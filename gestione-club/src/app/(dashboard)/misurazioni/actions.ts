"use server";

import { revalidatePath } from "next/cache";

import { createClient } from "@/lib/supabase-server";

export type MisurazioniActionResult = {
  success: boolean;
  message: string;
  inserimenti?: number;
};

function getString(value: FormDataEntryValue | null): string {
  return typeof value === "string" ? value.trim() : "";
}

function getNullableString(
  value: FormDataEntryValue | null,
): string | null {
  const normalized = getString(value);
  return normalized || null;
}

function getNullableNumber(
  value: FormDataEntryValue | null,
): number | null {
  const normalized = getString(value).replace(",", ".");

  if (!normalized) {
    return null;
  }

  const parsed = Number(normalized);

  return Number.isFinite(parsed) ? parsed : null;
}

function parseGiocatoriIds(value: FormDataEntryValue | null): string[] {
  const rawValue = getString(value);

  if (!rawValue) {
    return [];
  }

  try {
    const parsed: unknown = JSON.parse(rawValue);

    if (!Array.isArray(parsed)) {
      return [];
    }

    return [
      ...new Set(
        parsed.filter(
          (item): item is string =>
            typeof item === "string" && item.trim().length > 0,
        ),
      ),
    ];
  } catch {
    return [];
  }
}

async function getCurrentContext() {
  const supabase = await createClient();

  const {
    data: { user },
    error: userError,
  } = await supabase.auth.getUser();

  if (userError || !user) {
    throw new Error("Utente non autenticato.");
  }

  const { data: profilo, error: profiloError } = await supabase
    .from("profili")
    .select("id, tipo_profilo, last_club_id, last_squadra_id")
    .eq("auth_user_id", user.id)
    .single();

  if (profiloError || !profilo) {
    throw new Error("Profilo non trovato.");
  }

  if (!profilo.last_club_id) {
    throw new Error("Nessun club attivo selezionato.");
  }

  return {
    supabase,
    user,
    profilo,
  };
}

/*
 * Auto-compilazione dello stato post-allenamento da parte del
 * giocatore stesso (self-report), non un'azione di gestione
 * riservata all'admin: ogni giocatore può inserire solo il
 * proprio stato, collegato tramite giocatori.user_id.
 */
export async function creaPostAllenamentoAction(
  formData: FormData,
): Promise<MisurazioniActionResult> {
  try {
    const { supabase, user, profilo } = await getCurrentContext();

    const tipoProfilo = String(
      profilo.tipo_profilo || "",
    ).toLowerCase();

    if (tipoProfilo !== "giocatore") {
      return {
        success: false,
        message:
          "Solo un giocatore può registrare il proprio stato post allenamento.",
      };
    }

    const { data: giocatore, error: giocatoreError } = await supabase
      .from("giocatori")
      .select("id, squadra_id")
      .eq("id_atleta", profilo.id)
      .eq("club_id", profilo.last_club_id)
      .maybeSingle();

    if (giocatoreError || !giocatore) {
      return {
        success: false,
        message:
          "Il tuo profilo non è collegato a un giocatore della squadra attiva.",
      };
    }

    const dataCompilazione =
      getString(formData.get("data_compilazione")) ||
      new Date().toISOString().slice(0, 10);

    /*
     * Solo 3 domande al giocatore, tutte su scala 1-5:
     * 1. Come hai dormito -> qualita_sonno
     * 2. Come ti senti -> umore
     * 3. Hai dolori muscolari -> dolore_muscolare (+ zona_dolore se > 1)
     */
    function getScala1a5(
      campo: string,
      etichetta: string,
    ): { valore: number } | { errore: string } {
      const valore = getNullableNumber(formData.get(campo));

      if (
        valore === null ||
        valore < 1 ||
        valore > 5 ||
        !Number.isInteger(valore)
      ) {
        return { errore: `Indica ${etichetta} (da 1 a 5).` };
      }

      return { valore };
    }

    const sonnoRisultato = getScala1a5("qualita_sonno", "come hai dormito");

    if ("errore" in sonnoRisultato) {
      return { success: false, message: sonnoRisultato.errore };
    }

    const umoreRisultato = getScala1a5("umore", "come ti senti");

    if ("errore" in umoreRisultato) {
      return { success: false, message: umoreRisultato.errore };
    }

    const doloreRisultato = getScala1a5(
      "dolore_muscolare",
      "il livello di dolori muscolari",
    );

    if ("errore" in doloreRisultato) {
      return { success: false, message: doloreRisultato.errore };
    }

    const qualitaSonno = sonnoRisultato.valore;
    const umore = umoreRisultato.valore;
    const doloreMuscolare = doloreRisultato.valore;
    const doloreProvocato = doloreMuscolare > 1;

    const { error: insertError } = await supabase
      .from("misurazioni_post_allenamento")
      .insert({
        club_id: profilo.last_club_id,
        squadra_id: giocatore.squadra_id ?? null,
        giocatore_id: giocatore.id,
        data_compilazione: dataCompilazione,
        umore,
        qualita_sonno: qualitaSonno,
        dolore_muscolare: doloreMuscolare,
        dolore_presente: doloreProvocato,
        zona_dolore: doloreProvocato
          ? getNullableString(formData.get("zona_dolore"))
          : null,
      });

    if (insertError) {
      console.error(
        "Errore inserimento post allenamento:",
        insertError,
      );

      return {
        success: false,
        message: insertError.message,
      };
    }

    revalidatePath("/misurazioni");

    return {
      success: true,
      message: "Stato post allenamento salvato correttamente.",
    };
  } catch (error) {
    console.error("Errore creaPostAllenamentoAction:", error);

    return {
      success: false,
      message:
        error instanceof Error
          ? error.message
          : "Errore imprevisto.",
    };
  }
}

export async function creaMisurazioneAntropometricaAction(
  formData: FormData,
): Promise<MisurazioniActionResult> {
  try {
    const { supabase, user, profilo } =
      await getCurrentContext();

    const tipoProfilo = String(
      profilo.tipo_profilo || "",
    ).toLowerCase();

    if (tipoProfilo !== "admin") {
      return {
        success: false,
        message:
          "Non hai i permessi per inserire misurazioni antropometriche.",
      };
    }

    const giocatoriIds = parseGiocatoriIds(
      formData.get("giocatori_ids"),
    );

    if (giocatoriIds.length === 0) {
      return {
        success: false,
        message: "Seleziona almeno un giocatore.",
      };
    }

    /*
     * Recuperiamo esclusivamente giocatori appartenenti
     * al club e alla squadra attivi.
     */
    let giocatoriQuery = supabase
      .from("giocatori")
      .select("id, squadra_id, nome, cognome")
      .eq("club_id", profilo.last_club_id)
      .eq("attivo", true)
      .in("id", giocatoriIds);

    if (profilo.last_squadra_id) {
      giocatoriQuery = giocatoriQuery.eq(
        "squadra_id",
        profilo.last_squadra_id,
      );
    }

    const {
      data: giocatoriValidi,
      error: giocatoriError,
    } = await giocatoriQuery;

    if (giocatoriError) {
      console.error(
        "Errore verifica giocatori:",
        giocatoriError,
      );

      return {
        success: false,
        message:
          "Errore durante la verifica dei giocatori selezionati.",
      };
    }

    if (
      !giocatoriValidi ||
      giocatoriValidi.length !== giocatoriIds.length
    ) {
      return {
        success: false,
        message:
          "Uno o più giocatori non appartengono al club o alla squadra attiva.",
      };
    }

    const dataMisurazione =
      getString(formData.get("data_misurazione")) ||
      new Date().toISOString().slice(0, 10);

    const righeDaInserire = giocatoriValidi
      .map((giocatore) => {
        const pesoKg = getNullableNumber(
          formData.get(`peso_kg__${giocatore.id}`),
        );

        const altezzaCm = getNullableNumber(
          formData.get(`altezza_cm__${giocatore.id}`),
        );

        const massaGrassaPercentuale = getNullableNumber(
          formData.get(
            `massa_grassa_percentuale__${giocatore.id}`,
          ),
        );

        const circonferenzaVitaCm = getNullableNumber(
          formData.get(
            `circonferenza_vita_cm__${giocatore.id}`,
          ),
        );

        const note = getNullableString(
          formData.get(`note__${giocatore.id}`),
        );

        const haAlmenoUnValore =
          pesoKg !== null ||
          altezzaCm !== null ||
          massaGrassaPercentuale !== null ||
          circonferenzaVitaCm !== null;

        if (!haAlmenoUnValore) {
          return null;
        }

        return {
          club_id: profilo.last_club_id,
          squadra_id:
            profilo.last_squadra_id ??
            giocatore.squadra_id ??
            null,
          giocatore_id: giocatore.id,
          data_misurazione: dataMisurazione,
          peso_kg: pesoKg,
          altezza_cm: altezzaCm,
          massa_grassa_percentuale:
            massaGrassaPercentuale,
          circonferenza_vita_cm:
            circonferenzaVitaCm,
          note,
          registrato_da: user.id,
        };
      })
      .filter(
        (
          riga,
        ): riga is NonNullable<typeof riga> =>
          riga !== null,
      );

    if (righeDaInserire.length === 0) {
      return {
        success: false,
        message:
          "Inserisci almeno un valore per uno dei giocatori selezionati.",
      };
    }

    const { error: insertError } = await supabase
      .from("misurazioni_antropometriche")
      .insert(righeDaInserire);

    if (insertError) {
      console.error(
        "Errore inserimento misurazioni:",
        insertError,
      );

      return {
        success: false,
        message: insertError.message,
      };
    }

    revalidatePath("/misurazioni");

    const giocatoriSaltati =
      giocatoriValidi.length - righeDaInserire.length;

    return {
      success: true,
      inserimenti: righeDaInserire.length,
      message:
        giocatoriSaltati > 0
          ? `${righeDaInserire.length} misurazioni salvate. ${giocatoriSaltati} giocatori ignorati perché senza valori.`
          : `${righeDaInserire.length} misurazioni salvate correttamente.`,
    };
  } catch (error) {
    console.error(
      "Errore creaMisurazioneAntropometricaAction:",
      error,
    );

    return {
      success: false,
      message:
        error instanceof Error
          ? error.message
          : "Errore imprevisto.",
    };
  }
}