"use client";

import { useMemo, useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { ChevronDown, Download, Loader2, UserRound, Upload } from "lucide-react";

import ReportPerformanceClient, {
  STATI,
  fetchPresenzeRows,
  calcolaStatistichePresenze,
  type StatoPresenzaDb,
} from "@/components/charts/ReportPerformanceClient";
import ReportAcwrClient from "@/components/charts/ReportAcwrClient";
import { AppCard } from "@/components/ui/AppCard";
import { DateInput } from "@/components/ui/DateInput";
import { formatDataIT } from "@/lib/date";
import ReportPerformanceSessioniClient, {
  COLONNE_PDF,
  fetchPerformanceRows,
  formatDate as formatDataPerformance,
  formatNumber as formatNumeroPerformance,
  type PerformanceRow,
} from "@/components/charts/ReportPerformanceSessioniClient";
import PerformanceDashboardChartsClient from "@/components/charts/PerformanceDashboardChartsClient";
import ReportTestClient from "@/components/charts/ReportTestClient";
import ConfrontoPerformanceClient from "@/components/charts/ConfrontoPerformanceClient";
import MinutaggioPartiteClient from "@/components/charts/MinutaggioPartiteClient";
import {
  generaPdfPerformance,
  generaPdfPresenze,
  scaricaPdfPerformance,
  type AndamentoSessionePdf,
  type PdfPerformanceGenerato,
} from "@/lib/pdf-performance";
import PdfPreviewModal from "@/components/allenamenti/PdfPreviewModal";
import {
  TAG_ALLENAMENTO,
  TAG_PARTITA,
  type TipoSedutaSingolo,
} from "@/lib/performance/catapult-filtri";
type TabKey =
  | "riepilogo"
  | "presenze"
  | "performance"
  | "acwr"
  | "test"
  | "confronto"
  | "minutaggio_partite";

// I valori reali di split_name per le partite dipendono da come Catapult
// esporta il CSV (varia da dispositivo/versione: "1st Half", "H1", "1",
// ecc.): invece di assumere una stringa fissa, mostriamo sempre i valori
// effettivamente presenti nei dati (vedi splitOpzioniPartita) e proviamo
// solo a etichettarli in modo leggibile quando riconosciamo un pattern
// comune. Se non riconosciamo nulla, mostriamo il valore così com'è,
// così il filtro funziona comunque.
// STATI.color è una stringa hex ("#16a34a") pensata per il CSS a schermo:
// il PDF (jsPDF) vuole invece una tripla RGB, quindi la convertiamo qui
// per riusare esattamente gli stessi colori dell'istogramma.
function hexToRgb(hex: string): [number, number, number] {
  const normalizzato = hex.replace("#", "");
  const valore = parseInt(normalizzato, 16);

  return [(valore >> 16) & 255, (valore >> 8) & 255, valore & 255];
}

function etichettaSplitPartita(nome: string): string {
  const normalizzato = nome.trim().toLowerCase();

  if (/^1(st)?\b|primo|first|h1\b/.test(normalizzato)) {
    return "Primo Tempo";
  }

  if (/^2(nd)?\b|secondo|second|h2\b/.test(normalizzato)) {
    return "Secondo Tempo";
  }

  return nome;
}

function corrispondeATag(tagsValue: string | null, tag: string) {
  return !!tagsValue && tagsValue.trim().toLowerCase() === tag.toLowerCase();
}

type Giocatore = {
  id: string;
  nome: string | null;
  cognome: string | null;
  foto_url: string | null;
};

/*
 * Le sessioni mostrabili nel filtro "Nome evento" vengono lette
 * direttamente da Catapult (session_title/date/tags su catapult_data),
 * non dal calendario interno allenamenti/partite: quest'ultimo può
 * non corrispondere 1:1 alle sedute effettivamente registrate dal
 * dispositivo GPS.
 */
type SessioneCatapult = {
  titolo: string;
  data: string | null;
  tags: string | null;
};

// Split di allenamento e "tempi" di partita condividono la stessa colonna
// split_name, ma vanno proposti separatamente in base al tag della riga
// (Training/Game), altrimenti si mescolano nella stessa lista.
type SplitOption = {
  nome: string;
  tags: string | null;
};

type Props = {
  clubId: string;
  squadraId: string | null;
  coloreFlag: string;
  clubLogoUrl?: string | null;
  giocatori: Giocatore[];
  splitOptions: SplitOption[];
  sessioni: SessioneCatapult[];
  giocatoreId?: string | null;
  tipoProfilo?: string | null;
};

function chiaveSessione(sessione: SessioneCatapult) {
  return `${sessione.titolo}__${sessione.data ?? ""}`;
}

// Stesse statistiche aggregate mostrate nella card "Riepilogo statistiche"
// / "Ultima sessione" della tab Riepilogo (ReportPerformanceSessioniClient
// in mode="summary"), calcolate qui per poterle riportare anche nel PDF.
function calcolaRiepilogoPerformance(rows: PerformanceRow[]) {
  const numeroSessioni = rows.length;

  const distanzaTotale = rows.reduce(
    (sum, row) => sum + (row.distance ?? 0),
    0
  );

  const distanzaMedia = numeroSessioni > 0 ? distanzaTotale / numeroSessioni : 0;

  const topSpeedMassimo = Math.max(0, ...rows.map((row) => row.top_speed ?? 0));

  const playerLoadTotale = rows.reduce(
    (sum, row) => sum + (row.player_load ?? 0),
    0
  );

  const playerLoadMedio =
    numeroSessioni > 0 ? playerLoadTotale / numeroSessioni : 0;

  const ultimaSessione =
    rows.length > 0
      ? [...rows]
          .filter((row) => row.date)
          .sort((a, b) => (b.date ?? "").localeCompare(a.date ?? ""))[0] ?? null
      : null;

  return {
    numeroSessioni,
    distanzaMedia,
    topSpeedMassimo,
    playerLoadMedio,
    playerLoadTotale,
    ultimaSessione,
  };
}

// Le righe di catapult_data possono includere più split per la stessa
// sessione (es. primo/secondo tempo, o più giocatori): per il grafico
// "andamento per sessione" del PDF le aggreghiamo per data+titolo,
// sommando distanza e player load, e le ordiniamo cronologicamente.
function calcolaAndamentoSessioni(
  rows: PerformanceRow[]
): AndamentoSessionePdf[] {
  const gruppi = new Map<
    string,
    {
      data: string | null;
      titolo: string | null;
      distanza: number;
      playerLoad: number;
    }
  >();

  rows.forEach((row) => {
    const chiave = `${row.date ?? ""}__${row.session_title ?? ""}`;
    const esistente = gruppi.get(chiave);

    if (esistente) {
      esistente.distanza += row.distance ?? 0;
      esistente.playerLoad += row.player_load ?? 0;
    } else {
      gruppi.set(chiave, {
        data: row.date,
        titolo: row.session_title,
        distanza: row.distance ?? 0,
        playerLoad: row.player_load ?? 0,
      });
    }
  });

  return Array.from(gruppi.values())
    .sort((a, b) => (a.data ?? "").localeCompare(b.data ?? ""))
    .map((gruppo) => ({
      etichetta: gruppo.data
        ? formatDataPerformance(gruppo.data).slice(0, 5)
        : gruppo.titolo ?? "—",
      distanza: gruppo.distanza,
      playerLoad: gruppo.playerLoad,
    }));
}

const TABS: { key: TabKey; label: string }[] = [
  { key: "riepilogo", label: "Riepilogo" },
  { key: "presenze", label: "Presenze" },
  { key: "performance", label: "Performance" },
  { key: "acwr", label: "ACWR" },
  { key: "test", label: "Test" },
  { key: "confronto", label: "Confronto" },
  { key: "minutaggio_partite", label: "Minutaggio Partite" },
];

export default function ReportTabsClient({
  clubId,
  squadraId,
  coloreFlag,
  clubLogoUrl = null,
  giocatori,
  splitOptions,
  sessioni,
  giocatoreId: giocatoreIdIniziale = null,
  tipoProfilo = null,
}: Props) {
  const [activeTab, setActiveTab] = useState<TabKey>("riepilogo");

  const [dataDa, setDataDa] = useState("");
  const [dataA, setDataA] = useState("");

  const [tipiSeduta, setTipiSeduta] =
    useState<TipoSedutaSingolo[]>([]);

  const [giocatoreIds, setGiocatoreIds] = useState<string[]>(
    giocatoreIdIniziale ? [giocatoreIdIniziale] : []
  );

  const [titoliSelezionati, setTitoliSelezionati] = useState<string[]>([]);

  const [openGiocatori, setOpenGiocatori] = useState(false);
  const [openEventi, setOpenEventi] = useState(false);
  const [openSplit, setOpenSplit] = useState(false);

  /*
   * Su mobile i sei filtri impilati occupano piu' di mezzo schermo prima
   * che si arrivi ai dati: restano chiusi di default e si aprono dal
   * pulsante nella testata della card. Da "sm" in su sono sempre visibili
   * (classe "sm:block"), quindi su desktop non cambia nulla.
   */
  const [filtriAperti, setFiltriAperti] = useState(false);

  const [splitSelezionati, setSplitSelezionati] = useState<string[]>(
    []
  );

  // Card di stato selezionata nella tab Presenze (filtro sull'istogramma):
  // vive qui, non dentro ReportPerformanceClient, così anche l'export PDF
  // (gestito in questo componente) sa quale card è attiva.
  const [statoPresenzeSelezionato, setStatoPresenzeSelezionato] =
    useState<StatoPresenzaDb | null>(null);

  const [generandoPdf, setGenerandoPdf] = useState(false);
  const [pdfInAnteprima, setPdfInAnteprima] = useState<
    (PdfPerformanceGenerato & { blobUrl: string }) | null
  >(null);

  function toggleGiocatore(id: string) {
    setGiocatoreIds((prev) =>
      prev.includes(id)
        ? prev.filter((item) => item !== id)
        : [...prev, id]
    );
  }

  function toggleSessione(chiave: string) {
    setTitoliSelezionati((prev) =>
      prev.includes(chiave)
        ? prev.filter((item) => item !== chiave)
        : [...prev, chiave]
    );
  }

  function toggleSplit(split: string) {
    setSplitSelezionati((prev) =>
      prev.includes(split)
        ? prev.filter((item) => item !== split)
        : [...prev, split]
    );
  }

  function toggleTipoSeduta(tipo: TipoSedutaSingolo) {
    setTipiSeduta((prev) =>
      prev.includes(tipo)
        ? prev.filter((item) => item !== tipo)
        : [...prev, tipo]
    );
    setSplitSelezionati([]);
    setTitoliSelezionati([]);
  }

  const giocatoriSelezionati = useMemo(() => {
    return giocatori.filter((item) =>
      giocatoreIds.includes(item.id)
    );
  }, [giocatori, giocatoreIds]);

  const tagCorrispondenti = useMemo(() => {
    return tipiSeduta.map((tipo) =>
      tipo === "allenamento" ? TAG_ALLENAMENTO : TAG_PARTITA
    );
  }, [tipiSeduta]);

  // Split disponibili per gli allenamenti: solo i valori di split_name
  // presenti su righe con tag "Training", mai mescolati con quelli delle
  // partite.
  const splitOpzioniAllenamento = useMemo(() => {
    return Array.from(
      new Set(
        splitOptions
          .filter((opzione) => corrispondeATag(opzione.tags, TAG_ALLENAMENTO))
          .map((opzione) => opzione.nome)
      )
    ).sort();
  }, [splitOptions]);

  // "Tempi" disponibili per le partite: solo i valori di split_name
  // presenti su righe con tag "Game", con un'etichetta leggibile quando
  // possibile (altrimenti il valore grezzo, per non nascondere dati reali
  // dietro etichette hardcoded che potrebbero non corrispondere).
  const splitOpzioniPartita = useMemo(() => {
    const nomi = Array.from(
      new Set(
        splitOptions
          .filter((opzione) => corrispondeATag(opzione.tags, TAG_PARTITA))
          .map((opzione) => opzione.nome)
      )
    ).sort();

    return nomi.map((nome) => ({
      value: nome,
      label: etichettaSplitPartita(nome),
    }));
  }, [splitOptions]);

  const sessioniFiltrate = useMemo(() => {
    if (tagCorrispondenti.length === 0) {
      return sessioni;
    }

    return sessioni.filter(
      (sessione) =>
        sessione.tags &&
        tagCorrispondenti.some(
          (tag) =>
            sessione.tags!.trim().toLowerCase() === tag.toLowerCase()
        )
    );
  }, [sessioni, tagCorrispondenti]);

  function nomeCompleto(giocatore: Giocatore) {
    return (
      `${giocatore.nome ?? ""} ${giocatore.cognome ?? ""}`.trim() ||
      "Senza nome"
    );
  }

  const sessioniSelezionate = useMemo(() => {
    return sessioni.filter((sessione) =>
      titoliSelezionati.includes(chiaveSessione(sessione))
    );
  }, [sessioni, titoliSelezionati]);

  // Filtro esatto per i componenti che leggono catapult_data
  // direttamente (session_title).
  const sessionTitlesFiltro = useMemo(() => {
    return Array.from(
      new Set(sessioniSelezionate.map((sessione) => sessione.titolo))
    );
  }, [sessioniSelezionate]);

  // presenze_allenamenti non ha session_title: come approssimazione
  // per quella tabella filtriamo per le date delle sessioni Catapult
  // selezionate.
  const sessioniSelezionateDate = useMemo(() => {
    return Array.from(
      new Set(
        sessioniSelezionate
          .map((sessione) => sessione.data)
          .filter((value): value is string => Boolean(value))
      )
    );
  }, [sessioniSelezionate]);

  // Riepilogo testuale dei filtri attivi, usato come sottotitolo nel PDF
  // scaricato dalla tabella Performance, così il file resta comprensibile
  // anche fuori dal contesto dell'app.
  const filtroDescrizionePerformance = useMemo(() => {
    const parti: string[] = [];

    if (giocatoriSelezionati.length > 0) {
      parti.push(
        `Giocatori: ${giocatoriSelezionati.map((g) => nomeCompleto(g)).join(", ")}`
      );
    }

    if (dataDa || dataA) {
      parti.push(
        `Periodo: ${dataDa ? formatDataIT(dataDa) : "..."} - ${
          dataA ? formatDataIT(dataA) : "..."
        }`
      );
    }

    if (tipiSeduta.length === 1) {
      parti.push(
        `Tipo seduta: ${tipiSeduta[0] === "allenamento" ? "Allenamento" : "Partita"}`
      );
    }

    if (sessioniSelezionate.length > 0) {
      parti.push(
        `Eventi: ${sessioniSelezionate.map((s) => s.titolo).join(", ")}`
      );
    }

    if (splitSelezionati.length > 0) {
      parti.push(`Split: ${splitSelezionati.join(", ")}`);
    }

    return parti.length > 0 ? parti.join("  |  ") : "Nessun filtro applicato";
  }, [
    giocatoriSelezionati,
    dataDa,
    dataA,
    tipiSeduta,
    sessioniSelezionate,
    splitSelezionati,
  ]);

  const soloPartita =
    tipiSeduta.length === 1 && tipiSeduta[0] === "partita";

  const soloAllenamento =
    tipiSeduta.length === 1 && tipiSeduta[0] === "allenamento";

  const labelEvento = soloPartita
    ? "Nome partita"
    : soloAllenamento
      ? "Nome allenamento"
      : "Nome evento";

  function chiudiAnteprimaPdf() {
    if (pdfInAnteprima) URL.revokeObjectURL(pdfInAnteprima.blobUrl);
    setPdfInAnteprima(null);
  }

  // Tab "Presenze": il PDF mostra l'andamento delle presenze in base ai
  // filtri applicati (non la scheda Catapult, che qui non ha senso).
  async function generaAnteprimaPdfPresenze() {
    const presenzeRows = await fetchPresenzeRows({
      clubId,
      squadraId,
      dataDa,
      dataA,
      tipiSeduta,
      giocatoreIds,
      eventoDate: sessioniSelezionateDate,
    });

    const statistiche = calcolaStatistichePresenze(presenzeRows);

    const righeRiepilogo = [
      {
        label: "Rilevazioni registrate",
        value: String(statistiche.totaleRilevazioni),
      },
      {
        label: "Presenze totali",
        value: String(statistiche.totalePresenze),
      },
      {
        label: "% di presenza",
        value: `${statistiche.percentualePresenza}%`,
      },
    ];

    // Se è selezionata una card (es. "Infortunato"), il PDF resta coerente
    // con quello che si vede a schermo: istogramma isolato su quello stato
    // solo, distribuzione limitata alla stessa riga, titolo e sottotitolo
    // aggiornati.
    const statoInfo = statoPresenzeSelezionato
      ? STATI.find((stato) => stato.key === statoPresenzeSelezionato)
      : null;

    const statiDaMostrare = statoInfo ? [statoInfo] : STATI;

    const andamento = statistiche.datiGrafico.map((voce) => ({
      etichetta: formatDataIT(voce.data).slice(0, 5),
      segmenti: statiDaMostrare
        .map((stato) => ({
          colore: hexToRgb(stato.color),
          valore: voce.perStato[stato.key] ?? 0,
        }))
        .filter((segmento) => segmento.valore > 0),
    }));

    const legenda = statiDaMostrare.map((stato) => ({
      label: stato.title,
      colore: hexToRgb(stato.color),
    }));

    const distribuzioneFiltrata = statoInfo
      ? statistiche.distribuzione.filter(
          (voce) => voce.stato === statoInfo.key
        )
      : statistiche.distribuzione;

    const distribuzione = distribuzioneFiltrata.map((voce) => {
      const label =
        STATI.find((stato) => stato.key === voce.stato)?.title ?? voce.stato;

      const percentuale =
        statistiche.totaleRilevazioni > 0
          ? Math.round((voce.totale / statistiche.totaleRilevazioni) * 100)
          : 0;

      return { label, totale: voce.totale, percentuale };
    });

    const titolo = statoInfo
      ? `ANDAMENTO PRESENZE — ${statoInfo.title.toUpperCase()}`
      : "ANDAMENTO PRESENZE";

    const sottotitolo = statoInfo
      ? `${filtroDescrizionePerformance}  |  Stato: ${statoInfo.title}`
      : filtroDescrizionePerformance;

    return generaPdfPresenze(
      titolo,
      sottotitolo,
      righeRiepilogo,
      andamento,
      distribuzione,
      legenda,
      { logo_url: clubLogoUrl },
      `presenze-${new Date().toISOString().slice(0, 10)}.pdf`
    );
  }

  async function generaAnteprimaPdfPerformance() {
    const performanceRows = await fetchPerformanceRows({
        clubId,
        squadraId,
        giocatoreIds,
        dataDa,
        dataA,
        tipiSeduta,
        sessionTitles: sessionTitlesFiltro,
        splitSelezionati,
      });

      const colonnePdf = COLONNE_PDF.map((column) => ({
        label: column.label,
        align: column.align ?? ("left" as const),
      }));

      const righePdf = performanceRows.map((row) =>
        COLONNE_PDF.map((column) => {
          const value = row[column.key];

          if (column.type === "date") {
            return formatDataPerformance(value as string | null);
          }

          if (column.type === "number") {
            return formatNumeroPerformance(
              value as number | null,
              column.decimals ?? 0
            );
          }

          return value ? String(value) : "—";
        })
      );

      const riepilogo = calcolaRiepilogoPerformance(performanceRows);

      const righeRiepilogo = [
        {
          label: "Numero sessioni registrate",
          value: String(riepilogo.numeroSessioni),
        },
        {
          label: "Distanza media (m)",
          value: formatNumeroPerformance(riepilogo.distanzaMedia, 0),
        },
        {
          label: "Top Speed massimo (m/s)",
          value: formatNumeroPerformance(riepilogo.topSpeedMassimo, 2),
        },
        {
          label: "Player Load medio",
          value: formatNumeroPerformance(riepilogo.playerLoadMedio, 0),
        },
        {
          label: "Player Load totale",
          value: formatNumeroPerformance(riepilogo.playerLoadTotale, 0),
        },
      ];

      if (riepilogo.ultimaSessione) {
        righeRiepilogo.push(
          {
            label: "Ultima sessione — Data",
            value: formatDataPerformance(riepilogo.ultimaSessione.date),
          },
          {
            label: "Ultima sessione — Nome",
            value: riepilogo.ultimaSessione.session_title ?? "—",
          },
          {
            label: "Ultima sessione — Player Load",
            value: formatNumeroPerformance(
              riepilogo.ultimaSessione.player_load,
              0
            ),
          },
          {
            label: "Ultima sessione — Top Speed (m/s)",
            value: formatNumeroPerformance(
              riepilogo.ultimaSessione.top_speed,
              2
            ),
          }
        );
      }

    const andamentoSessioni = calcolaAndamentoSessioni(performanceRows);

    return generaPdfPerformance(
      "SCHEDA PERFORMANCE",
      filtroDescrizionePerformance,
      colonnePdf,
      righePdf,
      { logo_url: clubLogoUrl },
      `performance-${new Date().toISOString().slice(0, 10)}.pdf`,
      righeRiepilogo,
      andamentoSessioni
    );
  }

  async function handleDownloadPdf() {
    if (generandoPdf) return;

    setGenerandoPdf(true);

    try {
      const generato =
        activeTab === "presenze"
          ? await generaAnteprimaPdfPresenze()
          : await generaAnteprimaPdfPerformance();

      const blobUrl = URL.createObjectURL(generato.doc.output("blob"));

      setPdfInAnteprima({ ...generato, blobUrl });
    } finally {
      setGenerandoPdf(false);
    }
  }

  const numeroFiltriAttivi =
    (dataDa ? 1 : 0) +
    (dataA ? 1 : 0) +
    (tipiSeduta.length > 0 ? 1 : 0) +
    (giocatoreIds.length > 0 ? 1 : 0) +
    (titoliSelezionati.length > 0 ? 1 : 0) +
    (splitSelezionati.length > 0 ? 1 : 0);

  return (
    <div className="space-y-4 sm:space-y-6 sm:p-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <p className="text-sm text-zinc-400">Performance</p>
          <h1 className="text-xl font-semibold text-white sm:text-2xl">
            Report performance
          </h1>
        </div>

        <div className="grid grid-cols-2 gap-2 sm:flex sm:items-center sm:gap-3">
          <button
            type="button"
            onClick={handleDownloadPdf}
            disabled={generandoPdf}
            className="inline-flex w-full items-center justify-center gap-2 whitespace-nowrap rounded-xl border border-white/10 bg-white/5 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-white/10 disabled:cursor-not-allowed disabled:opacity-40 sm:w-auto sm:py-2"
          >
            {generandoPdf ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Download className="h-4 w-4" />
            )}
            Anteprima PDF
          </button>

          <Link
            href="/performance/importa-dati"
            className="inline-flex w-full items-center justify-center gap-2 whitespace-nowrap rounded-xl px-4 py-2.5 text-sm font-semibold text-white transition hover:opacity-90 sm:w-auto sm:py-2"
            style={{ backgroundColor: coloreFlag }}
          >
            <Upload className="h-4 w-4" />
            Importa dati
          </Link>
        </div>
      </div>

      <AppCard
        title="Filtri report"
        headerAction={
          <button
            type="button"
            onClick={() => setFiltriAperti((value) => !value)}
            aria-expanded={filtriAperti}
            className="flex items-center gap-2 rounded-xl border border-white/10 bg-white/5 px-3 py-1.5 text-xs font-bold text-zinc-300 transition hover:bg-white/10 hover:text-white sm:hidden"
          >
            {numeroFiltriAttivi > 0 && (
              <span
                className="flex h-5 min-w-5 items-center justify-center rounded-full px-1 text-[10px] font-black text-white"
                style={{ backgroundColor: coloreFlag }}
              >
                {numeroFiltriAttivi}
              </span>
            )}

            {filtriAperti ? "Nascondi" : "Filtri"}

            <ChevronDown
              size={14}
              className={`transition ${filtriAperti ? "rotate-180" : ""}`}
            />
          </button>
        }
      >
        <div className={filtriAperti ? "block" : "hidden sm:block"}>
        <div className="grid gap-3 sm:grid-cols-2 sm:gap-4 xl:grid-cols-[1.4fr_1fr_1fr_1fr_1.4fr_1fr]">
          {/* GIOCATORE (multiselezione) */}
          <div className="relative">
            <label className="mb-2 block text-xs font-bold uppercase tracking-wide text-zinc-500">
              Giocatore
            </label>

            <button
              type="button"
              onClick={() =>
                setOpenGiocatori((value) => !value)
              }
              className="flex h-12 sm:h-[52px] w-full items-center justify-between rounded-2xl border border-white/10 bg-zinc-950 px-4 text-left text-white shadow-inner outline-none transition hover:border-white/25 hover:bg-zinc-900"
            >
              <span className="flex min-w-0 items-center gap-3">
                {giocatoriSelezionati.length === 1 ? (
                  giocatoriSelezionati[0].foto_url ? (
                    <Image
                      src={giocatoriSelezionati[0].foto_url}
                      alt={nomeCompleto(giocatoriSelezionati[0])}
                      width={36}
                      height={36}
                      className="h-9 w-9 rounded-full object-cover ring-2 ring-white/10"
                    />
                  ) : (
                    <span className="flex h-9 w-9 items-center justify-center rounded-full bg-white/10 text-zinc-300 ring-2 ring-white/10">
                      <UserRound size={17} />
                    </span>
                  )
                ) : (
                  <span className="flex h-9 w-9 items-center justify-center rounded-full bg-white/10 text-zinc-300 ring-2 ring-white/10">
                    <UserRound size={17} />
                  </span>
                )}

                <span className="truncate text-sm font-bold">
                  {giocatoriSelezionati.length === 0
                    ? "Tutti i giocatori"
                    : giocatoriSelezionati.length === 1
                      ? nomeCompleto(giocatoriSelezionati[0])
                      : `${giocatoriSelezionati.length} giocatori selezionati`}
                </span>
              </span>

              <ChevronDown
                size={18}
                className="shrink-0 text-zinc-500"
              />
            </button>

            {openGiocatori && (
              <div className="absolute z-40 mt-2 max-h-80 w-full overflow-auto rounded-2xl border border-white/10 bg-zinc-950 p-2 shadow-2xl">
                <button
                  type="button"
                  onClick={() => setGiocatoreIds([])}
                  className="flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-left text-sm font-bold text-white transition hover:bg-white/5"
                >
                  <span className="flex h-9 w-9 items-center justify-center rounded-full bg-white/10">
                    <UserRound size={17} />
                  </span>

                  Tutti i giocatori

                  {giocatoreIds.length === 0 && (
                    <span className="ml-auto text-emerald-400">✓</span>
                  )}
                </button>

                {giocatori.map((giocatore) => {
                  const selezionato = giocatoreIds.includes(
                    giocatore.id
                  );

                  return (
                    <button
                      key={giocatore.id}
                      type="button"
                      onClick={() => toggleGiocatore(giocatore.id)}
                      className={`flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-left text-sm font-semibold transition hover:bg-white/5 hover:text-white ${
                        selezionato ? "text-white" : "text-zinc-300"
                      }`}
                    >
                      {giocatore.foto_url ? (
                        <Image
                          src={giocatore.foto_url}
                          alt={nomeCompleto(giocatore)}
                          width={36}
                          height={36}
                          className="h-9 w-9 rounded-full object-cover ring-2 ring-white/10"
                        />
                      ) : (
                        <span className="flex h-9 w-9 items-center justify-center rounded-full bg-white/10">
                          <UserRound size={17} />
                        </span>
                      )}

                      <span className="truncate">
                        {nomeCompleto(giocatore)}
                      </span>

                      {selezionato && (
                        <span className="ml-auto text-emerald-400">✓</span>
                      )}
                    </button>
                  );
                })}

                <div className="mt-1 border-t border-white/10 pt-2">
                  <button
                    type="button"
                    onClick={() => setOpenGiocatori(false)}
                    className="w-full rounded-xl px-3 py-2 text-center text-xs font-bold text-zinc-400 transition hover:bg-white/5 hover:text-white"
                  >
                    Chiudi
                  </button>
                </div>
              </div>
            )}
          </div>

          {/* DATA DA */}
          <div>
            <DateInput
              label="Data da"
              value={dataDa}
              onChange={setDataDa}
              wrapperClassName="h-12 sm:h-[52px] rounded-2xl border-white/10 bg-zinc-950 focus-within:border-white/30"
            />
          </div>

          {/* DATA A */}
          <div>
            <DateInput
              label="Data a"
              value={dataA}
              onChange={setDataA}
              wrapperClassName="h-12 sm:h-[52px] rounded-2xl border-white/10 bg-zinc-950 focus-within:border-white/30"
            />
          </div>

          {/* TIPO SEDUTA (multiselezione) */}
          <div>
            <label className="mb-2 block text-xs font-bold uppercase tracking-wide text-zinc-500">
              Tipo seduta
            </label>

            <div className="flex h-12 sm:h-[52px] items-center gap-2 rounded-2xl border border-white/10 bg-zinc-950 p-1.5">
              <button
                type="button"
                onClick={() => toggleTipoSeduta("allenamento")}
                className="flex h-full flex-1 items-center justify-center rounded-xl text-xs font-black transition"
                style={
                  tipiSeduta.includes("allenamento")
                    ? { backgroundColor: coloreFlag, color: "#fff" }
                    : { backgroundColor: "transparent", color: "#a1a1aa" }
                }
              >
                Allenamento
              </button>

              <button
                type="button"
                onClick={() => toggleTipoSeduta("partita")}
                className="flex h-full flex-1 items-center justify-center rounded-xl text-xs font-black transition"
                style={
                  tipiSeduta.includes("partita")
                    ? { backgroundColor: coloreFlag, color: "#fff" }
                    : { backgroundColor: "transparent", color: "#a1a1aa" }
                }
              >
                Partita
              </button>
            </div>
          </div>

          {/* NOME EVENTO (multiselezione) */}
          <div className="relative">
            <label className="mb-2 block text-xs font-bold uppercase tracking-wide text-zinc-500">
              {labelEvento}
            </label>

            <button
              type="button"
              onClick={() => setOpenEventi((value) => !value)}
              className="flex h-12 sm:h-[52px] w-full items-center justify-between rounded-2xl border border-white/10 bg-zinc-950 px-4 text-left text-sm font-bold text-white outline-none transition hover:border-white/25 hover:bg-zinc-900"
            >
              <span className="truncate">
                {titoliSelezionati.length === 0
                  ? "Tutti gli eventi"
                  : titoliSelezionati.length === 1
                    ? (sessioniSelezionate[0]?.titolo ?? "1 evento")
                    : `${titoliSelezionati.length} eventi selezionati`}
              </span>

              <ChevronDown
                size={18}
                className="shrink-0 text-zinc-500"
              />
            </button>

            {openEventi && (
              <div className="absolute z-40 mt-2 max-h-80 w-full overflow-auto rounded-2xl border border-white/10 bg-zinc-950 p-2 shadow-2xl">
                <button
                  type="button"
                  onClick={() => setTitoliSelezionati([])}
                  className="flex w-full items-center justify-between rounded-xl px-3 py-2.5 text-left text-sm font-bold text-white transition hover:bg-white/5"
                >
                  Tutti gli eventi
                  {titoliSelezionati.length === 0 && (
                    <span className="text-emerald-400">✓</span>
                  )}
                </button>

                {sessioniFiltrate.map((sessione) => {
                  const chiave = chiaveSessione(sessione);
                  const selezionato = titoliSelezionati.includes(chiave);

                  return (
                    <button
                      key={chiave}
                      type="button"
                      onClick={() => toggleSessione(chiave)}
                      className={`flex w-full items-center justify-between gap-2 rounded-xl px-3 py-2.5 text-left text-sm font-semibold transition hover:bg-white/5 hover:text-white ${
                        selezionato ? "text-white" : "text-zinc-300"
                      }`}
                    >
                      <span className="truncate">
                        {sessione.titolo}
                        {sessione.data ? ` - ${formatDataIT(sessione.data)}` : ""}
                      </span>

                      {selezionato && (
                        <span className="shrink-0 text-emerald-400">
                          ✓
                        </span>
                      )}
                    </button>
                  );
                })}

                <div className="mt-1 border-t border-white/10 pt-2">
                  <button
                    type="button"
                    onClick={() => setOpenEventi(false)}
                    className="w-full rounded-xl px-3 py-2 text-center text-xs font-bold text-zinc-400 transition hover:bg-white/5 hover:text-white"
                  >
                    Chiudi
                  </button>
                </div>
              </div>
            )}
          </div>

          {/* DETTAGLIO */}
          {soloPartita ? (
            <div className="relative">
              <label className="mb-2 block text-xs font-bold uppercase tracking-wide text-zinc-500">
                Tempo
              </label>

              <button
                type="button"
                onClick={() => setOpenSplit((value) => !value)}
                className="flex h-12 sm:h-[52px] w-full items-center justify-between rounded-2xl border border-white/10 bg-zinc-950 px-4 text-left text-sm font-bold text-white outline-none transition hover:border-white/25 hover:bg-zinc-900"
              >
                <span className="truncate">
                  {splitSelezionati.length === 0
                    ? "Tutta la partita"
                    : splitSelezionati.length === 1
                      ? (splitOpzioniPartita.find(
                          (opzione) => opzione.value === splitSelezionati[0]
                        )?.label ?? splitSelezionati[0])
                      : `${splitSelezionati.length} tempi selezionati`}
                </span>

                <ChevronDown
                  size={18}
                  className="shrink-0 text-zinc-500"
                />
              </button>

              {openSplit && (
                <div className="absolute z-40 mt-2 w-full overflow-auto rounded-2xl border border-white/10 bg-zinc-950 p-2 shadow-2xl">
                  <button
                    type="button"
                    onClick={() => setSplitSelezionati([])}
                    className="flex w-full items-center justify-between rounded-xl px-3 py-2.5 text-left text-sm font-bold text-white transition hover:bg-white/5"
                  >
                    Tutta la partita
                    {splitSelezionati.length === 0 && (
                      <span className="text-emerald-400">✓</span>
                    )}
                  </button>

                  {splitOpzioniPartita.map((opzione) => {
                    const selezionato = splitSelezionati.includes(
                      opzione.value
                    );

                    return (
                      <button
                        key={opzione.value}
                        type="button"
                        onClick={() => toggleSplit(opzione.value)}
                        className={`flex w-full items-center justify-between gap-2 rounded-xl px-3 py-2.5 text-left text-sm font-semibold transition hover:bg-white/5 hover:text-white ${
                          selezionato ? "text-white" : "text-zinc-300"
                        }`}
                      >
                        <span className="truncate">{opzione.label}</span>

                        {selezionato && (
                          <span className="shrink-0 text-emerald-400">
                            ✓
                          </span>
                        )}
                      </button>
                    );
                  })}

                  {splitOpzioniPartita.length === 0 && (
                    <p className="px-3 py-2.5 text-xs font-semibold text-zinc-500">
                      Nessun dato per tempo disponibile per le partite
                      importate.
                    </p>
                  )}

                  <div className="mt-1 border-t border-white/10 pt-2">
                    <button
                      type="button"
                      onClick={() => setOpenSplit(false)}
                      className="w-full rounded-xl px-3 py-2 text-center text-xs font-bold text-zinc-400 transition hover:bg-white/5 hover:text-white"
                    >
                      Chiudi
                    </button>
                  </div>
                </div>
              )}
            </div>
          ) : soloAllenamento ? (
            <div className="relative">
              <label className="mb-2 block text-xs font-bold uppercase tracking-wide text-zinc-500">
                Split
              </label>

              <button
                type="button"
                onClick={() => setOpenSplit((value) => !value)}
                className="flex h-12 sm:h-[52px] w-full items-center justify-between rounded-2xl border border-white/10 bg-zinc-950 px-4 text-left text-sm font-bold text-white outline-none transition hover:border-white/25 hover:bg-zinc-900"
              >
                <span className="truncate">
                  {splitSelezionati.length === 0
                    ? "Tutti"
                    : splitSelezionati.length === 1
                      ? splitSelezionati[0]
                      : `${splitSelezionati.length} split selezionati`}
                </span>

                <ChevronDown
                  size={18}
                  className="shrink-0 text-zinc-500"
                />
              </button>

              {openSplit && (
                <div className="absolute z-40 mt-2 max-h-80 w-full overflow-auto rounded-2xl border border-white/10 bg-zinc-950 p-2 shadow-2xl">
                  <button
                    type="button"
                    onClick={() => setSplitSelezionati([])}
                    className="flex w-full items-center justify-between rounded-xl px-3 py-2.5 text-left text-sm font-bold text-white transition hover:bg-white/5"
                  >
                    Tutti
                    {splitSelezionati.length === 0 && (
                      <span className="text-emerald-400">✓</span>
                    )}
                  </button>

                  {splitOpzioniAllenamento.map((split) => {
                    const selezionato =
                      splitSelezionati.includes(split);

                    return (
                      <button
                        key={split}
                        type="button"
                        onClick={() => toggleSplit(split)}
                        className={`flex w-full items-center justify-between gap-2 rounded-xl px-3 py-2.5 text-left text-sm font-semibold transition hover:bg-white/5 hover:text-white ${
                          selezionato ? "text-white" : "text-zinc-300"
                        }`}
                      >
                        <span className="truncate">{split}</span>

                        {selezionato && (
                          <span className="shrink-0 text-emerald-400">
                            ✓
                          </span>
                        )}
                      </button>
                    );
                  })}

                  <div className="mt-1 border-t border-white/10 pt-2">
                    <button
                      type="button"
                      onClick={() => setOpenSplit(false)}
                      className="w-full rounded-xl px-3 py-2 text-center text-xs font-bold text-zinc-400 transition hover:bg-white/5 hover:text-white"
                    >
                      Chiudi
                    </button>
                  </div>
                </div>
              )}
            </div>
          ) : (
            <div>
              <label className="mb-2 block text-xs font-bold uppercase tracking-wide text-zinc-500">
                Dettaglio
              </label>

              <div className="flex h-12 sm:h-[52px] items-center rounded-2xl border border-white/10 bg-zinc-950 px-4 text-sm font-semibold text-zinc-500">
                Tutti i dettagli
              </div>
            </div>
          )}
        </div>

        {/* RESET */}
        <div className="mt-4 flex flex-wrap items-center gap-3">
          <button
            type="button"
            onClick={() => {
              setDataDa("");
              setDataA("");
              setTipiSeduta([]);
              setGiocatoreIds([]);
              setTitoliSelezionati([]);
              setSplitSelezionati([]);
              setOpenGiocatori(false);
              setOpenEventi(false);
              setOpenSplit(false);
            }}
            className="rounded-xl border border-white/10 bg-white/5 px-4 py-2 text-sm font-bold text-zinc-300 transition hover:bg-white/10 hover:text-white"
          >
            Azzera filtri
          </button>
        </div>
        </div>
      </AppCard>

      {/* TAB */}
      <div className="overflow-x-auto">
        <div className="flex min-w-max gap-2 rounded-2xl border border-white/10 bg-zinc-950 p-2">
          {TABS.map((tab) => {
            const active = activeTab === tab.key;

            return (
              <button
                key={tab.key}
                type="button"
                onClick={() => setActiveTab(tab.key)}
                className="whitespace-nowrap rounded-xl px-4 py-2.5 text-sm font-black transition sm:px-5 sm:py-3"
                style={
                  active
                    ? {
                        backgroundColor: coloreFlag,
                        color: "#ffffff",
                      }
                    : {
                        backgroundColor: "transparent",
                        color: "#a1a1aa",
                      }
                }
              >
                {tab.label}
              </button>
            );
          })}
        </div>
      </div>

      {activeTab === "riepilogo" && (
        <div className="space-y-6">
          <ReportPerformanceSessioniClient
            mode="summary"
            clubId={clubId}
            squadraId={squadraId}
            giocatoreIds={giocatoreIds}
            dataDa={dataDa}
            dataA={dataA}
            tipiSeduta={tipiSeduta}
            sessionTitles={sessionTitlesFiltro}
            splitSelezionati={splitSelezionati}
            tipoProfilo={tipoProfilo}
          />

          <ReportAcwrClient
            mode="chart"
            clubId={clubId}
            squadraId={squadraId}
            giocatoreIds={giocatoreIds}
            dataDa={dataDa}
            dataA={dataA}
            tipiSeduta={tipiSeduta}
            coloreFlag={coloreFlag}
          />

          <PerformanceDashboardChartsClient
            clubId={clubId}
            squadraId={squadraId}
            giocatoreIds={giocatoreIds}
            dataDa={dataDa}
            dataA={dataA}
            tipiSeduta={tipiSeduta}
            sessionTitles={sessionTitlesFiltro}
            splitSelezionati={splitSelezionati}
            coloreFlag={coloreFlag}
          />
        </div>
      )}

      {activeTab === "presenze" && (
        <ReportPerformanceClient
          clubId={clubId}
          squadraId={squadraId}
          dataDa={dataDa}
          dataA={dataA}
          tipiSeduta={tipiSeduta}
          giocatoreIds={giocatoreIds}
          eventoDate={sessioniSelezionateDate}
          hideFilters
          statoSelezionato={statoPresenzeSelezionato}
          onStatoSelezionatoChange={setStatoPresenzeSelezionato}
        />
      )}

      {activeTab === "performance" && (
        <ReportPerformanceSessioniClient
          mode="table"
          clubId={clubId}
          squadraId={squadraId}
          giocatoreIds={giocatoreIds}
          dataDa={dataDa}
          dataA={dataA}
          tipiSeduta={tipiSeduta}
          sessionTitles={sessionTitlesFiltro}
          splitSelezionati={splitSelezionati}
        />
      )}

      {activeTab === "acwr" && (
        <ReportAcwrClient
          mode="table"
          clubId={clubId}
          squadraId={squadraId}
          giocatoreIds={giocatoreIds}
          dataDa={dataDa}
          dataA={dataA}
          tipiSeduta={tipiSeduta}
          coloreFlag={coloreFlag}
        />
      )}

      {activeTab === "test" && (
         <ReportTestClient
            clubId={clubId}
            squadraId={squadraId}
            giocatoreIds={giocatoreIds}
            dataDa={dataDa}
            dataA={dataA}
            coloreFlag={coloreFlag}
          />
      )}

      {activeTab === "confronto" && (
        <ConfrontoPerformanceClient
          clubId={clubId}
          squadraId={squadraId}
          giocatori={giocatori}
          giocatoreIds={giocatoreIds}
          dataDa={dataDa}
          dataA={dataA}
          tipiSeduta={tipiSeduta}
          sessionTitles={sessionTitlesFiltro}
          splitSelezionati={splitSelezionati}
          coloreFlag={coloreFlag}
        />
      )}

      {activeTab === "minutaggio_partite" && (
        <MinutaggioPartiteClient
          clubId={clubId}
          squadraId={squadraId}
          giocatori={giocatori}
          giocatoreIds={giocatoreIds}
          dataDa={dataDa}
          dataA={dataA}
          coloreFlag={coloreFlag}
        />
      )}

      {pdfInAnteprima && (
        <div className="fixed inset-0 z-[9999] overflow-y-auto bg-black/80 px-3 py-4 backdrop-blur-sm sm:px-6 sm:py-8">
          <div
            className="mx-auto max-w-4xl min-w-0 overflow-x-hidden rounded-3xl border bg-[#090909] p-4 shadow-2xl sm:p-6"
            style={{
              borderColor: `${coloreFlag}55`,
              boxShadow: `0 30px 80px ${coloreFlag}22`,
            }}
          >
            <PdfPreviewModal
              blobUrl={pdfInAnteprima.blobUrl}
              nomeFile={pdfInAnteprima.nomeFile}
              themeColor={coloreFlag}
              onDownload={() => scaricaPdfPerformance(pdfInAnteprima)}
              onClose={chiudiAnteprimaPdf}
            />
          </div>
        </div>
      )}

    </div>
  );
}