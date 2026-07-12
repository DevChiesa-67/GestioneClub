"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase-server";

type TipoSeduta = "allenamento" | "partita" | null;

type CatapultPreviewRowInput = {
  giocatore_id: string | null;
  giocatore_trovato: boolean;
  giocatore_nome_completo: string | null;
  data_seduta: string;
  tipo_seduta: TipoSeduta;
  raw_data: Record<string, unknown>;
};

type ConfermaImportazioneInput = {
  nome: string;
  filename: string;
  data_seduta: string | null;
  tipo_seduta: TipoSeduta;
  rows: CatapultPreviewRowInput[];
};

function toNumber(value: unknown): number | null {
  if (value === null || value === undefined) return null;

  const text = String(value).trim();
  if (text === "") return null;

  const normalized = text.replace(",", ".").replace(/[^\d.-]/g, "").trim();
  if (normalized === "") return null;

  const number = Number(normalized);

  return Number.isFinite(number) ? number : null;
}

function toText(value: unknown): string | null {
  if (value === null || value === undefined) return null;

  const text = String(value).trim();

  return text.length > 0 ? text : null;
}

function getValue(row: Record<string, unknown>, key: string): unknown {
  return row[key] ?? null;
}

async function getContestoCorrente() {
  const supabase = await createClient();

  const {
    data: { user },
    error: userError,
  } = await supabase.auth.getUser();

  if (userError || !user) {
    throw new Error("Utente non autenticato.");
  }

  const { data: profilo, error: profiloError } = await supabase
    .from("profili")
    .select("id,tipo_profilo,last_club_id,last_squadra_id")
    .eq("auth_user_id", user.id)
    .single();

  if (profiloError || !profilo) {
    throw new Error("Profilo non trovato.");
  }

  if (!profilo.last_club_id) {
    throw new Error("Nessun club attivo selezionato.");
  }

  return {
    supabase,
    profiloId: profilo.id,
    tipoProfilo: String(profilo.tipo_profilo || "").toLowerCase(),
    clubId: profilo.last_club_id as string,
    squadraId: profilo.last_squadra_id as string | null,
  };
}

function assertAdmin(tipoProfilo: string) {
  if (tipoProfilo !== "admin") {
    throw new Error(
      "Non hai i permessi per modificare i dati di Performance."
    );
  }
}

export async function confermaImportazioneCatapult(
  input: ConfermaImportazioneInput
) {
  const { supabase, profiloId, tipoProfilo, clubId, squadraId } =
    await getContestoCorrente();

  assertAdmin(tipoProfilo);

  const nome = input.nome.trim();

  if (!nome) {
    throw new Error("Inserisci un nome per l'importazione.");
  }

  if (!input.rows || input.rows.length === 0) {
    throw new Error("Non ci sono righe da importare.");
  }

  const giocatoriTrovati = input.rows.filter(
    (row) => row.giocatore_trovato
  ).length;

  const giocatoriNonTrovati = input.rows.filter(
    (row) => !row.giocatore_trovato
  ).length;

  const { data: importazione, error: importazioneError } = await supabase
    .from("catapult_importazioni")
    .insert({
      club_id: clubId,
      squadra_id: squadraId,
      nome,
      filename: input.filename || null,
      data_seduta: input.data_seduta || null,
      tipo_seduta: input.tipo_seduta,
      numero_righe: input.rows.length,
      numero_giocatori_trovati: giocatoriTrovati,
      numero_giocatori_non_trovati: giocatoriNonTrovati,
      created_by: profiloId,
    })
    .select("id")
    .single();

  if (importazioneError || !importazione) {
    throw new Error(
      importazioneError?.message ??
        "Errore durante la creazione dell'importazione."
    );
  }

  const rowsToInsert = input.rows.map((row) => {
    const raw = row.raw_data;

    return {
      importazione_id: importazione.id,
      club_id: clubId,
      squadra_id: squadraId,
      giocatore_id: row.giocatore_id,

      date: row.data_seduta || null,

      session_title: toText(getValue(raw, "Session Title")),
      player_name: toText(getValue(raw, "Player Name")),
      split_name: toText(getValue(raw, "Split Name")),
      tags: toText(getValue(raw, "Tags")),
      split_start_time: toText(getValue(raw, "Split Start Time")),
      split_end_time: toText(getValue(raw, "Split End Time")),

      duration: toNumber(getValue(raw, "Duration")),
      distance_metres: toNumber(getValue(raw, "Distance (metres)")),
      sprint_distance_m: toNumber(getValue(raw, "Sprint Distance (m)")),
      power_plays: toNumber(getValue(raw, "Power Plays")),
      energy_kcal: toNumber(getValue(raw, "Energy (kcal)")),
      impacts: toNumber(getValue(raw, "Impacts")),
      hr_load: toNumber(getValue(raw, "Hr Load")),
      time_in_red_zone_min: toNumber(getValue(raw, "Time In Red Zone (min)")),
      player_load: toNumber(getValue(raw, "Player Load")),
      top_speed_m_s: toNumber(getValue(raw, "Top Speed (m/s)")),
      distance_per_min_m_min: toNumber(getValue(raw, "Distance Per Min (m/min)")),
      power_score_w_kg: toNumber(getValue(raw, "Power Score (w/kg)")),
      work_ratio: toNumber(getValue(raw, "Work Ratio")),
      hr_max_bpm: toNumber(getValue(raw, "Hr Max (bpm)")),
      max_deceleration_m_s_s: toNumber(getValue(raw, "Max Deceleration (m/s/s)")),
      max_acceleration_m_s_s: toNumber(getValue(raw, "Max Acceleration (m/s/s)")),

      distance_speed_zone_1_metres: toNumber(getValue(raw, "Distance in Speed Zone 1  (metres)")),
      distance_speed_zone_2_metres: toNumber(getValue(raw, "Distance in Speed Zone 2  (metres)")),
      distance_speed_zone_3_metres: toNumber(getValue(raw, "Distance in Speed Zone 3  (metres)")),
      distance_speed_zone_4_metres: toNumber(getValue(raw, "Distance in Speed Zone 4  (metres)")),
      distance_speed_zone_5_metres: toNumber(getValue(raw, "Distance in Speed Zone 5  (metres)")),

      time_speed_zone_1_secs: toNumber(getValue(raw, "Time in Speed Zone 1 (secs)")),
      time_speed_zone_2_secs: toNumber(getValue(raw, "Time in Speed Zone 2 (secs)")),
      time_speed_zone_3_secs: toNumber(getValue(raw, "Time in Speed Zone 3 (secs)")),
      time_speed_zone_4_secs: toNumber(getValue(raw, "Time in Speed Zone 4 (secs)")),
      time_speed_zone_5_secs: toNumber(getValue(raw, "Time in Speed Zone 5 (secs)")),

      impact_zone_3_5_g: toNumber(getValue(raw, "Impact Zones: 3 - 5 G (Impacts)")),
      impact_zone_5_10_g: toNumber(getValue(raw, "Impact Zones: 5 - 10 G (Impacts)")),
      impact_zone_10_15_g: toNumber(getValue(raw, "Impact Zones: 10 - 15 G (Impacts)")),
      impact_zone_15_20_g: toNumber(getValue(raw, "Impact Zones: 15 - 20 G (Impacts)")),
      impact_zone_gt_20_g: toNumber(getValue(raw, "Impact Zones: > 20 G (Impacts)")),

      power_play_duration_0_2_5_s: toNumber(getValue(raw, "Power Play Duration Zones: 0 - 2.5 s (Power Plays)")),
      power_play_duration_2_5_5_s: toNumber(getValue(raw, "Power Play Duration Zones: 2.5 - 5 s (Power Plays)")),
      power_play_duration_5_7_5_s: toNumber(getValue(raw, "Power Play Duration Zones: 5 - 7.5 s (Power Plays)")),
      power_play_duration_7_5_10_s: toNumber(getValue(raw, "Power Play Duration Zones: 7.5 - 10 s (Power Plays)")),
      power_play_duration_gt_10_s: toNumber(getValue(raw, "Power Play Duration Zones: > 10 s (Power Plays)")),

      distance_deceleration_0_1: toNumber(getValue(raw, "Distance in Deceleration Zones: 0 - 1 m/s/s  (metres)")),
      distance_deceleration_1_2: toNumber(getValue(raw, "Distance in Deceleration Zones: 1 - 2 m/s/s  (metres)")),
      distance_deceleration_2_3: toNumber(getValue(raw, "Distance in Deceleration Zones: 2 - 3 m/s/s  (metres)")),
      distance_deceleration_3_4: toNumber(getValue(raw, "Distance in Deceleration Zones: 3 - 4 m/s/s  (metres)")),
      distance_deceleration_gt_4: toNumber(getValue(raw, "Distance in Deceleration Zones: > 4 m/s/s  (metres)")),

      time_deceleration_0_1: toNumber(getValue(raw, "Time in Deceleration Zones: 0 - 1 m/s/s (secs)")),
      time_deceleration_1_2: toNumber(getValue(raw, "Time in Deceleration Zones: 1 - 2 m/s/s (secs)")),
      time_deceleration_2_3: toNumber(getValue(raw, "Time in Deceleration Zones: 2 - 3 m/s/s (secs)")),
      time_deceleration_3_4: toNumber(getValue(raw, "Time in Deceleration Zones: 3 - 4 m/s/s (secs)")),
      time_deceleration_gt_4: toNumber(getValue(raw, "Time in Deceleration Zones: > 4 m/s/s (secs)")),

      distance_acceleration_0_1: toNumber(getValue(raw, "Distance in Acceleration Zones: 0 - 1 m/s/s  (metres)")),
      distance_acceleration_1_2: toNumber(getValue(raw, "Distance in Acceleration Zones: 1 - 2 m/s/s  (metres)")),
      distance_acceleration_2_3: toNumber(getValue(raw, "Distance in Acceleration Zones: 2 - 3 m/s/s  (metres)")),
      distance_acceleration_3_4: toNumber(getValue(raw, "Distance in Acceleration Zones: 3 - 4 m/s/s  (metres)")),
      distance_acceleration_gt_4: toNumber(getValue(raw, "Distance in Acceleration Zones: > 4 m/s/s  (metres)")),

      time_acceleration_0_1: toNumber(getValue(raw, "Time in Acceleration Zones: 0 - 1 m/s/s (secs)")),
      time_acceleration_1_2: toNumber(getValue(raw, "Time in Acceleration Zones: 1 - 2 m/s/s (secs)")),
      time_acceleration_2_3: toNumber(getValue(raw, "Time in Acceleration Zones: 2 - 3 m/s/s (secs)")),
      time_acceleration_3_4: toNumber(getValue(raw, "Time in Acceleration Zones: 3 - 4 m/s/s (secs)")),
      time_acceleration_gt_4: toNumber(getValue(raw, "Time in Acceleration Zones: > 4 m/s/s (secs)")),

      distance_power_0_5: toNumber(getValue(raw, "Distance in Power Zone: 0 - 5 w/kg  (metres)")),
      distance_power_5_10: toNumber(getValue(raw, "Distance in Power Zone: 5 - 10 w/kg  (metres)")),
      distance_power_10_15: toNumber(getValue(raw, "Distance in Power Zone: 10 - 15 w/kg  (metres)")),
      distance_power_15_20: toNumber(getValue(raw, "Distance in Power Zone: 15 - 20 w/kg  (metres)")),
      distance_power_20_25: toNumber(getValue(raw, "Distance in Power Zone: 20 - 25 w/kg  (metres)")),
      distance_power_25_30: toNumber(getValue(raw, "Distance in Power Zone: 25 - 30 w/kg  (metres)")),
      distance_power_30_35: toNumber(getValue(raw, "Distance in Power Zone: 30 - 35 w/kg  (metres)")),
      distance_power_35_40: toNumber(getValue(raw, "Distance in Power Zone: 35 - 40 w/kg  (metres)")),
      distance_power_40_45: toNumber(getValue(raw, "Distance in Power Zone: 40 - 45 w/kg  (metres)")),
      distance_power_45_50: toNumber(getValue(raw, "Distance in Power Zone: 45 - 50 w/kg  (metres)")),
      distance_power_gt_50: toNumber(getValue(raw, "Distance in Power Zone: > 50 w/kg  (metres)")),

      time_power_0_5: toNumber(getValue(raw, "Time in Power Zone: 0 - 5 w/kg (secs)")),
      time_power_5_10: toNumber(getValue(raw, "Time in Power Zone: 5 - 10 w/kg (secs)")),
      time_power_10_15: toNumber(getValue(raw, "Time in Power Zone: 10 - 15 w/kg (secs)")),
      time_power_15_20: toNumber(getValue(raw, "Time in Power Zone: 15 - 20 w/kg (secs)")),
      time_power_20_25: toNumber(getValue(raw, "Time in Power Zone: 20 - 25 w/kg (secs)")),
      time_power_25_30: toNumber(getValue(raw, "Time in Power Zone: 25 - 30 w/kg (secs)")),
      time_power_30_35: toNumber(getValue(raw, "Time in Power Zone: 30 - 35 w/kg (secs)")),
      time_power_35_40: toNumber(getValue(raw, "Time in Power Zone: 35 - 40 w/kg (secs)")),
      time_power_40_45: toNumber(getValue(raw, "Time in Power Zone: 40 - 45 w/kg (secs)")),
      time_power_45_50: toNumber(getValue(raw, "Time in Power Zone: 45 - 50 w/kg (secs)")),
      time_power_gt_50: toNumber(getValue(raw, "Time in Power Zone: > 50 w/kg (secs)")),

      time_hr_zone_0_60: toNumber(getValue(raw, "Time in HR Load Zone 0% - 60% Max HR(secs)")),
      time_hr_zone_60_75: toNumber(getValue(raw, "Time in HR Load Zone 60% - 75% Max HR (secs)")),
      time_hr_zone_75_85: toNumber(getValue(raw, "Time in HR Load Zone 75% - 85% Max HR (secs)")),
      time_hr_zone_85_96: toNumber(getValue(raw, "Time in HR Load Zone 85% - 96% Max HR (secs)")),
      time_hr_zone_96_100: toNumber(getValue(raw, "Time in HR Load Zone 96% - 100% Max HR (secs)")),

      acceleration_count_0_1: toNumber(getValue(raw, "Accelerations Zone Count: 0 - 1 m/s/s")),
      acceleration_count_1_2: toNumber(getValue(raw, "Accelerations Zone Count: 1 - 2 m/s/s")),
      acceleration_count_2_3: toNumber(getValue(raw, "Accelerations Zone Count: 2 - 3 m/s/s")),
      acceleration_count_3_4: toNumber(getValue(raw, "Accelerations Zone Count: 3 - 4 m/s/s")),
      acceleration_count_gt_4: toNumber(getValue(raw, "Accelerations Zone Count: > 4 m/s/s")),

      deceleration_count_0_1: toNumber(getValue(raw, "Deceleration Zone Count: 0 - 1 m/s/s")),
      deceleration_count_1_2: toNumber(getValue(raw, "Deceleration Zone Count: 1 - 2 m/s/s")),
      deceleration_count_2_3: toNumber(getValue(raw, "Deceleration Zone Count: 2 - 3 m/s/s")),
      deceleration_count_3_4: toNumber(getValue(raw, "Deceleration Zone Count: 3 - 4 m/s/s")),
      deceleration_count_gt_4: toNumber(getValue(raw, "Deceleration Zone Count: > 4 m/s/s")),

      raw_data: raw,
    };
  });

  const { error: dataError } = await supabase
    .from("catapult_data")
    .insert(rowsToInsert);

  if (dataError) {
    await supabase
      .from("catapult_importazioni")
      .delete()
      .eq("id", importazione.id)
      .eq("club_id", clubId);

    throw new Error(
      dataError.message ??
        "Errore durante il salvataggio delle righe Catapult."
    );
  }

  revalidatePath("/performance/importa-dati");

  return {
    success: true,
    importazione_id: importazione.id,
  };
}

export async function eliminaImportazioneCatapult(importazioneId: string) {
  const { supabase, tipoProfilo, clubId, squadraId } =
    await getContestoCorrente();

  assertAdmin(tipoProfilo);

  let query = supabase
    .from("catapult_importazioni")
    .delete()
    .eq("id", importazioneId)
    .eq("club_id", clubId);

  if (squadraId) {
    query = query.eq("squadra_id", squadraId);
  } else {
    query = query.is("squadra_id", null);
  }

  const { error } = await query;

  if (error) {
    throw new Error(
      error.message ?? "Errore durante l'eliminazione dell'importazione."
    );
  }

  revalidatePath("/performance/importa-dati");

  return {
    success: true,
  };
}