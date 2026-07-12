// src/lib/giocatori/autorizza-accesso.ts

import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";

type AutorizzaAccessoGiocatoreInput = {
  supabaseAdmin: SupabaseClient;
  giocatoreId: string;
  clubId: string;
  squadraId: string | null;
  email: string;
  nome: string;
  cognome: string;
  telefono: string | null;
  fotoUrl: string | null;
};

type AutorizzaAccessoGiocatoreResult =
  | {
      success: true;
      profiloId: string;
      profiloCreato: boolean;
    }
  | {
      success: false;
      error: string;
    };

/*
 * Pre-autorizza l'accesso di un giocatore al gestionale.
 *
 * Crea (o riusa, se già esistente) un profilo di tipo "giocatore"
 * collegato a questa email, SENZA creare subito un account Supabase
 * Auth: il profilo resta con auth_user_id = null finché il giocatore
 * non completa la registrazione da /register (stesso meccanismo usato
 * per allenatori/preparatori in utenti-permessi).
 *
 * Il collegamento tecnico giocatore <-> profilo avviene tramite
 * giocatori.id_atleta = profili.id (convenzione usata anche da
 * get-contesto-utente.ts per far vedere a un giocatore loggato solo
 * i propri dati).
 */
export async function autorizzaAccessoGiocatore(
  input: AutorizzaAccessoGiocatoreInput
): Promise<AutorizzaAccessoGiocatoreResult> {
  const {
    supabaseAdmin,
    giocatoreId,
    clubId,
    squadraId,
    email,
    nome,
    cognome,
    telefono,
    fotoUrl,
  } = input;

  const { data: profiloEsistente, error: ricercaError } =
    await supabaseAdmin
      .from("profili")
      .select("id,email,tipo_profilo,club_id")
      .ilike("email", email)
      .maybeSingle();

  if (ricercaError) {
    return { success: false, error: ricercaError.message };
  }

  if (profiloEsistente) {
    const tipoEsistente = String(
      profiloEsistente.tipo_profilo || ""
    ).toLowerCase();

    if (tipoEsistente !== "giocatore") {
      return {
        success: false,
        error: `L'indirizzo email è già associato a un profilo "${profiloEsistente.tipo_profilo}". Usa un'altra email per autorizzare l'accesso del giocatore.`,
      };
    }

    const clubEsistenti = Array.isArray(profiloEsistente.club_id)
      ? profiloEsistente.club_id
      : [];

    const clubAggiornati = clubEsistenti.includes(clubId)
      ? clubEsistenti
      : [...clubEsistenti, clubId];

    const { error: updateProfiloError } = await supabaseAdmin
      .from("profili")
      .update({
        nome,
        cognome,
        telefono,
        avatar_url: fotoUrl,
        club_id: clubAggiornati,
        last_club_id: clubId,
        last_squadra_id: squadraId,
        updated_at: new Date().toISOString(),
      })
      .eq("id", profiloEsistente.id);

    if (updateProfiloError) {
      return { success: false, error: updateProfiloError.message };
    }

    const { error: collegamentoError } = await supabaseAdmin
      .from("giocatori")
      .update({
        id_atleta: profiloEsistente.id,
        updated_at: new Date().toISOString(),
      })
      .eq("id", giocatoreId)
      .eq("club_id", clubId);

    if (collegamentoError) {
      return { success: false, error: collegamentoError.message };
    }

    return {
      success: true,
      profiloId: profiloEsistente.id,
      profiloCreato: false,
    };
  }

  const nuovoProfiloId = crypto.randomUUID();

  const { error: creazioneProfiloError } = await supabaseAdmin
    .from("profili")
    .insert({
      id: nuovoProfiloId,
      email,
      nome,
      cognome,
      telefono,
      avatar_url: fotoUrl,
      tipo_profilo: "giocatore",
      club_id: [clubId],
      last_club_id: clubId,
      last_squadra_id: squadraId,
      attivo: true,
      auth_user_id: null,
      updated_at: new Date().toISOString(),
    });

  if (creazioneProfiloError) {
    return { success: false, error: creazioneProfiloError.message };
  }

  const { error: collegamentoError } = await supabaseAdmin
    .from("giocatori")
    .update({
      id_atleta: nuovoProfiloId,
      updated_at: new Date().toISOString(),
    })
    .eq("id", giocatoreId)
    .eq("club_id", clubId);

  if (collegamentoError) {
    // Rollback: il profilo pre-autorizzato senza collegamento sarebbe orfano.
    await supabaseAdmin.from("profili").delete().eq("id", nuovoProfiloId);

    return { success: false, error: collegamentoError.message };
  }

  return {
    success: true,
    profiloId: nuovoProfiloId,
    profiloCreato: true,
  };
}
