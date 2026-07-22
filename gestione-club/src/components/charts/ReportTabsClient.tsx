"use client";

import { useMemo, useState } from "react";
import Image from "next/image";
import { ChevronDown, UserRound } from "lucide-react";

import ReportPerformanceClient from "@/components/charts/ReportPerformanceClient";
import ReportAcwrClient from "@/components/charts/ReportAcwrClient";
import { AppCard } from "@/components/ui/AppCard";
import ReportPerformanceSessioniClient from "@/components/charts/ReportPerformanceSessioniClient";
import PerformanceDashboardChartsClient from "@/components/charts/PerformanceDashboardChartsClient";
import ReportTestClient from "@/components/charts/ReportTestClient";
import ConfrontoPerformanceClient from "@/components/charts/ConfrontoPerformanceClient";
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
  | "confronto";

const TEMPO_PARTITA_OPZIONI: { value: string; label: string }[] = [
  { value: "1 Half", label: "Primo Tempo" },
  { value: "2 Half", label: "Secondo Tempo" },
];

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

type Props = {
  clubId: string;
  squadraId: string | null;
  coloreFlag: string;
  giocatori: Giocatore[];
  splitNames: string[];
  sessioni: SessioneCatapult[];
  giocatoreId?: string | null;
};

function chiaveSessione(sessione: SessioneCatapult) {
  return `${sessione.titolo}__${sessione.data ?? ""}`;
}

const TABS: { key: TabKey; label: string }[] = [
  { key: "riepilogo", label: "Riepilogo" },
  { key: "presenze", label: "Presenze" },
  { key: "performance", label: "Performance" },
  { key: "acwr", label: "ACWR" },
  { key: "test", label: "Test" },
  { key: "confronto", label: "Confronto" },
];

export default function ReportTabsClient({
  clubId,
  squadraId,
  coloreFlag,
  giocatori,
  splitNames,
  sessioni,
  giocatoreId: giocatoreIdIniziale = null,
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

  const [splitSelezionati, setSplitSelezionati] = useState<string[]>(
    []
  );

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

  const soloPartita =
    tipiSeduta.length === 1 && tipiSeduta[0] === "partita";

  const soloAllenamento =
    tipiSeduta.length === 1 && tipiSeduta[0] === "allenamento";

  const labelEvento = soloPartita
    ? "Nome partita"
    : soloAllenamento
      ? "Nome allenamento"
      : "Nome evento";

  return (
    <div className="space-y-6 p-6">
      <AppCard title="Filtri report">
        <div className="grid gap-4 xl:grid-cols-[1.4fr_1fr_1fr_1fr_1.4fr_1fr]">
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
              className="flex h-[52px] w-full items-center justify-between rounded-2xl border border-white/10 bg-zinc-950 px-4 text-left text-white shadow-inner outline-none transition hover:border-white/25 hover:bg-zinc-900"
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
            <label className="mb-2 block text-xs font-bold uppercase tracking-wide text-zinc-500">
              Data da
            </label>

            <input
              type="date"
              value={dataDa}
              onChange={(e) => setDataDa(e.target.value)}
              className="h-[52px] w-full rounded-2xl border border-white/10 bg-zinc-950 px-4 text-sm font-semibold text-white outline-none [color-scheme:dark] transition focus:border-white/30"
            />
          </div>

          {/* DATA A */}
          <div>
            <label className="mb-2 block text-xs font-bold uppercase tracking-wide text-zinc-500">
              Data a
            </label>

            <input
              type="date"
              value={dataA}
              onChange={(e) => setDataA(e.target.value)}
              className="h-[52px] w-full rounded-2xl border border-white/10 bg-zinc-950 px-4 text-sm font-semibold text-white outline-none [color-scheme:dark] transition focus:border-white/30"
            />
          </div>

          {/* TIPO SEDUTA (multiselezione) */}
          <div>
            <label className="mb-2 block text-xs font-bold uppercase tracking-wide text-zinc-500">
              Tipo seduta
            </label>

            <div className="flex h-[52px] items-center gap-2 rounded-2xl border border-white/10 bg-zinc-950 p-1.5">
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
              className="flex h-[52px] w-full items-center justify-between rounded-2xl border border-white/10 bg-zinc-950 px-4 text-left text-sm font-bold text-white outline-none transition hover:border-white/25 hover:bg-zinc-900"
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
                        {sessione.data ? ` - ${sessione.data}` : ""}
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
                className="flex h-[52px] w-full items-center justify-between rounded-2xl border border-white/10 bg-zinc-950 px-4 text-left text-sm font-bold text-white outline-none transition hover:border-white/25 hover:bg-zinc-900"
              >
                <span className="truncate">
                  {splitSelezionati.length === 0
                    ? "Tutta la partita"
                    : splitSelezionati.length === 1
                      ? (TEMPO_PARTITA_OPZIONI.find(
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

                  {TEMPO_PARTITA_OPZIONI.map((opzione) => {
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
                className="flex h-[52px] w-full items-center justify-between rounded-2xl border border-white/10 bg-zinc-950 px-4 text-left text-sm font-bold text-white outline-none transition hover:border-white/25 hover:bg-zinc-900"
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

                  {splitNames.map((split) => {
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

              <div className="flex h-[52px] items-center rounded-2xl border border-white/10 bg-zinc-950 px-4 text-sm font-semibold text-zinc-500">
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
                className="rounded-xl px-5 py-3 text-sm font-black transition"
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


    </div>
  );
}