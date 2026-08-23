// src/app/(dashboard)/allenamenti/[id]/actions.ts

"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase-server";

type LavoroInput = {
  id?: string;
  sezione: string;
  descrizione?: string | null;
  obbiettivo?: string | null;
  obbiettivo_tag?: string | null;
  rango?: string | null;
  immagine_lavoro?: string | null;
  tempo_lavoro?: number | null;
  ripetizione?: number | null;
  tempo_recupero?: number | null;
  tempo_totale?: number | null;
  contemporaneo?: boolean | null;
  gruppo_contemporaneo?: string | null;
  codice?: string | null;
  spazio?: string | null;
  materiale?: string | null;
  punti_chiave_coaching?: string | null;
  progressione?: string | null;
  riferimento_gps?: string | null;
  perche_serve?: string | null;
};

type AggiornaAllenamentoInput = {
  allenamento_id: string;
  titolo?: string | null;
  data_allenamento: string;
  tipo_allenamento?: string | null;
  ora_inizio?: string | null;
  ora_fine?: string | null;
  luogo?: string | null;
  obiettivo?: string | null;
  note?: string | null;
  lavori: LavoroInput[];
  lavoriEliminatiIds: string[];
};

type ActionResult = {
  success: boolean;
  message: string;
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
    throw new Error("Non hai i permessi per modificare questo allenamento.");
  }

  return {
    supabase,
    clubId: profilo.last_club_id as string,
    squadraId: profilo.last_squadra_id as string | null,
  };
}

export async function aggiornaAllenamento(
  input: AggiornaAllenamentoInput
): Promise<ActionResult> {
  try {
    const { supabase, clubId } = await getContestoAdmin();

    const { data: allenamento, error: allenamentoError } = await supabase
      .from("allenamenti")
      .select("id,club_id")
      .eq("id", input.allenamento_id)
      .eq("club_id", clubId)
      .maybeSingle();

    if (allenamentoError || !allenamento) {
      return { success: false, message: "Allenamento non trovato." };
    }

    if (!input.data_allenamento) {
      return {
        success: false,
        message: "Inserisci la data dell'allenamento.",
      };
    }

    const tempoTotaleLavori = input.lavori.reduce(
      (somma, lavoro) => somma + Number(lavoro.tempo_totale ?? 0),
      0
    );

    const { error: updateError } = await supabase
      .from("allenamenti")
      .update({
        titolo: input.titolo?.trim() || null,
        data_allenamento: input.data_allenamento,
        tipo_allenamento: input.tipo_allenamento?.trim() || null,
        ora_inizio: input.ora_inizio || null,
        ora_fine: input.ora_fine || null,
        luogo: input.luogo?.trim() || null,
        obiettivo: input.obiettivo?.trim() || null,
        note: input.note?.trim() || null,
        durata_minuti: tempoTotaleLavori || null,
        updated_at: new Date().toISOString(),
      })
      .eq("id", input.allenamento_id)
      .eq("club_id", clubId);

    if (updateError) {
      return { success: false, message: updateError.message };
    }

    if (input.lavoriEliminatiIds.length > 0) {
      const { error: deleteError } = await supabase
        .from("lavori_allenamento")
        .delete()
        .in("id", input.lavoriEliminatiIds)
        .eq("allenamento_id", input.allenamento_id);

      if (deleteError) {
        return { success: false, message: deleteError.message };
      }
    }

    // L'ordine deve riflettere la posizione reale nell'elenco mostrato in
    // UI (input.lavori), non l'ordine separato di "esistenti" ed "nuovi":
    // altrimenti, appena si aggiunge un lavoro nuovo in mezzo a lavori già
    // salvati (es. un lavoro parallelo di un gruppo contemporaneo), tutti
    // i nuovi finirebbero in coda scombinando la sequenza reale.
    const nuovi = input.lavori.filter((lavoro) => !lavoro.id);

    for (const [ordine, lavoro] of input.lavori.entries()) {
      if (!lavoro.id) continue;

      const { error } = await supabase
        .from("lavori_allenamento")
        .update({
          sezione: lavoro.sezione,
          descrizione: lavoro.descrizione || null,
          obbiettivo: lavoro.obbiettivo || null,
          obbiettivo_tag: lavoro.obbiettivo_tag || null,
          rango: lavoro.rango || null,
          immagine_lavoro: lavoro.immagine_lavoro || null,
          tempo_lavoro: lavoro.tempo_lavoro ?? null,
          ripetizione: lavoro.ripetizione ?? null,
          tempo_recupero: lavoro.tempo_recupero ?? null,
          tempo_totale: lavoro.tempo_totale ?? null,
          contemporaneo: lavoro.contemporaneo ?? false,
          gruppo_contemporaneo: lavoro.contemporaneo
            ? lavoro.gruppo_contemporaneo || null
            : null,
          codice: lavoro.codice || null,
          spazio: lavoro.spazio || null,
          materiale: lavoro.materiale || null,
          punti_chiave_coaching: lavoro.punti_chiave_coaching || null,
          progressione: lavoro.progressione || null,
          riferimento_gps: lavoro.riferimento_gps || null,
          perche_serve: lavoro.perche_serve || null,
          ordine,
        })
        .eq("id", lavoro.id)
        .eq("allenamento_id", input.allenamento_id);

      if (error) {
        return { success: false, message: error.message };
      }
    }

    if (nuovi.length > 0) {
      const { error } = await supabase.from("lavori_allenamento").insert(
        nuovi.map((lavoro) => ({
          allenamento_id: input.allenamento_id,
          sezione: lavoro.sezione,
          descrizione: lavoro.descrizione || null,
          obbiettivo: lavoro.obbiettivo || null,
          obbiettivo_tag: lavoro.obbiettivo_tag || null,
          rango: lavoro.rango || null,
          immagine_lavoro: lavoro.immagine_lavoro || null,
          tempo_lavoro: lavoro.tempo_lavoro ?? null,
          ripetizione: lavoro.ripetizione ?? null,
          tempo_recupero: lavoro.tempo_recupero ?? null,
          tempo_totale: lavoro.tempo_totale ?? null,
          contemporaneo: lavoro.contemporaneo ?? false,
          gruppo_contemporaneo: lavoro.contemporaneo
            ? lavoro.gruppo_contemporaneo || null
            : null,
          codice: lavoro.codice || null,
          spazio: lavoro.spazio || null,
          materiale: lavoro.materiale || null,
          punti_chiave_coaching: lavoro.punti_chiave_coaching || null,
          progressione: lavoro.progressione || null,
          riferimento_gps: lavoro.riferimento_gps || null,
          perche_serve: lavoro.perche_serve || null,
          ordine: input.lavori.indexOf(lavoro),
        }))
      );

      if (error) {
        return { success: false, message: error.message };
      }
    }

    revalidatePath("/allenamenti");
    revalidatePath(`/allenamenti/${input.allenamento_id}/modifica`);

    return {
      success: true,
      message: "Allenamento aggiornato correttamente.",
    };
  } catch (error) {
    return {
      success: false,
      message:
        error instanceof Error ? error.message : "Errore imprevisto.",
    };
  }
}

export async function eliminaAllenamento(
  allenamentoId: string
): Promise<ActionResult> {
  try {
    const { supabase, clubId } = await getContestoAdmin();

    const { data: allenamento, error: allenamentoError } = await supabase
      .from("allenamenti")
      .select("id")
      .eq("id", allenamentoId)
      .eq("club_id", clubId)
      .maybeSingle();

    if (allenamentoError || !allenamento) {
      return { success: false, message: "Allenamento non trovato." };
    }

    /*
     * Le presenze NON si cancellano piu' insieme alla seduta: da quando
     * vivono in presenze_giornaliere appartengono alla giornata, e la
     * stessa giornata puo' avere un'altra seduta (mattutina/serale).
     * Cancellarle qui farebbe sparire anche le presenze dell'altra
     * seduta. Se serve azzerare una giornata lo si fa dalla pagina
     * Allenamenti, giocatore per giocatore.
     */

    const { error: lavoriError } = await supabase
      .from("lavori_allenamento")
      .delete()
      .eq("allenamento_id", allenamentoId);

    if (lavoriError) {
      return { success: false, message: lavoriError.message };
    }

    const { error: deleteError } = await supabase
      .from("allenamenti")
      .delete()
      .eq("id", allenamentoId)
      .eq("club_id", clubId);

    if (deleteError) {
      return { success: false, message: deleteError.message };
    }

    revalidatePath("/allenamenti");

    return {
      success: true,
      message: "Allenamento eliminato correttamente.",
    };
  } catch (error) {
    return {
      success: false,
      message:
        error instanceof Error ? error.message : "Errore imprevisto.",
    };
  }
}

/*
 * Eliminazione in blocco di piu' sedute dalla pagina Allenamenti.
 *
 * Non e' un ciclo di eliminaAllenamento(): quello farebbe una coppia di
 * query per ogni seduta (con venti sedute selezionate sono quaranta
 * viaggi verso il database) e, soprattutto, non sarebbe atomico nel modo
 * che conta qui: se la nona fallisse, le prime otto sarebbero gia'
 * sparite e l'utente non saprebbe a che punto si e' fermato. Qui le
 * cancellazioni sono due sole, entrambe filtrate su un elenco di id gia'
 * verificato, e il risultato dice esattamente quante sedute sono state
 * eliminate.
 */
export async function eliminaAllenamentiInBlocco(
  allenamentoIds: string[]
): Promise<ActionResult & { eliminati: number }> {
  try {
    const { supabase, clubId } = await getContestoAdmin();

    // Ripulisce l'elenco: stringhe vuote, duplicati e valori non validi
    // arrivati dal client non devono finire in una clausola IN.
    const ids = Array.from(
      new Set(
        (allenamentoIds ?? [])
          .filter((id): id is string => typeof id === "string")
          .map((id) => id.trim())
          .filter((id) => id.length > 0)
      )
    );

    if (ids.length === 0) {
      return {
        success: false,
        message: "Nessuna seduta selezionata.",
        eliminati: 0,
      };
    }

    /*
     * Il filtro club_id non e' una formalita': senza, un id arrivato dal
     * client permetterebbe di cancellare la seduta di un altro club. Si
     * rileggono quindi gli id davvero appartenenti al club attivo e si
     * lavora solo su quelli.
     */
    const { data: appartenenti, error: verificaError } = await supabase
      .from("allenamenti")
      .select("id")
      .eq("club_id", clubId)
      .in("id", ids);

    if (verificaError) {
      return {
        success: false,
        message: verificaError.message,
        eliminati: 0,
      };
    }

    const idsValidi = (appartenenti ?? []).map((riga) => riga.id as string);

    if (idsValidi.length === 0) {
      return {
        success: false,
        message: "Nessuna delle sedute selezionate appartiene al club attivo.",
        eliminati: 0,
      };
    }

    // I lavori vanno prima: sono figli della seduta e senza di essa
    // resterebbero orfani.
    const { error: lavoriError } = await supabase
      .from("lavori_allenamento")
      .delete()
      .in("allenamento_id", idsValidi);

    if (lavoriError) {
      return {
        success: false,
        message: lavoriError.message,
        eliminati: 0,
      };
    }

    /*
     * Le presenze NON si toccano, per lo stesso motivo per cui non le
     * tocca eliminaAllenamento(): da quando vivono in
     * presenze_giornaliere appartengono alla GIORNATA, e la stessa
     * giornata puo' avere un'altra seduta. Cancellarle qui farebbe
     * sparire anche le presenze di una seduta che resta.
     */

    const { error: deleteError } = await supabase
      .from("allenamenti")
      .delete()
      .eq("club_id", clubId)
      .in("id", idsValidi);

    if (deleteError) {
      return {
        success: false,
        message: deleteError.message,
        eliminati: 0,
      };
    }

    revalidatePath("/allenamenti");

    // Se qualche id era gia' stato eliminato da un'altra scheda aperta,
    // il messaggio lo dice invece di far credere che siano sparite tutte.
    const ignorati = ids.length - idsValidi.length;

    return {
      success: true,
      eliminati: idsValidi.length,
      message:
        idsValidi.length === 1
          ? "1 seduta eliminata."
          : `${idsValidi.length} sedute eliminate.` +
            (ignorati > 0
              ? ` ${ignorati} non sono state trovate (forse gia' eliminate).`
              : ""),
    };
  } catch (error) {
    return {
      success: false,
      eliminati: 0,
      message:
        error instanceof Error ? error.message : "Errore imprevisto.",
    };
  }
}
