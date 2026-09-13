import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";

/**
 * PDF DELLA FORMAZIONE (CONVOCAZIONI)
 * ====================================
 * Stessa forma degli altri PDF del gestionale (vedi pdf-performance.ts):
 * la funzione genera e RESTITUISCE il documento, senza salvarlo, così il
 * chiamante può mostrarlo in anteprima in un iframe
 * (`doc.output("blob")`) e scaricarlo solo quando l'utente conferma.
 *
 * A differenza del PDF performance qui non si carica nessun logo: le
 * convocazioni si stampano spesso a ridosso della partita e una fetch
 * che può fallire o essere lenta non deve stare fra il click e il PDF.
 * L'identità visiva la dà il colore del club.
 */

export type RigaFormazionePdf = {
  /** Numero di maglia. `null` per un posto vuoto o senza numero. */
  numero: number | null;
  /** Cognome e nome, in quest'ordine: è come si legge una distinta. */
  nominativo: string;
  /** "C" capitano, "V" vice, stringa vuota per tutti gli altri. */
  grado: string;
  /** Anno di nascita, stringa vuota se la data non è in anagrafica. */
  anno: string;
};

export type DettaglioPartitaPdf = {
  label: string;
  value: string;
};

export type PdfConvocazioniGenerato = {
  doc: jsPDF;
  nomeFile: string;
};

export type OpzioniPdfConvocazioni = {
  /** "Squadra casa vs Squadra fuori". */
  titolo: string;
  dettagli: DettaglioPartitaPdf[];
  titolari: RigaFormazionePdf[];
  panchina: RigaFormazionePdf[];
  /** Colore del club in esadecimale, es. "#d71920". */
  coloreClub: string;
  nomeFile: string;
};

const COLORE_FALLBACK: [number, number, number] = [215, 25, 32];
const MARGINE = 14;

/** Scarica un PDF già generato da `generaPdfConvocazioni`. */
export function scaricaPdfConvocazioni({
  doc,
  nomeFile,
}: PdfConvocazioniGenerato) {
  doc.save(nomeFile);
}

/**
 * Converte "#d71920" (o "d71920") nella terna RGB che vuole jsPDF.
 * Davanti a qualsiasi valore non riconosciuto torna il rosso di default
 * invece di lanciare: un colore sbagliato in anagrafica club non deve
 * impedire di stampare la distinta.
 */
function hexToRgb(hex: string): [number, number, number] {
  const pulito = hex.trim().replace("#", "");

  const esteso =
    pulito.length === 3
      ? pulito
          .split("")
          .map((carattere) => carattere + carattere)
          .join("")
      : pulito;

  if (!/^[0-9a-fA-F]{6}$/.test(esteso)) {
    return COLORE_FALLBACK;
  }

  return [
    parseInt(esteso.slice(0, 2), 16),
    parseInt(esteso.slice(2, 4), 16),
    parseInt(esteso.slice(4, 6), 16),
  ];
}

type PosizioneCorrente = { y: number };

function disegnaTabella(
  doc: jsPDF,
  posizione: PosizioneCorrente,
  titoloSezione: string,
  righe: RigaFormazionePdf[],
  colore: [number, number, number]
) {
  doc.setFont("helvetica", "bold");
  doc.setFontSize(11);
  doc.setTextColor(colore[0], colore[1], colore[2]);
  doc.text(titoloSezione.toUpperCase(), MARGINE, posizione.y);

  posizione.y += 2;

  autoTable(doc, {
    startY: posizione.y,
    margin: { left: MARGINE, right: MARGINE },
    head: [["N.", "Cognome e nome", "C/V", "Anno"]],
    body:
      righe.length > 0
        ? righe.map((riga) => [
            riga.numero === null ? "-" : String(riga.numero),
            riga.nominativo,
            riga.grado,
            riga.anno,
          ])
        : [["-", "Nessun giocatore", "", ""]],
    theme: "grid",
    styles: {
      font: "helvetica",
      fontSize: 10,
      cellPadding: 2.2,
      lineColor: [220, 220, 220],
      lineWidth: 0.2,
      textColor: [30, 30, 30],
    },
    headStyles: {
      fillColor: colore,
      textColor: [255, 255, 255],
      fontStyle: "bold",
      halign: "center",
    },
    alternateRowStyles: { fillColor: [246, 246, 246] },
    columnStyles: {
      0: { cellWidth: 14, halign: "center", fontStyle: "bold" },
      1: { cellWidth: "auto" },
      2: { cellWidth: 16, halign: "center", fontStyle: "bold" },
      3: { cellWidth: 20, halign: "center" },
    },
  });

  /*
   * `lastAutoTable` è il modo con cui jspdf-autotable comunica dove ha
   * finito di disegnare: serve per incolonnare la sezione successiva
   * senza numeri magici.
   */
  const docConTabella = doc as jsPDF & {
    lastAutoTable?: { finalY: number };
  };

  posizione.y = (docConTabella.lastAutoTable?.finalY ?? posizione.y) + 10;
}

export function generaPdfConvocazioni({
  titolo,
  dettagli,
  titolari,
  panchina,
  coloreClub,
  nomeFile,
}: OpzioniPdfConvocazioni): PdfConvocazioniGenerato {
  const doc = new jsPDF({ orientation: "portrait", unit: "mm", format: "a4" });
  const colore = hexToRgb(coloreClub);
  const larghezza = doc.internal.pageSize.getWidth();

  // Fascia colorata in testa con il titolo della partita.
  doc.setFillColor(colore[0], colore[1], colore[2]);
  doc.rect(0, 0, larghezza, 24, "F");

  doc.setFont("helvetica", "bold");
  doc.setFontSize(16);
  doc.setTextColor(255, 255, 255);
  doc.text(titolo, larghezza / 2, 15, { align: "center", maxWidth: larghezza - 20 });

  const posizione: PosizioneCorrente = { y: 34 };

  // Dettagli partita: due colonne, così restano compatti anche quando
  // sono cinque o sei voci.
  if (dettagli.length > 0) {
    const meta = Math.ceil(dettagli.length / 2);
    const colonne = [dettagli.slice(0, meta), dettagli.slice(meta)];
    const larghezzaColonna = (larghezza - MARGINE * 2) / 2;

    colonne.forEach((colonna, indiceColonna) => {
      let y = posizione.y;

      colonna.forEach((voce) => {
        const x = MARGINE + indiceColonna * larghezzaColonna;

        doc.setFont("helvetica", "bold");
        doc.setFontSize(9);
        doc.setTextColor(120, 120, 120);
        doc.text(voce.label.toUpperCase(), x, y);

        doc.setFont("helvetica", "normal");
        doc.setFontSize(11);
        doc.setTextColor(30, 30, 30);
        doc.text(voce.value || "-", x, y + 5, {
          maxWidth: larghezzaColonna - 6,
        });

        y += 13;
      });
    });

    posizione.y += meta * 13 + 2;
  }

  doc.setDrawColor(colore[0], colore[1], colore[2]);
  doc.setLineWidth(0.6);
  doc.line(MARGINE, posizione.y, larghezza - MARGINE, posizione.y);

  posizione.y += 8;

  disegnaTabella(doc, posizione, "Formazione titolare", titolari, colore);
  disegnaTabella(doc, posizione, "Panchina", panchina, colore);

  // Legenda: "C/V" da sola non si capisce a distanza di un mese.
  doc.setFont("helvetica", "normal");
  doc.setFontSize(8);
  doc.setTextColor(140, 140, 140);
  doc.text(
    "C = capitano   V = vicecapitano",
    MARGINE,
    Math.min(posizione.y, doc.internal.pageSize.getHeight() - 10)
  );

  return { doc, nomeFile };
}
