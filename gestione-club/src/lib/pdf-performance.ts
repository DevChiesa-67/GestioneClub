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
) {
  const doc = new jsPDF({ orientation: "landscape" });
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

  doc.save(nomeFile);
}
