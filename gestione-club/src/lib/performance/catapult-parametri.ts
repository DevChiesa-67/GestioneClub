// src/lib/performance/catapult-parametri.ts
//
// Elenco completo dei parametri numerici realmente presenti in
// catapult_data (vedi src/app/(dashboard)/performance/importa-dati/actions.ts
// per il mapping di importazione da cui questi nomi colonna sono presi).
// Usato dal report builder (/reportistica/nuovo) per far scegliere
// all'admin "qualsiasi parametro" reale invece di campi finti.

export type ParametroCatapult = {
  /** Nome esatto della colonna su public.catapult_data. */
  campo: string;
  /** Etichetta leggibile mostrata nell'interfaccia. */
  label: string;
  /** Categoria per raggruppare i parametri nella UI. */
  categoria: string;
};

const PARAMETRI_CORE: ParametroCatapult[] = [
  { campo: "duration", label: "Durata (min)", categoria: "Generali" },
  { campo: "distance_metres", label: "Distanza (m)", categoria: "Generali" },
  { campo: "sprint_distance_m", label: "Sprint Distance (m)", categoria: "Generali" },
  { campo: "distance_per_min_m_min", label: "Distanza per minuto (m/min)", categoria: "Generali" },
  { campo: "top_speed_m_s", label: "Top Speed (m/s)", categoria: "Generali" },
  { campo: "power_score_w_kg", label: "Power Score (w/kg)", categoria: "Generali" },
  { campo: "power_plays", label: "Power Plays", categoria: "Generali" },
  { campo: "work_ratio", label: "Work Ratio", categoria: "Generali" },
  { campo: "player_load", label: "Player Load", categoria: "Generali" },
  { campo: "energy_kcal", label: "Energia (kcal)", categoria: "Generali" },
  { campo: "impacts", label: "Impacts", categoria: "Generali" },
  { campo: "max_acceleration_m_s_s", label: "Max Accelerazione (m/s²)", categoria: "Generali" },
  { campo: "max_deceleration_m_s_s", label: "Max Decelerazione (m/s²)", categoria: "Generali" },
  { campo: "hr_load", label: "HR Load", categoria: "Frequenza cardiaca" },
  { campo: "hr_max_bpm", label: "HR Max (bpm)", categoria: "Frequenza cardiaca" },
  { campo: "time_in_red_zone_min", label: "Tempo in zona rossa (min)", categoria: "Frequenza cardiaca" },
];

// Famiglie di colonne "a zone": stesso pattern <prefisso>_<suffisso>,
// generate qui invece che scritte a mano per ridurre il rischio di
// errori di battitura nei nomi colonna reali.
function zone(
  prefisso: string,
  categoria: string,
  labelBase: string,
  suffissi: { suffisso: string; label: string }[]
): ParametroCatapult[] {
  return suffissi.map(({ suffisso, label }) => ({
    campo: `${prefisso}_${suffisso}`,
    label: `${labelBase} ${label}`,
    categoria,
  }));
}

const RANGE_STANDARD = [
  { suffisso: "0_1", label: "0-1 m/s²" },
  { suffisso: "1_2", label: "1-2 m/s²" },
  { suffisso: "2_3", label: "2-3 m/s²" },
  { suffisso: "3_4", label: "3-4 m/s²" },
  { suffisso: "gt_4", label: "> 4 m/s²" },
];

const PARAMETRI_ZONE: ParametroCatapult[] = [
  ...zone("distance_speed_zone", "Zone di velocità", "Distanza", [
    { suffisso: "1_metres", label: "Zona 1 (m)" },
    { suffisso: "2_metres", label: "Zona 2 (m)" },
    { suffisso: "3_metres", label: "Zona 3 (m)" },
    { suffisso: "4_metres", label: "Zona 4 (m)" },
    { suffisso: "5_metres", label: "Zona 5 (m)" },
  ]),
  ...zone("time_speed_zone", "Zone di velocità", "Tempo", [
    { suffisso: "1_secs", label: "Zona 1 (s)" },
    { suffisso: "2_secs", label: "Zona 2 (s)" },
    { suffisso: "3_secs", label: "Zona 3 (s)" },
    { suffisso: "4_secs", label: "Zona 4 (s)" },
    { suffisso: "5_secs", label: "Zona 5 (s)" },
  ]),
  ...zone("impact_zone", "Zone di impatto", "Impatti", [
    { suffisso: "3_5_g", label: "3-5 G" },
    { suffisso: "5_10_g", label: "5-10 G" },
    { suffisso: "10_15_g", label: "10-15 G" },
    { suffisso: "15_20_g", label: "15-20 G" },
    { suffisso: "gt_20_g", label: "> 20 G" },
  ]),
  ...zone("power_play_duration", "Power Play", "Durata", [
    { suffisso: "0_2_5_s", label: "0-2,5 s" },
    { suffisso: "2_5_5_s", label: "2,5-5 s" },
    { suffisso: "5_7_5_s", label: "5-7,5 s" },
    { suffisso: "7_5_10_s", label: "7,5-10 s" },
    { suffisso: "gt_10_s", label: "> 10 s" },
  ]),
  ...zone("distance_deceleration", "Zone di decelerazione", "Distanza", RANGE_STANDARD),
  ...zone("time_deceleration", "Zone di decelerazione", "Tempo", RANGE_STANDARD),
  ...zone("distance_acceleration", "Zone di accelerazione", "Distanza", RANGE_STANDARD),
  ...zone("time_acceleration", "Zone di accelerazione", "Tempo", RANGE_STANDARD),
  ...zone("acceleration_count", "Zone di accelerazione", "Conteggio", RANGE_STANDARD),
  ...zone("deceleration_count", "Zone di decelerazione", "Conteggio", RANGE_STANDARD),
  ...zone("distance_power", "Zone di potenza", "Distanza", [
    { suffisso: "0_5", label: "0-5 w/kg" },
    { suffisso: "5_10", label: "5-10 w/kg" },
    { suffisso: "10_15", label: "10-15 w/kg" },
    { suffisso: "15_20", label: "15-20 w/kg" },
    { suffisso: "20_25", label: "20-25 w/kg" },
    { suffisso: "25_30", label: "25-30 w/kg" },
    { suffisso: "30_35", label: "30-35 w/kg" },
    { suffisso: "35_40", label: "35-40 w/kg" },
    { suffisso: "40_45", label: "40-45 w/kg" },
    { suffisso: "45_50", label: "45-50 w/kg" },
    { suffisso: "gt_50", label: "> 50 w/kg" },
  ]),
  ...zone("time_power", "Zone di potenza", "Tempo", [
    { suffisso: "0_5", label: "0-5 w/kg" },
    { suffisso: "5_10", label: "5-10 w/kg" },
    { suffisso: "10_15", label: "10-15 w/kg" },
    { suffisso: "15_20", label: "15-20 w/kg" },
    { suffisso: "20_25", label: "20-25 w/kg" },
    { suffisso: "25_30", label: "25-30 w/kg" },
    { suffisso: "30_35", label: "30-35 w/kg" },
    { suffisso: "35_40", label: "35-40 w/kg" },
    { suffisso: "40_45", label: "40-45 w/kg" },
    { suffisso: "45_50", label: "45-50 w/kg" },
    { suffisso: "gt_50", label: "> 50 w/kg" },
  ]),
  ...zone("time_hr_zone", "Frequenza cardiaca", "Tempo", [
    { suffisso: "0_60", label: "0-60% Max HR" },
    { suffisso: "60_75", label: "60-75% Max HR" },
    { suffisso: "75_85", label: "75-85% Max HR" },
    { suffisso: "85_96", label: "85-96% Max HR" },
    { suffisso: "96_100", label: "96-100% Max HR" },
  ]),
];

export const PARAMETRI_CATAPULT: ParametroCatapult[] = [
  ...PARAMETRI_CORE,
  ...PARAMETRI_ZONE,
];

export function trovaParametroCatapult(
  campo: string
): ParametroCatapult | undefined {
  return PARAMETRI_CATAPULT.find((parametro) => parametro.campo === campo);
}
