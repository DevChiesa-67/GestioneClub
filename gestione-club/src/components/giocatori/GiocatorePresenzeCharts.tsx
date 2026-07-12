"use client";

import { useMemo, useState } from "react";

type StatoPresenzaDb =
  | "presente_mattina"
  | "presente_pomeriggio"
  | "presente_entrambe"
  | "infortunato"
  | "assenza_giustificata"
  | "assenza_ingiustificata";

type PresenzaGiocatore = {
  id: string;
  stato: StatoPresenzaDb;
  allenamenti: {
    data_allenamento: string;
  } | null;
};

type FiltroPeriodo = "globale" | string;
type FiltroStato = "tutte" | StatoPresenzaDb;

const STATI: { value: FiltroStato; label: string }[] = [
  { value: "tutte", label: "Tutte" },
  { value: "presente_entrambe", label: "Presente" },
  { value: "presente_mattina", label: "Presente mattina" },
  { value: "presente_pomeriggio", label: "Presente pomeriggio" },
  { value: "infortunato", label: "Infortunio" },
  { value: "assenza_giustificata", label: "Assenza giustificata" },
  { value: "assenza_ingiustificata", label: "Assenza ingiustificata" },
];

const LABEL_STATO: Record<StatoPresenzaDb, string> = {
  presente_mattina: "Presente mattina",
  presente_pomeriggio: "Presente pomeriggio",
  presente_entrambe: "Presente",
  infortunato: "Infortunio",
  assenza_giustificata: "Assenza giustificata",
  assenza_ingiustificata: "Assenza ingiustificata",
};

const COLORI: Record<StatoPresenzaDb, string> = {
  presente_entrambe: "#16a34a",
  presente_mattina: "#facc15",
  presente_pomeriggio: "#facc15",
  infortunato: "#38bdf8",
  assenza_giustificata: "#f87171",
  assenza_ingiustificata: "#991b1b",
};

function formatMese(value: string) {
  const [anno, mese] = value.split("-");

  return new Intl.DateTimeFormat("it-IT", {
    month: "long",
    year: "numeric",
  }).format(new Date(Number(anno), Number(mese) - 1, 1));
}

function formatGiorno(value: string) {
  return new Intl.DateTimeFormat("it-IT", {
    day: "2-digit",
    month: "2-digit",
  }).format(new Date(value));
}

function getPeriodoKey(data: string, periodo: FiltroPeriodo) {
  if (periodo === "globale") {
    return data.slice(0, 7);
  }

  return data;
}

function getPeriodoLabel(value: string, periodo: FiltroPeriodo) {
  if (periodo === "globale") {
    return formatMese(value);
  }

  return formatGiorno(value);
}

function BarChart({
  dati,
  periodo,
}: {
  dati: { periodo: string; totale: number }[];
  periodo: FiltroPeriodo;
}) {
  const max = Math.max(...dati.map((d) => d.totale), 1);

  return (
    <div className="flex h-80 items-end gap-3 overflow-x-auto">
      {dati.length === 0 && (
        <div className="flex h-full w-full items-center justify-center text-sm text-zinc-500">
          Nessun dato disponibile.
        </div>
      )}

      {dati.map((item) => {
        const altezza = Math.max((item.totale / max) * 240, 8);

        return (
          <div
            key={item.periodo}
            className="flex min-w-20 flex-col items-center justify-end gap-2"
          >
            <p className="text-sm font-bold text-white">{item.totale}</p>

            <div
              className="w-9 rounded-t-xl bg-[#d71920]"
              style={{ height: `${altezza}px` }}
            />

            <p className="max-w-20 truncate text-center text-xs capitalize text-zinc-500">
              {getPeriodoLabel(item.periodo, periodo)}
            </p>
          </div>
        );
      })}
    </div>
  );
}

function PieChart({
  distribuzione,
}: {
  distribuzione: { stato: StatoPresenzaDb; totale: number }[];
}) {
  const totale = distribuzione.reduce((sum, item) => sum + item.totale, 0);

  const gradient =
    totale > 0
      ? distribuzione
          .map((item, index) => {
            const start = distribuzione
              .slice(0, index)
              .reduce(
                (sum, current) => sum + (current.totale / totale) * 100,
                0,
              );

            const end = start + (item.totale / totale) * 100;

            return `${COLORI[item.stato]} ${start}% ${end}%`;
          })
          .join(", ")
      : "#27272a 0% 100%";

  return (
    <>
      <div
        className="mx-auto mt-6 h-44 w-44 rounded-full"
        style={{ background: `conic-gradient(${gradient})` }}
      />

      <div className="mt-6 space-y-3">
        {distribuzione.length === 0 && (
          <p className="text-sm text-zinc-500">Nessun dato disponibile.</p>
        )}

        {distribuzione.map((item) => (
          <div
            key={item.stato}
            className="flex items-center justify-between gap-3 text-sm"
          >
            <span className="flex items-center gap-2 text-zinc-400">
              <span
                className="h-3 w-3 rounded-full"
                style={{ backgroundColor: COLORI[item.stato] }}
              />
              {LABEL_STATO[item.stato]}
            </span>

            <span className="font-bold text-white">{item.totale}</span>
          </div>
        ))}
      </div>
    </>
  );
}

export function GiocatorePresenzeCharts({
  presenze,
}: {
  presenze: PresenzaGiocatore[];
}) {
  const [periodo, setPeriodo] = useState<FiltroPeriodo>("globale");
  const [filtroStato, setFiltroStato] = useState<FiltroStato>("tutte");

  const presenzeConData = useMemo(() => {
    return presenze.filter((p) => p.allenamenti?.data_allenamento);
  }, [presenze]);

  const mesiDisponibili = useMemo(() => {
    const mesi = new Set<string>();

    presenzeConData.forEach((presenza) => {
      const data = presenza.allenamenti?.data_allenamento;
      if (data) mesi.add(data.slice(0, 7));
    });

    return Array.from(mesi).sort();
  }, [presenzeConData]);

  const presenzePeriodo = useMemo(() => {
    if (periodo === "globale") return presenzeConData;

    return presenzeConData.filter((presenza) => {
      const data = presenza.allenamenti?.data_allenamento;
      return data?.startsWith(periodo);
    });
  }, [presenzeConData, periodo]);

  const presenzeFiltrate = useMemo(() => {
    if (filtroStato === "tutte") return presenzePeriodo;

    return presenzePeriodo.filter((presenza) => presenza.stato === filtroStato);
  }, [presenzePeriodo, filtroStato]);

  const datiGrafico = useMemo(() => {
    const grouped = presenzeFiltrate.reduce<Record<string, number>>(
      (acc, presenza) => {
        const data = presenza.allenamenti?.data_allenamento;
        if (!data) return acc;

        const key = getPeriodoKey(data, periodo);
        acc[key] = (acc[key] || 0) + 1;

        return acc;
      },
      {},
    );

    return Object.entries(grouped)
      .map(([periodoItem, totale]) => ({
        periodo: periodoItem,
        totale,
      }))
      .sort((a, b) => a.periodo.localeCompare(b.periodo));
  }, [presenzeFiltrate, periodo]);

  const distribuzione = useMemo(() => {
    const grouped = presenzePeriodo.reduce<Record<StatoPresenzaDb, number>>(
      (acc, presenza) => {
        acc[presenza.stato] = (acc[presenza.stato] || 0) + 1;
        return acc;
      },
      {} as Record<StatoPresenzaDb, number>,
    );

    return Object.entries(grouped)
      .map(([stato, totale]) => ({
        stato: stato as StatoPresenzaDb,
        totale,
      }))
      .sort((a, b) => b.totale - a.totale);
  }, [presenzePeriodo]);

  const totalePresenze = presenzePeriodo.filter((p) =>
    [
      "presente_mattina",
      "presente_pomeriggio",
      "presente_entrambe",
    ].includes(p.stato),
  ).length;

  const totaleAllenamentiPeriodo = presenzePeriodo.length;

  const percentualePresenza =
    totaleAllenamentiPeriodo > 0
      ? Math.round((totalePresenze / totaleAllenamentiPeriodo) * 100)
      : 0;

  return (
    <section className="rounded-2xl border border-white/10 bg-[#171717] p-6">
      <div className="mb-6 flex flex-wrap items-end justify-between gap-4">
        <div>
          <h2 className="text-xl font-bold text-white">Presenze</h2>
          <p className="mt-1 text-sm text-zinc-500">
            Andamento dinamico in base agli allenamenti salvati.
          </p>
        </div>

        <div className="flex flex-wrap gap-3">
          <div>
            <label className="text-xs font-bold uppercase tracking-widest text-zinc-500">
              Periodo
            </label>
            <select
              value={periodo}
              onChange={(e) => setPeriodo(e.target.value)}
              className="mt-1 block rounded-xl border border-white/10 bg-black/30 px-3 py-2 text-sm text-white outline-none"
            >
              <option value="globale">Globale</option>

              {mesiDisponibili.map((mese) => (
                <option key={mese} value={mese}>
                  {formatMese(mese)}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="text-xs font-bold uppercase tracking-widest text-zinc-500">
              Stato
            </label>
            <select
              value={filtroStato}
              onChange={(e) => setFiltroStato(e.target.value as FiltroStato)}
              className="mt-1 block rounded-xl border border-white/10 bg-black/30 px-3 py-2 text-sm text-white outline-none"
            >
              {STATI.map((stato) => (
                <option key={stato.value} value={stato.value}>
                  {stato.label}
                </option>
              ))}
            </select>
          </div>
        </div>
      </div>

      <div className="mb-6 grid gap-4 md:grid-cols-3">
        <div className="rounded-2xl border border-white/10 bg-black/20 p-5">
          <p className="text-xs font-bold uppercase tracking-widest text-zinc-500">
            Presenza
          </p>
          <p className="mt-2 text-3xl font-black text-white">
            {percentualePresenza}%
          </p>
          <p className="mt-1 text-sm text-zinc-500">
            {totalePresenze} su {totaleAllenamentiPeriodo}
          </p>
        </div>

        <div className="rounded-2xl border border-white/10 bg-black/20 p-5">
          <p className="text-xs font-bold uppercase tracking-widest text-zinc-500">
            Allenamenti registrati
          </p>
          <p className="mt-2 text-3xl font-black text-white">
            {totaleAllenamentiPeriodo}
          </p>
        </div>

        <div className="rounded-2xl border border-white/10 bg-black/20 p-5">
          <p className="text-xs font-bold uppercase tracking-widest text-zinc-500">
            Periodo selezionato
          </p>
          <p className="mt-2 text-lg font-black capitalize text-white">
            {periodo === "globale" ? "Globale" : formatMese(periodo)}
          </p>
        </div>
      </div>

      <div className="grid gap-6 xl:grid-cols-[3fr_1fr]">
        <div className="rounded-2xl border border-white/10 bg-black/20 p-5">
          <BarChart dati={datiGrafico} periodo={periodo} />
        </div>

        <div className="rounded-2xl border border-white/10 bg-black/20 p-5">
          <h3 className="text-sm font-bold uppercase tracking-widest text-zinc-500">
            Distribuzione
          </h3>

          <PieChart distribuzione={distribuzione} />
        </div>
      </div>
    </section>
  );
}