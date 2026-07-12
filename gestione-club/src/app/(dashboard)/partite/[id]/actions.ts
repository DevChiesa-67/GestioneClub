"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase-server";

type SalvaStatisticheInput = {
  partita_id: string;
  punti_fatti: number;
  punti_subiti: number;
  mete_fatte: number;
  mete_subite: number;
  calci_fatti: number;
  calci_subiti: number;
  ammonizioni: number;
  espulsioni: number;
  note?: string | null;
};

type ConvocazioneInput = {
  giocatore_id: string;
  convocato: boolean;
  titolare: boolean;
  capitano: boolean;
  posizione:
    | "pilone_sx"
    | "tallonatore"
    | "pilone_dx"
    | "seconda_linea_sx"
    | "seconda_linea_dx"
    | "terza_linea_sx"
    | "terza_linea_dx"
    | "numero_8"
    | "mediano_mischia"
    | "mediano_apertura"
    | "ala_sx"
    | "primo_centro"
    | "secondo_centro"
    | "ala_dx"
    | "estremo"
    | "panchina";
  numero_maglia: number | null;
  ordine: number | null;
  note?: string | null;
};

async function getContestoUtente() {
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
    throw new Error("Non hai i permessi per modificare questa partita.");
  }

  return {
    supabase,
    user,
    profilo,
    clubId: profilo.last_club_id as string,
    squadraId: profilo.last_squadra_id as string | null,
  };
}

export async function salvaStatistichePartita(input: SalvaStatisticheInput) {
  const { supabase, user, clubId } = await getContestoUtente();

  const { data: partita, error: partitaError } = await supabase
    .from("partite")
    .select("id,club_id,squadra_id")
    .eq("id", input.partita_id)
    .eq("club_id", clubId)
    .single();

  if (partitaError || !partita) {
    throw new Error("Partita non trovata.");
  }

  const risultato = `${input.punti_fatti}-${input.punti_subiti}`;

  const { error: statisticheError } = await supabase
    .from("partite_statistiche")
    .upsert(
      {
        club_id: clubId,
        squadra_id: partita.squadra_id,
        partita_id: partita.id,
        punti_fatti: input.punti_fatti,
        punti_subiti: input.punti_subiti,
        mete_fatte: input.mete_fatte,
        mete_subite: input.mete_subite,
        calci_fatti: input.calci_fatti,
        calci_subiti: input.calci_subiti,
        ammonizioni: input.ammonizioni,
        espulsioni: input.espulsioni,
        note: input.note ?? null,
        updated_by: user.id,
        updated_at: new Date().toISOString(),
      },
      {
        onConflict: "partita_id",
      }
    );

  if (statisticheError) {
    throw new Error(statisticheError.message);
  }

  const { error: partitaUpdateError } = await supabase
    .from("partite")
    .update({
      punti_fatti: input.punti_fatti,
      punti_subiti: input.punti_subiti,
      risultato,
      stato_partita: "giocata",
    })
    .eq("id", partita.id)
    .eq("club_id", clubId);

  if (partitaUpdateError) {
    throw new Error(partitaUpdateError.message);
  }

  revalidatePath(`/partite/${input.partita_id}`);
  revalidatePath("/partite");
}

export async function salvaConvocazioniPartita(
  partitaId: string,
  convocazioni: ConvocazioneInput[]
) {
  const { supabase, user, clubId } = await getContestoUtente();

  const { data: partita, error: partitaError } = await supabase
    .from("partite")
    .select("id,club_id,squadra_id")
    .eq("id", partitaId)
    .eq("club_id", clubId)
    .single();

  if (partitaError || !partita) {
    throw new Error("Partita non trovata.");
  }

  const righe = convocazioni.map((convocazione) => ({
    club_id: clubId,
    squadra_id: partita.squadra_id,
    partita_id: partita.id,
    giocatore_id: convocazione.giocatore_id,
    convocato: convocazione.convocato,
    titolare: convocazione.titolare,
    capitano: convocazione.capitano,
    posizione: convocazione.posizione,
    numero_maglia: convocazione.numero_maglia,
    ordine: convocazione.ordine,
    note: convocazione.note ?? null,
    created_by: user.id,
    updated_at: new Date().toISOString(),
  }));

  const { error } = await supabase
    .from("partite_convocazioni")
    .upsert(righe, {
      onConflict: "partita_id,giocatore_id",
    });

  if (error) {
    throw new Error(error.message);
  }

  await supabase
    .from("partite")
    .update({
      stato_partita: "convocazioni",
    })
    .eq("id", partita.id)
    .eq("club_id", clubId);

  revalidatePath(`/partite/${partitaId}`);
  revalidatePath("/partite");
}