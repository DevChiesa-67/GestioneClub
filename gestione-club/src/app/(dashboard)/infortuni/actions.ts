"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase-server";
import { puoGestireInfortuni } from "@/lib/permessi/infortuni";
import {
  assicuraBucketDocumentiMedici,
  BUCKET_DOCUMENTI_MEDICI,
} from "@/lib/supabase-storage-admin";

type StatoInfortunio =
  | "infortunato"
  | "in_valutazione"
  | "riabilitazione"
  | "recupero"
  | "rientrato";

const DIMENSIONE_MASSIMA_DOCUMENTO = 50 * 1024 * 1024;

function tipoDocumentoMedicoValido(tipo: string) {
  return (
    tipo === "application/pdf" ||
    tipo.startsWith("image/") ||
    tipo.startsWith("video/")
  );
}

function nomeFileSicuro(nome: string) {
  return nome.replace(/[^a-zA-Z0-9._-]/g, "_").slice(-120);
}

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

/*
 * Gli infortuni non sono piu' riservati all'admin: anche medico e
 * fisioterapista li gestiscono (leggono tutto il resto del gestionale in
 * sola lettura). L'elenco dei ruoli sta in un punto solo, allineato alle
 * policy RLS di aggiungi-tipi-profilo-medico-fisioterapista.sql.
 */
function assertPuoGestireInfortuni(profilo: { tipo_profilo?: string | null }) {
  if (!puoGestireInfortuni(profilo.tipo_profilo)) {
    throw new Error("Non hai i permessi per eseguire questa operazione.");
  }
}

export async function creaInfortunio(formData: FormData) {
  const supabase = await createClient();
  const profilo = await getProfiloCorrente();
  assertPuoGestireInfortuni(profilo);

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
  assertPuoGestireInfortuni(profilo);

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
  assertPuoGestireInfortuni(profilo);

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
  assertPuoGestireInfortuni(profilo);

  const linksRaw = String(formData.get("medico_link_documentazione") || "");
  const links = linksRaw
    .split("\n")
    .map((link) => link.trim())
    .filter(Boolean);

  const allegato = formData.get("medico_allegato");
  let percorsoAllegato: string | null = null;
  let storageAdmin: Awaited<ReturnType<typeof assicuraBucketDocumentiMedici>> | null = null;

  if (allegato instanceof File && allegato.size > 0) {
    if (!tipoDocumentoMedicoValido(allegato.type)) {
      throw new Error("Puoi allegare soltanto PDF, immagini o video.");
    }
    if (allegato.size > DIMENSIONE_MASSIMA_DOCUMENTO) {
      throw new Error("L’allegato non può superare 50 MB.");
    }

    const nomeOriginale = nomeFileSicuro(allegato.name || "documento");
    percorsoAllegato = `${profilo.last_club_id}/${infortunioId}/${crypto.randomUUID()}-${nomeOriginale}`;
    storageAdmin = await assicuraBucketDocumentiMedici();
    const { error: uploadError } = await storageAdmin.storage
      .from(BUCKET_DOCUMENTI_MEDICI)
      .upload(percorsoAllegato, allegato, {
        contentType: allegato.type,
        cacheControl: "3600",
        upsert: false,
      });

    if (uploadError) throw new Error(uploadError.message);
    links.push(`storage://${percorsoAllegato}::${nomeOriginale}`);
  }

  const { error } = await supabase.from("infortuni_medico_valutazioni").insert({
    infortunio_id: infortunioId,
    club_id: profilo.last_club_id,
    medico_nome: String(formData.get("medico_nome") || ""),
    medico_data_valutazione: String(formData.get("medico_data_valutazione") || ""),
    medico_terapia: String(formData.get("medico_terapia") || ""),
    medico_commento: String(formData.get("medico_commento") || ""),
    medico_link_documentazione: links,
  });

  if (error) {
    if (percorsoAllegato) {
      await storageAdmin?.storage
        .from(BUCKET_DOCUMENTI_MEDICI)
        .remove([percorsoAllegato]);
    }
    throw new Error(error.message);
  }

  revalidatePath(`/infortuni/${infortunioId}`);
}

type TipoValutazione = "medico" | "fisioterapista" | "preparatore";

const TABELLE_VALUTAZIONI: Record<TipoValutazione, string> = {
  medico: "infortuni_medico_valutazioni",
  fisioterapista: "infortuni_fisioterapista_valutazioni",
  preparatore: "infortuni_preparatore_valutazioni",
};

export async function eliminaValutazioneInfortunio(
  infortunioId: string,
  valutazioneId: string,
  tipo: TipoValutazione
) {
  const supabase = await createClient();
  const profilo = await getProfiloCorrente();
  assertPuoGestireInfortuni(profilo);

  const tabella = TABELLE_VALUTAZIONI[tipo];
  if (!tabella) throw new Error("Tipo di valutazione non valido.");

  let percorsiAllegati: string[] = [];
  if (tipo === "medico") {
    const { data: valutazione, error: letturaError } = await supabase
      .from("infortuni_medico_valutazioni")
      .select("medico_link_documentazione")
      .eq("id", valutazioneId)
      .eq("infortunio_id", infortunioId)
      .eq("club_id", profilo.last_club_id)
      .single();

    if (letturaError) throw new Error(letturaError.message);
    percorsiAllegati = (valutazione.medico_link_documentazione ?? [])
      .filter((link: string) => link.startsWith("storage://"))
      .map((link: string) => {
        const riferimento = link.slice("storage://".length);
        const separatore = riferimento.lastIndexOf("::");
        return separatore >= 0 ? riferimento.slice(0, separatore) : riferimento;
      });
  }

  const { error } = await supabase
    .from(tabella)
    .delete()
    .eq("id", valutazioneId)
    .eq("infortunio_id", infortunioId)
    .eq("club_id", profilo.last_club_id);

  if (error) throw new Error(error.message);

  if (percorsiAllegati.length > 0) {
    const storageAdmin = await assicuraBucketDocumentiMedici();
    const { error: rimozioneError } = await storageAdmin.storage
      .from(BUCKET_DOCUMENTI_MEDICI)
      .remove(percorsiAllegati);
    if (rimozioneError) {
      console.error("Allegato medico non rimosso:", rimozioneError.message);
    }
  }

  revalidatePath(`/infortuni/${infortunioId}`);
}

export async function aggiungiValutazioneFisioterapista(
  infortunioId: string,
  formData: FormData
) {
  const supabase = await createClient();
  const profilo = await getProfiloCorrente();
  assertPuoGestireInfortuni(profilo);

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
  assertPuoGestireInfortuni(profilo);

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
