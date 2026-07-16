"use client";

import { useMemo, useState } from "react";
import {
  X,
  Save,
  Loader2,
  CalendarDays,
  Layers,
  FileText,
  Plus,
  Trash2,
} from "lucide-react";

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

type SedutaDraft = {
  id: string;
  settimana_index: number;
  data_seduta: string;
  tipo_sessione: string;
  tema: string;
  durata_min: string;
  volume_min: string;
  intensita: string;
  note: string;
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
  const [sedute, setSedute] = useState<SedutaDraft[]>([]);

  const settimanePreview = useMemo(() => {
    return generaSettimanePreview(dataInizio, dataFine);
  }, [dataInizio, dataFine]);

  if (!open) return null;

  function aggiungiSeduta(settimanaIndex: number) {
  setSedute((prev) => [
    ...prev,
    {
      id: crypto.randomUUID(),
      settimana_index: settimanaIndex,
      data_seduta: "",
      tipo_sessione: "",
      tema: "",
      durata_min: "",
      volume_min: "",
      intensita: "",
      note: "",
    },
  ]);
}

  function aggiornaSeduta(
    id: string,
    field: keyof Omit<SedutaDraft, "id" | "settimana_index">,
    value: string
  ) {
    setSedute((prev) =>
      prev.map((seduta) =>
        seduta.id === id ? { ...seduta, [field]: value } : seduta
      )
    );
  }

  function eliminaSeduta(id: string) {
    setSedute((prev) => prev.filter((seduta) => seduta.id !== id));
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
        sedute: sedute.map((seduta) => ({
          settimana_index: seduta.settimana_index,
          data_seduta: seduta.data_seduta || null,
          tipo_sessione: seduta.tipo_sessione || null,
          tema: seduta.tema || null,
          durata_min: Number(seduta.durata_min) || null,
          volume_min: Number(seduta.volume_min) || null,
          intensita: seduta.intensita
            ? (seduta.intensita as Intensita)
            : null,
          note: seduta.note || null,
        })),
      });

      if (!res.success) {
        setErrore(res.message);
        return;
      }

      setSedute([]);
      setDataInizio("");
      setDataFine("");
      onClose();
    } catch {
      setErrore("Errore durante la creazione della fase.");
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
            <h2 className="text-lg font-bold">Nuova fase</h2>
            <p className="mt-1 text-sm text-white/75">
              Crea la fase, genera le settimane e programma subito le sedute.
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
              Nome fase
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
              label="Data inizio fase"
              value={dataInizio}
              onChange={setDataInizio}
            />

            <DateInput
              name="data_fine"
              label="Data fine fase"
              value={dataFine}
              onChange={setDataFine}
            />
            <div>
            <label className="mb-2 block text-sm font-semibold text-zinc-800">
              Colore fase
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
              Obiettivo fase
            </label>

            <div className="relative">
              <FileText
                size={18}
                className="pointer-events-none absolute left-4 top-4 text-zinc-400"
              />

              <textarea
                name="obiettivo"
                rows={4}
                placeholder="Obiettivi della fase..."
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
                  Inserisci qui le sedute previste per ogni settimana.
                </p>
              </div>

              {settimanePreview.map((settimana) => {
                const seduteSettimana = sedute.filter(
                  (seduta) => seduta.settimana_index === settimana.index
                );

                return (
                  <div
                    key={settimana.index}
                    className="rounded-3xl border border-zinc-800 bg-zinc-950 p-4"
                  >
                    <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
                      <div>
                        <h4 className="font-bold text-white">
                          Settimana {settimana.numero_settimana}
                        </h4>
                        <p className="text-sm text-zinc-400">
                          {settimana.label}
                        </p>
                      </div>

                      <button
                        type="button"
                        onClick={() => aggiungiSeduta(settimana.index)}
                        className="inline-flex items-center justify-center gap-2 rounded-2xl px-4 py-2 text-sm font-semibold text-white"
                        style={{ backgroundColor: brand }}
                      >
                        <Plus size={16} />
                        Aggiungi seduta
                      </button>
                    </div>

                    <div className="mt-4 space-y-3">
                      {seduteSettimana.length === 0 ? (
                        <div className="rounded-2xl border border-dashed border-zinc-800 bg-zinc-900 p-4 text-sm text-zinc-400">
                          Nessuna seduta programmata per questa settimana.
                        </div>
                      ) : (
                        seduteSettimana.map((seduta) => {
  return (
    <div
      key={seduta.id}
      className="overflow-hidden rounded-3xl border border-zinc-800 bg-zinc-950"
    >
      {/* HEADER SEDUTA */}
      <div className="flex flex-col gap-4 border-b border-zinc-800 bg-zinc-900 px-5 py-4 md:flex-row md:items-end md:justify-between">
        <div>
          <p className="text-xs font-bold uppercase tracking-[0.16em] text-zinc-400">
            Seduta
          </p>

          <h5 className="mt-1 text-base font-bold text-white">
            Seduta programmata
          </h5>
        </div>

        <div className="flex items-end gap-2">
          <div className="min-w-44">
  <label className="mb-1.5 block text-xs font-semibold text-zinc-500">
    Data seduta
  </label>

  <input
    type="date"
    min={settimana.data_inizio}
    max={settimana.data_fine}
    value={seduta.data_seduta}
    onChange={(e) =>
      aggiornaSeduta(seduta.id, "data_seduta", e.target.value)
    }
    className="h-11 w-full rounded-2xl border border-zinc-300 bg-white px-4 text-sm text-zinc-900 outline-none transition focus:ring-2 focus:ring-zinc-200"
  />
</div>

          <div className="w-32">
  <label className="mb-1.5 block text-xs font-semibold text-zinc-500">
    Durata (min)
  </label>

  <input
    type="number"
    min={0}
    placeholder="90"
    value={seduta.durata_min}
    onChange={(e) =>
      aggiornaSeduta(seduta.id, "durata_min", e.target.value)
    }
    className="h-11 w-full rounded-2xl border border-zinc-300 bg-white px-4 text-sm text-zinc-900 outline-none transition focus:ring-2 focus:ring-zinc-200"
  />
</div>

          <button
            type="button"
            onClick={() => eliminaSeduta(seduta.id)}
            className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl border border-red-200 bg-red-50 text-red-600 transition hover:bg-red-100"
            title="Elimina seduta"
          >
            <Trash2 size={17} />
          </button>
        </div>
      </div>

      <div className="space-y-5 p-5">
        {/* RIGA 1 */}
        <div className="grid gap-4 md:grid-cols-2">
          {/* TIPO STRUTTURA */}
          <div>
            <label className="mb-2 block text-xs font-bold uppercase tracking-wide text-zinc-400">
              Tipo della struttura
            </label>

            <input
              type="text"
              placeholder="Es. Tecnica, tattica, atletica..."
              value={seduta.tipo_sessione}
              onChange={(e) =>
                aggiornaSeduta(
                  seduta.id,
                  "tipo_sessione",
                  e.target.value
                )
              }
              className="h-12 w-full rounded-2xl border border-zinc-300 bg-zinc-950 px-4 text-sm text-white outline-none transition focus:ring-2 focus:ring-zinc-200"
            />
          </div>

          {/* TEMA */}
          <div>
            <label className="mb-2 block text-xs font-bold uppercase tracking-wide text-zinc-400">
              Tema tecnico / tattico
            </label>

            <input
              type="text"
              placeholder="Es. Difesa, possesso, transizione..."
              value={seduta.tema}
              onChange={(e) =>
                aggiornaSeduta(
                  seduta.id,
                  "tema",
                  e.target.value
                )
              }
              className="h-12 w-full rounded-2xl border border-zinc-300 bg-zinc-950 px-4 text-sm text-white outline-none transition focus:ring-2 focus:ring-zinc-200"
            />
          </div>
        </div>

        {/* RIGA 2 */}
        <div className="grid gap-4 md:grid-cols-2">
          {/* VOLUME */}
          <div>
            <label className="mb-2 block text-xs font-bold uppercase tracking-wide text-zinc-400">
              Volume
              <span className="ml-1 normal-case font-medium text-zinc-400">
                (min lavoro)
              </span>
            </label>

            <div className="relative">
              <input
                type="number"
                min={0}
                placeholder="60"
                value={seduta.volume_min}
                onChange={(e) =>
                  aggiornaSeduta(
                    seduta.id,
                    "volume_min",
                    e.target.value
                  )
                }
                className="h-12 w-full rounded-2xl border border-zinc-300 bg-zinc-950 px-4 pr-14 text-sm text-white outline-none transition focus:ring-2 focus:ring-zinc-200"
              />

              <span className="pointer-events-none absolute right-4 top-1/2 -translate-y-1/2 text-xs font-semibold text-zinc-400">
                min
              </span>
            </div>
          </div>

          {/* INTENSITÀ */}
          <div>
            <label className="mb-2 block text-xs font-bold uppercase tracking-wide text-zinc-400">
              Intensità
            </label>

            <select
              value={seduta.intensita}
              onChange={(e) =>
                aggiornaSeduta(seduta.id, "intensita", e.target.value)
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
        </div>

        {/* NOTE */}
        <div>
          <label className="mb-2 block text-xs font-bold uppercase tracking-wide text-zinc-400">
            Note
          </label>

          <textarea
            rows={3}
            placeholder="Inserisci note sulla seduta..."
            value={seduta.note}
            onChange={(e) =>
              aggiornaSeduta(
                seduta.id,
                "note",
                e.target.value
              )
            }
            className="w-full resize-none rounded-2xl border border-zinc-300 bg-zinc-950 px-4 py-3 text-sm text-white outline-none transition focus:ring-2 focus:ring-zinc-200"
          />
        </div>
      </div>
    </div>
  );
})
                      )}
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
              {loading ? "Creazione..." : "Crea fase, settimane e sedute"}
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
}: {
  name: string;
  label: string;
  value: string;
  onChange: (value: string) => void;
}) {
  return (
    <div>
      <label className="mb-2 block text-sm font-semibold text-zinc-800">
        {label}
      </label>

      <div className="relative">
        <CalendarDays
          size={18}
          className="pointer-events-none absolute left-4 top-1/2 z-10 -translate-y-1/2 text-zinc-400"
        />

        <input
          name={name}
          type="date"
          required
          value={value}
          onChange={(e) => onChange(e.target.value)}
          className="block h-12 w-full rounded-2xl border border-zinc-300 bg-zinc-950 py-3 pl-11 pr-4 text-sm text-white outline-none focus:ring-2 focus:ring-zinc-200"
        />
      </div>
    </div>
  );
}