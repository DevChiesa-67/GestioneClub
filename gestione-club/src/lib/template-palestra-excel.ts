import * as XLSX from "xlsx-js-style";

// Generatore del template Excel per le sedute di PALESTRA.
//
// Struttura: un foglio per gruppo (props, backs, ... li sceglie l'utente
// nel modale di download) e dentro ogni foglio un blocco per giorno di
// lavoro, con le colonne che il parser si aspetta:
//   esercizio | serie | rep | rpe | carico | recupero | note
//
// La riga 1 di ogni foglio riporta le date del ciclo nel formato
// "Ciclo dal GG/MM/AAAA al GG/MM/AAAA": e' da li' che l'import le rilegge
// per precompilare l'anteprima.

const COLORI = {
  titolo: "1F3664",
  blocco: "2E75B6",
  intestazione: "7F9DB9",
  nota: "FFF2CC",
  rigaAlternata: "DDE9EE",
  bianco: "FFFFFF",
  bordo: "B4C6D7",
};

const bordoSottile = {
  top: { style: "thin", color: { rgb: COLORI.bordo } },
  bottom: { style: "thin", color: { rgb: COLORI.bordo } },
  left: { style: "thin", color: { rgb: COLORI.bordo } },
  right: { style: "thin", color: { rgb: COLORI.bordo } },
} as const;

const COLONNE = [
  "esercizio",
  "serie",
  "rep",
  "rpe",
  "carico",
  "recupero",
  "note",
];

const LARGHEZZE = [34, 8, 10, 8, 14, 14, 46];

const ULTIMA_COLONNA = COLONNE.length - 1;

/** Etichette dei blocchi: day A, day B, ... poi day AA se servissero. */
export function etichettaBlocco(indice: number) {
  const lettere = "ABCDEFGHIJKLMNOPQRSTUVWXYZ";
  const lettera =
    indice < lettere.length
      ? lettere[indice]
      : `${lettere[Math.floor(indice / lettere.length) - 1]}${lettere[indice % lettere.length]}`;

  return `day ${lettera}`;
}

function stileCelle(
  foglio: XLSX.WorkSheet,
  daRiga: number,
  aRiga: number,
  daColonna: number,
  aColonna: number,
  stile: XLSX.CellStyle
) {
  for (let r = daRiga; r <= aRiga; r += 1) {
    for (let c = daColonna; c <= aColonna; c += 1) {
      const indirizzo = XLSX.utils.encode_cell({ r, c });
      if (!foglio[indirizzo]) foglio[indirizzo] = { t: "s", v: "" };
      foglio[indirizzo].s = stile;
    }
  }
}

function dataUtc(dataIso: string) {
  const [anno, mese, giorno] = dataIso.split("-").map(Number);
  return new Date(Date.UTC(anno, mese - 1, giorno));
}

function dataItaliana(dataIso: string) {
  const data = dataUtc(dataIso);
  return `${String(data.getUTCDate()).padStart(2, "0")}/${String(
    data.getUTCMonth() + 1
  ).padStart(2, "0")}/${data.getUTCFullYear()}`;
}

/**
 * Excel non accetta nomi foglio piu' lunghi di 31 caratteri ne' i
 * caratteri : \ / ? * [ ]. Il nome del foglio e' il gruppo, quindi va
 * ripulito senza perderne il senso.
 */
export function nomeFoglioValido(nome: string, giaUsati: string[]) {
  const pulito = nome
    .replace(/[:\\/?*[\]]/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 31);

  const base = pulito || "gruppo";

  if (!giaUsati.includes(base)) return base;

  for (let i = 2; i < 100; i += 1) {
    const candidato = `${base.slice(0, 28)} ${i}`;
    if (!giaUsati.includes(candidato)) return candidato;
  }

  return base;
}

function creaFoglioGruppo(
  gruppo: string,
  cicloDal: string,
  cicloAl: string,
  numeroBlocchi: number,
  eserciziPerBlocco: number
) {
  const righe: (string | null)[][] = [
    [
      `Palestra — Gruppo: ${gruppo} — Ciclo dal ${dataItaliana(cicloDal)} al ${dataItaliana(cicloAl)}`,
    ],
    [
      "Una riga per esercizio. Non rinominare le colonne e non cambiarne l'ordine: l'import le legge da questa intestazione. Il nome del foglio è il gruppo.",
    ],
    [],
  ];

  const merges: XLSX.Range[] = [
    { s: { r: 0, c: 0 }, e: { r: 0, c: ULTIMA_COLONNA } },
    { s: { r: 1, c: 0 }, e: { r: 1, c: ULTIMA_COLONNA } },
  ];

  const righeBlocco: number[] = [];
  const righeIntestazione: number[] = [];

  for (let blocco = 0; blocco < numeroBlocchi; blocco += 1) {
    righeBlocco.push(righe.length);
    righe.push([etichettaBlocco(blocco)]);
    merges.push({
      s: { r: righe.length - 1, c: 0 },
      e: { r: righe.length - 1, c: ULTIMA_COLONNA },
    });

    righeIntestazione.push(righe.length);
    righe.push([...COLONNE]);

    for (let esercizio = 0; esercizio < eserciziPerBlocco; esercizio += 1) {
      righe.push(Array(COLONNE.length).fill(null));
    }

    righe.push([]);
  }

  const foglio = XLSX.utils.aoa_to_sheet(righe);
  foglio["!merges"] = merges;
  foglio["!cols"] = LARGHEZZE.map((wch) => ({ wch }));
  foglio["!rows"] = righe.map((_, indice) => ({ hpt: indice < 2 ? 26 : 20 }));

  stileCelle(foglio, 0, 0, 0, ULTIMA_COLONNA, {
    fill: { patternType: "solid", fgColor: { rgb: COLORI.titolo } },
    font: { name: "Aptos Display", sz: 14, bold: true, color: { rgb: "FFFFFF" } },
    alignment: { vertical: "center", horizontal: "left" },
  });

  stileCelle(foglio, 1, 1, 0, ULTIMA_COLONNA, {
    fill: { patternType: "solid", fgColor: { rgb: COLORI.nota } },
    font: { name: "Aptos", sz: 10, italic: true, color: { rgb: "594A00" } },
    alignment: { wrapText: true, vertical: "center" },
  });

  for (const riga of righeBlocco) {
    stileCelle(foglio, riga, riga, 0, ULTIMA_COLONNA, {
      fill: { patternType: "solid", fgColor: { rgb: COLORI.blocco } },
      font: { name: "Aptos", sz: 11, bold: true, color: { rgb: "FFFFFF" } },
      alignment: { vertical: "center" },
    });
  }

  for (const riga of righeIntestazione) {
    stileCelle(foglio, riga, riga, 0, ULTIMA_COLONNA, {
      fill: { patternType: "solid", fgColor: { rgb: COLORI.intestazione } },
      font: { name: "Aptos", sz: 10, bold: true, color: { rgb: "FFFFFF" } },
      alignment: { vertical: "center", horizontal: "center" },
      border: bordoSottile,
    });

    for (let r = riga + 1; r <= riga + eserciziPerBlocco; r += 1) {
      stileCelle(foglio, r, r, 0, ULTIMA_COLONNA, {
        fill: {
          patternType: "solid",
          fgColor: { rgb: r % 2 === 0 ? COLORI.rigaAlternata : COLORI.bianco },
        },
        font: { name: "Aptos", sz: 10, color: { rgb: "1F1F1F" } },
        alignment: { wrapText: true, vertical: "top" },
        border: bordoSottile,
      });
    }
  }

  return foglio;
}

function creaFoglioNote() {
  const regole: [string, string][] = [
    [
      "1. Un foglio per gruppo",
      "Il nome del foglio diventa il gruppo dell'esercizio (props, backs, core...). Rinominarlo è consentito: l'import legge quel nome.",
    ],
    [
      "2. Blocchi",
      "Ogni blocco inizia con la sua etichetta (day A, day B...) su una riga da sola, seguita dalla riga di intestazione delle colonne.",
    ],
    [
      "3. Colonne",
      "Non cambiare i nomi né l'ordine: esercizio | serie | rep | rpe | carico | recupero | note. Le colonne che non servono si possono lasciare vuote.",
    ],
    [
      "4. Stesso blocco su più gruppi",
      "Il day A di props, backs e locks confluisce in un'unica seduta: usa la stessa etichetta nei fogli che si allenano insieme.",
    ],
    [
      "5. rep e carico",
      "Accettano anche testo: 30\" per i lavori a tempo, bw per il corpo libero, 12-15 per un intervallo.",
    ],
    [
      "6. Recupero",
      "Scriverlo all'italiana: 3' = 3 minuti, 30\" = mezzo minuto, 1'30\" = un minuto e mezzo. Un numero secco è letto come minuti.",
    ],
    [
      "7. Date",
      "Non servono nel file: in fase di importazione indichi la durata del ciclo (dal / al) e la data di ogni blocco.",
    ],
    [
      "8. Righe vuote",
      "Chiudono il blocco. Non lasciarne in mezzo agli esercizi, e non scrivere note isolate dentro un blocco: verrebbero ignorate con un avviso.",
    ],
  ];

  const foglio = XLSX.utils.aoa_to_sheet([
    ["Note per la compilazione — Palestra"],
    [],
    ["Regola", "Indicazioni"],
    ...regole,
  ]);

  foglio["!merges"] = [{ s: { r: 0, c: 0 }, e: { r: 0, c: 1 } }];
  foglio["!cols"] = [{ wch: 30 }, { wch: 110 }];
  foglio["!rows"] = [
    { hpt: 26 },
    { hpt: 10 },
    { hpt: 22 },
    ...regole.map(() => ({ hpt: 40 })),
  ];

  stileCelle(foglio, 0, 0, 0, 1, {
    fill: { patternType: "solid", fgColor: { rgb: COLORI.titolo } },
    font: { name: "Aptos Display", sz: 14, bold: true, color: { rgb: "FFFFFF" } },
    alignment: { vertical: "center" },
  });

  stileCelle(foglio, 2, 2, 0, 1, {
    fill: { patternType: "solid", fgColor: { rgb: COLORI.blocco } },
    font: { name: "Aptos", sz: 10, bold: true, color: { rgb: "FFFFFF" } },
    alignment: { vertical: "center", horizontal: "center" },
    border: bordoSottile,
  });

  for (let r = 3; r < regole.length + 3; r += 1) {
    stileCelle(foglio, r, r, 0, 1, {
      fill: {
        patternType: "solid",
        fgColor: { rgb: r % 2 === 0 ? COLORI.rigaAlternata : COLORI.bianco },
      },
      font: { name: "Aptos", sz: 10, color: { rgb: "1F1F1F" } },
      alignment: { wrapText: true, vertical: "top" },
      border: bordoSottile,
    });

    const etichetta = foglio[XLSX.utils.encode_cell({ r, c: 0 })];
    if (etichetta) {
      etichetta.s = {
        ...etichetta.s,
        font: { name: "Aptos", sz: 10, bold: true, color: { rgb: COLORI.titolo } },
      };
    }
  }

  return foglio;
}

export type OpzioniTemplatePalestra = {
  gruppi: string[];
  cicloDal: string;
  cicloAl: string;
  numeroBlocchi: number;
  eserciziPerBlocco?: number;
};

export function creaWorkbookPalestra({
  gruppi,
  cicloDal,
  cicloAl,
  numeroBlocchi,
  eserciziPerBlocco = 6,
}: OpzioniTemplatePalestra) {
  const workbook = XLSX.utils.book_new();
  const nomiUsati: string[] = [];

  for (const gruppo of gruppi) {
    const nomeFoglio = nomeFoglioValido(gruppo, nomiUsati);
    nomiUsati.push(nomeFoglio);

    XLSX.utils.book_append_sheet(
      workbook,
      creaFoglioGruppo(
        gruppo,
        cicloDal,
        cicloAl,
        numeroBlocchi,
        eserciziPerBlocco
      ),
      nomeFoglio
    );
  }

  XLSX.utils.book_append_sheet(
    workbook,
    creaFoglioNote(),
    "Note per la compilazione"
  );

  return workbook;
}

export function scaricaTemplatePalestra(opzioni: OpzioniTemplatePalestra) {
  const workbook = creaWorkbookPalestra(opzioni);

  const nomeFile = `Palestra_${opzioni.cicloDal}_${opzioni.cicloAl}.xlsx`;
  XLSX.writeFile(workbook, nomeFile, { compression: true });

  return nomeFile;
}

export function opzioniPalestraValide({
  gruppi,
  cicloDal,
  cicloAl,
  numeroBlocchi,
}: OpzioniTemplatePalestra) {
  if (gruppi.length === 0) return "Indica almeno un gruppo.";
  if (gruppi.length > 12) return "Massimo 12 gruppi per file.";
  if (!cicloDal || !cicloAl) return "Indica le date di inizio e fine ciclo.";
  if (dataUtc(cicloAl).getTime() < dataUtc(cicloDal).getTime()) {
    return "La data di fine ciclo precede quella di inizio.";
  }
  if (numeroBlocchi < 1 || numeroBlocchi > 14) {
    return "I giorni di lavoro devono essere fra 1 e 14.";
  }
  return null;
}
