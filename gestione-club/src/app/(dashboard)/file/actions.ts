"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase-server";
import { LIMITE_FILE_MB, tipoFileConsentito } from "@/lib/file-video";

async function profiloAdmin() {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) throw new Error("Utente non autenticato");

  const { data: profilo } = await supabase
    .from("profili")
    .select("id,last_club_id,last_squadra_id,tipo_profilo")
    .eq("auth_user_id", user.id)
    .single();

  if (!profilo?.last_club_id) throw new Error("Club non selezionato");
  if (profilo.tipo_profilo !== "admin") throw new Error("Non autorizzato");

  return { supabase, user, profilo };
}

/*
 * PERCHE' L'UPLOAD NON PASSA PIU' DA QUI (Server Action).
 *
 * Prima il file arrivava al server dentro il FormData di una Server Action.
 * In locale funzionava (next.config.ts alza serverActions.bodySizeLimit a
 * 55 MB), ma in produzione su Vercel ogni richiesta a una funzione
 * serverless ha un limite RIGIDO di ~4,5 MB: qualunque video piu' grande
 * veniva rifiutato prima ancora di entrare nel codice, con un errore
 * generico. Nessuna configurazione di Next puo' alzare quel tetto.
 *
 * Ora il browser carica il file DIRETTAMENTE su Supabase Storage:
 *   1. il client chiede qui un "signed upload URL" (payload di pochi byte);
 *   2. carica il file su Supabase senza passare da Vercel;
 *   3. richiama registraFileVideo con i soli percorsi + metadati.
 * Il limite che resta e' quello del bucket (LIMITE_FILE_MB).
 */
export async function preparaUploadFile(input: {
  nome: string;
  tipoMime: string;
  dimensione: number;
}): Promise<
  | { ok: true; path: string; token: string }
  | { ok: false; message: string }
> {
  try {
    const { supabase, profilo } = await profiloAdmin();

    if (!tipoFileConsentito(input.tipoMime)) {
      return {
        ok: false,
        message: `Formato non supportato per "${input.nome}". Carica video, immagini o PDF.`,
      };
    }

    if (input.dimensione > LIMITE_FILE_MB * 1024 * 1024) {
      return {
        ok: false,
        message: `"${input.nome}" supera il limite di ${LIMITE_FILE_MB} MB per file.`,
      };
    }

    const ext = input.nome.includes(".") ? input.nome.split(".").pop() : "bin";
    const videoPath = `${profilo.last_club_id}/${
      profilo.last_squadra_id ?? "no-squadra"
    }/${crypto.randomUUID()}.${ext}`;

    const { data, error } = await supabase.storage
      .from("file-video")
      .createSignedUploadUrl(videoPath);

    if (error || !data) {
      return {
        ok: false,
        message: `Impossibile preparare il caricamento di "${input.nome}": ${
          error?.message ?? "errore sconosciuto"
        }`,
      };
    }

    return { ok: true, path: data.path, token: data.token };
  } catch (errore) {
    // In produzione Next maschera le eccezioni delle Server Action con un
    // messaggio generico: restituendo l'errore come valore, l'utente legge
    // la causa vera.
    return {
      ok: false,
      message:
        errore instanceof Error ? errore.message : "Errore imprevisto.",
    };
  }
}

// Registra sul database i file gia' caricati su Storage dal browser.
// Il payload e' solo testo: nessun limite di dimensione da rispettare.
export async function registraFileVideo(input: {
  titolo: string;
  tipoEvento: string;
  eventoId: string;
  note: string;
  visibilita: string;
  personaId: string;
  giocatoreIds: string[];
  files: { path: string; nome: string; tipoMime: string; dimensione: number }[];
}): Promise<{ ok: true } | { ok: false; message: string }> {
  try {
    const { supabase, user, profilo } = await profiloAdmin();

    if (input.files.length === 0) throw new Error("File mancante");

    // I percorsi arrivano dal client: si accettano solo quelli dentro la
    // cartella del club corrente (lo stesso vincolo delle policy RLS).
    const prefisso = `${profilo.last_club_id}/`;
    const pathNonValido = input.files.find((file) => !file.path.startsWith(prefisso));
    if (pathNonValido) throw new Error("Percorso file non valido");

    const tipoNonValido = input.files.find((file) => !tipoFileConsentito(file.tipoMime));
    if (tipoNonValido) {
      throw new Error(
        `Formato non supportato per "${tipoNonValido.nome}". Carica video, immagini o PDF.`
      );
    }

    if (input.tipoEvento === "evento" && input.eventoId) {
      const { data: eventoValido } = await supabase
        .from("eventi")
        .select("id")
        .eq("id", input.eventoId)
        .eq("club_id", profilo.last_club_id)
        .maybeSingle();

      if (!eventoValido) throw new Error("Evento non valido");
    }

    for (const [indice, file] of input.files.entries()) {
      const { data: video, error: insertError } = await supabase
        .from("file_video")
        .insert({
          club_id: profilo.last_club_id,
          squadra_id: profilo.last_squadra_id,
          titolo: input.titolo,
          video_path: file.path,
          video_mime_type: file.tipoMime,
          video_size: file.dimensione,
          tipo_evento: input.tipoEvento,
          partita_id:
            input.tipoEvento === "partita" && input.eventoId ? input.eventoId : null,
          allenamento_id:
            input.tipoEvento === "allenamento" && input.eventoId
              ? input.eventoId
              : null,
          evento_id:
            input.tipoEvento === "evento" && input.eventoId ? input.eventoId : null,
          note: input.note,
          visibilita: input.visibilita,
          created_by: user.id,
        })
        .select("id")
        .single();

      if (insertError) {
        await supabase.storage.from("file-video").remove([file.path]);
        throw new Error(`File ${indice + 1} (${file.nome}): ${insertError.message}`);
      }

      if (input.visibilita === "persona" && input.personaId) {
        const { error } = await supabase.from("file_video_destinatari").insert({
          video_id: video.id,
          profilo_id: input.personaId,
          giocatore_id: null,
        });
        if (error) throw new Error(error.message);
      }

      if (input.visibilita === "giocatori" && input.giocatoreIds.length > 0) {
        const rows = input.giocatoreIds.map((giocatoreId) => ({
          video_id: video.id,
          profilo_id: null,
          giocatore_id: giocatoreId,
        }));
        const { error } = await supabase.from("file_video_destinatari").insert(rows);
        if (error) throw new Error(error.message);
      }
    }

    revalidatePath("/file");

    return { ok: true };
  } catch (errore) {
    return {
      ok: false,
      message:
        errore instanceof Error ? errore.message : "Errore imprevisto.",
    };
  }
}

export async function eliminaVideoFile(videoId: string, videoPath: string) {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) throw new Error("Utente non autenticato");

  const { data: profilo } = await supabase
    .from("profili")
    .select("tipo_profilo,last_club_id")
    .eq("auth_user_id", user.id)
    .single();

  if (profilo?.tipo_profilo !== "admin") throw new Error("Non autorizzato");

  await supabase.storage.from("file-video").remove([videoPath]);

  const { error } = await supabase
    .from("file_video")
    .delete()
    .eq("id", videoId)
    .eq("club_id", profilo.last_club_id);

  if (error) throw error;

  revalidatePath("/file");
}

export async function aggiornaVideoFile(formData: FormData) {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) throw new Error("Utente non autenticato");

  const { data: profilo } = await supabase
    .from("profili")
    .select("id,last_club_id,last_squadra_id,tipo_profilo")
    .eq("auth_user_id", user.id)
    .single();

  if (!profilo?.last_club_id) throw new Error("Club non selezionato");
  if (profilo.tipo_profilo !== "admin") throw new Error("Non autorizzato");

  const videoId = String(formData.get("video_id") ?? "");
  const titolo = String(formData.get("titolo") ?? "");
  const tipoEvento = String(formData.get("tipo_evento") ?? "");
  const eventoId = String(formData.get("evento_id") ?? "");
  const note = String(formData.get("note") ?? "");
  const visibilita = String(formData.get("visibilita") ?? "");
  const personaId = String(formData.get("persona_id") ?? "");
  const giocatoreIds = formData.getAll("giocatore_ids").map(String);

  if (!videoId) throw new Error("Video mancante");

  if (tipoEvento === "evento" && eventoId) {
    const { data: eventoValido } = await supabase
      .from("eventi")
      .select("id")
      .eq("id", eventoId)
      .eq("club_id", profilo.last_club_id)
      .maybeSingle();

    if (!eventoValido) throw new Error("Evento non valido");
  }

  const { error } = await supabase
    .from("file_video")
    .update({
      titolo,
      tipo_evento: tipoEvento,
      partita_id: tipoEvento === "partita" && eventoId ? eventoId : null,
      allenamento_id: tipoEvento === "allenamento" && eventoId ? eventoId : null,
      evento_id: tipoEvento === "evento" && eventoId ? eventoId : null,
      note,
      visibilita,
      updated_at: new Date().toISOString(),
    })
    .eq("id", videoId)
    .eq("club_id", profilo.last_club_id);

  if (error) throw error;

  const { error: deleteDestError } = await supabase
    .from("file_video_destinatari")
    .delete()
    .eq("video_id", videoId);

  if (deleteDestError) throw deleteDestError;

  if (visibilita === "persona" && personaId) {
    const { error: destError } = await supabase
      .from("file_video_destinatari")
      .insert({
        video_id: videoId,
        profilo_id: personaId,
        giocatore_id: null,
      });

    if (destError) throw destError;
  }

  if (visibilita === "giocatori" && giocatoreIds.length > 0) {
    const rows = giocatoreIds.map((giocatoreId) => ({
      video_id: videoId,
      profilo_id: null,
      giocatore_id: giocatoreId,
    }));

    const { error: destError } = await supabase
      .from("file_video_destinatari")
      .insert(rows);

    if (destError) throw destError;
  }

  revalidatePath("/file");
}
