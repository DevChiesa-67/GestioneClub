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
type TabKey =
  | "riepilogo"
  | "presenze"
  | "performance"
  | "acwr"
  | "test";

type TipoSeduta = "tutte" | "allenamento" | "partita";
type TempoPartita = "all" | "1 Half" | "2 Half";

type Giocatore = {
  id: string;
  nome: string | null;
  cognome: string | null;
  foto_url: string | null;
};

type EventoReport = {
  id: string;
  tipo: "allenamento" | "partita";
  nome: string;
  data: string;
};

type Props = {
  clubId: string;
  squadraId: string | null;
  coloreFlag: string;
  giocatori: Giocatore[];
  splitNames: string[];
  eventi: EventoReport[];
  giocatoreId?: string | null;
};

const TABS: { key: TabKey; label: string }[] = [
  { key: "riepilogo", label: "Riepilogo" },
  { key: "presenze", label: "Presenze" },
  { key: "performance", label: "Performance" },
  { key: "acwr", label: "ACWR" },
  { key: "test", label: "Test" },
];

export default function ReportTabsClient({
  clubId,
  squadraId,
  coloreFlag,
  giocatori,
  splitNames,
  eventi,
  giocatoreId: giocatoreIdIniziale = null,
}: Props) {
  const [activeTab, setActiveTab] = useState<TabKey>("riepilogo");

  const [dataDa, setDataDa] = useState("");
  const [dataA, setDataA] = useState("");

  const [tipoSeduta, setTipoSeduta] =
    useState<TipoSeduta>("tutte");

  const [giocatoreId, setGiocatoreId] = useState<string>(
    giocatoreIdIniziale ?? "tutti"
  );

  const [eventoId, setEventoId] = useState("all");

  const [openGiocatori, setOpenGiocatori] = useState(false);

  const [tempoPartita, setTempoPartita] =
    useState<TempoPartita>("all");

  const [splitName, setSplitName] = useState("all");

  const giocatoreSelezionato = useMemo(() => {
    return (
      giocatori.find((item) => item.id === giocatoreId) ?? null
    );
  }, [giocatori, giocatoreId]);

  const eventiFiltrati = useMemo(() => {
    if (tipoSeduta === "allenamento") {
      return eventi.filter((evento) => evento.tipo === "allenamento");
    }

    if (tipoSeduta === "partita") {
      return eventi.filter((evento) => evento.tipo === "partita");
    }

    return eventi;
  }, [eventi, tipoSeduta]);

  function nomeCompleto(giocatore: Giocatore) {
    return (
      `${giocatore.nome ?? ""} ${giocatore.cognome ?? ""}`.trim() ||
      "Senza nome"
    );
  }

  const giocatoreIdFiltro =
    giocatoreId === "tutti" ? null : giocatoreId;

  const eventoIdFiltro = eventoId === "all" ? null : eventoId;

  const labelEvento =
    tipoSeduta === "partita"
      ? "Nome partita"
      : tipoSeduta === "allenamento"
        ? "Nome allenamento"
        : "Nome evento";

  return (
    <div className="space-y-6 p-6">
      <AppCard title="Filtri report">
        <div className="grid gap-4 xl:grid-cols-[1.4fr_1fr_1fr_1fr_1.4fr_1fr]">
          {/* GIOCATORE */}
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
                {giocatoreSelezionato?.foto_url ? (
                  <Image
                    src={giocatoreSelezionato.foto_url}
                    alt={nomeCompleto(giocatoreSelezionato)}
                    width={36}
                    height={36}
                    className="h-9 w-9 rounded-full object-cover ring-2 ring-white/10"
                  />
                ) : (
                  <span className="flex h-9 w-9 items-center justify-center rounded-full bg-white/10 text-zinc-300 ring-2 ring-white/10">
                    <UserRound size={17} />
                  </span>
                )}

                <span className="truncate text-sm font-bold">
                  {giocatoreSelezionato
                    ? nomeCompleto(giocatoreSelezionato)
                    : "Tutti i giocatori"}
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
                  onClick={() => {
                    setGiocatoreId("tutti");
                    setOpenGiocatori(false);
                  }}
                  className="flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-left text-sm font-bold text-white transition hover:bg-white/5"
                >
                  <span className="flex h-9 w-9 items-center justify-center rounded-full bg-white/10">
                    <UserRound size={17} />
                  </span>

                  Tutti i giocatori
                </button>

                {giocatori.map((giocatore) => (
                  <button
                    key={giocatore.id}
                    type="button"
                    onClick={() => {
                      setGiocatoreId(giocatore.id);
                      setOpenGiocatori(false);
                    }}
                    className="flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-left text-sm font-semibold text-zinc-300 transition hover:bg-white/5 hover:text-white"
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
                  </button>
                ))}
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

          {/* TIPO SEDUTA */}
          <div>
            <label className="mb-2 block text-xs font-bold uppercase tracking-wide text-zinc-500">
              Tipo seduta
            </label>

            <select
              value={tipoSeduta}
              onChange={(e) => {
                const value = e.target.value as TipoSeduta;

                setTipoSeduta(value);
                setTempoPartita("all");
                setSplitName("all");
                setEventoId("all");
              }}
              className="h-[52px] w-full rounded-2xl border border-white/10 bg-zinc-950 px-4 text-sm font-bold text-white outline-none transition focus:border-white/30"
            >
              <option value="tutte">Tutte</option>
              <option value="allenamento">
                Allenamento / Training
              </option>
              <option value="partita">
                Partita / Game
              </option>
            </select>
          </div>

          {/* NOME EVENTO */}
          <div>
            <label className="mb-2 block text-xs font-bold uppercase tracking-wide text-zinc-500">
              {labelEvento}
            </label>

            <select
              value={eventoId}
              onChange={(e) => setEventoId(e.target.value)}
              className="h-[52px] w-full rounded-2xl border border-white/10 bg-zinc-950 px-4 text-sm font-bold text-white outline-none transition focus:border-white/30"
            >
              <option value="all">Tutti gli eventi</option>

              {eventiFiltrati.map((evento) => (
                <option
                  key={`${evento.tipo}-${evento.id}`}
                  value={evento.id}
                >
                  {evento.nome} - {evento.data}
                </option>
              ))}
            </select>
          </div>

          {/* DETTAGLIO */}
          {tipoSeduta === "partita" ? (
            <div>
              <label className="mb-2 block text-xs font-bold uppercase tracking-wide text-zinc-500">
                Tempo
              </label>

              <select
                value={tempoPartita}
                onChange={(e) =>
                  setTempoPartita(
                    e.target.value as TempoPartita
                  )
                }
                className="h-[52px] w-full rounded-2xl border border-white/10 bg-zinc-950 px-4 text-sm font-bold text-white outline-none transition focus:border-white/30"
              >
                <option value="all">
                  Tutta la partita
                </option>
                <option value="1 Half">
                  Primo Tempo
                </option>
                <option value="2 Half">
                  Secondo Tempo
                </option>
              </select>
            </div>
          ) : tipoSeduta === "allenamento" ? (
            <div>
              <label className="mb-2 block text-xs font-bold uppercase tracking-wide text-zinc-500">
                Split
              </label>

              <select
                value={splitName}
                onChange={(e) =>
                  setSplitName(e.target.value)
                }
                className="h-[52px] w-full rounded-2xl border border-white/10 bg-zinc-950 px-4 text-sm font-bold text-white outline-none transition focus:border-white/30"
              >
                <option value="all">Tutti</option>

                {splitNames.map((split) => (
                  <option key={split} value={split}>
                    {split}
                  </option>
                ))}
              </select>
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
              setTipoSeduta("tutte");
              setGiocatoreId("tutti");
              setEventoId("all");
              setTempoPartita("all");
              setSplitName("all");
              setOpenGiocatori(false);
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
            giocatoreId={giocatoreIdFiltro}
            dataDa={dataDa}
            dataA={dataA}
            tipoSeduta={tipoSeduta}
            eventoId={eventoIdFiltro}
          />

          <ReportAcwrClient
            mode="chart"
            clubId={clubId}
            squadraId={squadraId}
            giocatoreId={giocatoreIdFiltro}
            dataDa={dataDa}
            dataA={dataA}
            coloreFlag={coloreFlag}
          />

          <PerformanceDashboardChartsClient
            clubId={clubId}
            squadraId={squadraId}
            giocatoreId={giocatoreIdFiltro}
            dataDa={dataDa}
            dataA={dataA}
            tipoSeduta={tipoSeduta}
            eventoId={eventoIdFiltro}
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
          tipoSeduta={tipoSeduta}
          giocatoreId={giocatoreIdFiltro}
          eventoId={eventoIdFiltro}
          hideFilters
        />
      )}

      {activeTab === "performance" && (
        <ReportPerformanceSessioniClient
          mode="table"
          clubId={clubId}
          squadraId={squadraId}
          giocatoreId={giocatoreIdFiltro}
          dataDa={dataDa}
          dataA={dataA}
          tipoSeduta={tipoSeduta}
          eventoId={eventoIdFiltro}
        />
      )}

      {activeTab === "acwr" && (
        <ReportAcwrClient
          mode="table"
          clubId={clubId}
          squadraId={squadraId}
          giocatoreId={giocatoreIdFiltro}
          dataDa={dataDa}
          dataA={dataA}
          coloreFlag={coloreFlag}
        />
      )}

      {activeTab === "test" && (
         <ReportTestClient
            clubId={clubId}
            squadraId={squadraId}
            giocatoreId={giocatoreIdFiltro}
            dataDa={dataDa}
            dataA={dataA}
            coloreFlag={coloreFlag}
          />
      )}

      
    </div>
  );
}