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

/*
 * Nuovo questionario "Come va" (self-report del giocatore): sostituisce
 * il vecchio creaPostAllenamentoAction. Tre percorsi possibili, tutti
 * salvati sulla stessa tabella misurazioni_benessere:
 *   - campo:    seduta + minutaggio + RPE 1-10 + fastidio
 *   - palestra: seduta + minutaggio + RPE 1-10 + fastidio
 *   - mattino:  indice di Hooper, 4 valori 1-7 (sonno, stanchezza,
 *               indolenzimento, stress)
 */
export async function creaMisurazioneBenessereAction(
  formData: FormData,
): Promise<MisurazioniActionResult> {
  try {
    const { supabase, profilo } = await getCurrentContext();

    const tipoProfilo = String(
      profilo.tipo_profilo || "",
    ).toLowerCase();

    let giocatore: { id: string; squadra_id: string | null } | null = null;

    if (tipoProfilo === "giocatore") {
      const { data: giocatoreProprio, error: giocatoreError } =
        await supabase
          .from("giocatori")
          .select("id, squadra_id")
          .eq("id_atleta", profilo.id)
          .eq("club_id", profilo.last_club_id)
          .maybeSingle();

      if (giocatoreError || !giocatoreProprio) {
        return {
          success: false,
          message:
            "Il tuo profilo non è collegato a un giocatore della squadra attiva.",
        };
      }

      giocatore = giocatoreProprio;
    } else if (tipoProfilo === "admin") {
      // Lo staff può compilare il modulo per conto di un atleta (es.
      // seduta in campo, dispositivo condiviso): il giocatore va scelto
      // esplicitamente e deve appartenere al club/squadra attivi.
      const giocatoreId = getString(formData.get("giocatore_id"));

      if (!giocatoreId) {
        return {
          success: false,
          message: "Seleziona per quale atleta stai compilando il modulo.",
        };
      }

      let giocatoreQuery = supabase
        .from("giocatori")
        .select("id, squadra_id")
        .eq("id", giocatoreId)
        .eq("club_id", profilo.last_club_id);

      if (profilo.last_squadra_id) {
        giocatoreQuery = giocatoreQuery.eq(
          "squadra_id",
          profilo.last_squadra_id,
        );
      }

      const { data: giocatoreScelto, error: giocatoreError } =
        await giocatoreQuery.maybeSingle();

      if (giocatoreError || !giocatoreScelto) {
        return {
          success: false,
          message: "L'atleta selezionato non è valido.",
        };
      }

      giocatore = giocatoreScelto;
    } else {
      return {
        success: false,
        message:
          "Non hai i permessi per registrare questo tipo di stato.",
      };
    }

    if (!giocatore) {
      return { success: false, message: "Atleta non valido." };
    }

    const dataCompilazione =
      getString(formData.get("data_compilazione")) ||
      new Date().toISOString().slice(0, 10);

    const tipoCompilazione = getString(formData.get("tipo_compilazione"));

    if (!["campo", "palestra", "mattino"].includes(tipoCompilazione)) {
      return {
        success: false,
        message: "Indica cosa stai compilando.",
      };
    }

    function getScala(
      campo: string,
      etichetta: string,
      min: number,
      max: number,
    ): { valore: number } | { errore: string } {
      const valore = getNullableNumber(formData.get(campo));

      if (
        valore === null ||
        valore < min ||
        valore > max ||
        !Number.isInteger(valore)
      ) {
        return { errore: `Indica ${etichetta} (da ${min} a ${max}).` };
      }

      return { valore };
    }

    const payload: {
      club_id: string;
      squadra_id: string | null;
      giocatore_id: string;
      data_compilazione: string;
      tipo_compilazione: string;
      seduta: string | null;
      rpe: number | null;
      minutaggio_lavoro: number | null;
      fastidio: string | null;
      fastidio_dettaglio: string | null;
      sonno: number | null;
      stanchezza: number | null;
      indolenzimento: number | null;
      stress: number | null;
    } = {
      club_id: profilo.last_club_id,
      squadra_id: giocatore.squadra_id ?? null,
      giocatore_id: giocatore.id,
      data_compilazione: dataCompilazione,
      tipo_compilazione: tipoCompilazione,
      seduta: null,
      rpe: null,
      minutaggio_lavoro: null,
      fastidio: null,
      fastidio_dettaglio: null,
      sonno: null,
      stanchezza: null,
      indolenzimento: null,
      stress: null,
    };

    if (tipoCompilazione === "campo" || tipoCompilazione === "palestra") {
      const seduta = getString(formData.get("seduta"));

      if (!seduta) {
        return { success: false, message: "Indica quale seduta." };
      }

      const rpeRisultato = getScala(
        "rpe",
        "quanto è stata dura questa seduta",
        1,
        10,
      );

      if ("errore" in rpeRisultato) {
        return { success: false, message: rpeRisultato.errore };
      }

      const minutaggioRisultato = getScala(
        "minutaggio_lavoro",
        "il minutaggio di lavoro",
        1,
        600,
      );

      if ("errore" in minutaggioRisultato) {
        return { success: false, message: minutaggioRisultato.errore };
      }

      const fastidio = getString(formData.get("fastidio"));

      if (!["no", "leggero", "preoccupante"].includes(fastidio)) {
        return {
          success: false,
          message: "Indica se hai qualche fastidio o dolore.",
        };
      }

      payload.seduta = seduta;
      payload.rpe = rpeRisultato.valore;
      payload.minutaggio_lavoro = minutaggioRisultato.valore;
      payload.fastidio = fastidio;
      payload.fastidio_dettaglio =
        fastidio !== "no"
          ? getNullableString(formData.get("fastidio_dettaglio"))
          : null;
    } else {
      const sonnoRisultato = getScala("sonno", "come hai dormito", 1, 7);

      if ("errore" in sonnoRisultato) {
        return { success: false, message: sonnoRisultato.errore };
      }

      const stanchezzaRisultato = getScala(
        "stanchezza",
        "quanto sei stanco",
        1,
        7,
      );

      if ("errore" in stanchezzaRisultato) {
        return { success: false, message: stanchezzaRisultato.errore };
      }

      const indolenzimentoRisultato = getScala(
        "indolenzimento",
        "quanto hai i muscoli indolenziti",
        1,
        7,
      );

      if ("errore" in indolenzimentoRisultato) {
        return { success: false, message: indolenzimentoRisultato.errore };
      }

      const stressRisultato = getScala(
        "stress",
        "quanto sei stressato o nervoso",
        1,
        7,
      );

      if ("errore" in stressRisultato) {
        return { success: false, message: stressRisultato.errore };
      }

      payload.sonno = sonnoRisultato.valore;
      payload.stanchezza = stanchezzaRisultato.valore;
      payload.indolenzimento = indolenzimentoRisultato.valore;
      payload.stress = stressRisultato.valore;
    }

    const { error: insertError } = await supabase
      .from("misurazioni_benessere")
      .insert(payload);

    if (insertError) {
      console.error(
        "Errore inserimento misurazione benessere:",
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
      message: "Risposta salvata correttamente.",
    };
  } catch (error) {
    console.error("Errore creaMisurazioneBenessereAction:", error);

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

/*
 * Aggiorna una singola misurazione antropometrica già esistente.
 * Riservata all'admin, scoperta al club attivo (non è possibile
 * modificare misurazioni di un altro club tramite id).
 */
export async function aggiornaMisurazioneAntropometricaAction(
  formData: FormData,
): Promise<MisurazioniActionResult> {
  try {
    const { supabase, profilo } = await getCurrentContext();

    const tipoProfilo = String(
      profilo.tipo_profilo || "",
    ).toLowerCase();

    if (tipoProfilo !== "admin") {
      return {
        success: false,
        message:
          "Non hai i permessi per modificare misurazioni antropometriche.",
      };
    }

    const id = getString(formData.get("id"));

    if (!id) {
      return {
        success: false,
        message: "Misurazione non valida.",
      };
    }

    const dataMisurazione =
      getString(formData.get("data_misurazione")) ||
      new Date().toISOString().slice(0, 10);

    const pesoKg = getNullableNumber(formData.get("peso_kg"));
    const altezzaCm = getNullableNumber(formData.get("altezza_cm"));
    const massaGrassaPercentuale = getNullableNumber(
      formData.get("massa_grassa_percentuale"),
    );
    const circonferenzaVitaCm = getNullableNumber(
      formData.get("circonferenza_vita_cm"),
    );
    const note = getNullableString(formData.get("note"));

    const haAlmenoUnValore =
      pesoKg !== null ||
      altezzaCm !== null ||
      massaGrassaPercentuale !== null ||
      circonferenzaVitaCm !== null;

    if (!haAlmenoUnValore) {
      return {
        success: false,
        message: "Inserisci almeno un valore.",
      };
    }

    const { data: aggiornata, error: updateError } = await supabase
      .from("misurazioni_antropometriche")
      .update({
        data_misurazione: dataMisurazione,
        peso_kg: pesoKg,
        altezza_cm: altezzaCm,
        massa_grassa_percentuale: massaGrassaPercentuale,
        circonferenza_vita_cm: circonferenzaVitaCm,
        note,
      })
      .eq("id", id)
      .eq("club_id", profilo.last_club_id)
      .select("id")
      .maybeSingle();

    if (updateError) {
      console.error("Errore aggiornamento misurazione:", updateError);

      return {
        success: false,
        message: updateError.message,
      };
    }

    if (!aggiornata) {
      return {
        success: false,
        message:
          "Misurazione non trovata, oppure non hai i permessi per modificarla.",
      };
    }

    revalidatePath("/misurazioni");

    return {
      success: true,
      message: "Misurazione aggiornata correttamente.",
    };
  } catch (error) {
    console.error(
      "Errore aggiornaMisurazioneAntropometricaAction:",
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

/*
 * Elimina una singola misurazione antropometrica. Riservata all'admin,
 * scoperta al club attivo. Verifichiamo che la riga sia stata
 * effettivamente eliminata (una RLS troppo restrittiva potrebbe far
 * "riuscire" la query senza cancellare nulla).
 */
export async function eliminaMisurazioneAntropometricaAction(
  id: string,
): Promise<MisurazioniActionResult> {
  try {
    const { supabase, profilo } = await getCurrentContext();

    const tipoProfilo = String(
      profilo.tipo_profilo || "",
    ).toLowerCase();

    if (tipoProfilo !== "admin") {
      return {
        success: false,
        message:
          "Non hai i permessi per eliminare misurazioni antropometriche.",
      };
    }

    if (!id) {
      return {
        success: false,
        message: "Misurazione non valida.",
      };
    }

    const { data: eliminata, error: deleteError } = await supabase
      .from("misurazioni_antropometriche")
      .delete()
      .eq("id", id)
      .eq("club_id", profilo.last_club_id)
      .select("id");

    if (deleteError) {
      console.error("Errore eliminazione misurazione:", deleteError);

      return {
        success: false,
        message: deleteError.message,
      };
    }

    if (!eliminata || eliminata.length === 0) {
      return {
        success: false,
        message:
          "Misurazione non trovata, già eliminata, oppure non hai i permessi per eliminarla.",
      };
    }

    revalidatePath("/misurazioni");

    return {
      success: true,
      message: "Misurazione eliminata correttamente.",
    };
  } catch (error) {
    console.error(
      "Errore eliminaMisurazioneAntropometricaAction:",
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
