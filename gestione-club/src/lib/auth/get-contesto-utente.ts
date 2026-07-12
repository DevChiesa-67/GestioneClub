// src/lib/auth/get-contesto-utente.ts

import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase-server";

export type ContestoUtente = {
  userId: string;
  profiloId: string;
  tipoProfilo: string;
  clubId: string;
  squadraId: string | null;
  giocatoreId: string | null;
  isAdmin: boolean;
  isGiocatore: boolean;
};

export async function getContestoUtente(): Promise<ContestoUtente> {
  const supabase = await createClient();

  const {
    data: { user },
    error: userError,
  } = await supabase.auth.getUser();

  if (userError || !user) {
    redirect("/login");
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
    throw new Error("Profilo utente non trovato.");
  }

  if (!profilo.last_club_id) {
    throw new Error("Nessun club attivo selezionato.");
  }

  const tipoProfilo = profilo.tipo_profilo?.trim().toLowerCase() ?? "";

  const isAdmin = tipoProfilo === "admin";
  const isGiocatore = tipoProfilo === "giocatore";

  let giocatoreId: string | null = null;

  if (isGiocatore) {
    let query = supabase
      .from("giocatori")
      .select("id")
      .eq("club_id", profilo.last_club_id)
      .eq("id_atleta", profilo.id);

    if (profilo.last_squadra_id) {
      query = query.eq("squadra_id", profilo.last_squadra_id);
    }

    const { data: giocatore, error: giocatoreError } =
      await query.maybeSingle();

    if (giocatoreError) {
      console.error(
        "Errore recupero giocatore collegato:",
        giocatoreError
      );

      throw new Error(
        "Errore durante il recupero del giocatore associato."
      );
    }

    if (!giocatore) {
      throw new Error(
        "Il profilo giocatore non è collegato ad alcun atleta nel club attivo."
      );
    }

    giocatoreId = giocatore.id;
  }

  return {
    userId: user.id,
    profiloId: profilo.id,
    tipoProfilo,
    clubId: profilo.last_club_id,
    squadraId: profilo.last_squadra_id,
    giocatoreId,
    isAdmin,
    isGiocatore,
  };
}