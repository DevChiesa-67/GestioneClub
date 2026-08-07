import * as XLSX from "xlsx";

// Parser per il formato "Microciclo settimanale" usato dai file Excel di
// programmazione allenamenti (un foglio con più sedute in sequenza, ogni
// seduta introdotta da una riga titolo tipo:
//   "Martedì 18/08 — Serata di apertura — Tutti (36) · 18:30–20:20"
// seguita da una riga di intestazione colonne (Orario/Tipo/Stazione/Drill/
// Consegna e organizzazione/Punti chiave di coaching) e dalle righe dei
// singoli lavori, con eventuali righe speciali H2O/CAMBIO e righe di
// continuazione (ripetizioni/minuti/rec) subito sotto ogni lavoro.
//
// Il parser è "best effort": qualunque riga che non riconosce viene
// segnalata in `avvisi` invece di bloccare l'import, così l'utente vede
// comunque un'anteprima e può correggere a mano prima di confermare.

export type LavoroImportato = {
  sezione: string;
  rango: string | null;
  titolo: string | null;
  descrizione: string | null;
  punti_chiave_coaching: string | null;
  codice: string | null;
  ripetizione: number | null;
  tempo_lavoro: number | null;
  tempo_recupero: number | null;
  tempo_totale: number | null;
  // true per H2O/CAMBIO e per i lavori il cui minutaggio arriva dal foglio
  // "Drill bank" (colonna Durata, tramite il codice fra parentesi nel
  // nome, es. "(A1)"): in questi casi tempo_totale va usato così com'è,
  // senza ricalcolarlo da ripetizione × tempo_lavoro + recupero.
  tempo_totale_fisso: boolean;
  // true quando tempo_totale_fisso è stato impostato leggendo il Drill
  // bank (per mostrarlo in anteprima): non salvato su lavori_allenamento.
  tempo_da_drill_bank: boolean;
  // true quando tempo_totale_fisso è stato impostato dalla differenza fra
  // inizio e fine dell'orario del lavoro (fallback quando il codice non è
  // nel Drill bank, per mostrarlo in anteprima): non salvato su
  // lavori_allenamento.
  tempo_da_orario: boolean;
  contemporaneo: boolean;
  gruppo_contemporaneo: string | null;
  spazio: string | null;
  materiale: string | null;
  progressione: string | null;
  riferimento_gps: string | null;
  perche_serve: string | null;
  // Solo per l'anteprima (mostra l'orario originale del foglio Excel):
  // non è una colonna di lavori_allenamento e va escluso dal salvataggio.
  orario_riferimento: string | null;
};

type VoceDrillBank = {
  codice: string;
  categoria: string | null;
  nome: string | null;
  durataMinuti: number | null;
  spazio: string | null;
  materiale: string | null;
  organizzazione: string | null;
  puntiChiaveCoaching: string | null;
  progressione: string | null;
  riferimentoGps: string | null;
  percheServe: string | null;
};

export type SedutaImportata = {
  titolo: string;
  data_allenamento: string;
  tipo_allenamento: "Seduta Mattutina" | "Seduta Serale";
  ora_inizio: string | null;
  ora_fine: string | null;
  lavori: LavoroImportato[];
};

export type RisultatoImportExcel = {
  sedute: SedutaImportata[];
  avvisi: string[];
};

const GIORNO_DATA_RE = /^(\S+)\s+(\d{1,2})\/(\d{1,2})\b/;
const ORARIO_FINALE_RE = /(\d{1,2}:\d{2})\s*[–\-‐]\s*(\d{1,2}:\d{2})\s*$/;
const RIGA_ORARIO_RE = /^\d{1,2}:\d{2}\s*[–\-‐]\s*\d{1,2}:\d{2}$/;
const CODICE_RE = /\s*\(([A-Za-z]{1,3}\d{1,3})\)\s*$/;

function generaIdGruppo() {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
    return crypto.randomUUID();
  }
  return `gruppo-${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

function pulisci(valore: unknown): string | null {
  if (valore === null || valore === undefined) return null;
  const testo = String(valore).trim();
  if (testo === "" || testo === "—" || testo === "-") return null;
  return testo;
}

function estraiNumero(valore: unknown): number | null {
  const testo = pulisci(valore);
  if (!testo) return null;
  const match = testo.match(/(\d+(?:[.,]\d+)?)/);
  if (!match) return null;
  const numero = Number(match[1].replace(",", "."));
  return Number.isFinite(numero) ? numero : null;
}

// Converte un valore tipo "minuti 3", "1 MIN", "MINUTI 10" o "90"" (secondi)
// in un numero di minuti (i secondi vengono convertiti e arrotondati).
function estraiMinuti(valore: unknown): number | null {
  const testo = pulisci(valore);
  if (!testo) return null;

  const secondi = testo.match(/(\d+(?:[.,]\d+)?)\s*"/);
  if (secondi) {
    const numero = Number(secondi[1].replace(",", "."));
    return Number.isFinite(numero) ? Math.round((numero / 60) * 100) / 100 : null;
  }

  return estraiNumero(testo);
}

function estraiTitoloECodice(valore: unknown): {
  titolo: string | null;
  codice: string | null;
} {
  const testo = pulisci(valore);
  if (!testo) return { titolo: null, codice: null };

  const match = testo.match(CODICE_RE);
  if (!match) return { titolo: testo, codice: null };

  return {
    titolo: testo.slice(0, match.index).trim() || null,
    codice: match[1],
  };
}

function celle(riga: unknown[] | undefined, indice: number): unknown {
  if (!riga) return null;
  return riga[indice] ?? null;
}

// Calcola la durata in minuti di un lavoro dalla sua riga orario
// "HH:MM–HH:MM" (usata come fallback quando il codice non è nel Drill
// bank, al posto di ricalcolarla da ripetizioni/minuti/recupero).
function estraiDurataDaOrario(orario: string | null): number | null {
  if (!orario) return null;
  const match = orario.match(/^(\d{1,2}):(\d{2})\s*[–\-‐]\s*(\d{1,2}):(\d{2})$/);
  if (!match) return null;

  const [, h1, m1, h2, m2] = match;
  const inizio = Number(h1) * 60 + Number(m1);
  let fine = Number(h2) * 60 + Number(m2);
  if (fine < inizio) fine += 24 * 60; // difensivo, in caso di orario a cavallo di mezzanotte

  const durata = fine - inizio;
  return durata > 0 ? durata : null;
}

const CODICE_VOCE_RE = /^[A-Za-z]{1,3}\d{1,3}$/;

// Legge il foglio "Drill bank" (se presente): colonne fisse Codice /
// Categoria / Nome / Durata / Spazio / Materiale / Organizzazione / Punti
// chiave di coaching / Progressione / Riferimento GPS / Perché serve.
// Restituisce una mappa codice → voce, usata per completare i lavori della
// seduta che riportano lo stesso codice fra parentesi nel nome del drill.
function parseDrillBank(
  workbook: XLSX.WorkBook
): Map<string, VoceDrillBank> {
  const mappa = new Map<string, VoceDrillBank>();

  const nomeFoglio = workbook.SheetNames.find((nome) =>
    /drill\s*bank/i.test(nome)
  );
  if (!nomeFoglio) return mappa;

  const foglio = workbook.Sheets[nomeFoglio];
  const righe = XLSX.utils.sheet_to_json(foglio, {
    header: 1,
    defval: null,
    raw: false,
  }) as unknown[][];

  for (const riga of righe) {
    const codiceGrezzo = pulisci(celle(riga, 0));
    if (!codiceGrezzo) continue;

    const codice = codiceGrezzo.toUpperCase();
    if (!CODICE_VOCE_RE.test(codice)) continue; // salta intestazione/titolo

    mappa.set(codice, {
      codice,
      categoria: pulisci(celle(riga, 1)),
      nome: pulisci(celle(riga, 2)),
      durataMinuti: estraiMinuti(celle(riga, 3)),
      spazio: pulisci(celle(riga, 4)),
      materiale: pulisci(celle(riga, 5)),
      organizzazione: pulisci(celle(riga, 6)),
      puntiChiaveCoaching: pulisci(celle(riga, 7)),
      progressione: pulisci(celle(riga, 8)),
      riferimentoGps: pulisci(celle(riga, 9)),
      percheServe: pulisci(celle(riga, 10)),
    });
  }

  return mappa;
}

export function parseSeduteDaExcel(dati: ArrayBuffer): RisultatoImportExcel {
  const avvisi: string[] = [];
  const workbook = XLSX.read(dati, { type: "array" });

  const drillBank = parseDrillBank(workbook);
  if (drillBank.size === 0) {
    avvisi.push(
      "Nessun foglio \"Drill bank\" trovato: il minutaggio dei lavori con codice verrà preso solo da ripetizioni/minuti/recupero del foglio principale."
    );
  }

  const nomeFoglio =
    workbook.SheetNames.find((nome) => /settiman|microcicl/i.test(nome)) ??
    workbook.SheetNames[0];

  if (!nomeFoglio) {
    return {
      sedute: [],
      avvisi: ["Il file Excel non contiene nessun foglio leggibile."],
    };
  }

  const foglio = workbook.Sheets[nomeFoglio];
  const righe = XLSX.utils.sheet_to_json(foglio, {
    header: 1,
    defval: null,
    raw: false,
  }) as unknown[][];

  // Cerca un anno a 4 cifre nel titolo generale del foglio (es. "Settimana
  // 1 (18–23 Agosto 2026)"), altrimenti usa l'anno corrente come fallback:
  // resta comunque modificabile nell'anteprima prima di confermare.
  const titoloGenerale = pulisci(celle(righe[0], 0)) ?? "";
  const annoMatch = titoloGenerale.match(/\b(20\d{2})\b/);
  const anno = annoMatch ? annoMatch[1] : String(new Date().getFullYear());

  const sedute: SedutaImportata[] = [];
  let sedutaCorrente: SedutaImportata | null = null;
  let lavoroCorrente: LavoroImportato | null = null;

  for (let i = 0; i < righe.length; i++) {
    const riga = righe[i];
    const a = pulisci(celle(riga, 0));
    const b = pulisci(celle(riga, 1));
    const c = pulisci(celle(riga, 2));
    const d = celle(riga, 3);
    const e = celle(riga, 4);
    const f = celle(riga, 5);

    const giornoMatch = a ? a.match(GIORNO_DATA_RE) : null;
    const orarioFinaleMatch = a ? a.match(ORARIO_FINALE_RE) : null;

    // Riga titolo di una nuova seduta.
    if (giornoMatch && orarioFinaleMatch && a) {
      const [, , giornoStr, meseStr] = giornoMatch;
      const [oraInizio, oraFine] = orarioFinaleMatch.slice(1);

      const giorno = Number(giornoStr);
      const mese = Number(meseStr);
      const dataAllenamento = `${anno}-${String(mese).padStart(2, "0")}-${String(
        giorno
      ).padStart(2, "0")}`;

      let sottotitolo = a.slice(0, orarioFinaleMatch.index).trim();
      sottotitolo = sottotitolo.replace(/^[—\-–·\s]+|[—\-–·\s]+$/g, "");
      sottotitolo = sottotitolo.replace(/\bcampo\s*$/i, "").trim();

      const oraInizioNumero = Number(oraInizio.split(":")[0]);
      const tipoAllenamento: SedutaImportata["tipo_allenamento"] =
        Number.isFinite(oraInizioNumero) && oraInizioNumero < 15
          ? "Seduta Mattutina"
          : "Seduta Serale";

      sedutaCorrente = {
        titolo: sottotitolo || a,
        data_allenamento: dataAllenamento,
        tipo_allenamento: tipoAllenamento,
        ora_inizio: oraInizio,
        ora_fine: oraFine,
        lavori: [],
      };
      sedute.push(sedutaCorrente);
      lavoroCorrente = null;
      continue;
    }

    if (!sedutaCorrente) continue;

    // Riga di intestazione colonne della tabella: la saltiamo.
    if (a && a.toLowerCase() === "orario") continue;

    // Riga di un nuovo lavoro (identificata dall'orario "HH:MM–HH:MM").
    if (a && RIGA_ORARIO_RE.test(a)) {
      const { titolo, codice } = estraiTitoloECodice(d);
      const voceBank = codice ? drillBank.get(codice.toUpperCase()) : undefined;
      const durataDaOrario = estraiDurataDaOrario(a);

      let tempoTotale: number | null;
      let tempoTotaleFisso: boolean;
      let tempoDaDrillBank: boolean;
      let tempoDaOrario: boolean;

      if (voceBank?.durataMinuti != null) {
        tempoTotale = voceBank.durataMinuti;
        tempoTotaleFisso = true;
        tempoDaDrillBank = true;
        tempoDaOrario = false;
      } else if (durataDaOrario != null) {
        tempoTotale = durataDaOrario;
        tempoTotaleFisso = true;
        tempoDaDrillBank = false;
        tempoDaOrario = true;
      } else {
        tempoTotale = null;
        tempoTotaleFisso = false;
        tempoDaDrillBank = false;
        tempoDaOrario = false;
      }

      if (codice && !voceBank && drillBank.size > 0) {
        avvisi.push(
          `Codice "${codice}" (riga ${i + 1}) non trovato nel Drill bank: minutaggio preso dalla differenza di orario.`
        );
      }

      lavoroCorrente = {
        sezione: b ?? "ALTRO",
        rango: c,
        titolo,
        codice,
        descrizione: pulisci(e) ?? voceBank?.organizzazione ?? null,
        punti_chiave_coaching: pulisci(f) ?? voceBank?.puntiChiaveCoaching ?? null,
        ripetizione: null,
        tempo_lavoro: null,
        tempo_recupero: null,
        tempo_totale: tempoTotale,
        tempo_totale_fisso: tempoTotaleFisso,
        tempo_da_drill_bank: tempoDaDrillBank,
        tempo_da_orario: tempoDaOrario,
        contemporaneo: false,
        gruppo_contemporaneo: null,
        spazio: voceBank?.spazio ?? null,
        materiale: voceBank?.materiale ?? null,
        progressione: voceBank?.progressione ?? null,
        riferimento_gps: voceBank?.riferimentoGps ?? null,
        perche_serve: voceBank?.percheServe ?? null,
        orario_riferimento: a,
      };
      sedutaCorrente.lavori.push(lavoroCorrente);
      continue;
    }

    // Pausa acqua: sezione H2O, tempo totale in minuti dalla colonna E.
    if (a && a.toUpperCase() === "H2O") {
      sedutaCorrente.lavori.push({
        sezione: "H2O",
        rango: null,
        titolo: null,
        codice: null,
        descrizione: null,
        punti_chiave_coaching: null,
        ripetizione: null,
        tempo_lavoro: null,
        tempo_recupero: null,
        tempo_totale: estraiMinuti(e) ?? 1,
        tempo_totale_fisso: true,
        tempo_da_drill_bank: false,
        tempo_da_orario: false,
        contemporaneo: false,
        gruppo_contemporaneo: null,
        spazio: null,
        materiale: null,
        progressione: null,
        riferimento_gps: null,
        perche_serve: null,
        orario_riferimento: null,
      });
      lavoroCorrente = null;
      continue;
    }

    // Cambio campo/attrezzatura: trattato come H2O (blocco a tempo fisso,
    // senza ripetizioni), sezione dedicata "CAMBIO".
    if (a && a.toUpperCase() === "CAMBIO") {
      sedutaCorrente.lavori.push({
        sezione: "CAMBIO",
        rango: null,
        titolo: null,
        codice: null,
        descrizione: null,
        punti_chiave_coaching: null,
        ripetizione: null,
        tempo_lavoro: null,
        tempo_recupero: null,
        tempo_totale: estraiMinuti(e) ?? 0,
        tempo_totale_fisso: true,
        tempo_da_drill_bank: false,
        tempo_da_orario: false,
        contemporaneo: false,
        gruppo_contemporaneo: null,
        spazio: null,
        materiale: null,
        progressione: null,
        riferimento_gps: null,
        perche_serve: null,
        orario_riferimento: null,
      });
      lavoroCorrente = null;
      continue;
    }

    // Riga di continuazione (ripetizioni/minuti/rec) del lavoro appena
    // aggiunto: colonna A vuota, oppure con la parola "contemporanea" che
    // segnala esplicitamente una stazione in parallelo.
    const marcatoreContemporanea = a?.toLowerCase() === "contemporanea";
    const haValori = pulisci(d) !== null || pulisci(e) !== null || pulisci(f) !== null;

    if ((!a || marcatoreContemporanea) && haValori) {
      if (lavoroCorrente) {
        lavoroCorrente.ripetizione = estraiNumero(d);
        lavoroCorrente.tempo_lavoro = estraiMinuti(e);
        lavoroCorrente.tempo_recupero = estraiMinuti(f);
      }
      continue;
    }

    if (a || b || c || d || e || f) {
      avvisi.push(
        `Riga ${i + 1} non riconosciuta e ignorata: "${a ?? b ?? d ?? ""}"`
      );
    }
  }

  // Raggruppa come "contemporaneo" i lavori con lo stesso orario (stessa
  // seduta): è lo stesso concetto già presente nel builder manuale, qui
  // dedotto dal fatto che condividono l'intervallo invece che da un flag
  // esplicito impostato dall'utente.
  for (const seduta of sedute) {
    const gruppiPerOrario = new Map<string, LavoroImportato[]>();

    for (const lavoro of seduta.lavori) {
      const orario = lavoro.orario_riferimento;
      if (!orario) continue;

      const gruppo = gruppiPerOrario.get(orario) ?? [];
      gruppo.push(lavoro);
      gruppiPerOrario.set(orario, gruppo);
    }

    for (const gruppo of gruppiPerOrario.values()) {
      if (gruppo.length < 2) continue;

      const idGruppo = generaIdGruppo();
      for (const lavoro of gruppo) {
        lavoro.contemporaneo = true;
        lavoro.gruppo_contemporaneo = idGruppo;
      }
    }
  }

  if (sedute.length === 0) {
    avvisi.push(
      "Non è stata trovata nessuna seduta riconoscibile nel file. Verifica che il formato corrisponda al modello atteso."
    );
  }

  return { sedute, avvisi };
}
