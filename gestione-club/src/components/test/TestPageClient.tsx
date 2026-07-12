"use client";

import { useMemo, useState } from "react";
import { ChevronDown, Plus, Target, TrendingUp, User } from "lucide-react";
import { AppCard } from "@/components/ui/AppCard";
import AggiungiTestModal from "@/components/test/AggiungiTestModal";
import NuovoTipoTestModal from "@/components/test/NuovoTipoTestModal";
import TestSparkline from "@/components/test/TestSparkline";

type Club = {
  id: string;
  nome: string;
  colore_flag: string;
};

type Profilo = {
  id: string;
  last_club_id: string;
  last_squadra_id: string;
};

type TestPerformance = {
  id: string;
  club_id: string;
  nome: string;
  tipo_test: "atletica" | "forza";
  unita_misura: string;
  attivo: boolean;
};

type GiocatoreRelazione = {
  id: string;
  nome: string;
  cognome: string;
  foto_url: string | null;
};

type TestRelazione = {
  id: string;
  nome: string;
  tipo_test: "atletica" | "forza";
  unita_misura: string;
};

type Misurazione = {
  id: string;
  club_id: string;
  squadra_id: string;
  giocatore_id: string;
  test_id: string;
  data_test: string;
  valore: number;
  obiettivo: number | null;
  note: string | null;
  giocatori: GiocatoreRelazione | GiocatoreRelazione[] | null;
  test_atletici_forza: TestRelazione | TestRelazione[] | null;
};

type Props = {
  club: Club;
  profilo: Profilo;
  tests: TestPerformance[];
  misurazioni: Misurazione[];
  isAdmin: boolean;
};

function getSingle<T>(value: T | T[] | null): T | null {
  if (!value) return null;
  return Array.isArray(value) ? value[0] ?? null : value;
}

function formatDate(date: string) {
  return new Intl.DateTimeFormat("it-IT", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  }).format(new Date(date));
}

function calcolaPercentuale(
  valore: number,
  obiettivo: number | null,
  tipoTest: "atletica" | "forza"
) {
  if (!obiettivo || !valore) return null;

  if (tipoTest === "atletica") {
    return (obiettivo / valore) * 100;
  }

  return (valore / obiettivo) * 100;
}

function statoBadge(percentuale: number | null) {
  if (percentuale === null) {
    return {
      label: "Senza obiettivo",
      className: "bg-zinc-700/40 text-zinc-300",
    };
  }

  if (percentuale >= 100) {
    return {
      label: "Obiettivo raggiunto",
      className: "bg-emerald-500/15 text-emerald-300",
    };
  }

  if (percentuale >= 50) {
    return {
      label: "Almeno 50%",
      className: "bg-amber-500/15 text-amber-300",
    };
  }

  return {
    label: "Sotto 50%",
    className: "bg-red-500/15 text-red-300",
  };
}

export default function TestPageClient({
  club,
  profilo,
  tests,
  misurazioni,
  isAdmin,
}: Props) {
  const [openAggiungi, setOpenAggiungi] = useState(false);
  const [openNuovoTipo, setOpenNuovoTipo] = useState(false);
  const [openGroups, setOpenGroups] = useState<Record<string, boolean>>({});

  const coloreFlag = club.colore_flag || "#d71920";

  const misurazioniNormalizzate = useMemo(() => {
    return misurazioni.map((m) => ({
      ...m,
      giocatore: getSingle(m.giocatori),
      test: getSingle(m.test_atletici_forza),
    }));
  }, [misurazioni]);

  const gruppi = useMemo(() => {
    const map = new Map<string, typeof misurazioniNormalizzate>();

    for (const misurazione of misurazioniNormalizzate) {
      if (!misurazione.test) continue;

      const key = `${misurazione.test_id}_${misurazione.data_test}`;

      if (!map.has(key)) {
        map.set(key, []);
      }

      map.get(key)?.push(misurazione);
    }

    return Array.from(map.entries()).map(([key, rows]) => {
      const first = rows[0];
      const test = first.test!;

      const raggiunto = rows.filter((row) => {
        const pct = calcolaPercentuale(
          Number(row.valore),
          row.obiettivo,
          test.tipo_test
        );

        return pct !== null && pct >= 100;
      }).length;

      const meta = rows.filter((row) => {
        const pct = calcolaPercentuale(
          Number(row.valore),
          row.obiettivo,
          test.tipo_test
        );

        return pct !== null && pct >= 50 && pct < 100;
      }).length;

      const sottoMeta = rows.filter((row) => {
        const pct = calcolaPercentuale(
          Number(row.valore),
          row.obiettivo,
          test.tipo_test
        );

        return pct !== null && pct < 50;
      }).length;

      return {
        key,
        test,
        data_test: first.data_test,
        rows,
        raggiunto,
        meta,
        sottoMeta,
      };
    });
  }, [misurazioniNormalizzate]);

  function storicoGiocatoreTest(giocatoreId: string, testId: string) {
    return misurazioniNormalizzate
      .filter(
        (m) => m.giocatore_id === giocatoreId && m.test_id === testId
      )
      .map((m) => ({
        data_test: m.data_test,
        valore: Number(m.valore),
      }));
  }

  function toggleGroup(key: string) {
    setOpenGroups((prev) => ({
      ...prev,
      [key]: !(prev[key] ?? false),
    }));
  }

  return (
    <div className="w-full min-w-0 space-y-4 px-3 py-4 sm:space-y-6 sm:px-4 sm:py-5 lg:p-6">
      {/* HEADER */}
      <div className="flex flex-col gap-4 sm:flex-row sm:flex-wrap sm:items-center sm:justify-between">
        <div className="min-w-0">
          <p className="truncate text-sm text-zinc-500">
            Club attivo:{" "}
            <span className="font-semibold text-zinc-300">{club.nome}</span>
          </p>

          <p className="mt-1 hidden text-xs text-zinc-600 sm:block">
            I dati usano profili.last_club_id e profili.last_squadra_id.
          </p>
        </div>

        {/* AZIONI */}
        {isAdmin && (
          <div className="grid w-full grid-cols-2 gap-2 sm:flex sm:w-auto sm:flex-wrap sm:gap-3">
            <button
              type="button"
              onClick={() => setOpenNuovoTipo(true)}
              className="flex min-w-0 items-center justify-center gap-2 rounded-xl border border-white/10 px-3 py-3 text-sm font-bold text-white transition hover:bg-white/5 sm:px-5"
            >
              <Plus size={17} className="shrink-0" />

              <span className="truncate sm:hidden">Nuovo tipo</span>
              <span className="hidden sm:inline">Nuovo tipo test</span>
            </button>

            <button
              type="button"
              onClick={() => setOpenAggiungi(true)}
              style={{ backgroundColor: coloreFlag }}
              className="flex min-w-0 items-center justify-center gap-2 rounded-xl px-3 py-3 text-sm font-bold text-white transition hover:opacity-90 sm:px-5"
            >
              <Plus size={17} className="shrink-0" />

              <span className="truncate sm:hidden">Aggiungi</span>
              <span className="hidden sm:inline">Aggiungi Test</span>
            </button>
          </div>
        )}
      </div>

      {/* EMPTY STATE TEST */}
      {tests.length === 0 && (
        <AppCard>
          <div className="px-3 py-8 text-center sm:py-10">
            <p className="text-base font-bold text-white sm:text-lg">
              Nessun test configurato
            </p>

            <p className="mx-auto mt-2 max-w-md text-sm leading-6 text-zinc-500">
              Crea prima Sprint, CMJ, Squat, Panca o qualsiasi altro test.
            </p>
          </div>
        </AppCard>
      )}

      {/* EMPTY STATE MISURAZIONI */}
      {gruppi.length === 0 && tests.length > 0 && (
        <AppCard>
          <div className="px-3 py-8 text-center sm:py-10">
            <p className="text-base font-bold text-white sm:text-lg">
              Nessuna misurazione presente
            </p>

            <p className="mx-auto mt-2 max-w-md text-sm leading-6 text-zinc-500">
              Clicca su “Aggiungi Test” per inserire i dati.
            </p>
          </div>
        </AppCard>
      )}

      {/* GRUPPI */}
      <div className="space-y-3 sm:space-y-4">
        {gruppi.map((gruppo) => {
          const isOpen = openGroups[gruppo.key] ?? false;

          return (
            <AppCard key={gruppo.key} noPadding>
              {/* HEADER GRUPPO */}
              <button
                type="button"
                onClick={() => toggleGroup(gruppo.key)}
                className="flex w-full min-w-0 items-center justify-between gap-3 px-4 py-4 text-left sm:gap-4 sm:px-5"
              >
                <div className="min-w-0 flex-1">
                  <h2 className="truncate text-base font-black text-white sm:text-lg">
                    {gruppo.test.nome}
                  </h2>

                  <p className="mt-1 text-xs text-zinc-500 sm:text-sm">
                    {formatDate(gruppo.data_test)}
                    <span className="mx-1.5">·</span>
                    {gruppo.rows.length} atleti
                  </p>

                  <div className="mt-2 flex flex-wrap items-center gap-1.5 sm:hidden">
                    <span className="rounded-full bg-white/5 px-2 py-1 text-[10px] font-bold uppercase text-zinc-400">
                      {gruppo.test.tipo_test}
                    </span>

                    <span className="rounded-full bg-white/5 px-2 py-1 text-[10px] font-bold text-zinc-400">
                      {gruppo.test.unita_misura}
                    </span>
                  </div>

                  <p className="mt-1 hidden text-sm text-zinc-500 sm:block">
                    {gruppo.test.tipo_test} · {gruppo.test.unita_misura} ·{" "}
                    {gruppo.rows.length} atleti
                  </p>
                </div>

                <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-white/5">
                  <ChevronDown
                    size={20}
                    className={`text-zinc-400 transition-transform duration-200 ${
                      isOpen ? "rotate-180" : ""
                    }`}
                  />
                </div>
              </button>

              {isOpen && (
                <div className="border-t border-white/10">
                  {/* ================================================= */}
                  {/* MOBILE */}
                  {/* ================================================= */}
                  <div className="space-y-4 p-3 md:hidden">
                    {/* RIEPILOGO MOBILE */}
                    <div className="grid grid-cols-3 gap-2">
                      <div
                        className="min-w-0 rounded-xl border border-white/10 p-3"
                        style={{
                          borderColor: `${coloreFlag}66`,
                          backgroundColor: `${coloreFlag}10`,
                        }}
                      >
                        <p className="text-[10px] leading-4 text-zinc-500">
                          Raggiunto
                        </p>

                        <p className="mt-1 text-2xl font-black text-white">
                          {gruppo.raggiunto}
                        </p>
                      </div>

                      <div className="min-w-0 rounded-xl border border-white/10 bg-white/[0.02] p-3">
                        <p className="text-[10px] leading-4 text-zinc-500">
                          Almeno 50%
                        </p>

                        <p className="mt-1 text-2xl font-black text-amber-300">
                          {gruppo.meta}
                        </p>
                      </div>

                      <div className="min-w-0 rounded-xl border border-white/10 bg-white/[0.02] p-3">
                        <p className="text-[10px] leading-4 text-zinc-500">
                          Sotto 50%
                        </p>

                        <p className="mt-1 text-2xl font-black text-red-300">
                          {gruppo.sottoMeta}
                        </p>
                      </div>
                    </div>

                    {/* CARD GIOCATORI */}
                    <div className="space-y-3">
                      {gruppo.rows.map((row) => {
                        const giocatore = row.giocatore;

                        const percentuale = calcolaPercentuale(
                          Number(row.valore),
                          row.obiettivo,
                          gruppo.test.tipo_test
                        );

                        const badge = statoBadge(percentuale);

                        const storico = storicoGiocatoreTest(
                          row.giocatore_id,
                          row.test_id
                        );

                        return (
                          <div
                            key={row.id}
                            className="overflow-hidden rounded-2xl border border-white/10 bg-white/[0.02]"
                          >
                            {/* TOP GIOCATORE */}
                            <div className="flex min-w-0 items-start gap-3 p-4">
                              <div
                                className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl"
                                style={{
                                  backgroundColor: `${coloreFlag}18`,
                                  color: coloreFlag,
                                }}
                              >
                                <User size={19} />
                              </div>

                              <div className="min-w-0 flex-1">
                                <p className="truncate font-bold text-white">
                                  {giocatore
                                    ? `${giocatore.nome} ${giocatore.cognome}`
                                    : "Giocatore eliminato"}
                                </p>

                                {row.note ? (
                                  <p className="mt-1 line-clamp-2 text-xs leading-5 text-zinc-500">
                                    {row.note}
                                  </p>
                                ) : (
                                  <p className="mt-1 text-xs text-zinc-600">
                                    Nessuna nota
                                  </p>
                                )}
                              </div>
                            </div>

                            {/* VALORE / OBIETTIVO */}
                            <div className="grid grid-cols-2 border-y border-white/10">
                              <div className="min-w-0 border-r border-white/10 p-3">
                                <div className="flex items-center gap-1.5 text-zinc-500">
                                  <TrendingUp size={13} />

                                  <span className="text-[10px] font-bold uppercase tracking-wide">
                                    Valore
                                  </span>
                                </div>

                                <p className="mt-1.5 truncate text-base font-black text-white">
                                  {row.valore}{" "}
                                  <span className="text-xs font-semibold text-zinc-500">
                                    {gruppo.test.unita_misura}
                                  </span>
                                </p>
                              </div>

                              <div className="min-w-0 p-3">
                                <div className="flex items-center gap-1.5 text-zinc-500">
                                  <Target size={13} />

                                  <span className="text-[10px] font-bold uppercase tracking-wide">
                                    Obiettivo
                                  </span>
                                </div>

                                <p className="mt-1.5 truncate text-base font-black text-white">
                                  {row.obiettivo ? (
                                    <>
                                      {row.obiettivo}{" "}
                                      <span className="text-xs font-semibold text-zinc-500">
                                        {gruppo.test.unita_misura}
                                      </span>
                                    </>
                                  ) : (
                                    <span className="text-zinc-600">—</span>
                                  )}
                                </p>
                              </div>
                            </div>

                            {/* STORICO */}
                            <div className="p-4">
                              <div className="mb-3 flex items-center justify-between gap-3">
                                <p className="text-[10px] font-bold uppercase tracking-wide text-zinc-500">
                                  Andamento storico
                                </p>

                                <span className="text-[10px] text-zinc-600">
                                  {storico.length} rilevazioni
                                </span>
                              </div>

                              <div className="min-h-[44px] w-full overflow-hidden">
                                <TestSparkline
                                  color={coloreFlag}
                                  points={storico}
                                />
                              </div>
                            </div>

                            {/* STATO */}
                            <div className="border-t border-white/10 px-4 py-3">
                              <span
                                className={`inline-flex max-w-full rounded-full px-3 py-1.5 text-xs font-bold ${badge.className}`}
                              >
                                {badge.label}
                              </span>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>

                  {/* ================================================= */}
                  {/* DESKTOP / TABLET */}
                  {/* ================================================= */}
                  <div className="hidden gap-5 p-5 md:grid xl:grid-cols-[minmax(0,1fr)_260px]">
                    {/* TABELLA */}
                    <div className="min-w-0 overflow-hidden rounded-xl border border-white/10">
                      <div className="grid grid-cols-[1.3fr_0.7fr_0.7fr_1fr_0.8fr] bg-white/5 px-4 py-3 text-xs font-bold uppercase tracking-wide text-zinc-500">
                        <span>Giocatore</span>
                        <span>Valore</span>
                        <span>Obiettivo</span>
                        <span>Storico</span>
                        <span>Stato</span>
                      </div>

                      {gruppo.rows.map((row) => {
                        const giocatore = row.giocatore;

                        const percentuale = calcolaPercentuale(
                          Number(row.valore),
                          row.obiettivo,
                          gruppo.test.tipo_test
                        );

                        const badge = statoBadge(percentuale);

                        return (
                          <div
                            key={row.id}
                            className="grid grid-cols-[1.3fr_0.7fr_0.7fr_1fr_0.8fr] items-center gap-3 border-t border-white/10 px-4 py-3"
                          >
                            <div className="min-w-0">
                              <p className="truncate font-bold text-white">
                                {giocatore
                                  ? `${giocatore.nome} ${giocatore.cognome}`
                                  : "Giocatore eliminato"}
                              </p>

                              {row.note && (
                                <p className="truncate text-xs text-zinc-500">
                                  {row.note}
                                </p>
                              )}
                            </div>

                            <p className="text-sm font-bold text-white">
                              {row.valore} {gruppo.test.unita_misura}
                            </p>

                            <p className="text-sm text-zinc-300">
                              {row.obiettivo
                                ? `${row.obiettivo} ${gruppo.test.unita_misura}`
                                : "-"}
                            </p>

                            <div className="min-w-0">
                              <TestSparkline
                                color={coloreFlag}
                                points={storicoGiocatoreTest(
                                  row.giocatore_id,
                                  row.test_id
                                )}
                              />
                            </div>

                            <span
                              className={`rounded-full px-3 py-1 text-center text-xs font-bold ${badge.className}`}
                            >
                              {badge.label}
                            </span>
                          </div>
                        );
                      })}
                    </div>

                    {/* KPI DESKTOP */}
                    <div className="space-y-3">
                      <div
                        className="rounded-xl border border-white/10 p-4"
                        style={{
                          borderColor: `${coloreFlag}66`,
                        }}
                      >
                        <p className="text-sm text-zinc-500">
                          Obiettivo raggiunto
                        </p>

                        <p className="mt-1 text-4xl font-black text-white">
                          {gruppo.raggiunto}
                        </p>
                      </div>

                      <div className="rounded-xl border border-white/10 p-4">
                        <p className="text-sm text-zinc-500">
                          Almeno 50% obiettivo
                        </p>

                        <p className="mt-1 text-4xl font-black text-amber-300">
                          {gruppo.meta}
                        </p>
                      </div>

                      <div className="rounded-xl border border-white/10 p-4">
                        <p className="text-sm text-zinc-500">
                          Sotto 50% obiettivo
                        </p>

                        <p className="mt-1 text-4xl font-black text-red-300">
                          {gruppo.sottoMeta}
                        </p>
                      </div>
                    </div>
                  </div>
                </div>
              )}
            </AppCard>
          );
        })}
      </div>

      <AggiungiTestModal
        open={openAggiungi}
        onClose={() => setOpenAggiungi(false)}
        tests={tests}
        coloreFlag={coloreFlag}
      />

      <NuovoTipoTestModal
        open={openNuovoTipo}
        onClose={() => setOpenNuovoTipo(false)}
        coloreFlag={coloreFlag}
      />
    </div>
  );
}