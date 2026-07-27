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

    const { error: presenzeError } = await supabase
      .from("presenze_allenamenti")
      .delete()
      .eq("allenamento_id", allenamentoId);

    if (presenzeError) {
      return { success: false, message: presenzeError.message };
    }

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
