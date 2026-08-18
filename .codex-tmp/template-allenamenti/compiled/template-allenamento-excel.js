"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
exports.calcolaNumeroSettimana = calcolaNumeroSettimana;
exports.scaricaTemplateAllenamenti = scaricaTemplateAllenamenti;
exports.intervalloTemplateValido = intervalloTemplateValido;
exports.settimanaInizialeTemplate = settimanaInizialeTemplate;
const XLSX = __importStar(require("xlsx"));
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
const GIORNO_MS = 86400000;
const SETTIMANA_1 = Date.UTC(2026, 7, 17);
function dataUtc(dataIso) {
    const [anno, mese, giorno] = dataIso.split("-").map(Number);
    return new Date(Date.UTC(anno, mese - 1, giorno));
}
function dataIso(data) {
    return `${data.getUTCFullYear()}-${String(data.getUTCMonth() + 1).padStart(2, "0")}-${String(data.getUTCDate()).padStart(2, "0")}`;
}
function dataBreve(data) {
    return `${data.getUTCDate()}${MESI_BREVI[data.getUTCMonth()]}`;
}
function dataEstesa(data) {
    return `${data.getUTCDate()} ${MESI_ESTESI[data.getUTCMonth()]} ${data.getUTCFullYear()}`;
}
function dataFoglio(data) {
    return `${String(data.getUTCDate()).padStart(2, "0")}/${String(data.getUTCMonth() + 1).padStart(2, "0")}`;
}
function calcolaNumeroSettimana(dataDal) {
    const inizio = dataUtc(dataDal).getTime();
    return Math.floor((inizio - SETTIMANA_1) / (7 * GIORNO_MS)) + 1;
}
function applicaLarghezze(foglio, larghezze) {
    foglio["!cols"] = larghezze.map((wch) => ({ wch }));
}
function creaFoglioSettimana(numeroSettimana, dal, al) {
    const righe = [
        [
            `Microciclo — Settimana ${numeroSettimana} (${dataEstesa(dal)} – ${dataEstesa(al)}) · Sequenza esercizi`,
        ],
        [
            "Sostituisci i segnaposto tra parentesi quadre e HH:MM–HH:MM con i dati reali. Consulta la scheda «Note per la compilazione» prima dell'importazione.",
        ],
        [],
    ];
    const merges = [
        { s: { r: 0, c: 0 }, e: { r: 0, c: 5 } },
        { s: { r: 1, c: 0 }, e: { r: 1, c: 5 } },
    ];
    for (let timestamp = dal.getTime(); timestamp <= al.getTime(); timestamp += GIORNO_MS) {
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
    return foglio;
}
function creaFoglioDrillBank() {
    const righe = [
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
    for (let i = 0; i < 30; i += 1)
        righe.push(Array(11).fill(null));
    const foglio = XLSX.utils.aoa_to_sheet(righe);
    foglio["!merges"] = [{ s: { r: 0, c: 0 }, e: { r: 0, c: 10 } }];
    applicaLarghezze(foglio, [12, 18, 32, 12, 22, 26, 46, 46, 38, 30, 42]);
    return foglio;
}
function creaFoglioGps(numeroSettimana) {
    const righe = [
        [`Riferimenti GPS e regole — Settimana ${numeroSettimana}`],
        [],
        ["Blocco / regola", "Target precedente", "Target settimana", "Riferimento / note"],
    ];
    for (let i = 0; i < 20; i += 1)
        righe.push([null, null, null, null]);
    const foglio = XLSX.utils.aoa_to_sheet(righe);
    foglio["!merges"] = [{ s: { r: 0, c: 0 }, e: { r: 0, c: 3 } }];
    applicaLarghezze(foglio, [36, 22, 22, 64]);
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
    return foglio;
}
function scaricaTemplateAllenamenti(dataDal, dataAl) {
    const dal = dataUtc(dataDal);
    const al = dataUtc(dataAl);
    const numeroSettimana = calcolaNumeroSettimana(dataDal);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, creaFoglioSettimana(numeroSettimana, dal, al), `Settimana ${numeroSettimana}`);
    XLSX.utils.book_append_sheet(workbook, creaFoglioDrillBank(), "Drill Bank");
    XLSX.utils.book_append_sheet(workbook, creaFoglioGps(numeroSettimana), "GPS e regole");
    XLSX.utils.book_append_sheet(workbook, creaFoglioNote(), "Note per la compilazione");
    const nomeFile = `Allenamento_Settimana${numeroSettimana}_${dataBreve(dal)}_${dataBreve(al)}.xlsx`;
    XLSX.writeFile(workbook, nomeFile, { compression: true });
    return nomeFile;
}
function intervalloTemplateValido(dataDal, dataAl) {
    if (!dataDal || !dataAl)
        return "Seleziona entrambe le date.";
    const dal = dataUtc(dataDal);
    const al = dataUtc(dataAl);
    if (dal.getTime() < SETTIMANA_1) {
        return "La prima settimana disponibile inizia il 17 agosto 2026.";
    }
    if (al.getTime() < dal.getTime())
        return "La data finale precede quella iniziale.";
    const giorni = Math.round((al.getTime() - dal.getTime()) / GIORNO_MS) + 1;
    if (giorni > 31)
        return "Seleziona un intervallo massimo di 31 giorni.";
    return null;
}
function settimanaInizialeTemplate() {
    return dataIso(new Date(SETTIMANA_1));
}
