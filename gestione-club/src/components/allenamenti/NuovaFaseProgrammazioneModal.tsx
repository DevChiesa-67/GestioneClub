"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import {
  X,
  Save,
  Loader2,
  CalendarDays,
  Layers,
  FileText,
} from "lucide-react";
import { formatDataIT, parseDataIT } from "@/lib/date";

import {
  creaFaseConSettimane,
  type Intensita,
} from "@/app/(dashboard)/allenamenti/programmazione/actions";

const INTENSITA_OPTIONS: { value: Intensita; label: string }[] = [
  { value: "bassa", label: "Bassa" },
  { value: "media", label: "Media" },
  { value: "alta", label: "Alta" },
];

type Programmazione = {
  id: string;
  titolo: string;
};

type SettimanaDati = {
  focus_tecnico: string;
  intensita: string;
  rpe_target: string;
  focus_avanti: string;
  focus_trequarti: string;
};

const SETTIMANA_DATI_VUOTA: SettimanaDati = {
  focus_tecnico: "",
  intensita: "",
  rpe_target: "",
  focus_avanti: "",
  focus_trequarti: "",
};

type Props = {
  open: boolean;
  onClose: () => void;
  brand: string;
  programmazione: Programmazione | null;
};

function addDays(date: Date, days: number) {
  const next = new Date(date);
  next.setDate(next.getDate() + days);
  return next;
}

function toDateString(date: Date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");

  return `${year}-${month}-${day}`;
}

function formatPeriodoBreve(dateString: string) {
  const date = new Date(`${dateString}T12:00:00`);

  return new Intl.DateTimeFormat("it-IT", {
    day: "numeric",
    month: "short",
  })
    .format(date)
    .replace(".", "");
}

function getMonday(date: Date) {
  const day = date.getDay(); // 0 domenica, 1 lunedì
  const diff = day === 0 ? -6 : 1 - day;
  return addDays(date, diff);
}

function generaSettimanePreview(dataInizio: string, dataFine: string) {
  if (!dataInizio || !dataFine || dataFine < dataInizio) return [];

  const start = new Date(`${dataInizio}T12:00:00`);
  const end = new Date(`${dataFine}T12:00:00`);

  const settimane: {
    index: number;
    numero_settimana: number;
    data_inizio: string;
    data_fine: string;
    label: string;
  }[] = [];

  let currentStart = getMonday(start);
  let numero = 1;

  while (currentStart <= end) {
  const currentEnd = addDays(currentStart, 6);
  const safeEnd = currentEnd > end ? end : currentEnd;

  const dataInizioSettimana = toDateString(currentStart);
  const dataFineSettimana = toDateString(safeEnd);

  settimane.push({
    index: numero - 1,
    numero_settimana: numero,
    data_inizio: dataInizioSettimana,
    data_fine: dataFineSettimana,
    label: `${formatPeriodoBreve(dataInizioSettimana)} → ${formatPeriodoBreve(
      dataFineSettimana
    )}`,
  });

  currentStart = addDays(currentStart, 7);
  numero += 1;
}

  return settimane;
}

export default function NuovaFaseProgrammazioneModal({
  open,
  onClose,
  brand,
  programmazione,
}: Props) {
  const [loading, setLoading] = useState(false);
  const [errore, setErrore] = useState<string | null>(null);

  const [dataInizio, setDataInizio] = useState("");
  const [dataFine, setDataFine] = useState("");
  const [settimaneDati, setSettimaneDati] = useState<
    Record<number, SettimanaDati>
  >({});

  const settimanePreview = useMemo(() => {
    return generaSettimanePreview(dataInizio, dataFine);
  }, [dataInizio, dataFine]);

  if (!open) return null;

  function aggiornaSettimanaDati(
    settimanaIndex: number,
    field: keyof SettimanaDati,
    value: string
  ) {
    setSettimaneDati((prev) => ({
      ...prev,
      [settimanaIndex]: {
        ...(prev[settimanaIndex] ?? SETTIMANA_DATI_VUOTA),
        [field]: value,
      },
    }));
  }

  async function handleSubmit(formData: FormData) {
    if (!programmazione) {
      setErrore("Seleziona prima una programmazione.");
      return;
    }

    setLoading(true);
    setErrore(null);

    try {
      const res = await creaFaseConSettimane({
        programmazione_id: programmazione.id,
        nome: String(formData.get("nome") ?? ""),
        colore: String(formData.get("colore") ?? "") || null,
        data_inizio: String(formData.get("data_inizio") ?? ""),
        data_fine: String(formData.get("data_fine") ?? ""),
        obiettivo: String(formData.get("obiettivo") ?? "") || null,
        settimane_dettagli: settimanePreview.map((settimana) => {
          const dati = settimaneDati[settimana.index] ?? SETTIMANA_DATI_VUOTA;

          return {
            settimana_index: settimana.index,
            focus_tecnico: dati.focus_tecnico || null,
            intensita: dati.intensita ? (dati.intensita as Intensita) : null,
            rpe_target: dati.rpe_target ? Number(dati.rpe_target) : null,
            focus_avanti: dati.focus_avanti || null,
            focus_trequarti: dati.focus_trequarti || null,
          };
        }),
      });

      if (!res.success) {
        setErrore(res.message);
        return;
      }

      setSettimaneDati({});
      setDataInizio("");
      setDataFine("");
      onClose();
    } catch {
      setErrore("Errore durante la creazione del mesociclo.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/55 p-4 backdrop-blur-[2px]">
      <div className="max-h-[92vh] w-full max-w-5xl overflow-hidden rounded-3xl bg-zinc-950 shadow-2xl">
        <div
          className="flex items-center justify-between px-6 py-5 text-white"
          style={{ backgroundColor: brand }}
        >
          <div>
            <h2 className="text-lg font-bold">Nuovo mesociclo</h2>
            <p className="mt-1 text-sm text-white/75">
              Crea il mesociclo, genera le settimane e definisci subito il focus di ciascuna.
            </p>
          </div>

          <button
            type="button"
            onClick={onClose}
            disabled={loading}
            className="flex h-9 w-9 items-center justify-center rounded-xl text-white transition hover:bg-zinc-950/15 disabled:opacity-50"
          >
            <X size={20} />
          </button>
        </div>

        <form
          action={handleSubmit}
          className="max-h-[calc(92vh-84px)] space-y-5 overflow-y-auto bg-zinc-950 p-6"
        >
          <div className="rounded-2xl bg-zinc-900 px-4 py-3 text-sm text-zinc-600">
            Programmazione:{" "}
            <strong className="text-white">
              {programmazione?.titolo ?? "Nessuna selezionata"}
            </strong>
          </div>

          <div>
            <label className="mb-2 block text-sm font-semibold text-zinc-800">
              Nome mesociclo
            </label>

            <div className="relative">
              <Layers
                size={18}
                className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-zinc-400"
              />

              <input
                name="nome"
                type="text"
                required
                placeholder="Es. Preparazione atletica"
                className="block h-12 w-full rounded-2xl border border-zinc-300 bg-zinc-950 py-3 pl-11 pr-4 text-sm text-white outline-none focus:ring-2 focus:ring-zinc-200"
              />
            </div>
          </div>

          <div className="grid gap-4 md:grid-cols-3">
            <DateInput
              name="data_inizio"
              label="Data inizio mesociclo"
              value={dataInizio}
              onChange={setDataInizio}
              required
            />

            <DateInput
              name="data_fine"
              label="Data fine mesociclo"
              value={dataFine}
              onChange={setDataFine}
              required
            />
            <div>
            <label className="mb-2 block text-sm font-semibold text-zinc-800">
              Colore mesociclo
            </label>
            <input
              name="colore"
              type="color"
           
              defaultValue={brand}
              className="h-12 w-full cursor-pointer rounded-2xl border border-zinc-300 bg-zinc-950 p-1"
            /></div>
          </div>

          

          <div>
            <label className="mb-2 block text-sm font-semibold text-zinc-800">
              Obiettivo mesociclo
            </label>

            <div className="relative">
              <FileText
                size={18}
                className="pointer-events-none absolute left-4 top-4 text-zinc-400"
              />

              <textarea
                name="obiettivo"
                rows={4}
                placeholder="Obiettivi del mesociclo..."
                className="block min-h-28 w-full resize-none rounded-2xl border border-zinc-300 bg-zinc-950 py-3 pl-11 pr-4 text-sm text-white outline-none focus:ring-2 focus:ring-zinc-200"
              />
            </div>
          </div>

          {settimanePreview.length > 0 && (
            <div className="space-y-4 rounded-3xl border border-zinc-800 bg-zinc-900 p-4">
              <div>
                <h3 className="font-bold text-white">
                  Slot settimanali generati
                </h3>
                <p className="text-sm text-zinc-400">
                  Definisci il focus tecnico, l&apos;intensità e il lavoro di reparto per ogni settimana.
                </p>
              </div>

              {settimanePreview.map((settimana) => {
                const dati = settimaneDati[settimana.index] ?? SETTIMANA_DATI_VUOTA;

                return (
                  <div
                    key={settimana.index}
                    className="overflow-hidden rounded-3xl border border-zinc-800 bg-zinc-950"
                  >
                    <div className="border-b border-zinc-800 bg-zinc-900 px-5 py-4">
                      <h4 className="font-bold text-white">
                        Settimana {settimana.numero_settimana}
                      </h4>
                      <p className="text-sm text-zinc-400">
                        {settimana.label}
                      </p>
                    </div>

                    <div className="space-y-5 p-5">
                      {/* RIGA 1: FOCUS TECNICO */}
                      <div>
                        <label className="mb-2 block text-xs font-bold uppercase tracking-wide text-zinc-400">
                          Focus tecnico
                        </label>

                        <textarea
                          rows={3}
                          placeholder="Es. Difesa, possesso, transizione..."
                          value={dati.focus_tecnico}
                          onChange={(e) =>
                            aggiornaSettimanaDati(
                              settimana.index,
                              "focus_tecnico",
                              e.target.value
                            )
                          }
                          className="w-full resize-y rounded-2xl border border-zinc-300 bg-zinc-950 px-4 py-3 text-sm text-white outline-none transition focus:ring-2 focus:ring-zinc-200"
                        />
                      </div>

                      {/* RIGA 2: INTENSITÀ + RPE TARGET */}
                      <div className="grid gap-4 md:grid-cols-2">
                        <div>
                          <label className="mb-2 block text-xs font-bold uppercase tracking-wide text-zinc-400">
                            Intensità
                          </label>

                          <select
                            value={dati.intensita}
                            onChange={(e) =>
                              aggiornaSettimanaDati(
                                settimana.index,
                                "intensita",
                                e.target.value
                              )
                            }
                            className="h-12 w-full rounded-2xl border border-zinc-300 bg-zinc-950 px-4 text-sm text-white outline-none transition focus:ring-2 focus:ring-zinc-200"
                          >
                            <option value="">Seleziona</option>

                            {INTENSITA_OPTIONS.map((option) => (
                              <option key={option.value} value={option.value}>
                                {option.label}
                              </option>
                            ))}
                          </select>
                        </div>

                        <div>
                          <label className="mb-2 block text-xs font-bold uppercase tracking-wide text-zinc-400">
                            RPE target/seduta
                          </label>

                          <input
                            type="number"
                            min={0}
                            max={10}
                            placeholder="Es. 7"
                            value={dati.rpe_target}
                            onChange={(e) =>
                              aggiornaSettimanaDati(
                                settimana.index,
                                "rpe_target",
                                e.target.value
                              )
                            }
                            className="h-12 w-full rounded-2xl border border-zinc-300 bg-zinc-950 px-4 text-sm text-white outline-none transition focus:ring-2 focus:ring-zinc-200"
                          />
                        </div>
                      </div>

                      {/* RIGA 3: REPARTO SPECIALISTICO AVANTI / TREQUARTI */}
                      <div className="grid gap-4 md:grid-cols-2">
                        <div>
                          <label className="mb-2 block text-xs font-bold uppercase tracking-wide text-zinc-400">
                            Reparto specialistico — Avanti
                          </label>

                          <textarea
                            rows={3}
                            placeholder="Es. Mischia chiusa, touche..."
                            value={dati.focus_avanti}
                            onChange={(e) =>
                              aggiornaSettimanaDati(
                                settimana.index,
                                "focus_avanti",
                                e.target.value
                              )
                            }
                            className="w-full resize-y rounded-2xl border border-zinc-300 bg-zinc-950 px-4 py-3 text-sm text-white outline-none transition focus:ring-2 focus:ring-zinc-200"
                          />
                        </div>

                        <div>
                          <label className="mb-2 block text-xs font-bold uppercase tracking-wide text-zinc-400">
                            Reparto specialistico — Trequarti
                          </label>

                          <textarea
                            rows={3}
                            placeholder="Es. Attacco a due fasce, difesa scivolata..."
                            value={dati.focus_trequarti}
                            onChange={(e) =>
                              aggiornaSettimanaDati(
                                settimana.index,
                                "focus_trequarti",
                                e.target.value
                              )
                            }
                            className="w-full resize-y rounded-2xl border border-zinc-300 bg-zinc-950 px-4 py-3 text-sm text-white outline-none transition focus:ring-2 focus:ring-zinc-200"
                          />
                        </div>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}

          {errore && (
            <div className="rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm font-medium text-red-700">
              {errore}
            </div>
          )}

          <div className="flex items-center justify-end gap-3 border-t border-zinc-800 pt-5">
            <button
              type="button"
              onClick={onClose}
              disabled={loading}
              className="rounded-2xl border border-zinc-300 bg-zinc-950 px-5 py-2.5 text-sm font-semibold text-zinc-700"
            >
              Annulla
            </button>

            <button
              type="submit"
              disabled={loading || !programmazione}
              className="inline-flex items-center justify-center gap-2 rounded-2xl px-5 py-2.5 text-sm font-semibold text-white disabled:opacity-60"
              style={{ backgroundColor: brand }}
            >
              {loading ? (
                <Loader2 size={17} className="animate-spin" />
              ) : (
                <Save size={17} />
              )}
              {loading ? "Creazione..." : "Crea mesociclo e settimane"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

function DateInput({
  name,
  label,
  value,
  onChange,
  min,
  max,
  required = false,
}: {
  name: string;
  label: string;
  value: string;
  onChange: (value: string) => void;
  min?: string;
  max?: string;
  required?: boolean;
}) {
  const nativeRef = useRef<HTMLInputElement>(null);

  const [testo, setTesto] = useState(() => {
    const formattata = formatDataIT(value);
    return formattata === "-" ? "" : formattata;
  });

  useEffect(() => {
    const formattata = formatDataIT(value);
    setTesto(formattata === "-" ? "" : formattata);
  }, [value]);

  function handleTextChange(raw: string) {
    const cifre = raw.replace(/\D/g, "").slice(0, 8);
    let formattato = cifre;

    if (cifre.length > 4) {
      formattato = `${cifre.slice(0, 2)}/${cifre.slice(2, 4)}/${cifre.slice(4)}`;
    } else if (cifre.length > 2) {
      formattato = `${cifre.slice(0, 2)}/${cifre.slice(2)}`;
    }

    setTesto(formattato);

    if (formattato === "") {
      onChange("");
      return;
    }

    const iso = parseDataIT(formattato);

    if (iso) {
      onChange(iso);
    }
  }

  function openPicker() {
    const input = nativeRef.current;
    if (!input) return;

    if (typeof input.showPicker === "function") {
      try {
        input.showPicker();
        return;
      } catch {
        // fallback sotto
      }
    }

    input.focus();
    input.click();
  }

  return (
    <div>
      <label className="mb-2 block text-sm font-semibold text-zinc-800">
        {label}
      </label>

      <div className="relative">
        <button
          type="button"
          tabIndex={-1}
          onClick={openPicker}
          aria-label="Apri calendario"
          className="absolute left-4 top-1/2 z-10 -translate-y-1/2 text-zinc-400 transition hover:text-white"
        >
          <CalendarDays size={18} />
        </button>

        <input
          type="text"
          inputMode="numeric"
          placeholder="GG/MM/AAAA"
          maxLength={10}
          value={testo}
          onChange={(e) => handleTextChange(e.target.value)}
          className="block h-12 w-full rounded-2xl border border-zinc-300 bg-zinc-950 py-3 pl-11 pr-4 text-sm text-white outline-none focus:ring-2 focus:ring-zinc-200"
        />

        <input
          ref={nativeRef}
          name={name}
          type="date"
          tabIndex={-1}
          required={required}
          min={min}
          max={max}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          className="pointer-events-none absolute inset-0 h-0 w-0 opacity-0"
          aria-hidden="true"
        />
      </div>
    </div>
  );
}