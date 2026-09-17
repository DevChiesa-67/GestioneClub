import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";

export type ClubPdf = {
  logo_url?: string | null;
};

export type ColonnaPdfPerformance = {
  label: string;
  align?: "left" | "right";
};

export type RigaRiepilogoPdf = {
  label: string;
  value: string;
};

export type AndamentoSessionePdf = {
  /** Etichetta breve mostrata sotto la barra (es. data in formato gg/mm). */
  etichetta: string;
  distanza: number;
  playerLoad: number;
};

export type PdfPerformanceGenerato = {
  doc: jsPDF;
  nomeFile: string;
};

/**
 * Innesca il download di un PDF già generato con generaPdfPerformance /
 * generaPdfPresenze. Separato dalla generazione in modo che il chiamante
 * possa prima mostrare un'anteprima (doc.output("blob") in un iframe) e
 * scaricare solo quando l'utente conferma.
 */
export function scaricaPdfPerformance({ doc, nomeFile }: PdfPerformanceGenerato) {
  doc.save(nomeFile);
}

const COLORE_GIALLO: [number, number, number] = [255, 255, 0];
const COLORE_HEADER: [number, number, number] = [56, 87, 35];
const COLORE_RIEPILOGO_HEADER: [number, number, number] = [40, 40, 40];
const COLORE_BARRA_DISTANZA: [number, number, number] = [56, 87, 35];
const COLORE_BARRA_PLAYER_LOAD: [number, number, number] = [140, 20, 24];

type LogoCaricato = {
  dataUrl: string;
  formato: "PNG" | "JPEG";
  larghezza: number;
  altezza: number;
};

/**
 * Scarica il logo del club e lo prepara per essere inserito nel PDF.
 * Ritorna null se l'URL manca o se il download/decodifica fallisce, in
 * modo che il PDF venga comunque generato senza logo invece di rompersi.
 */
async function caricaLogo(logoUrl?: string | null): Promise<LogoCaricato | null> {
  if (!logoUrl) return null;

  try {
    const risposta = await fetch(logoUrl);
    if (!risposta.ok) return null;

    const blob = await risposta.blob();

    let formato: "PNG" | "JPEG";
    if (blob.type.includes("png")) {
      formato = "PNG";
    } else if (blob.type.includes("jpeg") || blob.type.includes("jpg")) {
      formato = "JPEG";
    } else {
      return null;
    }

    const dataUrl = await new Promise<string>((resolve, reject) => {
      const reader = new FileReader();
      reader.onloadend = () => resolve(reader.result as string);
      reader.onerror = () => reject(new Error("Impossibile leggere il logo"));
      reader.readAsDataURL(blob);
    });

    const dimensioni = await new Promise<{ larghezza: number; altezza: number }>(
      (resolve, reject) => {
        const img = new Image();
        img.onload = () =>
          resolve({ larghezza: img.naturalWidth, altezza: img.naturalHeight });
        img.onerror = () => reject(new Error("Impossibile decodificare il logo"));
        img.src = dataUrl;
      }
    );

    return { dataUrl, formato, ...dimensioni };
  } catch {
    return null;
  }
}

/**
 * Disegna un grafico a barre verticali "a mano" con le primitive di jsPDF
 * (niente canvas/rasterizzazione: resta vettoriale e nitido a ogni zoom).
 * Usato per mostrare l'andamento di una singola metrica sessione per
 * sessione dentro il riquadro di riepilogo del PDF Performance.
 */
function disegnaGraficoBarre(
  doc: jsPDF,
  opzioni: {
    x: number;
    y: number;
    larghezza: number;
    altezza: number;
    titolo: string;
    valori: { etichetta: string; valore: number }[];
    colore: [number, number, number];
    decimali?: number;
  }
) {
  const { x, y, larghezza, altezza, titolo, valori, colore, decimali = 0 } = opzioni;

  doc.setFont("helvetica", "bold");
  doc.setFontSize(8.5);
  doc.setTextColor(0, 0, 0);
  doc.text(titolo, x, y);

  const areaY = y + 3;
  const areaAltezzaLabel = 8; // spazio per le etichette sotto le barre
  const areaAltezza = altezza - areaAltezzaLabel;

  doc.setDrawColor(180, 180, 180);
  doc.setLineWidth(0.1);
  doc.line(x, areaY + areaAltezza, x + larghezza, areaY + areaAltezza);

  if (valori.length === 0) {
    doc.setFont("helvetica", "normal");
    doc.setFontSize(7.5);
    doc.setTextColor(120, 120, 120);
    doc.text("Nessun dato disponibile", x, areaY + areaAltezza / 2);
    return;
  }

  const massimo = Math.max(1, ...valori.map((v) => v.valore));
  const gap = 2;
  const larghezzaBarra = Math.max(
    2,
    (larghezza - gap * (valori.length - 1)) / valori.length
  );

  valori.forEach((voce, indice) => {
    const barX = x + indice * (larghezzaBarra + gap);
    const barAltezza = Math.max(0.3, (voce.valore / massimo) * (areaAltezza - 5));
    const barY = areaY + areaAltezza - barAltezza;

    doc.setFillColor(...colore);
    doc.setDrawColor(...colore);
    doc.rect(barX, barY, larghezzaBarra, barAltezza, "F");

    doc.setFont("helvetica", "bold");
    doc.setFontSize(6);
    doc.setTextColor(0, 0, 0);
    doc.text(
      voce.valore.toFixed(decimali),
      barX + larghezzaBarra / 2,
      barY - 1,
      { align: "center" }
    );

    doc.setFont("helvetica", "normal");
    doc.setFontSize(6);
    doc.setTextColor(80, 80, 80);
    doc.text(
      voce.etichetta,
      barX + larghezzaBarra / 2,
      areaY + areaAltezza + 4,
      { align: "center", maxWidth: larghezzaBarra + gap }
    );
  });
}

/**
 * Come disegnaGraficoBarre, ma ogni colonna è impilata (stacked) con più
 * segmenti colorati: usato per l'andamento presenze, dove ogni giornata va
 * scomposta per stato (Presente, Infortunato, ecc.) con lo stesso colore
 * usato nell'istogramma a schermo. Con un solo segmento per colonna si
 * riduce automaticamente a una barra piena di un colore (caso "filtrato
 * su una card").
 */
function disegnaGraficoBarreImpilate(
  doc: jsPDF,
  opzioni: {
    x: number;
    y: number;
    larghezza: number;
    altezza: number;
    titolo: string;
    colonne: {
      etichetta: string;
      segmenti: { colore: [number, number, number]; valore: number }[];
    }[];
  }
) {
  const { x, y, larghezza, altezza, titolo, colonne } = opzioni;

  doc.setFont("helvetica", "bold");
  doc.setFontSize(8.5);
  doc.setTextColor(0, 0, 0);
  doc.text(titolo, x, y);

  const areaY = y + 3;
  const areaAltezzaLabel = 8;
  const areaAltezza = altezza - areaAltezzaLabel;

  doc.setDrawColor(180, 180, 180);
  doc.setLineWidth(0.1);
  doc.line(x, areaY + areaAltezza, x + larghezza, areaY + areaAltezza);

  if (colonne.length === 0) {
    doc.setFont("helvetica", "normal");
    doc.setFontSize(7.5);
    doc.setTextColor(120, 120, 120);
    doc.text("Nessun dato disponibile", x, areaY + areaAltezza / 2);
    return;
  }

  const totali = colonne.map((colonna) =>
    colonna.segmenti.reduce((somma, segmento) => somma + segmento.valore, 0)
  );
  const massimo = Math.max(1, ...totali);
  const gap = 2;
  const larghezzaBarra = Math.max(
    2,
    (larghezza - gap * (colonne.length - 1)) / colonne.length
  );

  colonne.forEach((colonna, indice) => {
    const totaleColonna = totali[indice];
    const barX = x + indice * (larghezzaBarra + gap);
    // Come in disegnaGraficoBarre: sempre un'altezza minima (0.3mm), anche
    // per le colonne a 0 (es. giornata senza quello stato dopo un filtro
    // da card). Senza questo minimo l'etichetta del valore finisce esatta-
    // mente sopra la linea dell'asse e si sovrappone, con effetto "sballato".
    const barAltezzaTotale = Math.max(
      0.3,
      (totaleColonna / massimo) * (areaAltezza - 5)
    );

    let cursoreY = areaY + areaAltezza;

    colonna.segmenti.forEach((segmento) => {
      if (segmento.valore <= 0 || totaleColonna <= 0) return;

      const segmentoAltezza =
        barAltezzaTotale * (segmento.valore / totaleColonna);
      const segmentoY = cursoreY - segmentoAltezza;

      doc.setFillColor(...segmento.colore);
      doc.setDrawColor(...segmento.colore);
      doc.rect(barX, segmentoY, larghezzaBarra, segmentoAltezza, "F");

      cursoreY = segmentoY;
    });

    doc.setFont("helvetica", "bold");
    doc.setFontSize(6);
    doc.setTextColor(0, 0, 0);
    doc.text(
      String(totaleColonna),
      barX + larghezzaBarra / 2,
      areaY + areaAltezza - barAltezzaTotale - 1,
      { align: "center" }
    );

    doc.setFont("helvetica", "normal");
    doc.setFontSize(6);
    doc.setTextColor(80, 80, 80);
    doc.text(
      colonna.etichetta,
      barX + larghezzaBarra / 2,
      areaY + areaAltezza + 4,
      { align: "center", maxWidth: larghezzaBarra + gap }
    );
  });
}

/**
 * Disegna la legenda colori (quadratino + etichetta) usata sotto il
 * grafico impilato dell'andamento presenze, in modo che i colori dei
 * segmenti restino leggibili anche senza guardare lo schermo.
 */
function disegnaLegendaPresenze(
  doc: jsPDF,
  opzioni: {
    x: number;
    y: number;
    larghezzaMax: number;
    voci: { label: string; colore: [number, number, number] }[];
  }
) {
  const { x, y, larghezzaMax, voci } = opzioni;
  const dimQuadrato = 3;
  const gapVoci = 5;

  let curX = x;
  let curY = y;

  doc.setFont("helvetica", "normal");
  doc.setFontSize(7.5);

  voci.forEach((voce) => {
    const larghezzaTesto = doc.getTextWidth(voce.label);
    const larghezzaVoce = dimQuadrato + 1.5 + larghezzaTesto + gapVoci;

    if (curX + larghezzaVoce > x + larghezzaMax) {
      curX = x;
      curY += 5;
    }

    doc.setFillColor(...voce.colore);
    doc.rect(curX, curY - dimQuadrato, dimQuadrato, dimQuadrato, "F");

    doc.setTextColor(90, 90, 90);
    doc.text(voce.label, curX + dimQuadrato + 1.5, curY);

    curX += larghezzaVoce;
  });

  return curY;
}

/**
 * Disegna l'intestazione comune a tutti i PDF di /performance: barra
 * gialla col titolo, logo del club in alto a destra ed eventuale
 * sottotitolo. Estratta da generaPdfPerformance in modo da essere
 * riutilizzata anche da generaPdfPresenze (stesso stile, contenuto
 * diverso).
 */
async function disegnaIntestazionePdf(
  doc: jsPDF,
  titolo: string,
  sottotitolo: string | null,
  club?: ClubPdf | null
): Promise<number> {
  const larghezzaPagina = doc.internal.pageSize.getWidth();
  const margine = 12;

  const logo = await caricaLogo(club?.logo_url);

  const larghezzaLogoBox = logo ? 26 : 0;
  const larghezzaTitolo = larghezzaPagina - margine * 2 - larghezzaLogoBox;

  doc.setFillColor(...COLORE_GIALLO);
  doc.setDrawColor(0, 0, 0);
  doc.rect(margine, 10, larghezzaTitolo, 9, "FD");

  doc.setFont("helvetica", "bold");
  doc.setFontSize(12);
  doc.setTextColor(0, 0, 0);
  doc.text(titolo, margine + larghezzaTitolo / 2, 16.5, { align: "center" });

  if (logo) {
    const altezzaMax = 16;
    const larghezzaMax = larghezzaLogoBox - 2;
    const rapporto = logo.larghezza / logo.altezza || 1;

    let larghezzaLogo = larghezzaMax;
    let altezzaLogo = larghezzaLogo / rapporto;

    if (altezzaLogo > altezzaMax) {
      altezzaLogo = altezzaMax;
      larghezzaLogo = altezzaLogo * rapporto;
    }

    const xLogo = larghezzaPagina - margine - larghezzaLogo;
    const yLogo = 10 + (9 - altezzaLogo) / 2;

    try {
      doc.addImage(
        logo.dataUrl,
        logo.formato,
        xLogo,
        yLogo,
        larghezzaLogo,
        altezzaLogo
      );
    } catch {
      // Se anche addImage fallisce non blocchiamo la generazione del PDF.
    }
  }

  let startY = 23;

  if (sottotitolo) {
    doc.setFont("helvetica", "normal");
    doc.setFontSize(9);
    doc.setTextColor(80, 80, 80);
    doc.text(sottotitolo, margine, startY);
    startY += 7;
  }

  return startY;
}

/**
 * Genera e scarica un PDF della scheda performance (dati Catapult) così
 * come filtrata/visualizzata a schermo: stesso titolo giallo e logo in
 * alto a destra usati per il PDF dell'allenamento, ma in orizzontale per
 * ospitare più colonne, con una tabella che rispecchia esattamente le
 * colonne visibili (incluse quelle calcolate) e le righe filtrate.
 */
export async function generaPdfPerformance(
  titolo: string,
  sottotitolo: string | null,
  colonne: ColonnaPdfPerformance[],
  righe: string[][],
  club?: ClubPdf | null,
  nomeFile = "performance.pdf",
  righeRiepilogo?: RigaRiepilogoPdf[],
  andamentoSessioni?: AndamentoSessionePdf[]
): Promise<PdfPerformanceGenerato> {
  const doc = new jsPDF({ orientation: "landscape" });
  const larghezzaPagina = doc.internal.pageSize.getWidth();
  const margine = 12;

  let startY = await disegnaIntestazionePdf(doc, titolo, sottotitolo, club);

  // Sezione "Riepilogo": statistiche aggregate mostrate come piccola
  // tabella a due colonne prima del dettaglio riga-per-sessione, così il
  // PDF riflette anche quello che si vede nella tab "Riepilogo" a schermo.
  if (righeRiepilogo && righeRiepilogo.length > 0) {
    doc.setFont("helvetica", "bold");
    doc.setFontSize(10);
    doc.setTextColor(0, 0, 0);
    doc.text("RIEPILOGO", margine, startY);
    startY += 3;

    const riepilogoStartY = startY;
    const larghezzaTabellaRiepilogo = 110;

    autoTable(doc, {
      startY: riepilogoStartY,
      body: righeRiepilogo.map((riga) => [riga.label, riga.value]),
      theme: "grid",
      tableWidth: larghezzaTabellaRiepilogo,
      margin: { left: margine },
      styles: {
        fontSize: 8,
        cellPadding: 2,
        lineColor: [0, 0, 0],
        lineWidth: 0.2,
        textColor: [0, 0, 0],
      },
      columnStyles: {
        0: { fontStyle: "bold", cellWidth: 65 },
        1: { halign: "right" },
      },
      headStyles: {
        fillColor: COLORE_RIEPILOGO_HEADER,
      },
    });

    const riepilogoFinalY = (
      doc as unknown as { lastAutoTable: { finalY: number } }
    ).lastAutoTable.finalY;

    // Grafici "andamento per sessione": affiancati alla tabella riepilogo,
    // nello spazio libero a destra (il PDF è in orizzontale apposta per
    // ospitarli senza dover aggiungere una pagina).
    if (andamentoSessioni && andamentoSessioni.length > 0) {
      const gapGrafici = 8;
      const xGrafici = margine + larghezzaTabellaRiepilogo + gapGrafici;
      const larghezzaGrafici = larghezzaPagina - margine - xGrafici;
      const altezzaDisponibile = Math.max(
        riepilogoFinalY - riepilogoStartY,
        40
      );
      const gapVerticale = 8;
      const altezzaSingoloGrafico = (altezzaDisponibile - gapVerticale) / 2;

      disegnaGraficoBarre(doc, {
        x: xGrafici,
        y: riepilogoStartY + 4,
        larghezza: larghezzaGrafici,
        altezza: altezzaSingoloGrafico,
        titolo: "Distanza per sessione (m)",
        valori: andamentoSessioni.map((voce) => ({
          etichetta: voce.etichetta,
          valore: voce.distanza,
        })),
        colore: COLORE_BARRA_DISTANZA,
      });

      disegnaGraficoBarre(doc, {
        x: xGrafici,
        y: riepilogoStartY + 4 + altezzaSingoloGrafico + gapVerticale,
        larghezza: larghezzaGrafici,
        altezza: altezzaSingoloGrafico,
        titolo: "Player Load per sessione",
        valori: andamentoSessioni.map((voce) => ({
          etichetta: voce.etichetta,
          valore: voce.playerLoad,
        })),
        colore: COLORE_BARRA_PLAYER_LOAD,
      });
    }

    startY = riepilogoFinalY + 8;

    doc.setFont("helvetica", "bold");
    doc.setFontSize(10);
    doc.setTextColor(0, 0, 0);
    doc.text("DETTAGLIO SESSIONI", margine, startY);
    startY += 3;
  }

  autoTable(doc, {
    startY,
    head: [colonne.map((colonna) => colonna.label)],
    body: righe,
    theme: "grid",
    styles: {
      fontSize: 8,
      cellPadding: 2,
      lineColor: [0, 0, 0],
      lineWidth: 0.2,
      textColor: [0, 0, 0],
    },
    columnStyles: Object.fromEntries(
      colonne.map((colonna, indice) => [
        indice,
        { halign: colonna.align ?? "left" },
      ])
    ),
    headStyles: {
      fillColor: COLORE_HEADER,
      textColor: [255, 255, 255],
      fontStyle: "bold",
      halign: "center",
    },
    alternateRowStyles: {
      fillColor: [245, 245, 245],
    },
  });

  return { doc, nomeFile };
}

export type SegmentoAndamentoPresenzaPdf = {
  colore: [number, number, number];
  valore: number;
};

export type AndamentoPresenzaPdf = {
  /** Etichetta breve mostrata sotto la barra (es. data in formato gg/mm). */
  etichetta: string;
  /**
   * Uno o più segmenti impilati nella colonna, ciascuno col colore dello
   * stato corrispondente (stessi colori dell'istogramma a schermo). Con un
   * solo segmento la barra resta di un unico colore (card filtrata).
   */
  segmenti: SegmentoAndamentoPresenzaPdf[];
};

export type LegendaPresenzaPdf = {
  label: string;
  colore: [number, number, number];
};

export type RigaDistribuzionePdf = {
  label: string;
  totale: number;
  percentuale: number;
};

/**
 * Una riga della sezione "Assenze giustificate": il motivo scritto nel
 * popup di Registra presenze, cosi' il PDF non si limita a dire quante
 * assenze ci sono state ma anche perche'.
 */
export type RigaAssenzaGiustificataPdf = {
  /** Gia' formattata per la stampa (gg/mm/aaaa). */
  data: string;
  giocatore: string;
  motivo: string | null;
};

/**
 * Nero o bianco a seconda di quanto e' chiaro lo sfondo. Formula di
 * luminanza percepita: l'occhio pesa molto il verde e pochissimo il blu,
 * per questo i coefficienti non sono uguali fra loro.
 */
function testoSuSfondo(
  colore: [number, number, number]
): [number, number, number] {
  const [r, g, b] = colore;

  const luminanza = (0.299 * r + 0.587 * g + 0.114 * b) / 255;

  return luminanza > 0.6 ? [25, 25, 25] : [255, 255, 255];
}

/**
 * Una cella della matrice presenze: la sigla dello stato (P, PM, PP, I,
 * AG, AI) con il colore della legenda. `null` = nessun dato per quel
 * giocatore in quella giornata.
 */
export type CellaMatricePresenzePdf = {
  sigla: string;
  colore: [number, number, number];
} | null;

export type RigaMatricePresenzePdf = {
  giocatore: string;
  /** Stessa lunghezza (e stesso ordine) di `MatricePresenzePdf.date`. */
  celle: CellaMatricePresenzePdf[];
  presenze: number;
  giornate: number;
};

/**
 * Spaccato giocatore x giornata: la stessa griglia che si vede a schermo
 * nella tab Presenze.
 */
export type MatricePresenzePdf = {
  /** Etichette di colonna gia' formattate (gg/mm). */
  date: string[];
  righe: RigaMatricePresenzePdf[];
};

/**
 * Genera e scarica un PDF con l'andamento delle presenze in base ai filtri
 * applicati nella tab "Presenze" (inclusa l'eventuale card di stato
 * selezionata): riepilogo con % di presenza, grafico a barre impilate con
 * gli stessi colori dell'istogramma a schermo e tabella di distribuzione
 * per stato. Stesso stile (intestazione gialla + logo) del PDF
 * Performance, così i due export restano coerenti tra loro pur mostrando
 * contenuti diversi.
 */
export async function generaPdfPresenze(
  titolo: string,
  sottotitolo: string | null,
  righeRiepilogo: RigaRiepilogoPdf[],
  andamento: AndamentoPresenzaPdf[],
  distribuzione: RigaDistribuzionePdf[],
  legenda: LegendaPresenzaPdf[],
  club?: ClubPdf | null,
  nomeFile = "presenze.pdf",
  // In coda per non rompere le chiamate esistenti: senza assenze
  // giustificate nel periodo la sezione non viene nemmeno disegnata.
  assenzeGiustificate: RigaAssenzaGiustificataPdf[] = [],
  // Idem: senza matrice la sezione non compare.
  matrice: MatricePresenzePdf | null = null
): Promise<PdfPerformanceGenerato> {
  const doc = new jsPDF({ orientation: "landscape" });
  const larghezzaPagina = doc.internal.pageSize.getWidth();
  const margine = 12;

  let startY = await disegnaIntestazionePdf(doc, titolo, sottotitolo, club);

  doc.setFont("helvetica", "bold");
  doc.setFontSize(10);
  doc.setTextColor(0, 0, 0);
  doc.text("RIEPILOGO", margine, startY);
  startY += 3;

  const riepilogoStartY = startY;
  const larghezzaTabellaRiepilogo = 90;

  autoTable(doc, {
    startY: riepilogoStartY,
    body: righeRiepilogo.map((riga) => [riga.label, riga.value]),
    theme: "grid",
    tableWidth: larghezzaTabellaRiepilogo,
    margin: { left: margine },
    styles: {
      fontSize: 8,
      cellPadding: 2,
      lineColor: [0, 0, 0],
      lineWidth: 0.2,
      textColor: [0, 0, 0],
    },
    columnStyles: {
      0: { fontStyle: "bold", cellWidth: 55 },
      1: { halign: "right" },
    },
    headStyles: {
      fillColor: COLORE_RIEPILOGO_HEADER,
    },
  });

  const riepilogoFinalY = (
    doc as unknown as { lastAutoTable: { finalY: number } }
  ).lastAutoTable.finalY;

  // Grafico "andamento presenze": affiancato alla tabella riepilogo, nello
  // spazio libero a destra, con le colonne impilate colorate per stato
  // (stessi colori dell'istogramma a schermo).
  let yLegenda = riepilogoFinalY;

  if (andamento.length > 0) {
    const gapGrafico = 8;
    const xGrafico = margine + larghezzaTabellaRiepilogo + gapGrafico;
    const larghezzaGrafico = larghezzaPagina - margine - xGrafico;
    const altezzaGrafico = Math.max(riepilogoFinalY - riepilogoStartY, 40);

    disegnaGraficoBarreImpilate(doc, {
      x: xGrafico,
      y: riepilogoStartY + 4,
      larghezza: larghezzaGrafico,
      altezza: altezzaGrafico,
      titolo: "Andamento presenze nel periodo",
      colonne: andamento.map((voce) => ({
        etichetta: voce.etichetta,
        segmenti: voce.segmenti,
      })),
    });

    // La legenda ha senso solo quando ci sono più colori da spiegare
    // (nessun filtro attivo su una sola card).
    if (legenda.length > 1) {
      yLegenda = disegnaLegendaPresenze(doc, {
        x: xGrafico,
        y: riepilogoStartY + 4 + altezzaGrafico + 3,
        larghezzaMax: larghezzaGrafico,
        voci: legenda,
      });
    }
  }

  startY = Math.max(riepilogoFinalY, yLegenda) + 8;

  doc.setFont("helvetica", "bold");
  doc.setFontSize(10);
  doc.setTextColor(0, 0, 0);
  doc.text("DISTRIBUZIONE PER STATO", margine, startY);
  startY += 3;

  autoTable(doc, {
    startY,
    head: [["Stato", "Totale", "% sul totale"]],
    body: distribuzione.map((riga) => [
      riga.label,
      String(riga.totale),
      `${riga.percentuale}%`,
    ]),
    theme: "grid",
    tableWidth: larghezzaTabellaRiepilogo + 40,
    margin: { left: margine },
    styles: {
      fontSize: 8,
      cellPadding: 2,
      lineColor: [0, 0, 0],
      lineWidth: 0.2,
      textColor: [0, 0, 0],
    },
    columnStyles: {
      1: { halign: "right" },
      2: { halign: "right" },
    },
    headStyles: {
      fillColor: COLORE_HEADER,
      textColor: [255, 255, 255],
      fontStyle: "bold",
      halign: "center",
    },
    alternateRowStyles: {
      fillColor: [245, 245, 245],
    },
  });

  /*
   * SPACCATO GIOCATORE x GIORNATA
   * ==============================
   * La stessa griglia che si vede a schermo: una riga per giocatore, una
   * colonna per giornata, la sigla dello stato colorata come la legenda.
   *
   * Sta PRIMA delle assenze giustificate: prima si guarda il quadro
   * d'insieme, poi si leggono i motivi delle assenze.
   *
   * Le giornate si spezzano in blocchi da MAX_COLONNE_MATRICE: su un A4
   * orizzontale oltre quella soglia le colonne diventano cosi' strette
   * che la sigla non ci sta piu'. La colonna dei totali compare solo
   * nell'ultimo blocco, perche' e' il totale del periodo intero e
   * ripeterla a ogni blocco farebbe pensare a un totale parziale.
   */
  if (matrice && matrice.date.length > 0 && matrice.righe.length > 0) {
    // Copia in una const: dentro le callback qui sotto TypeScript
    // perderebbe il controllo di nullita' fatto sul parametro.
    const griglia = matrice;

    const MAX_COLONNE_MATRICE = 26;

    const blocchi: number[][] = [];

    for (let i = 0; i < griglia.date.length; i += MAX_COLONNE_MATRICE) {
      blocchi.push(
        griglia.date.map((_, indice) => indice).slice(i, i + MAX_COLONNE_MATRICE)
      );
    }

    blocchi.forEach((indiciColonna, indiceBlocco) => {
      const ultimoBlocco = indiceBlocco === blocchi.length - 1;

      /*
       * Una pagina tutta sua (e una per ogni blocco di giornate). La
       * griglia si legge solo se sta intera sotto gli occhi: accodata al
       * riepilogo si spezzava a meta' fra due pagine, con i primi
       * giocatori in fondo alla prima e il resto sulla seconda.
       */
      doc.addPage();
      startY = margine + 6;

      doc.setFont("helvetica", "bold");
      doc.setFontSize(10);
      doc.setTextColor(0, 0, 0);
      doc.text(
        blocchi.length > 1
          ? `PRESENZE PER GIOCATORE (${indiceBlocco + 1} di ${blocchi.length})`
          : "PRESENZE PER GIOCATORE",
        margine,
        startY
      );
      startY += 3;

      const intestazione = [
        "Giocatore",
        ...indiciColonna.map((indice) => griglia.date[indice]),
        ...(ultimoBlocco ? ["Presenze"] : []),
      ];

      const corpo = griglia.righe.map((riga) => [
        riga.giocatore,
        ...indiciColonna.map((indice) => riga.celle[indice]?.sigla ?? ""),
        ...(ultimoBlocco ? [`${riga.presenze}/${riga.giornate}`] : []),
      ]);

      /*
       * Larghezza fissa per le colonne-data, uguale in tutti i blocchi:
       * senza, l'ultimo blocco (quasi sempre corto) allargherebbe le sue
       * poche colonne fino a riempire la pagina, e i due blocchi non si
       * leggerebbero piu' come la stessa griglia. `tableWidth: "wrap"`
       * serve allo stesso scopo: la tabella e' larga quanto le colonne.
       */
      const larghezzaNome = 34;
      const larghezzaTotali = 16;

      /*
       * Con un blocco solo le colonne si spartiscono tutta la pagina.
       * Con piu' blocchi si dividono invece per il massimo teorico, cosi'
       * l'ultimo blocco (quasi sempre corto) non allarga le sue poche
       * colonne fino a riempire la pagina: i blocchi devono leggersi come
       * la stessa griglia spezzata, non come due tabelle diverse.
       */
      const colonneDaSpartire =
        blocchi.length > 1 ? MAX_COLONNE_MATRICE : indiciColonna.length;

      const larghezzaColonnaData =
        (larghezzaPagina - margine * 2 - larghezzaNome - larghezzaTotali) /
        colonneDaSpartire;

      const stiliColonne: Record<number, { cellWidth: number }> = {};

      indiciColonna.forEach((_, posizione) => {
        stiliColonne[posizione + 1] = { cellWidth: larghezzaColonnaData };
      });

      autoTable(doc, {
        startY,
        head: [intestazione],
        body: corpo,
        theme: "grid",
        tableWidth: "wrap",
        margin: { left: margine, right: margine },
        styles: {
          fontSize: 6,
          cellPadding: 1,
          lineColor: [210, 210, 210],
          lineWidth: 0.1,
          textColor: [0, 0, 0],
          halign: "center",
          valign: "middle",
          overflow: "hidden",
        },
        columnStyles: {
          0: { cellWidth: larghezzaNome, halign: "left", fontStyle: "bold" },
          ...stiliColonne,
          ...(ultimoBlocco
            ? {
                [indiciColonna.length + 1]: {
                  cellWidth: larghezzaTotali,
                  fontStyle: "bold" as const,
                },
              }
            : {}),
        },
        headStyles: {
          fillColor: COLORE_RIEPILOGO_HEADER,
          textColor: [255, 255, 255],
          fontStyle: "bold",
          fontSize: 6,
          halign: "center",
        },
        /*
         * Il colore non puo' stare nei dati (autoTable accetta solo
         * stringhe nelle celle): si applica qui, leggendo la cella
         * corrispondente della matrice. Il testo bianco o nero lo decide
         * la luminosita' dello sfondo: "PM" e' giallo, e in bianco su
         * giallo la sigla sparisce.
         */
        didParseCell: (dati) => {
          if (dati.section !== "body") return;

          // La colonna 0 e' il nome, le ultime possono essere i totali.
          const posizione = dati.column.index - 1;

          if (posizione < 0 || posizione >= indiciColonna.length) return;

          const cella =
            griglia.righe[dati.row.index]?.celle[indiciColonna[posizione]];

          if (!cella) return;

          dati.cell.styles.fillColor = cella.colore;
          dati.cell.styles.textColor = testoSuSfondo(cella.colore);
          dati.cell.styles.fontStyle = "bold";
        },
      });
    });
  }

  // Sezione "Assenze giustificate": elenco per data con il motivo scritto
  // in Registra presenze. Larghezza piena, perche' i motivi sono testo
  // libero e in una colonna stretta andrebbero a capo di continuo.
  if (assenzeGiustificate.length > 0) {
    /*
     * Anche le assenze giustificate partono da una pagina nuova: e'
     * l'elenco che si stampa e si passa in giro, e cominciare a meta'
     * pagina sotto la coda di un'altra tabella lo rende scomodo da
     * leggere. Se sono tante, autoTable prosegue sulle pagine dopo.
     */
    doc.addPage();
    startY = margine + 6;

    doc.setFont("helvetica", "bold");
    doc.setFontSize(10);
    doc.setTextColor(0, 0, 0);
    doc.text("ASSENZE GIUSTIFICATE", margine, startY);
    startY += 3;

    autoTable(doc, {
      startY,
      head: [["Data", "Giocatore", "Motivo"]],
      body: assenzeGiustificate.map((riga) => [
        riga.data,
        riga.giocatore,
        riga.motivo?.trim() || "Motivo non indicato",
      ]),
      theme: "grid",
      margin: { left: margine, right: margine },
      styles: {
        fontSize: 8,
        cellPadding: 2,
        lineColor: [0, 0, 0],
        lineWidth: 0.2,
        textColor: [0, 0, 0],
        overflow: "linebreak",
      },
      columnStyles: {
        0: { cellWidth: 24 },
        1: { cellWidth: 55, fontStyle: "bold" },
      },
      headStyles: {
        fillColor: COLORE_HEADER,
        textColor: [255, 255, 255],
        fontStyle: "bold",
        halign: "center",
      },
      alternateRowStyles: {
        fillColor: [245, 245, 245],
      },
    });
  }

  return { doc, nomeFile };
}
