"use client";

import { ChevronDown } from "lucide-react";
import TestSparkline from "@/components/test/TestSparkline";

type TipoTest = "atletica" | "forza";

type Giocatore = {
  id: string;
  nome: string;
  cognome: string;
  foto_url: string | null;
};

type TestPerformance = {
  id: string;
  nome: string;
  tipo_test: TipoTest;
  unita_misura: string;
};

type Row = {
  id: string;
  giocatore_id: string;
  test_id: string;
  data_test: string;
  valore: number;
  obiettivo: number | null;
  note: string | null;
  giocatore: Giocatore | null;
};

type Props = {
  gruppo: {
    key: string;
    test: TestPerformance;
    data_test: string;
    rows: Row[];
    raggiunto: number;
    meta: number;
    sottoMeta: number;
  };
  isOpen: boolean;
  onToggle: () => void;
  coloreFlag: string;
  storicoGiocatoreTest: (
    giocatoreId: string,
    testId: string
  ) => {
    data_test: string;
    valore: number;
  }[];
};

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
  tipoTest: TipoTest
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

export default function TestAccordion({
  gruppo,
  isOpen,
  onToggle,
  coloreFlag,
  storicoGiocatoreTest,
}: Props) {
  return (
    <div className="rounded-xl border border-zinc-800 bg-zinc-900">
      <button
        onClick={onToggle}
        className="flex w-full items-center justify-between gap-4 px-5 py-4 text-left"
      >
        <div>
          <h2 className="text-lg font-black text-white">
            {gruppo.test.nome} · {formatDate(gruppo.data_test)}
          </h2>

          <p className="text-sm text-zinc-500">
            {gruppo.test.tipo_test} · {gruppo.test.unita_misura} ·{" "}
            {gruppo.rows.length} atleti
          </p>
        </div>

        <ChevronDown
          size={22}
          className={`text-zinc-400 transition ${isOpen ? "rotate-180" : ""}`}
        />
      </button>

      {isOpen && (
        <div className="grid gap-5 border-t border-white/10 p-5 xl:grid-cols-[1fr_260px]">
          <div className="overflow-hidden rounded-xl border border-white/10">
            <div className="grid grid-cols-[1.3fr_0.7fr_0.7fr_1fr_0.8fr] bg-white/5 px-4 py-3 text-xs font-bold uppercase tracking-wide text-zinc-500">
              <span>Giocatore</span>
              <span>Valore</span>
              <span>Obiettivo</span>
              <span>Storico</span>
              <span>Stato</span>
            </div>

            {gruppo.rows.map((row) => {
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
                  <div>
                    <p className="font-bold text-white">
                      {row.giocatore
                        ? `${row.giocatore.nome} ${row.giocatore.cognome}`
                        : "Giocatore eliminato"}
                    </p>

                    {row.note && (
                      <p className="text-xs text-zinc-500">{row.note}</p>
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

                  <TestSparkline
                    color={coloreFlag}
                    points={storicoGiocatoreTest(
                      row.giocatore_id,
                      row.test_id
                    )}
                  />

                  <span
                    className={`rounded-full px-3 py-1 text-center text-xs font-bold ${badge.className}`}
                  >
                    {badge.label}
                  </span>
                </div>
              );
            })}
          </div>

          <div className="space-y-3">
            <div
              className="rounded-xl border border-white/10 p-4"
              style={{ borderColor: `${coloreFlag}66` }}
            >
              <p className="text-sm text-zinc-500">Obiettivo raggiunto</p>
              <p className="mt-1 text-4xl font-black text-white">
                {gruppo.raggiunto}
              </p>
            </div>

            <div className="rounded-xl border border-white/10 p-4">
              <p className="text-sm text-zinc-500">Almeno 50% obiettivo</p>
              <p className="mt-1 text-4xl font-black text-amber-300">
                {gruppo.meta}
              </p>
            </div>

            <div className="rounded-xl border border-white/10 p-4">
              <p className="text-sm text-zinc-500">Sotto 50% obiettivo</p>
              <p className="mt-1 text-4xl font-black text-red-300">
                {gruppo.sottoMeta}
              </p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}