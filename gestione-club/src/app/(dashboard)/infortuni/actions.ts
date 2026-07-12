"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase-server";

type StatoInfortunio =
  | "infortunato"
  | "in_valutazione"
  | "riabilitazione"
  | "recupero"
  | "rientrato";

async function getProfiloCorrente() {
  const supabase = await createClient();

  const {
    data: { user },
    error: userError,
  } = await supabase.auth.getUser();

  if (userError || !user) {
    throw new Error("Utente non autenticato.");
  }

  const { data: profilo, error } = await supabase
    .from("profili")
    .select("id,tipo_profilo,last_club_id,last_squadra_id")
    .eq("auth_user_id", user.id)
    .single();

  if (error || !profilo?.last_club_id) {
    throw new Error("Club attivo non trovato.");
  }

  return profilo;
}

function assertAdmin(profilo: { tipo_profilo?: string | null }) {
  if (String(profilo.tipo_profilo || "").toLowerCase() !== "admin") {
    throw new Error("Non hai i permessi per eseguire questa operazione.");
  }
}

export async function creaInfortunio(formData: FormData) {
  const supabase = await createClient();
  const profilo = await getProfiloCorrente();
  assertAdmin(profilo);

  const giocatoreId = String(formData.get("giocatore_id") || "");
  const dataInfortunio = String(formData.get("data_infortunio") || "");
  const tipoInfortunio = String(formData.get("tipo_infortunio") || "");
  const dataRientro = String(formData.get("data_rientro") || "") || null;
  const stato = String(formData.get("stato") || "infortunato") as StatoInfortunio;

  if (!giocatoreId || !dataInfortunio || !tipoInfortunio) {
    throw new Error("Compila giocatore, data infortunio e tipo infortunio.");
  }

  const { data: giocatore, error: giocatoreError } = await supabase
    .from("giocatori")
    .select("id,squadra_id")
    .eq("id", giocatoreId)
    .eq("club_id", profilo.last_club_id)
    .single();

  if (giocatoreError || !giocatore) {
    throw new Error("Giocatore non trovato nel club attivo.");
  }

  const { error } = await supabase.from("infortuni").insert({
    club_id: profilo.last_club_id,
    squadra_id: giocatore.squadra_id,
    giocatore_id: giocatoreId,
    data_infortunio: dataInfortunio,
    tipo_infortunio: tipoInfortunio,
    data_rientro: dataRientro,
    stato,
    created_by: profilo.id,
  });

  if (error) throw new Error(error.message);

  revalidatePath("/infortuni");
}

export async function aggiornaInfortunio(infortunioId: string, formData: FormData) {
  const supabase = await createClient();
  const profilo = await getProfiloCorrente();
  assertAdmin(profilo);

  const { error } = await supabase
    .from("infortuni")
    .update({
      data_infortunio: String(formData.get("data_infortunio") || ""),
      tipo_infortunio: String(formData.get("tipo_infortunio") || ""),
      data_rientro: String(formData.get("data_rientro") || "") || null,
      stato: String(formData.get("stato") || "infortunato"),
      updated_at: new Date().toISOString(),
    })
    .eq("id", infortunioId)
    .eq("club_id", profilo.last_club_id);

  if (error) throw new Error(error.message);

  revalidatePath("/infortuni");
  revalidatePath(`/infortuni/${infortunioId}`);
}

export async function eliminaInfortunio(infortunioId: string) {
  const supabase = await createClient();
  const profilo = await getProfiloCorrente();
  assertAdmin(profilo);

  const { error } = await supabase
    .from("infortuni")
    .delete()
    .eq("id", infortunioId)
    .eq("club_id", profilo.last_club_id);

  if (error) throw new Error(error.message);

  revalidatePath("/infortuni");
}

export async function aggiungiValutazioneMedico(
  infortunioId: string,
  formData: FormData
) {
  const supabase = await createClient();
  const profilo = await getProfiloCorrente();
  assertAdmin(profilo);

  const linksRaw = String(formData.get("medico_link_documentazione") || "");
  const links = linksRaw
    .split("\n")
    .map((link) => link.trim())
    .filter(Boolean);

  const { error } = await supabase.from("infortuni_medico_valutazioni").insert({
    infortunio_id: infortunioId,
    club_id: profilo.last_club_id,
    medico_nome: String(formData.get("medico_nome") || ""),
    medico_data_valutazione: String(formData.get("medico_data_valutazione") || ""),
    medico_terapia: String(formData.get("medico_terapia") || ""),
    medico_commento: String(formData.get("medico_commento") || ""),
    medico_link_documentazione: links,
  });

  if (error) throw new Error(error.message);

  revalidatePath(`/infortuni/${infortunioId}`);
}

export async function aggiungiValutazioneFisioterapista(
  infortunioId: string,
  formData: FormData
) {
  const supabase = await createClient();
  const profilo = await getProfiloCorrente();
  assertAdmin(profilo);

  const { error } = await supabase
    .from("infortuni_fisioterapista_valutazioni")
    .insert({
      infortunio_id: infortunioId,
      club_id: profilo.last_club_id,
      fisioterapista_nome: String(formData.get("fisioterapista_nome") || ""),
      fisioterapista_data_visita: String(
        formData.get("fisioterapista_data_visita") || ""
      ),
      fisioterapista_commento: String(
        formData.get("fisioterapista_commento") || ""
      ),
    });

  if (error) throw new Error(error.message);

  revalidatePath(`/infortuni/${infortunioId}`);
}

export async function aggiungiValutazionePreparatore(
  infortunioId: string,
  formData: FormData
) {
  const supabase = await createClient();
  const profilo = await getProfiloCorrente();
  assertAdmin(profilo);

  const { error } = await supabase
    .from("infortuni_preparatore_valutazioni")
    .insert({
      infortunio_id: infortunioId,
      club_id: profilo.last_club_id,
      preparatore_nome: String(formData.get("preparatore_nome") || ""),
      preparatore_data_valutazione: String(
        formData.get("preparatore_data_valutazione") || ""
      ),
      preparatore_allenamento_recupero_infortunio: String(
        formData.get("preparatore_allenamento_recupero_infortunio") || ""
      ),
      preparatore_commento: String(formData.get("preparatore_commento") || ""),
    });

  if (error) throw new Error(error.message);

  revalidatePath(`/infortuni/${infortunioId}`);
}