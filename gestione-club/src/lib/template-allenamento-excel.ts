import * as XLSX from "xlsx-js-style";

const GIORNI = [
  "Domenica",
  "Lunedì",
  "Martedì",
  "Mercoledì",
  "Giovedì",
  "Venerdì",
  "Sabato",
];

const MESI_BREVI = [
  "gen",
  "feb",
  "mar",
  "apr",
  "mag",
  "giu",
  "lug",
  "ago",
  "set",
  "ott",
  "nov",
  "dic",
];

const MESI_ESTESI = [
  "Gennaio",
  "Febbraio",
  "Marzo",
  "Aprile",
  "Maggio",
  "Giugno",
  "Luglio",
  "Agosto",
  "Settembre",
  "Ottobre",
  "Novembre",
  "Dicembre",
];

const GIORNO_MS = 86_400_000;
const SETTIMANA_1 = Date.UTC(2026, 7, 17);

const COLORI = {
  titolo: "1F3664",
  seduta: "2E75B6",
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

function stileTitolo(foglio: XLSX.WorkSheet, ultimaColonna: number) {
  stileCelle(foglio, 0, 0, 0, ultimaColonna, {
    fill: { patternType: "solid", fgColor: { rgb: COLORI.titolo } },
    font: { name: "Aptos Display", sz: 16, bold: true, color: { rgb: "FFFFFF" } },
    alignment: { vertical: "center", horizontal: "left" },
  });
}

function stileIntestazione(
  foglio: XLSX.WorkSheet,
  riga: number,
  ultimaColonna: number,
  colore = COLORI.intestazione
) {
  stileCelle(foglio, riga, riga, 0, ultimaColonna, {
    fill: { patternType: "solid", fgColor: { rgb: colore } },
    font: { name: "Aptos", sz: 10, bold: true, color: { rgb: "FFFFFF" } },
    alignment: { vertical: "center", horizontal: "center", wrapText: true },
    border: bordoSottile,
  });
}

function dataUtc(dataIso: string) {
  const [anno, mese, giorno] = dataIso.split("-").map(Number);
  return new Date(Date.UTC(anno, mese - 1, giorno));
}

function dataIso(data: Date) {
  return `${data.getUTCFullYear()}-${String(data.getUTCMonth() + 1).padStart(2, "0")}-${String(data.getUTCDate()).padStart(2, "0")}`;
}

function dataBreve(data: Date) {
  return `${data.getUTCDate()}${MESI_BREVI[data.getUTCMonth()]}`;
}

function dataEstesa(data: Date) {
  return `${data.getUTCDate()} ${MESI_ESTESI[data.getUTCMonth()]} ${data.getUTCFullYear()}`;
}

function dataFoglio(data: Date) {
  return `${String(data.getUTCDate()).padStart(2, "0")}/${String(data.getUTCMonth() + 1).padStart(2, "0")}`;
}

export function calcolaNumeroSettimana(dataDal: string) {
  const inizio = dataUtc(dataDal).getTime();
  return Math.floor((inizio - SETTIMANA_1) / (7 * GIORNO_MS)) + 1;
}

function applicaLarghezze(
  foglio: XLSX.WorkSheet,
  larghezze: number[]
) {
  foglio["!cols"] = larghezze.map((wch) => ({ wch }));
}

function creaFoglioSettimana(
  numeroSettimana: number,
  dal: Date,
  al: Date
) {
  const righe: (string | null)[][] = [
    [
      `Microciclo — Settimana ${numeroSettimana} (${dataEstesa(dal)} – ${dataEstesa(al)}) · Sequenza esercizi`,
    ],
    [
      "Sostituisci i segnaposto tra parentesi quadre e HH:MM–HH:MM con i dati reali. Consulta la scheda «Note per la compilazione» prima dell'importazione.",
    ],
    [],
  ];

  const merges: XLSX.Range[] = [
    { s: { r: 0, c: 0 }, e: { r: 0, c: 5 } },
    { s: { r: 1, c: 0 }, e: { r: 1, c: 5 } },
  ];

  for (
    let timestamp = dal.getTime();
    timestamp <= al.getTime();
    timestamp += GIORNO_MS
  ) {
    const data = new Date(timestamp);

    for (const sessione of ["MATTINO", "SERA"]) {
      const rigaTitolo = righe.length;
      righe.push([
        `${GIORNI[data.getUTCDay()]} ${dataFoglio(data)} — ${sessione} — [Titolo seduta] · [Gruppo] · HH:MM–HH:MM`,
      ]);
      merges.push({
        s: { r: rigaTitolo, c: 0 },
        e: { r: rigaTitolo, c: 5 },
      });
      righe.push([
        "Orario",
        "Tipo",
        "Stazione",
        "Drill",
        "Consegna e organizzazione",
        "Punti chiave di coaching",
      ]);

      for (let lavoro = 0; lavoro < 4; lavoro += 1) {
        righe.push(["HH:MM–HH:MM", "", "", "", "", ""]);
        righe.push([null, null, null, "ripetizioni N", "minuti N", "rec N"]);
      }
      righe.push([]);
    }
  }

  const foglio = XLSX.utils.aoa_to_sheet(righe);
  foglio["!merges"] = merges;
  applicaLarghezze(foglio, [22, 18, 27, 38, 58, 58]);
  foglio["!rows"] = righe.map((_, indice) => ({
    hpt: indice < 2 ? 28 : 24,
  }));
  foglio["!autofilter"] = undefined;
  stileTitolo(foglio, 5);
  stileCelle(foglio, 1, 1, 0, 5, {
    fill: { patternType: "solid", fgColor: { rgb: COLORI.nota } },
    font: { name: "Aptos", sz: 10, italic: true, color: { rgb: "594A00" } },
    alignment: { wrapText: true, vertical: "center" },
  });
  for (let r = 3; r < righe.length; r += 1) {
    const primaCella = String(righe[r]?.[0] ?? "");
    if (/^(Lunedì|Martedì|Mercoledì|Giovedì|Venerdì|Sabato|Domenica)/.test(primaCella)) {
      stileCelle(foglio, r, r, 0, 5, {
        fill: { patternType: "solid", fgColor: { rgb: COLORI.seduta } },
        font: { name: "Aptos", sz: 11, bold: true, color: { rgb: "FFFFFF" } },
        alignment: { vertical: "center" },
      });
    } else if (primaCella === "Orario") {
      stileIntestazione(foglio, r, 5);
    } else if (primaCella === "HH:MM–HH:MM") {
      const alternata = Math.floor(r / 2) % 2 === 0;
      stileCelle(foglio, r, r, 0, 5, {
        fill: { patternType: "solid", fgColor: { rgb: alternata ? COLORI.rigaAlternata : COLORI.bianco } },
        font: { name: "Aptos", sz: 10, color: { rgb: "1F1F1F" } },
        alignment: { wrapText: true, vertical: "top" },
        border: bordoSottile,
      });
      stileCelle(foglio, r + 1, r + 1, 0, 5, {
        fill: { patternType: "solid", fgColor: { rgb: alternata ? "EAF2F8" : "F7F7F7" } },
        font: { name: "Aptos", sz: 9, italic: true, color: { rgb: "5B6573" } },
        alignment: { vertical: "center" },
        border: bordoSottile,
      });
    }
  }
  return foglio;
}

function creaFoglioDrillBank() {
  const righe: (string | null)[][] = [
    ["Drill Bank — una riga per ogni esercizio riutilizzabile"],
    [],
    [
      "Codice",
      "Categoria",
      "Nome",
      "Durata",
      "Spazio",
      "Materiale",
      "Organizzazione",
      "Punti chiave di coaching",
      "Progressione",
      "Riferimento GPS",
      "Perché serve",
    ],
  ];
  for (let i = 0; i < 30; i += 1) righe.push(Array(11).fill(null));
  const foglio = XLSX.utils.aoa_to_sheet(righe);
  foglio["!merges"] = [{ s: { r: 0, c: 0 }, e: { r: 0, c: 10 } }];
  applicaLarghezze(foglio, [12, 18, 32, 12, 22, 26, 46, 46, 38, 30, 42]);
  stileTitolo(foglio, 10);
  stileIntestazione(foglio, 2, 10, COLORI.seduta);
  for (let r = 3; r < righe.length; r += 1) {
    stileCelle(foglio, r, r, 0, 10, {
      fill: { patternType: "solid", fgColor: { rgb: r % 2 === 0 ? COLORI.rigaAlternata : COLORI.bianco } },
      font: { name: "Aptos", sz: 10, color: { rgb: "1F1F1F" } },
      alignment: { wrapText: true, vertical: "top" },
      border: bordoSottile,
    });
  }
  return foglio;
}

function creaFoglioGps(numeroSettimana: number) {
  const righe: (string | null)[][] = [
    [`Riferimenti GPS e regole — Settimana ${numeroSettimana}`],
    [],
    ["Blocco / regola", "Target precedente", "Target settimana", "Riferimento / note"],
  ];
  for (let i = 0; i < 20; i += 1) righe.push([null, null, null, null]);
  const foglio = XLSX.utils.aoa_to_sheet(righe);
  foglio["!merges"] = [{ s: { r: 0, c: 0 }, e: { r: 0, c: 3 } }];
  applicaLarghezze(foglio, [36, 22, 22, 64]);
  stileTitolo(foglio, 3);
  stileIntestazione(foglio, 2, 3, COLORI.seduta);
  for (let r = 3; r < righe.length; r += 1) {
    stileCelle(foglio, r, r, 0, 3, {
      fill: { patternType: "solid", fgColor: { rgb: r % 2 === 0 ? COLORI.rigaAlternata : COLORI.bianco } },
      font: { name: "Aptos", sz: 10, color: { rgb: "1F1F1F" } },
      alignment: { wrapText: true, vertical: "top" },
      border: bordoSottile,
    });
  }
  return foglio;
}

function creaFoglioNote() {
  const regole = [
    ["1. Foglio principale", "Non rinominare la prima scheda: il nome deve contenere «Settimana» oppure «Microciclo». Il titolo generale in A1 deve includere l'anno a quattro cifre."],
    ["2. Titolo seduta", "Scriverlo interamente in colonna A. Deve iniziare con Giorno DD/MM e terminare con HH:MM–HH:MM. Esempio: Martedì 18/08 — Tecnica — Tutti (36) · 18:30–20:20."],
    ["3. Orari", "Usare il formato 24 ore HH:MM–HH:MM. Sono ammessi il trattino normale (-) e il trattino medio (–). Non aggiungere testo dopo l'orario finale della seduta."],
    ["4. Intestazioni", "Subito dopo il titolo mantenere: Orario | Tipo | Stazione | Drill | Consegna e organizzazione | Punti chiave di coaching."],
    ["5. Riga lavoro", "In A inserire l'intervallo del lavoro; Tipo in B, Stazione in C, Drill in D, organizzazione in E e coaching in F."],
    ["6. Ripetizioni", "Nella riga immediatamente successiva lasciare A vuota; in D scrivere «ripetizioni N», in E «minuti N», in F «rec N»."],
    ["7. Lavori paralleli", "Usare lo stesso intervallo orario e, facoltativamente, «contemporanea» in A nella riga di continuazione. Ripetizioni, lavoro e recupero possono differire, ma il totale deve essere uguale."],
    ["8. Tempo totale", "Con una ripetizione coincide col tempo lavoro. Con più ripetizioni: tempo lavoro × ripetizioni + recupero × (ripetizioni − 1)."],
    ["9. H2O e CAMBIO", "Scrivere H2O o CAMBIO in A e la durata in E, ad esempio «1 MIN» o «MINUTI 10»."],
    ["10. Codice Drill Bank", "Terminare il nome del drill col codice tra parentesi, es. «Griglia continua (A1)». Il codice deve essere presente nel Drill Bank."],
    ["11. Drill Bank", "Non cambiare l'ordine delle 11 colonne. Il codice deve avere 1–3 lettere e 1–3 cifre, ad esempio A1 o B12."],
    ["12. Righe vuote", "Sono consentite tra le sedute. Evitare righe descrittive isolate dentro una seduta: saranno ignorate con un avviso."],
    ["13. Celle e formule", "Usare valori semplici nelle righe importate. Non dividere titolo, data o orari su celle diverse e non spostare le sei colonne principali."],
    ["14. Prima dell'import", "Sostituire tutti i segnaposto [Titolo seduta], [Gruppo], HH:MM e N; eliminare i blocchi non utilizzati; verificare che ogni seduta contenga almeno un lavoro valido."],
  ];
  const foglio = XLSX.utils.aoa_to_sheet([
    ["Note per la compilazione e regole di importazione"],
    [],
    ["Regola", "Indicazioni"],
    ...regole,
  ]);
  foglio["!merges"] = [{ s: { r: 0, c: 0 }, e: { r: 0, c: 1 } }];
  applicaLarghezze(foglio, [30, 110]);
  foglio["!rows"] = [
    { hpt: 28 },
    { hpt: 10 },
    { hpt: 24 },
    ...regole.map(() => ({ hpt: 52 })),
  ];
  stileTitolo(foglio, 1);
  stileIntestazione(foglio, 2, 1, COLORI.seduta);
  for (let r = 3; r < regole.length + 3; r += 1) {
    stileCelle(foglio, r, r, 0, 1, {
      fill: { patternType: "solid", fgColor: { rgb: r % 2 === 0 ? COLORI.rigaAlternata : COLORI.bianco } },
      font: { name: "Aptos", sz: 10, color: { rgb: "1F1F1F" }, bold: false },
      alignment: { wrapText: true, vertical: "top" },
      border: bordoSottile,
    });
    const label = foglio[XLSX.utils.encode_cell({ r, c: 0 })];
    if (label) label.s = { ...label.s, font: { name: "Aptos", sz: 10, bold: true, color: { rgb: "1F3664" } } };
  }
  return foglio;
}

export function scaricaTemplateAllenamenti(dataDal: string, dataAl: string) {
  const dal = dataUtc(dataDal);
  const al = dataUtc(dataAl);
  const numeroSettimana = calcolaNumeroSettimana(dataDal);
  const workbook = XLSX.utils.book_new();

  XLSX.utils.book_append_sheet(
    workbook,
    creaFoglioSettimana(numeroSettimana, dal, al),
    `Settimana ${numeroSettimana}`
  );
  XLSX.utils.book_append_sheet(workbook, creaFoglioDrillBank(), "Drill Bank");
  XLSX.utils.book_append_sheet(
    workbook,
    creaFoglioGps(numeroSettimana),
    "GPS e regole"
  );
  XLSX.utils.book_append_sheet(
    workbook,
    creaFoglioNote(),
    "Note per la compilazione"
  );

  const nomeFile = `Allenamento_Settimana${numeroSettimana}_${dataBreve(dal)}_${dataBreve(al)}.xlsx`;
  XLSX.writeFile(workbook, nomeFile, { compression: true });
  return nomeFile;
}

export function intervalloTemplateValido(dataDal: string, dataAl: string) {
  if (!dataDal || !dataAl) return "Seleziona entrambe le date.";
  const dal = dataUtc(dataDal);
  const al = dataUtc(dataAl);
  if (dal.getTime() < SETTIMANA_1) {
    return "La prima settimana disponibile inizia il 17 agosto 2026.";
  }
  if (al.getTime() < dal.getTime()) return "La data finale precede quella iniziale.";
  const giorni = Math.round((al.getTime() - dal.getTime()) / GIORNO_MS) + 1;
  if (giorni > 31) return "Seleziona un intervallo massimo di 31 giorni.";
  return null;
}

export function settimanaInizialeTemplate() {
  return dataIso(new Date(SETTIMANA_1));
}
