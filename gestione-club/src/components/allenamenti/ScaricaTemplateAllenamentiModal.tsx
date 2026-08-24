"use client";

import { useMemo, useState } from "react";
import {
  CalendarRange,
  Download,
  Dumbbell,
  FileSpreadsheet,
  Plus,
  X,
} from "lucide-react";

import {
  calcolaNumeroSettimana,
  intervalloTemplateValido,
  scaricaTemplateAllenamenti,
  settimanaInizialeTemplate,
} from "@/lib/template-allenamento-excel";
import {
  etichettaBlocco,
  opzioniPalestraValide,
  scaricaTemplatePalestra,
} from "@/lib/template-palestra-excel";

type Props = {
  onClose: () => void;
  themeColor: string;
};

type TipoTemplate = "allenamento" | "palestra";

/** Gruppi di partenza: la suddivisione per ruolo usata in palestra. */
const GRUPPI_PREDEFINITI = [
  "props",
  "locks-back row",
  "backs",
  "core and wellness",
];

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

  const [tipo, setTipo] = useState<TipoTemplate>("allenamento");

  const [dataDal, setDataDal] = useState(dataIniziale);
  const [dataAl, setDataAl] = useState(aggiungiGiorni(dataIniziale, 6));
  const [errore, setErrore] = useState<string | null>(null);

  const [gruppi, setGruppi] = useState<string[]>(GRUPPI_PREDEFINITI);
  const [nuovoGruppo, setNuovoGruppo] = useState("");
  const [cicloDal, setCicloDal] = useState(dataIniziale);
  const [cicloAl, setCicloAl] = useState(aggiungiGiorni(dataIniziale, 27));
  const [giorniLavoro, setGiorniLavoro] = useState(3);

  const numeroSettimana = useMemo(
    () => (dataDal ? calcolaNumeroSettimana(dataDal) : null),
    [dataDal]
  );

  const anteprimaBlocchi = useMemo(
    () =>
      Array.from({ length: Math.max(0, Math.min(giorniLavoro, 14)) }, (_, i) =>
        etichettaBlocco(i)
      ),
    [giorniLavoro]
  );

  function aggiornaDataDal(valore: string) {
    setDataDal(valore);
    setDataAl(aggiungiGiorni(valore, 6));
    setErrore(null);
  }

  function aggiungiGruppo() {
    const nome = nuovoGruppo.trim();
    if (!nome) return;

    if (gruppi.some((g) => g.toLowerCase() === nome.toLowerCase())) {
      setErrore(`Il gruppo "${nome}" è già presente.`);
      return;
    }

    setGruppi((prev) => [...prev, nome]);
    setNuovoGruppo("");
    setErrore(null);
  }

  function rimuoviGruppo(nome: string) {
    setGruppi((prev) => prev.filter((g) => g !== nome));
    setErrore(null);
  }

  function scarica() {
    if (tipo === "allenamento") {
      const erroreIntervallo = intervalloTemplateValido(dataDal, dataAl);
      if (erroreIntervallo) {
        setErrore(erroreIntervallo);
        return;
      }

      scaricaTemplateAllenamenti(dataDal, dataAl);
      onClose();
      return;
    }

    const opzioni = {
      gruppi,
      cicloDal,
      cicloAl,
      numeroBlocchi: giorniLavoro,
    };

    const erroreOpzioni = opzioniPalestraValide(opzioni);
    if (erroreOpzioni) {
      setErrore(erroreOpzioni);
      return;
    }

    scaricaTemplatePalestra(opzioni);
    onClose();
  }

  return (
    <div className="fixed inset-0 z-[10000] flex items-center justify-center overflow-y-auto bg-black/80 p-4 backdrop-blur-sm">
      <div
        className="my-auto w-full max-w-xl rounded-3xl border bg-[#090909] p-5 shadow-2xl sm:p-7"
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
                Scegli che tipo di seduta vuoi programmare: il file sarà già
                predisposto per l&apos;importazione.
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

        {/* SCELTA DEL TIPO */}
        <div className="mt-6 grid gap-3 sm:grid-cols-2">
          {(
            [
              {
                valore: "allenamento" as const,
                icona: CalendarRange,
                titolo: "Allenamento",
                testo: "Sedute in campo, mattino e sera per ogni giorno.",
              },
              {
                valore: "palestra" as const,
                icona: Dumbbell,
                titolo: "Palestra",
                testo: "Un foglio per gruppo, con serie, rep, RPE e carico.",
              },
            ]
          ).map((opzione) => {
            const attivo = tipo === opzione.valore;
            const Icona = opzione.icona;

            return (
              <button
                key={opzione.valore}
                type="button"
                onClick={() => {
                  setTipo(opzione.valore);
                  setErrore(null);
                }}
                className="rounded-2xl border p-4 text-left transition"
                style={{
                  borderColor: attivo ? themeColor : "#27272a",
                  backgroundColor: attivo ? `${themeColor}18` : "transparent",
                }}
              >
                <Icona
                  className="h-5 w-5"
                  style={{ color: attivo ? themeColor : "#a1a1aa" }}
                />

                <p className="mt-2 font-black text-white">{opzione.titolo}</p>

                <p className="mt-1 text-xs leading-5 text-zinc-400">
                  {opzione.testo}
                </p>
              </button>
            );
          })}
        </div>

        {tipo === "allenamento" ? (
          <>
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
              <CalendarRange
                className="h-5 w-5 shrink-0"
                style={{ color: themeColor }}
              />
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
              Il workbook conterrà:{" "}
              <span className="text-zinc-200">Settimana</span>,{" "}
              <span className="text-zinc-200">Drill Bank</span>,{" "}
              <span className="text-zinc-200">GPS e regole</span> e{" "}
              <span className="text-zinc-200">Note per la compilazione</span>.
            </div>
          </>
        ) : (
          <>
            <div className="mt-6">
              <span className="mb-2 block text-sm font-semibold text-zinc-300">
                Gruppi (un foglio per gruppo)
              </span>

              <div className="flex flex-wrap gap-2">
                {gruppi.map((gruppo) => (
                  <span
                    key={gruppo}
                    className="inline-flex max-w-full items-center gap-2 rounded-full border border-zinc-700 px-3 py-1.5 text-xs font-semibold text-zinc-200"
                  >
                    <span className="truncate">{gruppo}</span>

                    <button
                      type="button"
                      onClick={() => rimuoviGruppo(gruppo)}
                      className="shrink-0 text-zinc-500 transition hover:text-white"
                      aria-label={`Rimuovi ${gruppo}`}
                    >
                      <X className="h-3.5 w-3.5" />
                    </button>
                  </span>
                ))}

                {gruppi.length === 0 && (
                  <span className="text-xs text-zinc-500">
                    Nessun gruppo: aggiungine almeno uno.
                  </span>
                )}
              </div>

              <div className="mt-3 flex gap-2">
                <input
                  value={nuovoGruppo}
                  onChange={(event) => setNuovoGruppo(event.target.value)}
                  onKeyDown={(event) => {
                    if (event.key === "Enter") {
                      event.preventDefault();
                      aggiungiGruppo();
                    }
                  }}
                  placeholder="Es. prima linea"
                  className="h-12 min-w-0 flex-1 rounded-xl border border-zinc-800 bg-zinc-950 px-3 text-white outline-none focus:border-zinc-600"
                />

                <button
                  type="button"
                  onClick={aggiungiGruppo}
                  className="inline-flex h-12 shrink-0 items-center gap-2 rounded-xl border border-zinc-700 px-4 text-sm font-bold text-zinc-200 transition hover:bg-white/5"
                >
                  <Plus className="h-4 w-4" />
                  Aggiungi
                </button>
              </div>
            </div>

            <div className="mt-4 grid gap-4 sm:grid-cols-2">
              <label className="block">
                <span className="mb-2 block text-sm font-semibold text-zinc-300">
                  Il ciclo inizia il
                </span>
                <input
                  type="date"
                  value={cicloDal}
                  onChange={(event) => {
                    setCicloDal(event.target.value);
                    setErrore(null);
                  }}
                  className="h-12 w-full rounded-xl border border-zinc-800 bg-zinc-950 px-3 text-white outline-none focus:border-zinc-600"
                />
              </label>

              <label className="block">
                <span className="mb-2 block text-sm font-semibold text-zinc-300">
                  e finisce il
                </span>
                <input
                  type="date"
                  min={cicloDal}
                  value={cicloAl}
                  onChange={(event) => {
                    setCicloAl(event.target.value);
                    setErrore(null);
                  }}
                  className="h-12 w-full rounded-xl border border-zinc-800 bg-zinc-950 px-3 text-white outline-none focus:border-zinc-600"
                />
              </label>
            </div>

            <label className="mt-4 block">
              <span className="mb-2 block text-sm font-semibold text-zinc-300">
                Giorni di lavoro nel ciclo
              </span>
              <input
                type="number"
                min={1}
                max={14}
                value={giorniLavoro}
                onChange={(event) => {
                  setGiorniLavoro(Number(event.target.value));
                  setErrore(null);
                }}
                className="h-12 w-full rounded-xl border border-zinc-800 bg-zinc-950 px-3 text-white outline-none focus:border-zinc-600"
              />
            </label>

            <div className="mt-4 rounded-2xl border border-zinc-800 bg-zinc-950/60 p-4 text-sm leading-6 text-zinc-400">
              Ogni foglio avrà i blocchi{" "}
              <span className="text-zinc-200">
                {anteprimaBlocchi.join(", ") || "—"}
              </span>{" "}
              con le colonne esercizio, serie, rep, rpe, carico, recupero e
              note. Le date delle singole sedute si indicano al momento
              dell&apos;importazione.
            </div>
          </>
        )}

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
