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

type TitolareManuale = {
  numeroMaglia: number;
  giocatoreId: string;
};

type CambioManuale = {
  minuto: number;
  giocatoreEntraId: string;
  giocatoreEsceId: string;
};

/*
 * Salva un minutaggio inserito manualmente dal popup "Aggiungi
 * Minutaggio" (senza file Excel): formazione titolare (1-15) + panchina
 * + eventuali sostituzioni. A differenza dell'import da file:
 *  - la partita è obbligatoria (non esiste uno stato "da associare");
 *  - la formazione inserita aggiorna anche partite_convocazioni (stessa
 *    tabella usata dal tab "Convocazioni" della partita), così titolari
 *    e panchina restano coerenti con quel tab e con il calcolo minutaggio
 *    (che legge i titolari da lì, vedi calcola-minutaggio.ts).
 */
export async function salvaMinutaggioManuale(input: {
  partitaId: string;
  durataMinuti: number;
  titolari: TitolareManuale[];
  panchina: string[];
  cambi: CambioManuale[];
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

    const titolari = (input.titolari ?? []).filter(
      (t) => t.giocatoreId && Number.isFinite(t.numeroMaglia)
    );

    const panchina = Array.from(
      new Set((input.panchina ?? []).filter((id) => id))
    );

    if (titolari.length === 0) {
      return {
        success: false,
        message: "Seleziona almeno un giocatore titolare.",
      };
    }

    const idTitolari = new Set(titolari.map((t) => t.giocatoreId));
    if (idTitolari.size !== titolari.length) {
      return {
        success: false,
        message: "Uno stesso giocatore è stato assegnato a più maglie.",
      };
    }

    const cambi = (input.cambi ?? []).filter(
      (c) =>
        c.giocatoreEntraId &&
        c.giocatoreEsceId &&
        c.giocatoreEntraId !== c.giocatoreEsceId &&
        Number.isFinite(c.minuto) &&
        c.minuto >= 0
    );

    const { data: partita, error: partitaError } = await supabase
      .from("partite")
      .select("id, club_id, squadra_id")
      .eq("id", partitaId)
      .eq("club_id", clubId)
      .maybeSingle();

    if (partitaError || !partita) {
      return { success: false, message: "La partita selezionata non è valida." };
    }

    // Aggiorna partite_convocazioni: titolari (con numero maglia) e
    // panchina (convocati, non titolari). La posizione in campo non è
    // gestita da questo popup (si può rifinire dal tab "Convocazioni"
    // della partita): tutti vengono salvati come "panchina", il flag
    // titolare/numero_maglia basta al calcolo del minutaggio.
    const righeConvocazioni = [
      ...titolari.map((t) => ({
        club_id: clubId,
        squadra_id: partita.squadra_id,
        partita_id: partita.id,
        giocatore_id: t.giocatoreId,
        convocato: true,
        titolare: true,
        capitano: false,
        vicecapitano: false,
        posizione: "panchina" as const,
        numero_maglia: t.numeroMaglia,
        ordine: null,
        ruolo_panchina: null,
        created_by: user.id,
        updated_at: new Date().toISOString(),
      })),
      ...panchina
        .filter((id) => !idTitolari.has(id))
        .map((giocatoreId) => ({
          club_id: clubId,
          squadra_id: partita.squadra_id,
          partita_id: partita.id,
          giocatore_id: giocatoreId,
          convocato: true,
          titolare: false,
          capitano: false,
          vicecapitano: false,
          posizione: "panchina" as const,
          numero_maglia: null,
          ordine: null,
          ruolo_panchina: null,
          created_by: user.id,
          updated_at: new Date().toISOString(),
        })),
    ];

    const { error: convocazioniError } = await supabase
      .from("partite_convocazioni")
      .upsert(righeConvocazioni, { onConflict: "partita_id,giocatore_id" });

    if (convocazioniError) {
      console.error(
        "Errore salvataggio convocazioni da minutaggio manuale:",
        convocazioniError
      );
      return { success: false, message: convocazioniError.message };
    }

    // Nomi (cognome) dei giocatori coinvolti nei cambi, solo per
    // popolare "nome_testo" (colonna NOT NULL, usata come riferimento
    // testuale leggibile, non per il calcolo).
    const idNomiNecessari = Array.from(
      new Set(cambi.flatMap((c) => [c.giocatoreEntraId, c.giocatoreEsceId]))
    );

    const nomiPerId = new Map<string, string>();

    if (idNomiNecessari.length > 0) {
      const { data: giocatoriNomi } = await supabase
        .from("giocatori")
        .select("id, nome, cognome")
        .in("id", idNomiNecessari);

      for (const g of giocatoriNomi ?? []) {
        nomiPerId.set(g.id, `${g.cognome ?? ""} ${g.nome ?? ""}`.trim());
      }
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

    if (cambi.length > 0) {
      const righeCambi = cambi.flatMap((cambio) => [
        {
          import_id: importCreato.id,
          club_id: clubId,
          giocatore_id: cambio.giocatoreEntraId,
          nome_testo: nomiPerId.get(cambio.giocatoreEntraId) || "Giocatore",
          minuto: cambio.minuto,
          tipo: "entra" as const,
        },
        {
          import_id: importCreato.id,
          club_id: clubId,
          giocatore_id: cambio.giocatoreEsceId,
          nome_testo: nomiPerId.get(cambio.giocatoreEsceId) || "Giocatore",
          minuto: cambio.minuto,
          tipo: "esce" as const,
        },
      ]);

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
