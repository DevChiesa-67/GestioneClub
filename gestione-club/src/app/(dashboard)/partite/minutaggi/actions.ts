"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase-server";

export type MinutaggioActionResult = {
  success: boolean;
  message: string;
  importId?: string;
};

type CambioDaSalvare = {
  nomeTesto: string;
  minuto: number;
  tipo: "entra" | "esce";
  giocatoreId: string | null;
};

async function getContestoAdmin() {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    throw new Error("Utente non autenticato.");
  }

  const { data: profilo, error } = await supabase
    .from("profili")
    .select("id,tipo_profilo,last_club_id,last_squadra_id")
    .eq("auth_user_id", user.id)
    .single();

  if (error || !profilo?.last_club_id) {
    throw new Error("Nessun club attivo selezionato.");
  }

  if (String(profilo.tipo_profilo || "").toLowerCase() !== "admin") {
    throw new Error("Non hai i permessi per gestire i minutaggi.");
  }

  return {
    supabase,
    user,
    clubId: profilo.last_club_id as string,
    squadraId: profilo.last_squadra_id as string | null,
  };
}

function parseCambi(raw: string): CambioDaSalvare[] {
  const parsed: unknown = JSON.parse(raw);
  if (!Array.isArray(parsed)) return [];

  return parsed
    .filter(
      (item): item is Record<string, unknown> =>
        typeof item === "object" && item !== null,
    )
    .map(
      (item): CambioDaSalvare => ({
        nomeTesto: String(item.nomeTesto ?? "").trim(),
        minuto: Number(item.minuto),
        tipo: item.tipo === "esce" ? "esce" : "entra",
        giocatoreId:
          typeof item.giocatoreId === "string" && item.giocatoreId
            ? item.giocatoreId
            : null,
      }),
    )
    .filter((item) => item.nomeTesto && Number.isFinite(item.minuto));
}

/*
 * Salva un nuovo import: carica il file originale su storage, crea la
 * riga di import (associata subito alla partita se già selezionata) e i
 * relativi eventi cambio (solo quelli risolti o esplicitamente ignorati
 * lato client: quelli con giocatoreId nullo restano comunque salvati come
 * riferimento testuale, ma non entrano nel calcolo minutaggio).
 */
export async function salvaMinutaggioImport(
  formData: FormData,
): Promise<MinutaggioActionResult> {
  try {
    const { supabase, user, clubId, squadraId } = await getContestoAdmin();

    const file = formData.get("file") as File | null;
    const partitaId = String(formData.get("partita_id") || "").trim() || null;
    const durataMinuti = Number(formData.get("durata_minuti")) || 80;
    const avversarioRilevato =
      String(formData.get("avversario_rilevato") || "").trim() || null;
    const dataRilevata =
      String(formData.get("data_rilevata") || "").trim() || null;
    const luogoRilevato =
      String(formData.get("luogo_rilevato") || "").trim() || null;
    const cambiRaw = String(formData.get("cambi") || "[]");

    if (!file || file.size === 0) {
      return { success: false, message: "Nessun file caricato." };
    }

    let cambi: CambioDaSalvare[];
    try {
      cambi = parseCambi(cambiRaw);
    } catch {
      return { success: false, message: "Dati cambi non validi." };
    }

    if (cambi.length === 0) {
      return {
        success: false,
        message: "Nessun cambio da salvare per questo file.",
      };
    }

    if (partitaId) {
      const { data: partita, error: partitaError } = await supabase
        .from("partite")
        .select("id")
        .eq("id", partitaId)
        .eq("club_id", clubId)
        .maybeSingle();

      if (partitaError || !partita) {
        return {
          success: false,
          message: "La partita selezionata non è valida.",
        };
      }
    }

    const estensione = file.name.split(".").pop() || "xlsx";
    const percorsoFile = `${clubId}/${crypto.randomUUID()}.${estensione}`;

    const { error: uploadError } = await supabase.storage
      .from("minutaggi-partite")
      .upload(percorsoFile, file, {
        cacheControl: "3600",
        upsert: false,
      });

    if (uploadError) {
      console.error("Errore upload file minutaggio:", uploadError);
      return { success: false, message: uploadError.message };
    }

    const { data: importCreato, error: importError } = await supabase
      .from("partite_minutaggi_import")
      .insert({
        club_id: clubId,
        squadra_id: squadraId,
        partita_id: partitaId,
        nome_file: file.name,
        file_path: percorsoFile,
        avversario_rilevato: avversarioRilevato,
        data_rilevata: dataRilevata,
        luogo_rilevato: luogoRilevato,
        durata_minuti: durataMinuti,
        stato: partitaId ? "associato" : "da_associare",
        created_by: user.id,
      })
      .select("id")
      .single();

    if (importError || !importCreato) {
      console.error("Errore creazione import minutaggio:", importError);

      await supabase.storage
        .from("minutaggi-partite")
        .remove([percorsoFile]);

      return {
        success: false,
        message: importError?.message || "Errore durante il salvataggio.",
      };
    }

    const righeCambi = cambi.map((cambio) => ({
      import_id: importCreato.id,
      club_id: clubId,
      giocatore_id: cambio.giocatoreId,
      nome_testo: cambio.nomeTesto,
      minuto: cambio.minuto,
      tipo: cambio.tipo,
    }));

    const { error: cambiError } = await supabase
      .from("partite_minutaggi_cambi")
      .insert(righeCambi);

    if (cambiError) {
      console.error("Errore salvataggio cambi minutaggio:", cambiError);

      await supabase
        .from("partite_minutaggi_import")
        .delete()
        .eq("id", importCreato.id);

      await supabase.storage
        .from("minutaggi-partite")
        .remove([percorsoFile]);

      return { success: false, message: cambiError.message };
    }

    revalidatePath("/partite");
    revalidatePath("/performance");

    return {
      success: true,
      message: partitaId
        ? "Minutaggio importato e associato alla partita."
        : "Minutaggio importato. Seleziona la partita corretta per associarlo.",
      importId: importCreato.id,
    };
  } catch (error) {
    console.error("Errore salvaMinutaggioImport:", error);

    return {
      success: false,
      message:
        error instanceof Error ? error.message : "Errore imprevisto.",
    };
  }
}

/*
 * Un evento singolo del minutaggio: un giocatore che entra o che esce a
 * un certo minuto. Le sostituzioni "classiche" sono semplicemente due
 * eventi con lo stesso minuto (uno "esce" + uno "entra"), ma i due lati
 * sono indipendenti: questo permette di far uscire un giocatore senza
 * sostituto (cartellino, infortunio in attesa) e soprattutto di farlo
 * RIENTRARE in campo più avanti nella partita, anche più volte
 * (calcolaMinutaggioPartita somma tutti gli intervalli, vedi
 * calcola-minutaggio.ts).
 *
 * `giocatoreId` nullo esiste solo per i cambi letti da un file Excel il
 * cui nome non è stato collegato a nessun giocatore: non entrano nel
 * calcolo, ma vanno conservati quando si aggiorna un import da file.
 */
export type EventoMinutaggioInput = {
  minuto: number;
  giocatoreId: string | null;
  tipo: "entra" | "esce";
  nomeTesto?: string | null;
};

type RigaCambioDb = {
  import_id: string;
  club_id: string;
  giocatore_id: string | null;
  nome_testo: string;
  minuto: number;
  tipo: "entra" | "esce";
};

type SupabaseClient = Awaited<ReturnType<typeof createClient>>;

function filtraEventiValidi(
  eventi: EventoMinutaggioInput[] | undefined,
): EventoMinutaggioInput[] {
  return (eventi ?? []).filter(
    (evento) =>
      (evento.tipo === "entra" || evento.tipo === "esce") &&
      Number.isFinite(Number(evento.minuto)) &&
      Number(evento.minuto) >= 0 &&
      (Boolean(evento.giocatoreId) || Boolean(evento.nomeTesto)),
  );
}

/*
 * Trasforma gli eventi in righe di partite_minutaggi_cambi. `nome_testo`
 * è NOT NULL e serve solo da riferimento leggibile: per gli eventi
 * collegati a un giocatore lo ricaviamo dall'anagrafica, per quelli che
 * arrivano da un file conserviamo il testo originale.
 */
async function costruisciRigheCambi(
  supabase: SupabaseClient,
  clubId: string,
  importId: string,
  eventi: EventoMinutaggioInput[],
): Promise<RigaCambioDb[]> {
  const idNecessari = Array.from(
    new Set(
      eventi
        .map((evento) => evento.giocatoreId)
        .filter((id): id is string => Boolean(id)),
    ),
  );

  const nomiPerId = new Map<string, string>();

  if (idNecessari.length > 0) {
    const { data: giocatoriNomi } = await supabase
      .from("giocatori")
      .select("id, nome, cognome")
      .in("id", idNecessari);

    for (const g of giocatoriNomi ?? []) {
      nomiPerId.set(g.id, `${g.cognome ?? ""} ${g.nome ?? ""}`.trim());
    }
  }

  return eventi.map((evento) => ({
    import_id: importId,
    club_id: clubId,
    giocatore_id: evento.giocatoreId ?? null,
    nome_testo:
      (evento.giocatoreId ? nomiPerId.get(evento.giocatoreId) : null) ||
      evento.nomeTesto ||
      "Giocatore",
    minuto: Number(evento.minuto),
    tipo: evento.tipo,
  }));
}

/*
 * Salva un minutaggio inserito manualmente dal popup "Aggiungi
 * Minutaggio" (senza file Excel): solo gli eventi entra/esce, perché la
 * formazione (titolari 1-15 + panchina) viene ereditata da
 * partite_convocazioni — stessa tabella già gestita dal tab
 * "Convocazioni" della partita e già letta da calcolaMinutaggioPartita
 * (vedi calcola-minutaggio.ts) — e non è modificabile da qui: va
 * impostata prima nel tab Convocazioni della partita.
 * A differenza dell'import da file, qui la partita è sempre obbligatoria
 * (non esiste uno stato "da associare").
 */
export async function salvaMinutaggioManuale(input: {
  partitaId: string;
  durataMinuti: number;
  eventi: EventoMinutaggioInput[];
}): Promise<MinutaggioActionResult> {
  try {
    const { supabase, user, clubId } = await getContestoAdmin();

    const partitaId = input.partitaId?.trim();

    if (!partitaId) {
      return { success: false, message: "Seleziona la partita." };
    }

    const durataMinuti =
      Number.isFinite(input.durataMinuti) && input.durataMinuti > 0
        ? input.durataMinuti
        : 80;

    const eventi = filtraEventiValidi(input.eventi);

    const { data: partita, error: partitaError } = await supabase
      .from("partite")
      .select("id, club_id, squadra_id")
      .eq("id", partitaId)
      .eq("club_id", clubId)
      .maybeSingle();

    if (partitaError || !partita) {
      return { success: false, message: "La partita selezionata non è valida." };
    }

    // La formazione è ereditata da partite_convocazioni e non si
    // modifica da questo popup: verifichiamo comunque lato server che
    // esista almeno un titolare, altrimenti il calcolo minutaggio non
    // avrebbe nessuna base da cui partire (difesa in profondità, oltre
    // al blocco già presente lato client).
    const { count: numeroTitolari, error: titolariError } = await supabase
      .from("partite_convocazioni")
      .select("id", { count: "exact", head: true })
      .eq("partita_id", partitaId)
      .eq("club_id", clubId)
      .eq("titolare", true);

    if (titolariError) {
      return { success: false, message: titolariError.message };
    }

    if (!numeroTitolari || numeroTitolari === 0) {
      return {
        success: false,
        message:
          "Questa partita non ha ancora una formazione salvata: impostala prima nel tab Convocazioni della partita.",
      };
    }

    const { data: importCreato, error: importError } = await supabase
      .from("partite_minutaggi_import")
      .insert({
        club_id: clubId,
        squadra_id: partita.squadra_id,
        partita_id: partita.id,
        nome_file: "Inserimento manuale",
        file_path: null,
        durata_minuti: durataMinuti,
        stato: "associato",
        created_by: user.id,
      })
      .select("id")
      .single();

    if (importError || !importCreato) {
      console.error("Errore creazione minutaggio manuale:", importError);
      return {
        success: false,
        message: importError?.message || "Errore durante il salvataggio.",
      };
    }

    if (eventi.length > 0) {
      const righeCambi = await costruisciRigheCambi(
        supabase,
        clubId,
        importCreato.id,
        eventi,
      );

      const { error: cambiError } = await supabase
        .from("partite_minutaggi_cambi")
        .insert(righeCambi);

      if (cambiError) {
        console.error("Errore salvataggio cambi minutaggio manuale:", cambiError);

        await supabase
          .from("partite_minutaggi_import")
          .delete()
          .eq("id", importCreato.id);

        return { success: false, message: cambiError.message };
      }
    }

    revalidatePath("/partite");
    revalidatePath("/performance");
    revalidatePath(`/partite/${partitaId}`);

    return {
      success: true,
      message: "Minutaggio inserito e associato alla partita.",
      importId: importCreato.id,
    };
  } catch (error) {
    console.error("Errore salvaMinutaggioManuale:", error);

    return {
      success: false,
      message: error instanceof Error ? error.message : "Errore imprevisto.",
    };
  }
}

/*
 * Aggiorna un minutaggio già salvato: durata della partita ed elenco
 * degli eventi entra/esce. Funziona sia sugli inserimenti manuali sia
 * sugli import da file — in quel caso il file originale resta allegato e
 * scaricabile, si riscrivono solo i cambi.
 *
 * I cambi vengono sostituiti in blocco (cancella + reinserisci) perché
 * l'editor lavora su una lista, non su singole righe identificate. Se
 * l'inserimento fallisce ripristiniamo le righe precedenti, così un
 * errore a metà non lascia il minutaggio svuotato.
 */
export async function aggiornaMinutaggioManuale(input: {
  importId: string;
  durataMinuti: number;
  eventi: EventoMinutaggioInput[];
}): Promise<MinutaggioActionResult> {
  try {
    const { supabase, clubId } = await getContestoAdmin();

    const importId = input.importId?.trim();

    if (!importId) {
      return { success: false, message: "Minutaggio non valido." };
    }

    const { data: importRow, error: importError } = await supabase
      .from("partite_minutaggi_import")
      .select("id, partita_id")
      .eq("id", importId)
      .eq("club_id", clubId)
      .maybeSingle();

    if (importError || !importRow) {
      return { success: false, message: "Minutaggio non trovato." };
    }

    const durataMinuti =
      Number.isFinite(input.durataMinuti) && input.durataMinuti > 0
        ? input.durataMinuti
        : 80;

    const eventi = filtraEventiValidi(input.eventi);

    const { data: cambiPrecedenti } = await supabase
      .from("partite_minutaggi_cambi")
      .select("import_id, club_id, giocatore_id, nome_testo, minuto, tipo")
      .eq("import_id", importId);

    const { error: deleteError } = await supabase
      .from("partite_minutaggi_cambi")
      .delete()
      .eq("import_id", importId)
      .eq("club_id", clubId);

    if (deleteError) {
      return { success: false, message: deleteError.message };
    }

    if (eventi.length > 0) {
      const righeCambi = await costruisciRigheCambi(
        supabase,
        clubId,
        importId,
        eventi,
      );

      const { error: cambiError } = await supabase
        .from("partite_minutaggi_cambi")
        .insert(righeCambi);

      if (cambiError) {
        console.error("Errore aggiornamento cambi minutaggio:", cambiError);

        if (cambiPrecedenti && cambiPrecedenti.length > 0) {
          await supabase
            .from("partite_minutaggi_cambi")
            .insert(cambiPrecedenti);
        }

        return { success: false, message: cambiError.message };
      }
    }

    const { error: updateError } = await supabase
      .from("partite_minutaggi_import")
      .update({
        durata_minuti: durataMinuti,
        updated_at: new Date().toISOString(),
      })
      .eq("id", importId)
      .eq("club_id", clubId);

    if (updateError) {
      return { success: false, message: updateError.message };
    }

    revalidatePath("/partite");
    revalidatePath("/performance");

    if (importRow.partita_id) {
      revalidatePath(`/partite/${importRow.partita_id}`);
    }

    return { success: true, message: "Minutaggio aggiornato." };
  } catch (error) {
    console.error("Errore aggiornaMinutaggioManuale:", error);

    return {
      success: false,
      message: error instanceof Error ? error.message : "Errore imprevisto.",
    };
  }
}

/*
 * Associa (o riassocia) un import già esistente a una partita, per il
 * caso in cui non sia stata trovata automaticamente al momento del
 * caricamento.
 */
export async function associaMinutaggioImport(
  importId: string,
  partitaId: string,
): Promise<MinutaggioActionResult> {
  try {
    const { supabase, clubId } = await getContestoAdmin();

    const { data: partita, error: partitaError } = await supabase
      .from("partite")
      .select("id")
      .eq("id", partitaId)
      .eq("club_id", clubId)
      .maybeSingle();

    if (partitaError || !partita) {
      return { success: false, message: "Partita non valida." };
    }

    const { data: aggiornato, error: updateError } = await supabase
      .from("partite_minutaggi_import")
      .update({
        partita_id: partitaId,
        stato: "associato",
        updated_at: new Date().toISOString(),
      })
      .eq("id", importId)
      .eq("club_id", clubId)
      .select("id")
      .maybeSingle();

    if (updateError) {
      return { success: false, message: updateError.message };
    }

    if (!aggiornato) {
      return { success: false, message: "Import non trovato." };
    }

    revalidatePath("/partite");
    revalidatePath("/performance");

    return { success: true, message: "Minutaggio associato alla partita." };
  } catch (error) {
    console.error("Errore associaMinutaggioImport:", error);

    return {
      success: false,
      message:
        error instanceof Error ? error.message : "Errore imprevisto.",
    };
  }
}

export async function eliminaMinutaggioImport(
  importId: string,
): Promise<MinutaggioActionResult> {
  try {
    const { supabase, clubId } = await getContestoAdmin();

    const { data: importRow, error: fetchError } = await supabase
      .from("partite_minutaggi_import")
      .select("id, file_path")
      .eq("id", importId)
      .eq("club_id", clubId)
      .maybeSingle();

    if (fetchError || !importRow) {
      return { success: false, message: "Import non trovato." };
    }

    const { error: deleteError } = await supabase
      .from("partite_minutaggi_import")
      .delete()
      .eq("id", importId)
      .eq("club_id", clubId);

    if (deleteError) {
      return { success: false, message: deleteError.message };
    }

    if (importRow.file_path) {
      await supabase.storage
        .from("minutaggi-partite")
        .remove([importRow.file_path]);
    }

    revalidatePath("/partite");
    revalidatePath("/performance");

    return { success: true, message: "Minutaggio eliminato." };
  } catch (error) {
    console.error("Errore eliminaMinutaggioImport:", error);

    return {
      success: false,
      message:
        error instanceof Error ? error.message : "Errore imprevisto.",
    };
  }
}
