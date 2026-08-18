// src/lib/performance/colonne-report-catapult.ts
//
// Catalogo delle colonne del report Performance, in forma leggera
// (chiave + etichetta + categoria), senza il resto delle informazioni di
// rendering (allineamento, decimali, tipo) che servono solo alla tabella.
//
// Serve a due padroni:
//   - la pagina Utenti e permessi, per far scegliere all'admin quali
//     colonne ogni tipo profilo puo' vedere;
//   - ReportPerformanceSessioniClient, per filtrare BASE_COLUMNS in base
//     a quella scelta.
//
// La pagina Utenti non puo' importare BASE_COLUMNS direttamente perche'
// vive dentro un componente client da 60 KB: importarlo trascinerebbe
// l'intero report nel bundle della pagina permessi.
//
// ATTENZIONE alla coerenza: le CHIAVI qui sotto devono restare allineate
// a COLONNE_PDF in ReportPerformanceSessioniClient.tsx. La seconda meta'
// del catalogo (le colonne "extra") e' invece derivata dalla stessa
// PARAMETRI_CATAPULT usata dal report, quindi non puo' divergere.

import { PARAMETRI_CATAPULT } from "@/lib/performance/catapult-parametri";

export type ColonnaReport = {
  key: string;
  label: string;
  categoria: string;
};

/*
 * Colonne "curate" del report: le stesse di COLONNE_PDF. Le prime quattro
 * sono anagrafiche (data, sessione, giocatore, split) e non sono dati
 * Catapult veri e propri, ma restano nell'elenco perche' anche su quelle
 * puo' avere senso decidere chi le vede.
 */
const COLONNE_CURATE: ColonnaReport[] = [
  { key: "date", label: "Data", categoria: "Anagrafica" },
  { key: "session_title", label: "Sessione", categoria: "Anagrafica" },
  { key: "player_name", label: "Giocatore", categoria: "Anagrafica" },
  { key: "split_name", label: "Split", categoria: "Anagrafica" },
  { key: "duration", label: "Durata (min)", categoria: "Generali" },
  { key: "distance", label: "Distanza (m)", categoria: "Generali" },
  { key: "sprint_distance", label: "Sprint Distance (m)", categoria: "Generali" },
  { key: "top_speed", label: "Top Speed (m/s)", categoria: "Generali" },
  {
    key: "distance_per_minute",
    label: "Distanza/min (m/min)",
    categoria: "Generali",
  },
  { key: "power_score", label: "Power Score", categoria: "Generali" },
  { key: "work_ratio", label: "Work Ratio (%)", categoria: "Generali" },
  { key: "player_load", label: "Player Load", categoria: "Generali" },
  { key: "impacts", label: "Impacts", categoria: "Generali" },
  { key: "max_acc", label: "Max Acc (m/s²)", categoria: "Generali" },
  { key: "max_dec", label: "Max Dec (m/s²)", categoria: "Generali" },
];

/*
 * Stessa esclusione applicata dal report: i parametri gia' coperti dalle
 * colonne curate non vanno ripetuti.
 */
const CAMPI_GIA_COPERTI = new Set([
  "duration",
  "distance_metres",
  "sprint_distance_m",
  "distance_per_min_m_min",
  "top_speed_m_s",
  "power_score_w_kg",
  "work_ratio",
  "player_load",
  "impacts",
  "max_acceleration_m_s_s",
  "max_deceleration_m_s_s",
]);

const COLONNE_EXTRA: ColonnaReport[] = PARAMETRI_CATAPULT.filter(
  (parametro) => !CAMPI_GIA_COPERTI.has(parametro.campo)
).map((parametro) => ({
  key: parametro.campo,
  label: parametro.label,
  categoria: parametro.categoria,
}));

export const COLONNE_REPORT_CATAPULT: ColonnaReport[] = [
  ...COLONNE_CURATE,
  ...COLONNE_EXTRA,
];

/** Colonne raggruppate per categoria, per l'interfaccia dei permessi. */
export function colonneReportPerCategoria(): {
  categoria: string;
  colonne: ColonnaReport[];
}[] {
  const gruppi = new Map<string, ColonnaReport[]>();

  for (const colonna of COLONNE_REPORT_CATAPULT) {
    const elenco = gruppi.get(colonna.categoria) ?? [];
    elenco.push(colonna);
    gruppi.set(colonna.categoria, elenco);
  }

  return Array.from(gruppi.entries()).map(([categoria, colonne]) => ({
    categoria,
    colonne,
  }));
}

export type PermessoColonna = {
  tipo_profilo: string;
  colonna_key: string;
  can_view: boolean;
};

/*
 * Codice speciale salvato nella colonna tipo_profilo per indicare la
 * configurazione COMUNE, valida per tutti i profili che non hanno una
 * configurazione propria. Non e' un tipo profilo reale e non compare in
 * tipi_profili: e' un contenitore, e il doppio underscore lo tiene fuori
 * dallo spazio dei codici normalizzati (minuscole, cifre e underscore
 * singoli) che l'applicazione genera.
 */
export const TIPO_PROFILO_TUTTI = "__tutti__";

/*
 * Traduce le righe di permessi_colonne_catapult in un insieme di chiavi
 * consentite.
 *
 * Ritorna null quando NON c'e' nessuna restrizione da applicare (admin,
 * oppure tipo profilo senza alcuna riga configurata): null significa
 * "tutte le colonne", ed e' diverso da un insieme vuoto, che significa
 * invece "nessuna colonna". La distinzione e' quella che evita di far
 * sparire tutto il report al primo deploy, quando la tabella e' vuota.
 */
export function colonneConsentitePerProfilo(
  permessi: PermessoColonna[],
  tipoProfilo: string | null,
  isAdmin: boolean
): Set<string> | null {
  if (isAdmin) return null;

  const insieme = (righe: PermessoColonna[]) =>
    new Set(
      righe
        .filter((permesso) => permesso.can_view)
        .map((permesso) => permesso.colonna_key)
    );

  /*
   * Ordine di risoluzione:
   *   1. configurazione specifica del tipo profilo, se esiste
   *   2. configurazione comune (TIPO_PROFILO_TUTTI), se esiste
   *   3. nessuna restrizione -> tutte le colonne
   *
   * Il punto 2 e' quello che fa vedere a tutti le colonne decise una
   * volta sola dall'admin, lasciando il punto 1 come eccezione da
   * usare solo quando un ruolo deve vedere qualcosa di diverso.
   */
  if (tipoProfilo) {
    const specifiche = permessi.filter(
      (permesso) => permesso.tipo_profilo === tipoProfilo
    );

    if (specifiche.length > 0) return insieme(specifiche);
  }

  const comuni = permessi.filter(
    (permesso) => permesso.tipo_profilo === TIPO_PROFILO_TUTTI
  );

  if (comuni.length > 0) return insieme(comuni);

  return null;
}
