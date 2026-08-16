// src/lib/presenze/presenze-giornaliere.ts

import type { SupabaseClient } from "@supabase/supabase-js";

/*
 * Presenze per GIORNATA, non per seduta.
 *
 * La tabella presenze_giornaliere ha una riga per (club, giocatore, data):
 * e' il vincolo UNIQUE che impedisce il doppio conteggio quando in un
 * giorno ci sono due sedute (mattutina + serale). Gli stati sono gia'
 * giornalieri per costruzione: "presente_mattina" significa che quel
 * giorno il giocatore c'era solo la mattina.
 *
 * Le assenze NON vengono piu' pre-inserite alla creazione della seduta.
 * Il denominatore delle percentuali e' quindi la rosa attiva: per ogni
 * giornata con almeno una seduta consideriamo tutti i giocatori attivi
 * della squadra, e chi non ha una riga viene contato come assente
 * ingiustificato SOLO nel calcolo (campo "registrata: false"), senza
 * scrivere nulla nel database.
 *
 * Le assenze si deducono pero' unicamente per le sedute GIA' AVVENUTE:
 * su un allenamento di domani nessuno e' ancora assente, e marcare
 * l'intera rosa come assente falserebbe medie e percentuali. Vedi
 * giornataConclusa().
 */

export type StatoPresenzaDb =
  | "presente_mattina"
  | "presente_pomeriggio"
  | "presente_entrambe"
  | "infortunato"
  | "assenza_giustificata"
  | "assenza_ingiustificata";

export const STATI_PRESENTE: StatoPresenzaDb[] = [
  "presente_mattina",
  "presente_pomeriggio",
  "presente_entrambe",
];

export function isPresente(stato: StatoPresenzaDb | string): boolean {
  return STATI_PRESENTE.includes(stato as StatoPresenzaDb);
}

export type PresenzaGiornaliera = {
  /** Per le assenze dedotte e' un id sintetico, non esiste nel database. */
  id: string;
  stato: StatoPresenzaDb;
  giocatore_id: string;
  squadra_id: string | null;
  /** Giornata in formato ISO YYYY-MM-DD. */
  data: string;
  /** false = assenza dedotta dalla rosa, nessuna riga salvata. */
  registrata: boolean;
};

export type ParametriPresenze = {
  clubId: string;
  squadraId: string | null;
  /** Se valorizzato, limita ai giocatori indicati. */
  giocatoreIds?: string[];
  dataDa?: string;
  dataA?: string;
};

type RigaPresenza = {
  id: string;
  stato: StatoPresenzaDb;
  giocatore_id: string;
  squadra_id: string | null;
  data: string;
};

type RigaGiocatore = {
  id: string;
  squadra_id: string | null;
};

function chiave(giocatoreId: string, data: string): string {
  return `${giocatoreId}|${data}`;
}

function oggiIso(adesso: Date): string {
  const anno = adesso.getFullYear();
  const mese = String(adesso.getMonth() + 1).padStart(2, "0");
  const giorno = String(adesso.getDate()).padStart(2, "0");

  return `${anno}-${mese}-${giorno}`;
}

function oraCorrente(adesso: Date): string {
  const ore = String(adesso.getHours()).padStart(2, "0");
  const minuti = String(adesso.getMinutes()).padStart(2, "0");

  return `${ore}:${minuti}`;
}

/*
 * Una giornata e' "conclusa" (e quindi le assenze mancanti si possono
 * dedurre) se e' passata, oppure se e' oggi e almeno una delle sedute in
 * programma e' gia' iniziata. Se le sedute di oggi non hanno un orario
 * restiamo prudenti e non deduciamo nulla: meglio una percentuale
 * mancante che una squadra intera segnata assente per errore.
 */
function giornataConclusa(
  giorno: string,
  orariInizio: (string | null)[],
  adesso: Date
): boolean {
  const oggi = oggiIso(adesso);

  if (giorno < oggi) return true;
  if (giorno > oggi) return false;

  const adessoHHMM = oraCorrente(adesso);

  return orariInizio.some(
    (ora) => Boolean(ora) && (ora as string).slice(0, 5) <= adessoHHMM
  );
}

/*
 * Carica le presenze di un periodo completandole con le assenze dedotte.
 *
 * Il client va passato dal chiamante perche' questa funzione serve sia
 * lato browser (supabase-client) sia lato server (supabase-server).
 */
export async function caricaPresenzeGiornaliere(
  client: SupabaseClient,
  parametri: ParametriPresenze
): Promise<PresenzaGiornaliera[]> {
  const { clubId, squadraId, giocatoreIds, dataDa, dataA } = parametri;

  // 1. Giornate in cui la squadra si e' allenata: sono queste a definire
  //    il calendario su cui misurare le presenze.
  let sedute = client
    .from("allenamenti")
    .select("data_allenamento, ora_inizio")
    .eq("club_id", clubId);

  if (squadraId) sedute = sedute.eq("squadra_id", squadraId);
  if (dataDa) sedute = sedute.gte("data_allenamento", dataDa);
  if (dataA) sedute = sedute.lte("data_allenamento", dataA);

  // 2. Rosa attiva: il denominatore.
  let rosa = client
    .from("giocatori")
    .select("id, squadra_id")
    .eq("club_id", clubId)
    .eq("attivo", true);

  if (squadraId) rosa = rosa.eq("squadra_id", squadraId);
  if (giocatoreIds && giocatoreIds.length > 0) {
    rosa = rosa.in("id", giocatoreIds);
  }

  // 3. Presenze effettivamente registrate.
  let registrate = client
    .from("presenze_giornaliere")
    .select("id, stato, giocatore_id, squadra_id, data")
    .eq("club_id", clubId);

  if (squadraId) registrate = registrate.eq("squadra_id", squadraId);
  if (giocatoreIds && giocatoreIds.length > 0) {
    registrate = registrate.in("giocatore_id", giocatoreIds);
  }
  if (dataDa) registrate = registrate.gte("data", dataDa);
  if (dataA) registrate = registrate.lte("data", dataA);

  const [seduteRes, rosaRes, registrateRes] = await Promise.all([
    sedute,
    rosa,
    registrate,
  ]);

  if (seduteRes.error) {
    console.error("Errore caricamento sedute:", seduteRes.error);
  }

  if (rosaRes.error) {
    console.error("Errore caricamento rosa:", rosaRes.error);
  }

  if (registrateRes.error) {
    console.error("Errore caricamento presenze giornaliere:", registrateRes.error);
    return [];
  }

  const righe = (registrateRes.data ?? []) as RigaPresenza[];
  const giocatori = (rosaRes.data ?? []) as RigaGiocatore[];

  const orariPerGiorno = new Map<string, (string | null)[]>();

  for (const seduta of (seduteRes.data ?? []) as {
    data_allenamento: string | null;
    ora_inizio: string | null;
  }[]) {
    if (!seduta.data_allenamento) continue;

    const orari = orariPerGiorno.get(seduta.data_allenamento) ?? [];
    orari.push(seduta.ora_inizio);
    orariPerGiorno.set(seduta.data_allenamento, orari);
  }

  const giorni = new Set<string>(orariPerGiorno.keys());

  // Una presenza registrata in un giorno senza sedute (correzione manuale,
  // amichevole non a calendario...) non va persa.
  for (const riga of righe) {
    if (riga.data) giorni.add(riga.data);
  }

  const perChiave = new Map<string, RigaPresenza>();

  for (const riga of righe) {
    perChiave.set(chiave(riga.giocatore_id, riga.data), riga);
  }

  const risultato: PresenzaGiornaliera[] = [];
  const adesso = new Date();

  for (const giorno of giorni) {
    const conclusa = giornataConclusa(
      giorno,
      orariPerGiorno.get(giorno) ?? [],
      adesso
    );

    for (const giocatore of giocatori) {
      const registrata = perChiave.get(chiave(giocatore.id, giorno));

      if (registrata) {
        risultato.push({
          id: registrata.id,
          stato: registrata.stato,
          giocatore_id: registrata.giocatore_id,
          squadra_id: registrata.squadra_id,
          data: registrata.data,
          registrata: true,
        });

        continue;
      }

      // Seduta non ancora avvenuta: nessuna assenza da dedurre. Il
      // giocatore semplicemente non compare ancora nei conteggi.
      if (!conclusa) continue;

      risultato.push({
        id: `dedotta:${giocatore.id}:${giorno}`,
        stato: "assenza_ingiustificata",
        giocatore_id: giocatore.id,
        squadra_id: giocatore.squadra_id,
        data: giorno,
        registrata: false,
      });
    }
  }

  return risultato.sort((a, b) => a.data.localeCompare(b.data));
}

/*
 * Percentuale di presenza per giornata, usata dai grafici della dashboard.
 */
export type PuntoPresenzaGiorno = {
  data: string;
  presenti: number;
  totale: number;
  percentuale: number;
};

export function aggregaPresenzePerGiorno(
  presenze: PresenzaGiornaliera[]
): PuntoPresenzaGiorno[] {
  const perGiorno = new Map<string, { presenti: number; totale: number }>();

  for (const presenza of presenze) {
    const corrente = perGiorno.get(presenza.data) ?? {
      presenti: 0,
      totale: 0,
    };

    corrente.totale += 1;

    if (isPresente(presenza.stato)) {
      corrente.presenti += 1;
    }

    perGiorno.set(presenza.data, corrente);
  }

  return Array.from(perGiorno.entries())
    .map(([data, valori]) => ({
      data,
      presenti: valori.presenti,
      totale: valori.totale,
      percentuale:
        valori.totale > 0
          ? Math.round((valori.presenti / valori.totale) * 100)
          : 0,
    }))
    .sort((a, b) => a.data.localeCompare(b.data));
}
