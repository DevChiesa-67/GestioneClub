"use client";

import { useMemo, useState } from "react";
import { CalendarRange, Download, FileSpreadsheet, X } from "lucide-react";

import {
  calcolaNumeroSettimana,
  intervalloTemplateValido,
  scaricaTemplateAllenamenti,
  settimanaInizialeTemplate,
} from "@/lib/template-allenamento-excel";

type Props = {
  onClose: () => void;
  themeColor: string;
};

function aggiungiGiorni(dataIso: string, giorni: number) {
  const [anno, mese, giorno] = dataIso.split("-").map(Number);
  const data = new Date(Date.UTC(anno, mese - 1, giorno + giorni));
  return `${data.getUTCFullYear()}-${String(data.getUTCMonth() + 1).padStart(2, "0")}-${String(data.getUTCDate()).padStart(2, "0")}`;
}

export default function ScaricaTemplateAllenamentiModal({
  onClose,
  themeColor,
}: Props) {
  const dataIniziale = settimanaInizialeTemplate();
  const [dataDal, setDataDal] = useState(dataIniziale);
  const [dataAl, setDataAl] = useState(aggiungiGiorni(dataIniziale, 6));
  const [errore, setErrore] = useState<string | null>(null);

  const numeroSettimana = useMemo(
    () => (dataDal ? calcolaNumeroSettimana(dataDal) : null),
    [dataDal]
  );

  function aggiornaDataDal(valore: string) {
    setDataDal(valore);
    setDataAl(aggiungiGiorni(valore, 6));
    setErrore(null);
  }

  function scarica() {
    const erroreIntervallo = intervalloTemplateValido(dataDal, dataAl);
    if (erroreIntervallo) {
      setErrore(erroreIntervallo);
      return;
    }

    scaricaTemplateAllenamenti(dataDal, dataAl);
    onClose();
  }

  return (
    <div className="fixed inset-0 z-[10000] flex items-center justify-center bg-black/80 p-4 backdrop-blur-sm">
      <div
        className="w-full max-w-xl rounded-3xl border bg-[#090909] p-5 shadow-2xl sm:p-7"
        style={{
          borderColor: `${themeColor}55`,
          boxShadow: `0 30px 80px ${themeColor}22`,
        }}
      >
        <div className="flex items-start justify-between gap-4">
          <div className="flex gap-3">
            <div
              className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl"
              style={{ backgroundColor: `${themeColor}20`, color: themeColor }}
            >
              <FileSpreadsheet className="h-5 w-5" />
            </div>
            <div>
              <h2 className="text-xl font-black text-white sm:text-2xl">
                Scarica template Excel
              </h2>
              <p className="mt-1 text-sm leading-6 text-zinc-400">
                Scegli l’intervallo: il file sarà già predisposto per le
                sedute mattutine e serali di ogni giorno.
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="rounded-xl border border-white/10 p-2 text-zinc-400 transition hover:bg-white/5 hover:text-white"
            aria-label="Chiudi"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="mt-6 grid gap-4 sm:grid-cols-2">
          <label className="block">
            <span className="mb-2 block text-sm font-semibold text-zinc-300">
              Dal
            </span>
            <input
              type="date"
              min={settimanaInizialeTemplate()}
              value={dataDal}
              onChange={(event) => aggiornaDataDal(event.target.value)}
              className="h-12 w-full rounded-xl border border-zinc-800 bg-zinc-950 px-3 text-white outline-none focus:border-zinc-600"
            />
          </label>

          <label className="block">
            <span className="mb-2 block text-sm font-semibold text-zinc-300">
              Al
            </span>
            <input
              type="date"
              min={dataDal}
              value={dataAl}
              onChange={(event) => {
                setDataAl(event.target.value);
                setErrore(null);
              }}
              className="h-12 w-full rounded-xl border border-zinc-800 bg-zinc-950 px-3 text-white outline-none focus:border-zinc-600"
            />
          </label>
        </div>

        <div className="mt-4 flex items-center gap-3 rounded-2xl border border-zinc-800 bg-zinc-950 p-4">
          <CalendarRange className="h-5 w-5 shrink-0" style={{ color: themeColor }} />
          <div>
            <p className="text-sm font-bold text-white">
              Settimana {numeroSettimana ?? "—"}
            </p>
            <p className="mt-0.5 text-xs text-zinc-500">
              Il conteggio parte dal 17 agosto 2026, settimana 1.
            </p>
          </div>
        </div>

        <div className="mt-4 rounded-2xl border border-zinc-800 bg-zinc-950/60 p-4 text-sm text-zinc-400">
          Il workbook conterrà: <span className="text-zinc-200">Settimana</span>,{" "}
          <span className="text-zinc-200">Drill Bank</span>,{" "}
          <span className="text-zinc-200">GPS e regole</span> e{" "}
          <span className="text-zinc-200">Note per la compilazione</span>.
        </div>

        {errore && (
          <p className="mt-4 rounded-xl border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm font-medium text-red-300">
            {errore}
          </p>
        )}

        <div className="mt-6 flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
          <button
            type="button"
            onClick={onClose}
            className="rounded-xl border border-zinc-700 px-5 py-3 text-sm font-bold text-zinc-300 transition hover:bg-white/5"
          >
            Annulla
          </button>
          <button
            type="button"
            onClick={scarica}
            className="inline-flex items-center justify-center gap-2 rounded-xl px-5 py-3 text-sm font-black text-white transition hover:brightness-110"
            style={{ backgroundColor: themeColor }}
          >
            <Download className="h-4 w-4" />
            Scarica template
          </button>
        </div>
      </div>
    </div>
  );
}
