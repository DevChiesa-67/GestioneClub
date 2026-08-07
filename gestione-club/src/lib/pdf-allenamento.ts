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
  /*
   * URL libero (immagine, video o link YouTube/Vimeo) inserito nella
   * scheda del lavoro: nel PDF le immagini vengono incorporate come
   * miniatura, i video come link cliccabile (jsPDF non può riprodurre
   * video, solo un lettore esterno può farlo).
   */
  immagine_lavoro?: string | null;
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

// Dimensioni (mm) usate per riservare/disegnare lo spazio della miniatura
// immagine o del link video sotto la Descrizione di un lavoro: tenute in
// un unico punto perché devono coincidere fra il calcolo dell'altezza
// riga (didParseCell) e il disegno effettivo (didDrawCell).
const ALTEZZA_RIGA_TESTO_MM = 9 * 0.3528 * 1.15; // fontSize 9pt -> mm, con line-height ~1.15
const PADDING_CELLA_MM = 2.2; // deve combaciare con styles.cellPadding
const ALTEZZA_MEDIA_MM = 20;
const ALTEZZA_LINK_MM = 5;

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

const ESTENSIONI_VIDEO = [
  ".mp4",
  ".mov",
  ".webm",
  ".m4v",
  ".avi",
  ".mkv",
  ".ogg",
];
const DOMINI_VIDEO = ["youtube.com", "youtu.be", "vimeo.com"];

function isVideoUrl(url: string): boolean {
  const pulito = url.trim().toLowerCase();

  if (DOMINI_VIDEO.some((dominio) => pulito.includes(dominio))) return true;

  const senzaQuery = pulito.split("?")[0].split("#")[0];

  return ESTENSIONI_VIDEO.some((ext) => senzaQuery.endsWith(ext));
}

type ImmagineCaricata = {
  dataUrl: string;
  larghezza: number;
  altezza: number;
};

/**
 * Versione generica di caricaLogo(): scarica un URL qualsiasi e, se è
 * un'immagine valida, la ridisegna su un <canvas> per convertirla
 * sempre in PNG. Passando dal canvas (anziché da addImage con il
 * formato originale) copriamo anche formati che jsPDF non gestisce
 * direttamente come WEBP, e il canvas non risulta "tainted" perché
 * partiamo da una data URL locale, non dall'URL remoto.
 */
async function caricaImmagineComeDataUrl(
  url: string
): Promise<ImmagineCaricata | null> {
  try {
    const risposta = await fetch(url);
    if (!risposta.ok) return null;

    const blob = await risposta.blob();
    if (!blob.type.startsWith("image/")) return null;

    const dataUrlOriginale = await new Promise<string>((resolve, reject) => {
      const reader = new FileReader();
      reader.onloadend = () => resolve(reader.result as string);
      reader.onerror = () =>
        reject(new Error("Impossibile leggere l'immagine del lavoro"));
      reader.readAsDataURL(blob);
    });

    const img = await new Promise<HTMLImageElement>((resolve, reject) => {
      const immagine = new Image();
      immagine.onload = () => resolve(immagine);
      immagine.onerror = () =>
        reject(new Error("Impossibile decodificare l'immagine del lavoro"));
      immagine.src = dataUrlOriginale;
    });

    const canvas = document.createElement("canvas");
    canvas.width = img.naturalWidth;
    canvas.height = img.naturalHeight;

    const ctx = canvas.getContext("2d");
    if (!ctx) return null;

    ctx.drawImage(img, 0, 0);

    return {
      dataUrl: canvas.toDataURL("image/png"),
      larghezza: img.naturalWidth,
      altezza: img.naturalHeight,
    };
  } catch {
    return null;
  }
}

type MediaLavoro =
  | { tipo: "immagine"; dataUrl: string; larghezza: number; altezza: number }
  | { tipo: "video"; url: string };

/**
 * Prepara in anticipo, per ogni lavoro, cosa disegnare nel PDF:
 * un'immagine (già scaricata e pronta per addImage) oppure un link
 * cliccabile per i contenuti video. Va fatto PRIMA di autoTable perché
 * il download è asincrono, mentre i callback di autoTable sono sincroni.
 */
async function preparaMediaLavori(
  lavori: LavoroPdf[]
): Promise<Map<LavoroPdf, MediaLavoro>> {
  const mappa = new Map<LavoroPdf, MediaLavoro>();

  await Promise.all(
    lavori.map(async (lavoro) => {
      const url = lavoro.immagine_lavoro?.trim();
      if (!url) return;

      if (isVideoUrl(url)) {
        mappa.set(lavoro, { tipo: "video", url });
        return;
      }

      const immagine = await caricaImmagineComeDataUrl(url);

      if (immagine) {
        mappa.set(lavoro, { tipo: "immagine", ...immagine });
      } else {
        // Non è un'immagine valida (o non è raggiungibile): proviamo
        // comunque a offrirlo come link, meglio di non mostrare nulla.
        mappa.set(lavoro, { tipo: "video", url });
      }
    })
  );

  return mappa;
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

export type PdfAllenamentoGenerato = {
  doc: jsPDF;
  nomeFile: string;
};

/**
 * Costruisce il PDF dell'allenamento nel formato "foglio di lavoro" classico
 * usato dallo staff tecnico: barra titolo rosso scuro con box logo a destra,
 * header verde scuro, righe di sezione grigie, riga di pausa h2o e colonna
 * Tempo Totale evidenziate in azzurro, celle unite per i lavori svolti in
 * contemporanea da più gruppi.
 *
 * Ritorna il documento jsPDF pronto (senza scaricarlo): il chiamante decide
 * se mostrarlo prima in anteprima (vedi PdfPreviewModal) e/o scaricarlo con
 * scaricaPdfAllenamento().
 */
export async function generaPdfAllenamento(
  allenamento: AllenamentoPdf,
  lavori: LavoroPdf[],
  club?: ClubPdf | null
): Promise<PdfAllenamentoGenerato> {
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

  const orarioSeduta =
    allenamento.ora_inizio || allenamento.ora_fine
      ? ` · ${formatOra(allenamento.ora_inizio)}${
          allenamento.ora_fine ? `–${formatOra(allenamento.ora_fine)}` : ""
        }`
      : "";

  doc.setFont("helvetica", "bold");
  doc.setFontSize(12);
  doc.setTextColor(255, 255, 255);
  doc.text(
    `ALLENAMENTO ${formatDataIT(allenamento.data_allenamento)}${orarioSeduta}`,
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

  const mediaPerLavoro = await preparaMediaLavori(lavoriOrdinati);

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
    media?: MediaLavoro | null;
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
        media: h2o ? null : mediaPerLavoro.get(capofila) ?? null,
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
      media: mediaPerLavoro.get(capofila) ?? null,
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
        media: mediaPerLavoro.get(membro) ?? null,
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
  const mediaRiga: (MediaLavoro | null)[] = [];

  corpo.push([{ content: "ora inizio", colSpan: 2 }, formatOra(allenamento.ora_inizio), "", "", "", ""]);
  tipiRiga.push("info");
  sezioneEtichetta.push(null);
  h2oRiga.push(false);
  mediaRiga.push(null);

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
      mediaRiga.push(riga.media ?? null);
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
  mediaRiga.push(null);

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
      // valign "top" sulla colonna Descrizione: quando c'è un'immagine o
      // un link video da disegnare sotto il testo (didDrawCell), serve
      // che il testo parta sempre dall'alto della cella, altrimenti con
      // l'allineamento verticale centrato di default la posizione in cui
      // disegnare la miniatura diventerebbe imprevedibile.
      1: { halign: "left", valign: "top" },
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

      // Riserva spazio sotto il testo della Descrizione per la miniatura
      // dell'immagine (o per il link del video) allegata al lavoro:
      // altrimenti autoTable dimensiona la riga solo in base al testo e
      // in didDrawCell l'immagine finirebbe per traboccare nella riga
      // successiva.
      if (data.column.index === 1) {
        const media = mediaRiga[data.row.index];
        if (media) {
          const numRighe = Array.isArray(data.cell.text)
            ? data.cell.text.length
            : 1;
          const altezzaTesto = numRighe * ALTEZZA_RIGA_TESTO_MM + PADDING_CELLA_MM;
          const altezzaExtra =
            media.tipo === "immagine" ? ALTEZZA_MEDIA_MM : ALTEZZA_LINK_MM;

          data.cell.styles.minCellHeight = Math.max(
            data.cell.styles.minCellHeight ?? 0,
            altezzaTesto + altezzaExtra + PADDING_CELLA_MM
          );
        }
      }
    },
    didDrawCell: (data) => {
      if (data.section !== "body") return;

      if (data.column.index === 0) {
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

        return;
      }

      if (data.column.index === 1) {
        const media = mediaRiga[data.row.index];
        if (!media) return;

        const { x, y, width } = data.cell;
        const numRighe = Array.isArray(data.cell.text)
          ? data.cell.text.length
          : 1;
        const yMedia =
          y + numRighe * ALTEZZA_RIGA_TESTO_MM + PADDING_CELLA_MM;

        if (media.tipo === "immagine") {
          const larghezzaDisponibile = width - PADDING_CELLA_MM * 2;
          const rapporto = media.larghezza / media.altezza || 1;

          let altezzaImg = ALTEZZA_MEDIA_MM;
          let larghezzaImg = altezzaImg * rapporto;

          if (larghezzaImg > larghezzaDisponibile) {
            larghezzaImg = larghezzaDisponibile;
            altezzaImg = larghezzaImg / rapporto;
          }

          try {
            doc.addImage(
              media.dataUrl,
              "PNG",
              x + PADDING_CELLA_MM,
              yMedia,
              larghezzaImg,
              altezzaImg
            );
          } catch {
            // Se addImage fallisce (es. immagine corrotta) non blocchiamo
            // la generazione del resto del PDF.
          }

          return;
        }

        doc.setFont("helvetica", "italic");
        doc.setFontSize(7.5);
        doc.setTextColor(30, 64, 175);
        doc.textWithLink("Video: apri link", x + PADDING_CELLA_MM, yMedia + 2, {
          url: media.url,
        });
      }
    },
  });

  const nomeFile = `allenamento-${allenamento.data_allenamento}.pdf`;
  return { doc, nomeFile };
}

/** Scarica un documento già generato da generaPdfAllenamento(). */
export function scaricaPdfAllenamento({ doc, nomeFile }: PdfAllenamentoGenerato) {
  doc.save(nomeFile);
}
