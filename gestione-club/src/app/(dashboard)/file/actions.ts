"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase-server";

export async function creaVideoFile(formData: FormData) {
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

  const titolo = String(formData.get("titolo") ?? "");
  const tipoEvento = String(formData.get("tipo_evento") ?? "");
  const eventoId = String(formData.get("evento_id") ?? "");
  const note = String(formData.get("note") ?? "");
  const visibilita = String(formData.get("visibilita") ?? "");
  const personaId = String(formData.get("persona_id") ?? "");
  const giocatoreIds = formData.getAll("giocatore_ids").map(String);
  const files = formData
    .getAll("video")
    .filter((valore): valore is File => valore instanceof File && valore.size > 0);

  if (files.length === 0) throw new Error("File mancante");

  const tipiConsentiti = ["application/pdf", "image/", "video/"];
  const fileNonValido = files.find(
    (file) =>
      !tipiConsentiti.some(
        (tipo) => file.type === tipo || file.type.startsWith(tipo)
      )
  );
  if (fileNonValido) {
    throw new Error(
      `Formato non supportato per "${fileNonValido.name}". Carica video, immagini o PDF.`
    );
  }

  if (tipoEvento === "evento" && eventoId) {
    const { data: eventoValido } = await supabase
      .from("eventi")
      .select("id")
      .eq("id", eventoId)
      .eq("club_id", profilo.last_club_id)
      .maybeSingle();

    if (!eventoValido) throw new Error("Evento non valido");
  }

  for (const [indice, file] of files.entries()) {
    const ext = file.name.includes(".") ? file.name.split(".").pop() : "bin";
    const videoPath = `${profilo.last_club_id}/${
      profilo.last_squadra_id ?? "no-squadra"
    }/${crypto.randomUUID()}.${ext}`;

    const { error: uploadError } = await supabase.storage
      .from("file-video")
      .upload(videoPath, file, { contentType: file.type, upsert: false });
    if (uploadError) throw new Error(`${file.name}: ${uploadError.message}`);

    const titoloFile = titolo;
    const { data: video, error: insertError } = await supabase
      .from("file_video")
      .insert({
        club_id: profilo.last_club_id,
        squadra_id: profilo.last_squadra_id,
        titolo: titoloFile,
        video_path: videoPath,
        video_mime_type: file.type,
        video_size: file.size,
        tipo_evento: tipoEvento,
        partita_id: tipoEvento === "partita" && eventoId ? eventoId : null,
        allenamento_id: tipoEvento === "allenamento" && eventoId ? eventoId : null,
        evento_id: tipoEvento === "evento" && eventoId ? eventoId : null,
        note,
        visibilita,
        created_by: user.id,
      })
      .select("id")
      .single();

    if (insertError) {
      await supabase.storage.from("file-video").remove([videoPath]);
      throw new Error(`File ${indice + 1} (${file.name}): ${insertError.message}`);
    }

    if (visibilita === "persona" && personaId) {
      const { error } = await supabase.from("file_video_destinatari").insert({
        video_id: video.id,
        profilo_id: personaId,
        giocatore_id: null,
      });
      if (error) throw new Error(error.message);
    }

    if (visibilita === "giocatori" && giocatoreIds.length > 0) {
      const rows = giocatoreIds.map((giocatoreId) => ({
        video_id: video.id,
        profilo_id: null,
        giocatore_id: giocatoreId,
      }));
      const { error } = await supabase.from("file_video_destinatari").insert(rows);
      if (error) throw new Error(error.message);
    }
  }

  revalidatePath("/file");
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
