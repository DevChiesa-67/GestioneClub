import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import { formatDataIT } from "@/lib/date";

export type LavoroPdf = {
  sezione: string;
  descrizione: string | null;
  obbiettivo: string | null;
  tempo_lavoro: number | null;
  ripetizione: number | null;
  tempo_recupero: number | null;
  tempo_totale: number | null;
  ordine: number | null;
  contemporaneo?: boolean | null;
  gruppo_contemporaneo?: string | null;
};

export type AllenamentoPdf = {
  titolo: string | null;
  data_allenamento: string;
  ora_inizio: string | null;
  ora_fine: string | null;
};

export type ClubPdf = {
  logo_url?: string | null;
};

const COLORE_HEADER: [number, number, number] = [56, 87, 35];
const COLORE_TITOLO: [number, number, number] = [140, 20, 24];
const COLORE_GRIGIO_SEZIONE: [number, number, number] = [217, 217, 217];
const COLORE_AZZURRO_TOTALE: [number, number, number] = [184, 204, 228];

function formatOra(ora: string | null) {
  return ora ? ora.slice(0, 5) : "";
}

function isSezioneH2O(sezione: string) {
  return sezione.trim().toUpperCase() === "H2O";
}

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
      // Formato non supportato direttamente da jsPDF (es. webp/svg): lo
      // saltiamo piuttosto che rischiare un PDF corrotto.
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

// Raggruppa i lavori ordinati in "run" consecutivi: i lavori contemporanei
// (stesso gruppo_contemporaneo, contigui) diventano un unico run con piu'
// membri, tutti gli altri sono run da un membro solo.
function raggruppaInRun(lavori: LavoroPdf[]) {
  const run: LavoroPdf[][] = [];

  lavori.forEach((lavoro) => {
    const idGruppo =
      lavoro.contemporaneo && lavoro.gruppo_contemporaneo
        ? lavoro.gruppo_contemporaneo
        : null;

    const ultimoRun = run[run.length - 1];
    const ultimo = ultimoRun?.[0];
    const idGruppoUltimo =
      ultimo?.contemporaneo && ultimo.gruppo_contemporaneo
        ? ultimo.gruppo_contemporaneo
        : null;

    if (idGruppo && ultimoRun && idGruppoUltimo === idGruppo) {
      ultimoRun.push(lavoro);
    } else {
      run.push([lavoro]);
    }
  });

  return run;
}

/**
 * Genera e scarica un PDF dell'allenamento nel formato "foglio di lavoro"
 * classico usato dallo staff tecnico: barra titolo rosso scuro con box logo
 * a destra, header verde scuro, righe di sezione grigie, riga di pausa h2o
 * e colonna Tempo Totale evidenziate in azzurro, celle unite per i lavori
 * svolti in contemporanea da più gruppi.
 */
export async function generaPdfAllenamento(
  allenamento: AllenamentoPdf,
  lavori: LavoroPdf[],
  club?: ClubPdf | null
) {
  const doc = new jsPDF();
  const larghezzaPagina = doc.internal.pageSize.getWidth();
  const margine = 14;

  const logo = await caricaLogo(club?.logo_url);

  // Il titolo lascia spazio al box logo (sempre presente, con placeholder
  // "LOGO" quando il club non ne ha uno caricato) sulla destra.
  const larghezzaLogoBox = 26;
  const scartoLogoBox = 3;
  const larghezzaTitolo =
    larghezzaPagina - margine * 2 - larghezzaLogoBox - scartoLogoBox;
  const xLogoBox = margine + larghezzaTitolo + scartoLogoBox;

  // Barra titolo rosso scuro, testo bianco allineato a sinistra.
  doc.setFillColor(...COLORE_TITOLO);
  doc.setDrawColor(0, 0, 0);
  doc.rect(margine, 12, larghezzaTitolo, 9, "FD");

  doc.setFont("helvetica", "bold");
  doc.setFontSize(12);
  doc.setTextColor(255, 255, 255);
  doc.text(
    `ALLENAMENTO ${formatDataIT(allenamento.data_allenamento)}`,
    margine + 3,
    18.5,
    { align: "left" }
  );

  // Box logo: sempre disegnato, con l'immagine del club se disponibile,
  // altrimenti un placeholder testuale "LOGO".
  doc.setFillColor(255, 255, 255);
  doc.setDrawColor(0, 0, 0);
  doc.rect(xLogoBox, 12, larghezzaLogoBox, 9, "FD");

  if (logo) {
    const altezzaMax = 7;
    const larghezzaMax = larghezzaLogoBox - 2;
    const rapporto = logo.larghezza / logo.altezza || 1;

    let larghezzaLogo = larghezzaMax;
    let altezzaLogo = larghezzaLogo / rapporto;

    if (altezzaLogo > altezzaMax) {
      altezzaLogo = altezzaMax;
      larghezzaLogo = altezzaLogo * rapporto;
    }

    const xLogo = xLogoBox + (larghezzaLogoBox - larghezzaLogo) / 2;
    const yLogo = 12 + (9 - altezzaLogo) / 2;

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
  } else {
    doc.setFont("helvetica", "bold");
    doc.setFontSize(9);
    doc.setTextColor(0, 0, 0);
    doc.text("LOGO", xLogoBox + larghezzaLogoBox / 2, 17.2, {
      align: "center",
    });
  }

  // La prima colonna ("") ospita l'etichetta di sezione ruotata in
  // verticale, disegnata a mano in didDrawCell.
  const colonne = [
    "",
    "Descrizione",
    "Obbiettivo",
    "Tempo di Lavoro",
    "Ripetizione",
    "Tempo di Recupero",
    "Tempo Totale",
  ];

  const lavoriOrdinati = [...lavori].sort(
    (a, b) => (a.ordine ?? 0) - (b.ordine ?? 0)
  );

  type TipoRiga = "info" | "dato" | "dato-continua" | "totale";
  type Cella = string | { content: string; colSpan?: number; rowSpan?: number };

  // Passo 1: costruisco le righe "di dato" (senza colonna sezione), con
  // la sezione "effettiva" a cui appartengono. Le pause H2O non aprono un
  // nuovo blocco sezione: restano visivamente dentro il blocco precedente.
  const righe: {
    celle: Cella[];
    tipo: TipoRiga;
    sezioneEffettiva: string;
    h2o?: boolean;
  }[] = [];

  let ultimaSezioneReale: string | null = null;
  let totaleMinuti = 0;

  const run = raggruppaInRun(lavoriOrdinati);

  run.forEach((membri) => {
    const capofila = membri[0];
    // .trim() evita che un valore "vuoto" ma non falsy (es. uno spazio
    // digitato per errore) faccia sparire l'etichetta della sezione: senza
    // il trim, doc.text() disegnerebbe uno spazio invisibile invece del
    // fallback "Senza sezione".
    const sezione = capofila.sezione?.trim() || "Senza sezione";
    const h2o = isSezioneH2O(sezione);

    const sezioneEffettiva = h2o ? ultimaSezioneReale ?? sezione : sezione;
    if (!h2o) ultimaSezioneReale = sezione;

    totaleMinuti += capofila.tempo_totale ?? 0;

    if (membri.length === 1) {
      righe.push({
        sezioneEffettiva,
        tipo: "dato",
        h2o,
        celle: [
          h2o ? "h2o" : capofila.descrizione || "",
          h2o ? "" : capofila.obbiettivo || "",
          h2o ? "" : capofila.tempo_lavoro !== null ? String(capofila.tempo_lavoro) : "",
          h2o ? "" : capofila.ripetizione !== null ? String(capofila.ripetizione) : "",
          h2o
            ? ""
            : capofila.tempo_recupero !== null
              ? String(capofila.tempo_recupero)
              : "",
          capofila.tempo_totale !== null ? String(capofila.tempo_totale) : "",
        ],
      });
      return;
    }

    // Lavori in contemporanea: le celle dei tempi vengono unite verticalmente
    // sulla prima riga del gruppo; le righe successive mostrano solo la
    // loro descrizione/obbiettivo.
    righe.push({
      sezioneEffettiva,
      tipo: "dato",
      celle: [
        capofila.descrizione || "",
        capofila.obbiettivo || "",
        {
          content: capofila.tempo_lavoro !== null ? String(capofila.tempo_lavoro) : "",
          rowSpan: membri.length,
        },
        {
          content: capofila.ripetizione !== null ? String(capofila.ripetizione) : "",
          rowSpan: membri.length,
        },
        {
          content:
            capofila.tempo_recupero !== null ? String(capofila.tempo_recupero) : "",
          rowSpan: membri.length,
        },
        {
          content: capofila.tempo_totale !== null ? String(capofila.tempo_totale) : "",
          rowSpan: membri.length,
        },
      ],
    });

    membri.slice(1).forEach((membro) => {
      righe.push({
        sezioneEffettiva,
        tipo: "dato-continua",
        celle: [membro.descrizione || "", membro.obbiettivo || ""],
      });
    });
  });

  // Passo 2: assemblo il corpo finale aggiungendo, per ogni blocco di
  // righe consecutive con la stessa sezione effettiva, una cella colonna-0
  // con rowSpan pari alla lunghezza del blocco (contenuto vuoto: il testo
  // viene disegnato a mano, ruotato, in didDrawCell).
  const tipiRiga: TipoRiga[] = [];
  const corpo: Cella[][] = [];
  const sezioneEtichetta: (string | null)[] = [];
  const h2oRiga: boolean[] = [];

  corpo.push([{ content: "ora inizio", colSpan: 2 }, formatOra(allenamento.ora_inizio), "", "", "", ""]);
  tipiRiga.push("info");
  sezioneEtichetta.push(null);
  h2oRiga.push(false);

  let indice = 0;
  while (indice < righe.length) {
    let fine = indice;
    while (
      fine + 1 < righe.length &&
      righe[fine + 1].sezioneEffettiva === righe[indice].sezioneEffettiva
    ) {
      fine += 1;
    }

    const lunghezzaBlocco = fine - indice + 1;

    for (let i = indice; i <= fine; i += 1) {
      const riga = righe[i];

      if (i === indice) {
        corpo.push([{ content: "", rowSpan: lunghezzaBlocco }, ...riga.celle]);
        sezioneEtichetta.push(riga.sezioneEffettiva);
      } else {
        corpo.push(riga.celle);
        sezioneEtichetta.push(null);
      }

      tipiRiga.push(riga.tipo);
      h2oRiga.push(Boolean(riga.h2o));
    }

    indice = fine + 1;
  }

  corpo.push([
    { content: "ora fine lavori", colSpan: 2 },
    formatOra(allenamento.ora_fine),
    "",
    "",
    "totale tempo min",
    String(totaleMinuti),
  ]);
  tipiRiga.push("totale");
  sezioneEtichetta.push(null);
  h2oRiga.push(false);

  autoTable(doc, {
    startY: 25,
    head: [colonne],
    // jspdf-autotable accetta stringhe oppure oggetti { content, colSpan, rowSpan }.
    body: corpo as never,
    theme: "grid",
    styles: {
      fontSize: 9,
      cellPadding: 2.2,
      lineColor: [0, 0, 0],
      lineWidth: 0.2,
      textColor: [0, 0, 0],
      halign: "center",
    },
    columnStyles: {
      0: { cellWidth: 7 },
      1: { halign: "left" },
      2: { halign: "left" },
    },
    headStyles: {
      fillColor: COLORE_HEADER,
      textColor: [255, 255, 255],
      fontStyle: "bold",
      halign: "center",
    },
    didParseCell: (data) => {
      if (data.section !== "body") return;

      const tipo = tipiRiga[data.row.index];

      if (data.column.index === 0) {
        data.cell.styles.fillColor = COLORE_GRIGIO_SEZIONE;
      }

      if (tipo === "info" || tipo === "totale") {
        data.cell.styles.fontStyle = "bold";
      }

      // La riga di pausa h2o viene evidenziata per intero (come nel modello
      // cartaceo), non solo sulla colonna Tempo Totale.
      if (h2oRiga[data.row.index] && data.column.index !== 0) {
        data.cell.styles.fillColor = COLORE_AZZURRO_TOTALE;
        data.cell.styles.fontStyle = "bold";
      } else if (
        data.column.index === 6 &&
        (tipo === "dato" || tipo === "totale")
      ) {
        data.cell.styles.fillColor = COLORE_AZZURRO_TOTALE;
      }
    },
    didDrawCell: (data) => {
      if (data.section !== "body" || data.column.index !== 0) return;

      const testo = sezioneEtichetta[data.row.index];
      if (!testo) return;

      const { x, y, width, height } = data.cell;

      doc.setFont("helvetica", "bold");
      doc.setFontSize(7.5);
      doc.setTextColor(0, 0, 0);
      doc.text(testo, x + width / 2, y + height / 2, {
        angle: 90,
        align: "center",
        baseline: "middle",
      });
    },
  });

  const nomeFile = `allenamento-${allenamento.data_allenamento}.pdf`;
  doc.save(nomeFile);
}
