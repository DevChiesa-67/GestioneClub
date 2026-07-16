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

type ModificaDettagliInput = {
  partita_id: string;
  squadra_casa_id: string;
  squadra_fuori_id: string;
  data_partita: string;
  ora_partita: string;
  luogo?: string | null;
  tipo_partita: string;
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

export async function eliminaPartita(partitaId: string) {
  const { supabase, clubId } = await getContestoUtente();

  const { data: partita, error: partitaError } = await supabase
    .from("partite")
    .select("id,club_id")
    .eq("id", partitaId)
    .eq("club_id", clubId)
    .single();

  if (partitaError || !partita) {
    throw new Error("Partita non trovata.");
  }

  const { error: convocazioniError } = await supabase
    .from("partite_convocazioni")
    .delete()
    .eq("partita_id", partitaId)
    .eq("club_id", clubId);

  if (convocazioniError) {
    throw new Error(convocazioniError.message);
  }

  const { error: statisticheError } = await supabase
    .from("partite_statistiche")
    .delete()
    .eq("partita_id", partitaId)
    .eq("club_id", clubId);

  if (statisticheError) {
    throw new Error(statisticheError.message);
  }

  const { error: partitaDeleteError } = await supabase
    .from("partite")
    .delete()
    .eq("id", partitaId)
    .eq("club_id", clubId);

  if (partitaDeleteError) {
    throw new Error(partitaDeleteError.message);
  }

  revalidatePath("/partite");
}

export async function modificaDettagliPartita(input: ModificaDettagliInput) {
  const { supabase, clubId } = await getContestoUtente();

  if (!input.squadra_casa_id || !input.squadra_fuori_id) {
    throw new Error("Seleziona entrambe le squadre.");
  }

  if (input.squadra_casa_id === input.squadra_fuori_id) {
    throw new Error("Le due squadre devono essere diverse.");
  }

  if (!input.data_partita || !input.ora_partita) {
    throw new Error("Inserisci data e ora della partita.");
  }

  const { data: partita, error: partitaError } = await supabase
    .from("partite")
    .select("id,club_id")
    .eq("id", input.partita_id)
    .eq("club_id", clubId)
    .single();

  if (partitaError || !partita) {
    throw new Error("Partita non trovata.");
  }

  const { data: squadre, error: squadreError } = await supabase
    .from("squadre_partite")
    .select("id")
    .eq("club_id", clubId)
    .in("id", [input.squadra_casa_id, input.squadra_fuori_id]);

  if (squadreError) {
    throw new Error(squadreError.message);
  }

  if (!squadre || squadre.length !== 2) {
    throw new Error(
      "Una o entrambe le squadre non appartengono al club attivo."
    );
  }

  const { error: updateError } = await supabase
    .from("partite")
    .update({
      squadra_casa_id: input.squadra_casa_id,
      squadra_fuori_id: input.squadra_fuori_id,
      data_partita: input.data_partita,
      ora_partita: input.ora_partita,
      luogo: input.luogo?.trim() || null,
      tipo_partita: input.tipo_partita,
      note: input.note?.trim() || null,
    })
    .eq("id", input.partita_id)
    .eq("club_id", clubId);

  if (updateError) {
    throw new Error(updateError.message);
  }

  revalidatePath(`/partite/${input.partita_id}`);
  revalidatePath("/partite");
}