"use server";

import { revalidatePath } from "next/cache";

import { createClient } from "@/lib/supabase-server";
import { supabaseAdmin } from "@/lib/supabase-admin";
import { autorizzaAccessoGiocatore } from "@/lib/giocatori/autorizza-accesso";

type NuovoGiocatoreInput = {
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
  note: string | null;
  foto_url: string | null;
};

type ActionResult =
  | {
      success: true;
      giocatoreId: string;
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

export async function creaNuovoGiocatoreAction(
  input: NuovoGiocatoreInput,
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

    const { data: profilo, error: profiloError } =
      await supabase
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
        error:
          "Non hai i permessi per creare un giocatore.",
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

    /*
     * La squadra inviata dal client viene accettata soltanto
     * dopo aver verificato che appartenga al club attivo.
     */
    let squadraId =
      stringOrNull(input.squadra_id) ??
      profilo.last_squadra_id ??
      null;

    if (squadraId) {
      const { data: squadra, error: squadraError } =
        await supabaseAdmin
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
          error:
            "La squadra selezionata non appartiene al club attivo.",
        };
      }
    }

    const email = input.email
      ? normalizzaEmail(input.email)
      : null;

    /*
     * Prima creiamo il giocatore.
     * club_id viene sempre ricavato dal profilo server-side.
     */
    const { data: giocatore, error: giocatoreError } =
      await supabaseAdmin
        .from("giocatori")
        .insert({
          user_id: null,
          club_id: profilo.last_club_id,
          squadra_id: squadraId,
          id_atleta: stringOrNull(input.id_atleta),
          nome,
          cognome,
          data_nascita: stringOrNull(input.data_nascita),
          categoria: stringOrNull(input.categoria),
          ruolo_1: stringOrNull(input.ruolo_1),
          ruolo_2: stringOrNull(input.ruolo_2),
          reparto: stringOrNull(input.reparto),
          mano_piede_dominante: stringOrNull(
            input.mano_piede_dominante,
          ),
          telefono: stringOrNull(input.telefono),
          email,
          genitore: stringOrNull(input.genitore),
          telefono_genitore: stringOrNull(
            input.telefono_genitore,
          ),
          foto_url: stringOrNull(input.foto_url),
          note: stringOrNull(input.note),
          attivo: true,
          updated_at: new Date().toISOString(),
        })
        .select(`
          id,
          club_id,
          squadra_id,
          id_atleta,
          nome,
          cognome,
          email,
          telefono,
          foto_url,
          attivo
        `)
        .single();

    if (giocatoreError || !giocatore) {
      return {
        success: false,
        error:
          giocatoreError?.message ??
          "Errore durante la creazione del giocatore.",
      };
    }

    if (!email) {
      revalidatePath("/giocatori");

      return {
        success: true,
        giocatoreId: giocatore.id,
        profiloCreato: false,
      };
    }

    const autorizzazione = await autorizzaAccessoGiocatore({
      supabaseAdmin,
      giocatoreId: giocatore.id,
      clubId: profilo.last_club_id,
      squadraId,
      email,
      nome,
      cognome,
      telefono: giocatore.telefono,
      fotoUrl: giocatore.foto_url,
    });

    if (!autorizzazione.success) {
      await supabaseAdmin
        .from("giocatori")
        .delete()
        .eq("id", giocatore.id);

      return {
        success: false,
        error: autorizzazione.error,
      };
    }

    revalidatePath("/giocatori");
    revalidatePath(`/giocatori/${giocatore.id}`);

    return {
      success: true,
      giocatoreId: giocatore.id,
      profiloCreato: autorizzazione.profiloCreato,
    };
  } catch (error) {
    console.error("Errore creazione giocatore:", error);

    return {
      success: false,
      error:
        error instanceof Error
          ? error.message
          : "Errore imprevisto.",
    };
  }
}