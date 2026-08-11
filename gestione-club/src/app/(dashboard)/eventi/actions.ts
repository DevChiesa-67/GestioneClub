"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase-server";

export type EventoActionResult = {
  success: boolean;
  message: string;
  id?: string;
};

const BUCKET_LOGHI = "club-loghi";

/*
 * Carica il logo di un evento nello stesso bucket pubblico già usato per
 * i loghi del club (cartella "eventi" per non mischiarli). Ritorna null
 * se non c'è nessun file (permette di lasciare l'evento senza logo).
 */
async function uploadLogoEvento(
  supabase: Awaited<ReturnType<typeof createClient>>,
  file: File | null
): Promise<string | null> {
  if (!file || file.size === 0) return null;

  const ext = file.name.split(".").pop() || "png";
  const path = `eventi/${crypto.randomUUID()}.${ext}`;

  const { error } = await supabase.storage
    .from(BUCKET_LOGHI)
    .upload(path, file, {
      cacheControl: "3600",
      upsert: false,
    });

  if (error) throw new Error(error.message);

  const { data } = supabase.storage.from(BUCKET_LOGHI).getPublicUrl(path);

  return data.publicUrl;
}

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
    throw new Error("Non hai i permessi per gestire gli eventi.");
  }

  return {
    supabase,
    user,
    clubId: profilo.last_club_id as string,
    squadraId: profilo.last_squadra_id as string | null,
  };
}

function getString(value: FormDataEntryValue | null): string {
  return typeof value === "string" ? value.trim() : "";
}

/*
 * Nuova tipologia di evento (es. "Torneo", "Raduno", "Team building"),
 * creata al volo dall'admin dal popup "Crea evento".
 */
export async function creaTipoEvento(
  formData: FormData,
): Promise<EventoActionResult> {
  try {
    const { supabase, clubId } = await getContestoAdmin();

    const nome = getString(formData.get("nome"));
    const colore = getString(formData.get("colore")) || null;

    if (!nome) {
      return { success: false, message: "Inserisci il nome della tipologia." };
    }

    const { data, error } = await supabase
      .from("tipi_eventi")
      .insert({
        club_id: clubId,
        nome,
        colore,
      })
      .select("id")
      .single();

    if (error) {
      if (error.code === "23505") {
        return {
          success: false,
          message: `Esiste già una tipologia "${nome}".`,
        };
      }

      console.error("Errore creazione tipo evento:", error);
      return { success: false, message: error.message };
    }

    revalidatePath("/partite");

    return { success: true, message: "Tipologia creata.", id: data.id };
  } catch (error) {
    console.error("Errore creaTipoEvento:", error);

    return {
      success: false,
      message: error instanceof Error ? error.message : "Errore imprevisto.",
    };
  }
}

export async function creaEvento(
  formData: FormData,
): Promise<EventoActionResult> {
  try {
    const { supabase, user, clubId, squadraId } = await getContestoAdmin();

    const titolo = getString(formData.get("titolo"));
    const tipoEventoId = getString(formData.get("tipo_evento_id"));
    const dataInizio = getString(formData.get("data_inizio"));
    const dataFine = getString(formData.get("data_fine")) || null;
    const oraInizio = getString(formData.get("ora_inizio")) || null;
    const oraFine = getString(formData.get("ora_fine")) || null;
    const luogo = getString(formData.get("luogo")) || null;
    const note = getString(formData.get("note")) || null;
    const logoFile = formData.get("logo");

    if (!titolo) {
      return { success: false, message: "Inserisci il titolo dell'evento." };
    }

    if (!tipoEventoId) {
      return { success: false, message: "Seleziona la tipologia di evento." };
    }

    if (!dataInizio) {
      return { success: false, message: "Indica la data di inizio." };
    }

    if (dataFine && dataFine < dataInizio) {
      return {
        success: false,
        message: "La data di fine non può precedere quella di inizio.",
      };
    }

    if (oraInizio && oraFine && oraFine <= oraInizio) {
      return {
        success: false,
        message: "L'ora di fine deve essere successiva a quella di inizio.",
      };
    }

    const { data: tipoValido, error: tipoError } = await supabase
      .from("tipi_eventi")
      .select("id")
      .eq("id", tipoEventoId)
      .eq("club_id", clubId)
      .maybeSingle();

    if (tipoError || !tipoValido) {
      return { success: false, message: "Tipologia di evento non valida." };
    }

    const logoUrl = await uploadLogoEvento(
      supabase,
      logoFile instanceof File ? logoFile : null
    );

    const { data, error } = await supabase
      .from("eventi")
      .insert({
        club_id: clubId,
        squadra_id: squadraId,
        tipo_evento_id: tipoEventoId,
        titolo,
        data_inizio: dataInizio,
        data_fine: dataFine,
        ora_inizio: oraInizio,
        ora_fine: oraFine,
        logo_url: logoUrl,
        luogo,
        note,
        created_by: user.id,
      })
      .select("id")
      .single();

    if (error) {
      console.error("Errore creazione evento:", error);
      return { success: false, message: error.message };
    }

    revalidatePath("/partite");
    revalidatePath("/dashboard");

    return { success: true, message: "Evento creato.", id: data.id };
  } catch (error) {
    console.error("Errore creaEvento:", error);

    return {
      success: false,
      message: error instanceof Error ? error.message : "Errore imprevisto.",
    };
  }
}

export async function aggiornaEvento(
  formData: FormData,
): Promise<EventoActionResult> {
  try {
    const { supabase, clubId } = await getContestoAdmin();

    const id = getString(formData.get("id"));
    const titolo = getString(formData.get("titolo"));
    const tipoEventoId = getString(formData.get("tipo_evento_id"));
    const dataInizio = getString(formData.get("data_inizio"));
    const dataFine = getString(formData.get("data_fine")) || null;
    const oraInizio = getString(formData.get("ora_inizio")) || null;
    const oraFine = getString(formData.get("ora_fine")) || null;
    const luogo = getString(formData.get("luogo")) || null;
    const note = getString(formData.get("note")) || null;
    const logoFile = formData.get("logo");
    const rimuoviLogo = getString(formData.get("rimuovi_logo")) === "1";

    if (!id) {
      return { success: false, message: "Evento non valido." };
    }

    if (!titolo) {
      return { success: false, message: "Inserisci il titolo dell'evento." };
    }

    if (!dataInizio) {
      return { success: false, message: "Indica la data di inizio." };
    }

    if (dataFine && dataFine < dataInizio) {
      return {
        success: false,
        message: "La data di fine non può precedere quella di inizio.",
      };
    }

    if (oraInizio && oraFine && oraFine <= oraInizio) {
      return {
        success: false,
        message: "L'ora di fine deve essere successiva a quella di inizio.",
      };
    }

    // Il logo si aggiorna solo se viene caricato un nuovo file, o si
    // rimuove esplicitamente con "rimuovi_logo": altrimenti resta quello
    // già salvato (non lo tocchiamo per non perderlo a ogni modifica).
    const nuovoLogoUrl = await uploadLogoEvento(
      supabase,
      logoFile instanceof File ? logoFile : null
    );

    const aggiornamento: Record<string, unknown> = {
      titolo,
      tipo_evento_id: tipoEventoId,
      data_inizio: dataInizio,
      data_fine: dataFine,
      ora_inizio: oraInizio,
      ora_fine: oraFine,
      luogo,
      note,
      updated_at: new Date().toISOString(),
    };

    if (nuovoLogoUrl) {
      aggiornamento.logo_url = nuovoLogoUrl;
    } else if (rimuoviLogo) {
      aggiornamento.logo_url = null;
    }

    const { error } = await supabase
      .from("eventi")
      .update(aggiornamento)
      .eq("id", id)
      .eq("club_id", clubId);

    if (error) {
      console.error("Errore aggiornamento evento:", error);
      return { success: false, message: error.message };
    }

    revalidatePath("/partite");
    revalidatePath(`/eventi/${id}`);
    revalidatePath("/dashboard");

    return { success: true, message: "Evento aggiornato." };
  } catch (error) {
    console.error("Errore aggiornaEvento:", error);

    return {
      success: false,
      message: error instanceof Error ? error.message : "Errore imprevisto.",
    };
  }
}

export async function eliminaEvento(id: string): Promise<EventoActionResult> {
  try {
    const { supabase, clubId } = await getContestoAdmin();

    const { error } = await supabase
      .from("eventi")
      .delete()
      .eq("id", id)
      .eq("club_id", clubId);

    if (error) {
      console.error("Errore eliminazione evento:", error);
      return { success: false, message: error.message };
    }

    revalidatePath("/partite");
    revalidatePath("/dashboard");

    return { success: true, message: "Evento eliminato." };
  } catch (error) {
    console.error("Errore eliminaEvento:", error);

    return {
      success: false,
      message: error instanceof Error ? error.message : "Errore imprevisto.",
    };
  }
}

/*
 * Imposta (crea o aggiorna) la convocazione di un giocatore per un
 * evento: usato dai toggle "Convocato" nella pagina di dettaglio.
 */
export async function impostaConvocazioneEvento(
  eventoId: string,
  giocatoreId: string,
  convocato: boolean,
): Promise<EventoActionResult> {
  try {
    const { supabase, clubId } = await getContestoAdmin();

    const { data: evento, error: eventoError } = await supabase
      .from("eventi")
      .select("id")
      .eq("id", eventoId)
      .eq("club_id", clubId)
      .maybeSingle();

    if (eventoError || !evento) {
      return { success: false, message: "Evento non valido." };
    }

    const { error } = await supabase.from("eventi_convocazioni").upsert(
      {
        evento_id: eventoId,
        club_id: clubId,
        giocatore_id: giocatoreId,
        convocato,
      },
      { onConflict: "evento_id,giocatore_id" },
    );

    if (error) {
      console.error("Errore impostaConvocazioneEvento:", error);
      return { success: false, message: error.message };
    }

    revalidatePath(`/eventi/${eventoId}`);

    return { success: true, message: "Convocazione aggiornata." };
  } catch (error) {
    console.error("Errore impostaConvocazioneEvento:", error);

    return {
      success: false,
      message: error instanceof Error ? error.message : "Errore imprevisto.",
    };
  }
}
