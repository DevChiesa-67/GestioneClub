import * as XLSX from "xlsx";

// Parser per i file di PALESTRA (formato "gym"): un foglio per gruppo
// (props, locks-back row, backs, core and wellness, ...) e dentro ogni
// foglio piu' blocchi introdotti da un'etichetta ("day A", "circuit B")
// seguita da una riga di intestazione che contiene "esercizio".
//
// Esempio di foglio:
//        | day A          |       |     |     |        |          |
//        | esercizio      | serie | rep | rpe | carico | recupero | note
//        | overhead squat | 4     | 4   | 8   |        | 3'       |
//
// Due cose lo rendono tollerante ai file veri:
//  1. le colonne si leggono DALL'INTESTAZIONE, non da posizioni fisse:
//     il foglio "core and wellness" non ha la colonna rpe e funziona
//     lo stesso;
//  2. le date NON sono richieste nel file. Un ciclo di palestra vale per
//     un periodo, non per un giorno: dal/al si indicano in fase di
//     import e i blocchi si datano nell'anteprima.
//
// Come per l'import allenamenti, e' "best effort": le righe non
// riconosciute finiscono in `avvisi` invece di bloccare tutto.

export type EsercizioPalestra = {
  /** Nome del foglio da cui arriva: props, backs, ... */
  gruppo: string;
  esercizio: string;
  serie: number | null;
  /** Testo: vale anche 30" o 12-15, non solo un numero. */
  ripetizioni: string | null;
  rpe: number | null;
  /** Testo: vale anche "bw" (bodyweight). */
  carico: string | null;
  /** Recupero convertito in minuti (3' -> 3, 1'30" -> 1.5, 30" -> 0.5). */
  recupero_minuti: number | null;
  /** Testo originale del recupero, per mostrarlo tale e quale. */
  recupero_testo: string | null;
  note: string | null;
};

export type BloccoPalestra = {
  /** Etichetta del blocco nel file: "day A", "circuit B", ... */
  etichetta: string;
  /** Gruppi (fogli) che contengono questo blocco. */
  gruppi: string[];
  esercizi: EsercizioPalestra[];
};

export type RisultatoImportPalestra = {
  blocchi: BloccoPalestra[];
  /** Date del ciclo lette dal file, se presenti (template palestra). */
  cicloDal: string | null;
  cicloAl: string | null;
  avvisi: string[];
};

type ChiaveColonna =
  | "esercizio"
  | "serie"
  | "ripetizioni"
  | "rpe"
  | "carico"
  | "recupero"
  | "note";

/** Nomi accettati per ogni colonna: l'intestazione del file puo' variare. */
const INTESTAZIONI: Record<ChiaveColonna, string[]> = {
  esercizio: ["esercizio", "exercise", "nome"],
  serie: ["serie", "sets", "set"],
  ripetizioni: ["rep", "reps", "ripetizioni", "ripetizione"],
  rpe: ["rpe"],
  carico: ["carico", "load", "peso"],
  recupero: ["recupero", "rec", "rest"],
  note: ["note", "nota", "notes"],
};

const FOGLI_DA_IGNORARE = [
  "note per la compilazione",
  "note",
  "istruzioni",
  "legenda",
];

const CICLO_RE =
  /dal\s+(\d{1,2})\/(\d{1,2})\/(\d{4})\s+al\s+(\d{1,2})\/(\d{1,2})\/(\d{4})/i;

function normalizza(valore: unknown) {
  return String(valore ?? "")
    .trim()
    .toLocaleLowerCase("it-IT")
    .replace(/\s+/g, " ");
}

/** "core and wellness" non e' un gruppo di ruolo: nell'app e' un circuito. */
function nomeGruppoPalestra(nomeFoglio: string) {
  return normalizza(nomeFoglio) === "core and wellness"
    ? "Circuiti"
    : nomeFoglio.trim();
}

function pulisci(valore: unknown): string | null {
  if (valore === null || valore === undefined) return null;
  const testo = String(valore).trim();
  if (testo === "" || testo === "—" || testo === "-") return null;
  return testo;
}

function numero(valore: unknown): number | null {
  const testo = pulisci(valore);
  if (!testo) return null;
  const match = testo.replace(",", ".").match(/-?\d+(?:\.\d+)?/);
  if (!match) return null;
  const n = Number(match[0]);
  return Number.isFinite(n) ? n : null;
}

/**
 * Converte il recupero in minuti. Nel file si scrive all'italiana:
 * 3' = 3 minuti, 30" = mezzo minuto, 1'30" = un minuto e mezzo.
 * Un numero secco viene letto come minuti.
 */
export function recuperoInMinuti(valore: unknown): number | null {
  const testo = pulisci(valore);
  if (!testo) return null;

  const minutiESecondi = testo.match(/(\d+)\s*['’]\s*(\d+)\s*["”]?/);
  if (minutiESecondi) {
    return Number(minutiESecondi[1]) + Number(minutiESecondi[2]) / 60;
  }

  const soloMinuti = testo.match(/(\d+(?:[.,]\d+)?)\s*['’]/);
  if (soloMinuti) return Number(soloMinuti[1].replace(",", "."));

  const soloSecondi = testo.match(/(\d+(?:[.,]\d+)?)\s*["”]/);
  if (soloSecondi) {
    return Math.round((Number(soloSecondi[1].replace(",", ".")) / 60) * 100) / 100;
  }

  const minuti = testo.match(/(\d+(?:[.,]\d+)?)\s*(?:min|minuti)?/i);
  if (minuti) return Number(minuti[1].replace(",", "."));

  return null;
}

function rigaVuota(riga: unknown[]) {
  return riga.every((cella) => pulisci(cella) === null);
}

/** Indice della colonna per ogni campo, letto dalla riga di intestazione. */
function mappaColonne(riga: unknown[]) {
  const mappa: Partial<Record<ChiaveColonna, number>> = {};

  riga.forEach((cella, indice) => {
    const testo = normalizza(cella);
    if (!testo) return;

    for (const [chiave, alias] of Object.entries(INTESTAZIONI) as [
      ChiaveColonna,
      string[],
    ][]) {
      if (mappa[chiave] !== undefined) continue;
      if (alias.includes(testo)) {
        mappa[chiave] = indice;
        return;
      }
    }
  });

  return mappa;
}

function isRigaIntestazione(riga: unknown[]) {
  return riga.some((cella) => INTESTAZIONI.esercizio.includes(normalizza(cella)));
}

/** Prima cella non vuota di una riga: e' l'etichetta del blocco. */
function etichettaRiga(riga: unknown[]) {
  for (const cella of riga) {
    const testo = pulisci(cella);
    if (testo) return testo;
  }
  return null;
}

function celleValorizzate(riga: unknown[]) {
  return riga.filter((cella) => pulisci(cella) !== null).length;
}

function isoData(giorno: string, mese: string, anno: string) {
  return `${anno}-${mese.padStart(2, "0")}-${giorno.padStart(2, "0")}`;
}

function cercaDateCiclo(righe: unknown[][]) {
  for (const riga of righe.slice(0, 4)) {
    for (const cella of riga) {
      const testo = pulisci(cella);
      if (!testo) continue;

      const match = testo.match(CICLO_RE);
      if (match) {
        return {
          dal: isoData(match[1], match[2], match[3]),
          al: isoData(match[4], match[5], match[6]),
        };
      }
    }
  }

  return null;
}

export function parsePalestraDaExcel(
  buffer: ArrayBuffer
): RisultatoImportPalestra {
  const workbook = XLSX.read(buffer, { type: "array" });

  const avvisi: string[] = [];
  const ordineBlocchi: string[] = [];
  const blocchi = new Map<string, BloccoPalestra>();

  let cicloDal: string | null = null;
  let cicloAl: string | null = null;

  for (const nomeFoglio of workbook.SheetNames) {
    if (FOGLI_DA_IGNORARE.includes(normalizza(nomeFoglio))) continue;

    const foglio = workbook.Sheets[nomeFoglio];
    if (!foglio) continue;

    const righe = XLSX.utils.sheet_to_json<unknown[]>(foglio, {
      header: 1,
      blankrows: true,
      defval: null,
    });

    if (!cicloDal) {
      const ciclo = cercaDateCiclo(righe);
      if (ciclo) {
        cicloDal = ciclo.dal;
        cicloAl = ciclo.al;
      }
    }

    const gruppo = nomeGruppoPalestra(nomeFoglio);
    let trovatoQualcosa = false;

    for (let r = 0; r < righe.length; r += 1) {
      const riga = righe[r] ?? [];

      if (!isRigaIntestazione(riga)) continue;

      const colonne = mappaColonne(riga);

      if (colonne.esercizio === undefined) continue;

      // L'etichetta del blocco e' l'ultima riga "solitaria" prima
      // dell'intestazione (nel file reale: "day A", "circuit B").
      let etichetta: string | null = null;

      for (let indietro = r - 1; indietro >= 0 && indietro >= r - 3; indietro -= 1) {
        const precedente = righe[indietro] ?? [];
        if (rigaVuota(precedente)) continue;
        if (celleValorizzate(precedente) === 1) {
          etichetta = etichettaRiga(precedente);
        }
        break;
      }

      if (!etichetta) {
        etichetta = `Blocco ${ordineBlocchi.length + 1}`;
        avvisi.push(
          `${gruppo}: blocco senza etichetta alla riga ${r + 1}, rinominato "${etichetta}".`
        );
      }

      const chiave = normalizza(etichetta);

      if (!blocchi.has(chiave)) {
        ordineBlocchi.push(chiave);
        blocchi.set(chiave, {
          etichetta,
          gruppi: [],
          esercizi: [],
        });
      }

      const blocco = blocchi.get(chiave)!;

      let eserciziDelGruppo = 0;

      // Righe esercizio: dall'intestazione fino alla prima riga vuota o
      // alla prossima intestazione.
      let riferimento = r + 1;

      for (; riferimento < righe.length; riferimento += 1) {
        const rigaEsercizio = righe[riferimento] ?? [];

        if (rigaVuota(rigaEsercizio)) break;
        if (isRigaIntestazione(rigaEsercizio)) break;

        const nome = pulisci(rigaEsercizio[colonne.esercizio]);

        if (!nome) {
          if (celleValorizzate(rigaEsercizio) > 0) {
            avvisi.push(
              `${gruppo} · ${etichetta}: riga ${riferimento + 1} senza nome esercizio, ignorata.`
            );
          }
          continue;
        }

        const recuperoTesto =
          colonne.recupero === undefined
            ? null
            : pulisci(rigaEsercizio[colonne.recupero]);

        blocco.esercizi.push({
          gruppo,
          esercizio: nome,
          serie:
            colonne.serie === undefined
              ? null
              : numero(rigaEsercizio[colonne.serie]),
          ripetizioni:
            colonne.ripetizioni === undefined
              ? null
              : pulisci(rigaEsercizio[colonne.ripetizioni]),
          rpe:
            colonne.rpe === undefined
              ? null
              : numero(rigaEsercizio[colonne.rpe]),
          carico:
            colonne.carico === undefined
              ? null
              : pulisci(rigaEsercizio[colonne.carico]),
          recupero_minuti: recuperoInMinuti(recuperoTesto),
          recupero_testo: recuperoTesto,
          note:
            colonne.note === undefined
              ? null
              : pulisci(rigaEsercizio[colonne.note]),
        });

        eserciziDelGruppo += 1;
        trovatoQualcosa = true;
      }

      // Il gruppo compare nel blocco solo se ha davvero degli esercizi:
      // un blocco lasciato vuoto nel template non deve risultare fra i
      // gruppi che si allenano insieme.
      if (eserciziDelGruppo > 0 && !blocco.gruppi.includes(gruppo)) {
        blocco.gruppi.push(gruppo);
      }

      r = riferimento - 1;
    }

    if (!trovatoQualcosa) {
      avvisi.push(
        `Foglio "${gruppo}": nessun esercizio riconosciuto. Serve una riga di intestazione con "esercizio".`
      );
    }
  }

  const risultato = ordineBlocchi
    .map((chiave) => blocchi.get(chiave)!)
    .filter((blocco) => blocco.esercizi.length > 0);

  return {
    blocchi: risultato,
    cicloDal,
    cicloAl,
    avvisi,
  };
}

/**
 * Riepilogo leggibile dell'esercizio: finisce in
 * punti_chiave_coaching, cosi' le schermate che gia' esistono mostrano
 * qualcosa di sensato anche senza conoscere le colonne nuove.
 */
export function riepilogoEsercizio(esercizio: EsercizioPalestra) {
  const parti: string[] = [];

  if (esercizio.serie !== null && esercizio.ripetizioni) {
    parti.push(`${esercizio.serie}x${esercizio.ripetizioni}`);
  } else if (esercizio.serie !== null) {
    parti.push(`${esercizio.serie} serie`);
  } else if (esercizio.ripetizioni) {
    parti.push(`${esercizio.ripetizioni} rep`);
  }

  if (esercizio.rpe !== null) parti.push(`RPE ${esercizio.rpe}`);
  if (esercizio.carico) parti.push(`carico ${esercizio.carico}`);
  if (esercizio.recupero_testo) parti.push(`rec ${esercizio.recupero_testo}`);

  const riepilogo = parti.join(" · ");

  if (esercizio.note) {
    return riepilogo ? `${riepilogo} — ${esercizio.note}` : esercizio.note;
  }

  return riepilogo || null;
}
