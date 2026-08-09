import * as XLSX from "xlsx";

// Parser del file Excel "MINUTAGGIO" (modello con sezioni EVENTO /
// PUNTEGGIO / CAMBI / CARTELLINI). Ci interessa solo la prima tabella
// CAMBI del foglio: è sempre quella della propria squadra (nei modelli
// osservati la seconda, se presente, è quella degli OSPITI, i cui
// giocatori non fanno parte dell'anagrafica del club e non vengono
// quindi importati).
//
// Formato tabella CAMBI: tre colonne MINUTO / ENTRA / ESCE, una riga per
// evento. Il nome giocatore è quasi sempre il solo cognome (es.
// "Abrigo"), per questo il matching con l'anagrafica avviene sul
// cognome, con fallback su nome completo.

export type TipoCambio = "entra" | "esce";

export type CambioRilevato = {
  minuto: number;
  tipo: TipoCambio;
  nomeTesto: string;
};

export type RisultatoParseMinutaggio = {
  cambi: CambioRilevato[];
  squadraPropriaRilevata: string | null;
  avversarioRilevato: string | null;
  dataRilevata: string | null; // ISO yyyy-mm-dd se riconosciuta
  luogoRilevato: string | null;
  avvisi: string[];
};

function pulisci(valore: unknown): string | null {
  if (valore === null || valore === undefined) return null;
  const testo = String(valore).trim();
  if (testo === "" || testo === "—" || testo === "-") return null;
  return testo;
}

function normalizzaEtichetta(valore: unknown): string {
  return (pulisci(valore) ?? "").toUpperCase().replace(/\s+/g, " ").trim();
}

function estraiNumero(valore: unknown): number | null {
  const testo = pulisci(valore);
  if (!testo) return null;
  const normalizzato = testo.replace(",", ".");
  const numero = Number(normalizzato);
  return Number.isFinite(numero) ? numero : null;
}

function celle(riga: unknown[] | undefined, indice: number): unknown {
  if (!riga || indice < 0) return null;
  return riga[indice] ?? null;
}

// Cerca su una riga, a partire da "daIndice", la prima cella non vuota:
// utile per leggere il valore scritto subito dopo un'etichetta tipo
// "del" o "campo di" quando non si conosce con certezza in quale cella
// esatta sia stato digitato (celle unite/spostate da file a file).
function primoValoreDopo(
  riga: unknown[] | undefined,
  daIndice: number,
  maxDistanza = 4
): string | null {
  if (!riga) return null;

  for (let i = daIndice + 1; i <= daIndice + maxDistanza; i++) {
    const valore = pulisci(riga[i]);
    if (valore) return valore;
  }

  return null;
}

// Prova a riconoscere una data in formato gg/mm/aaaa o simili e
// convertirla in ISO yyyy-mm-dd. Se il testo non è una data plausibile
// (es. è in realtà il nome di un campo/città), restituisce null.
function normalizzaData(testo: string | null): string | null {
  if (!testo) return null;

  const match = testo.match(/^(\d{1,2})[\/\-.](\d{1,2})[\/\-.](\d{2,4})$/);
  if (!match) return null;

  const [, giornoStr, meseStr, annoStr] = match;
  const giorno = Number(giornoStr);
  const mese = Number(meseStr);
  let anno = Number(annoStr);
  if (anno < 100) anno += 2000;

  if (giorno < 1 || giorno > 31 || mese < 1 || mese > 12) return null;

  return `${anno}-${String(mese).padStart(2, "0")}-${String(giorno).padStart(2, "0")}`;
}

export function parseMinutaggioDaExcel(
  dati: ArrayBuffer
): RisultatoParseMinutaggio {
  const avvisi: string[] = [];
  const workbook = XLSX.read(dati, { type: "array" });

  const nomeFoglio = workbook.SheetNames[0];

  if (!nomeFoglio) {
    return {
      cambi: [],
      squadraPropriaRilevata: null,
      avversarioRilevato: null,
      dataRilevata: null,
      luogoRilevato: null,
      avvisi: ["Il file Excel non contiene nessun foglio leggibile."],
    };
  }

  const foglio = workbook.Sheets[nomeFoglio];
  const righe = XLSX.utils.sheet_to_json(foglio, {
    header: 1,
    defval: null,
    raw: false,
  }) as unknown[][];

  // --- Intestazione (best effort: spesso non compilata) ---------------
  const rigaTitolo = righe[0];
  const squadraPropriaRilevata = pulisci(celle(rigaTitolo, 0));

  let avversarioRilevato: string | null = null;
  let dataRilevata: string | null = null;
  let luogoRilevato: string | null = null;

  if (rigaTitolo) {
    for (let i = 0; i < rigaTitolo.length; i++) {
      const etichetta = normalizzaEtichetta(rigaTitolo[i]);

      if (etichetta === "VS" && !avversarioRilevato) {
        avversarioRilevato = primoValoreDopo(rigaTitolo, i);
      } else if (etichetta === "DEL" && !dataRilevata) {
        dataRilevata = normalizzaData(primoValoreDopo(rigaTitolo, i));
      } else if (etichetta.startsWith("CAMPO") && !luogoRilevato) {
        luogoRilevato = primoValoreDopo(rigaTitolo, i);
      }
    }
  }

  // --- Tabella CAMBI (prima occorrenza = propria squadra) --------------
  // Nota: la riga di intestazione ha DUE colonne "MINUTO" (una per la
  // tabella EVENTO, una per quella CAMBI), quindi non si può prendere il
  // primo "MINUTO" della riga: si cerca prima "ENTRA" (etichetta univoca
  // della tabella CAMBI), poi "ESCE" subito dopo, poi "MINUTO" appena
  // prima di "ENTRA" (la colonna immediatamente a sinistra).
  let colMinuto = -1;
  let colEntra = -1;
  let colEsce = -1;
  let rigaIntestazioneCambi = -1;
  const RAGGIO_RICERCA_COLONNE = 6;

  for (let r = 0; r < righe.length; r++) {
    const riga = righe[r];
    if (!riga) continue;

    let entraIdx = -1;
    for (let c = 0; c < riga.length; c++) {
      if (normalizzaEtichetta(riga[c]) === "ENTRA") {
        entraIdx = c;
        break;
      }
    }
    if (entraIdx === -1) continue;

    let esceIdx = -1;
    for (
      let c = entraIdx + 1;
      c < Math.min(entraIdx + RAGGIO_RICERCA_COLONNE, riga.length);
      c++
    ) {
      if (normalizzaEtichetta(riga[c]) === "ESCE") {
        esceIdx = c;
        break;
      }
    }
    if (esceIdx === -1) continue;

    let minutoIdx = -1;
    for (
      let c = entraIdx - 1;
      c >= Math.max(entraIdx - RAGGIO_RICERCA_COLONNE, 0);
      c--
    ) {
      if (normalizzaEtichetta(riga[c]) === "MINUTO") {
        minutoIdx = c;
        break;
      }
    }
    if (minutoIdx === -1) continue;

    colMinuto = minutoIdx;
    colEntra = entraIdx;
    colEsce = esceIdx;
    rigaIntestazioneCambi = r;
    break;
  }

  if (rigaIntestazioneCambi === -1) {
    return {
      cambi: [],
      squadraPropriaRilevata,
      avversarioRilevato,
      dataRilevata,
      luogoRilevato,
      avvisi: [
        'Non è stata trovata la tabella "CAMBI" (colonne MINUTO/ENTRA/ESCE) nel file.',
      ],
    };
  }

  const cambi: CambioRilevato[] = [];

  for (let r = rigaIntestazioneCambi + 1; r < righe.length; r++) {
    const riga = righe[r];

    const minuto = estraiNumero(celle(riga, colMinuto));
    const entra = pulisci(celle(riga, colEntra));
    const esce = pulisci(celle(riga, colEsce));

    // Riga vuota: fine della tabella CAMBI di questa squadra.
    if (minuto === null && !entra && !esce) break;

    if (minuto === null) {
      avvisi.push(
        `Riga ${r + 1}: manca il minuto, evento ignorato (${entra || esce || "?"}).`
      );
      continue;
    }

    if (entra) {
      cambi.push({ minuto, tipo: "entra", nomeTesto: entra });
    }

    if (esce) {
      cambi.push({ minuto, tipo: "esce", nomeTesto: esce });
    }

    if (!entra && !esce) {
      avvisi.push(`Riga ${r + 1}: minuto ${minuto} senza nessun giocatore, ignorata.`);
    }
  }

  if (cambi.length === 0) {
    avvisi.push("Nessun cambio trovato nella tabella CAMBI.");
  }

  return {
    cambi,
    squadraPropriaRilevata,
    avversarioRilevato,
    dataRilevata,
    luogoRilevato,
    avvisi,
  };
}
