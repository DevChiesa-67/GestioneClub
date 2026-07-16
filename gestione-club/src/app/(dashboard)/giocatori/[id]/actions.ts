// src/app/(dashboard)/giocatori/[id]/actions.ts

"use server";

import { revalidatePath } from "next/cache";

import { createClient } from "@/lib/supabase-server";
import { supabaseAdmin } from "@/lib/supabase-admin";
import { autorizzaAccessoGiocatore } from "@/lib/giocatori/autorizza-accesso";

type ModificaGiocatoreInput = {
  giocatoreId: string;
  id_atleta: string | null;
  nome: string;
  cognome: string;
  data_nascita: string | null;
  categoria: string | null;
  email: string | null;
  telefono: string | null;
  squadra_id: string | null;
  ruolo_1: string | null;
  ruolo_2: string | null;
  reparto: string | null;
  mano_piede_dominante: string | null;
  genitore: string | null;
  telefono_genitore: string | null;
  numero_tessera: string | null;
  tipo_documento: string | null;
  numero_documento: string | null;
  note: string | null;
  foto_url: string | null;
};

type ActionResult =
  | {
      success: true;
      profiloCreato: boolean;
    }
  | {
      success: false;
      error: string;
    };

function stringOrNull(value: string | null | undefined) {
  const normalized = value?.trim();
  return normalized ? normalized : null;
}

function normalizzaEmail(value: string) {
  return value.trim().toLowerCase();
}

export async function aggiornaGiocatoreAction(
  input: ModificaGiocatoreInput,
): Promise<ActionResult> {
  try {
    const supabase = await createClient();

    const {
      data: { user },
      error: userError,
    } = await supabase.auth.getUser();

    if (userError || !user) {
      return {
        success: false,
        error: "Utente non autenticato.",
      };
    }

    const { data: profilo, error: profiloError } = await supabase
      .from("profili")
      .select(`
        id,
        tipo_profilo,
        last_club_id,
        last_squadra_id
      `)
      .eq("auth_user_id", user.id)
      .single();

    if (profiloError || !profilo) {
      return {
        success: false,
        error: "Profilo non trovato.",
      };
    }

    if (
      typeof profilo.tipo_profilo !== "string" ||
      profilo.tipo_profilo.trim().toLowerCase() !== "admin"
    ) {
      return {
        success: false,
        error: "Non hai i permessi per modificare un giocatore.",
      };
    }

    if (!profilo.last_club_id) {
      return {
        success: false,
        error: "Nessun club attivo selezionato.",
      };
    }

    const nome = input.nome.trim();
    const cognome = input.cognome.trim();

    if (!nome || !cognome) {
      return {
        success: false,
        error: "Nome e cognome sono obbligatori.",
      };
    }

    const { data: giocatoreEsistente, error: giocatoreEsistenteError } =
      await supabaseAdmin
        .from("giocatori")
        .select("id")
        .eq("id", input.giocatoreId)
        .eq("club_id", profilo.last_club_id)
        .maybeSingle();

    if (giocatoreEsistenteError || !giocatoreEsistente) {
      return {
        success: false,
        error: "Giocatore non trovato.",
      };
    }

    /*
     * La squadra inviata dal client viene accettata soltanto
     * dopo aver verificato che appartenga al club attivo.
     */
    const squadraId = stringOrNull(input.squadra_id);

    if (squadraId) {
      const { data: squadra, error: squadraError } = await supabaseAdmin
        .from("squadre")
        .select("id")
        .eq("id", squadraId)
        .eq("club_id", profilo.last_club_id)
        .maybeSingle();

      if (squadraError) {
        return {
          success: false,
          error: squadraError.message,
        };
      }

      if (!squadra) {
        return {
          success: false,
          error: "La squadra selezionata non appartiene al club attivo.",
        };
      }
    }

    const email = input.email ? normalizzaEmail(input.email) : null;

    const { data: giocatoreAggiornato, error: updateError } =
      await supabaseAdmin
        .from("giocatori")
        .update({
          squadra_id: squadraId,
          id_atleta: stringOrNull(input.id_atleta),
          nome,
          cognome,
          data_nascita: stringOrNull(input.data_nascita),
          categoria: stringOrNull(input.categoria),
          ruolo_1: stringOrNull(input.ruolo_1),
          ruolo_2: stringOrNull(input.ruolo_2),
          reparto: stringOrNull(input.reparto),
          mano_piede_dominante: stringOrNull(input.mano_piede_dominante),
          telefono: stringOrNull(input.telefono),
          email,
          genitore: stringOrNull(input.genitore),
          telefono_genitore: stringOrNull(input.telefono_genitore),
          numero_tessera: stringOrNull(input.numero_tessera),
          tipo_documento: stringOrNull(input.tipo_documento),
          numero_documento: stringOrNull(input.numero_documento),
          foto_url: stringOrNull(input.foto_url),
          note: stringOrNull(input.note),
          updated_at: new Date().toISOString(),
        })
        .eq("id", input.giocatoreId)
        .eq("club_id", profilo.last_club_id)
        .select("id, telefono, foto_url")
        .single();

    if (updateError || !giocatoreAggiornato) {
      return {
        success: false,
        error:
          updateError?.message ??
          "Errore durante l'aggiornamento del giocatore.",
      };
    }

    if (!email) {
      revalidatePath("/giocatori");
      revalidatePath(`/giocatori/${input.giocatoreId}`);

      return {
        success: true,
        profiloCreato: false,
      };
    }

    /*
     * L'email è presente (nuova o già esistente): assicura che il
     * giocatore abbia un profilo di accesso, creandolo se necessario.
     * L'helper è idempotente: se il profilo esiste già lo riusa.
     */
    const autorizzazione = await autorizzaAccessoGiocatore({
      supabaseAdmin,
      giocatoreId: input.giocatoreId,
      clubId: profilo.last_club_id,
      squadraId,
      email,
      nome,
      cognome,
      telefono: giocatoreAggiornato.telefono,
      fotoUrl: giocatoreAggiornato.foto_url,
    });

    if (!autorizzazione.success) {
      return {
        success: false,
        error: autorizzazione.error,
      };
    }

    revalidatePath("/giocatori");
    revalidatePath(`/giocatori/${input.giocatoreId}`);

    return {
      success: true,
      profiloCreato: autorizzazione.profiloCreato,
    };
  } catch (error) {
    console.error("Errore aggiornamento giocatore:", error);

    return {
      success: false,
      error:
        error instanceof Error ? error.message : "Errore imprevisto.",
    };
  }
}
