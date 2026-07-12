"use client";

import { useState } from "react";
import { X, Save, Loader2 } from "lucide-react";
import { creaSedutaSettimana } from "@/app/(dashboard)/allenamenti/programmazione/actions";

type Settimana = {
  id: string;
  numero_settimana: number;
  data_inizio: string;
  data_fine: string;
  fase_nome: string;
};

type Props = {
  open: boolean;
  onClose: () => void;
  brand: string;
  settimane: Settimana[];
};

export default function NuovaSedutaProgrammazioneModal({
  open,
  onClose,
  brand,
  settimane,
}: Props) {
  const [loading, setLoading] = useState(false);
  const [errore, setErrore] = useState<string | null>(null);
  const [settimanaSelezionata, setSettimanaSelezionata] =
    useState<Settimana | null>(null);

  if (!open) return null;

  async function handleSubmit(formData: FormData) {
    setLoading(true);
    setErrore(null);

    const res = await creaSedutaSettimana({
      settimana_id: String(formData.get("settimana_id") ?? ""),
      data_seduta: String(formData.get("data_seduta") ?? "") || null,
      tipo_sessione: String(formData.get("tipo_sessione") ?? "") || null,
      tema: String(formData.get("tema") ?? "") || null,
      volume_min: Number(formData.get("volume_min") ?? 0) || null,
      rpe: Number(formData.get("rpe") ?? 0) || null,
      note: String(formData.get("note") ?? "") || null,
    });

    setLoading(false);

    if (!res.success) {
      setErrore(res.message);
      return;
    }

    onClose();
  }

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/50 p-4">
      <div className="w-full max-w-3xl overflow-hidden rounded-3xl bg-white shadow-2xl">
        <div
          className="flex items-center justify-between px-6 py-5 text-white"
          style={{ backgroundColor: brand }}
        >
          <div>
            <h2 className="text-lg font-bold">Aggiungi seduta programmata</h2>
            <p className="mt-1 text-sm text-white/75">
              Inserisci una seduta dentro uno slot settimanale.
            </p>
          </div>

          <button type="button" onClick={onClose} disabled={loading}>
            <X size={20} />
          </button>
        </div>

        <form action={handleSubmit} className="space-y-5 bg-white p-6">
          <div>
            <label className="mb-2 block text-sm font-semibold text-zinc-800">
              Settimana
            </label>

            <select
              name="settimana_id"
              required
              className="h-12 w-full rounded-2xl border border-zinc-300 bg-white px-4 text-sm text-zinc-900"
              onChange={(event) => {
                const selected = settimane.find(
                  (item) => item.id === event.target.value
                );

                setSettimanaSelezionata(selected ?? null);
              }}
            >
              <option value="">Seleziona settimana</option>

              {settimane.map((settimana) => (
                <option key={settimana.id} value={settimana.id}>
                  {settimana.fase_nome} - Settimana{" "}
                  {settimana.numero_settimana} ({settimana.data_inizio} →{" "}
                  {settimana.data_fine})
                </option>
              ))}
            </select>
          </div>

          <div>
            <Input
              label="Data seduta"
              name="data_seduta"
              type="date"
              min={settimanaSelezionata?.data_inizio}
              max={settimanaSelezionata?.data_fine}
            />

            <p className="mt-2 text-xs text-zinc-500">
              Se non inserisci una data, la seduta verrà considerata valida per
              tutta la settimana.
            </p>
          </div>

          <div className="grid gap-4 md:grid-cols-2">
            <Input
              label="Tipo sessione"
              name="tipo_sessione"
              placeholder="Es. Campo, Palestra, Rugby, Recupero"
            />

            <Input
              label="Tema tecnico/tattico"
              name="tema"
              placeholder="Es. Attacco strutturato"
            />
          </div>

          <div className="grid gap-4 md:grid-cols-2">
            <Input
              label="Volume lavoro (min)"
              name="volume_min"
              type="number"
              placeholder="60"
            />

            <Input
              label="Intensità RPE 1-10"
              name="rpe"
              type="number"
              placeholder="7"
              min="1"
              max="10"
            />
          </div>

          <div className="rounded-2xl bg-zinc-50 px-4 py-3 text-sm text-zinc-600">
            Il carico verrà calcolato automaticamente:{" "}
            <strong>Volume × RPE</strong>.
          </div>

          <div>
            <label className="mb-2 block text-sm font-semibold text-zinc-800">
              Note allenatore
            </label>

            <textarea
              name="note"
              rows={4}
              placeholder="Note sulla seduta..."
              className="w-full resize-none rounded-2xl border border-zinc-300 bg-white px-4 py-3 text-sm text-zinc-900"
            />
          </div>

          {errore && (
            <div className="rounded-2xl bg-red-50 px-4 py-3 text-sm text-red-700">
              {errore}
            </div>
          )}

          <div className="flex justify-end gap-3 border-t border-zinc-200 pt-5">
            <button
              type="button"
              onClick={onClose}
              disabled={loading}
              className="rounded-2xl border border-zinc-300 px-5 py-2.5 text-sm font-semibold text-zinc-700 disabled:opacity-50"
            >
              Annulla
            </button>

            <button
              type="submit"
              disabled={loading}
              className="inline-flex items-center gap-2 rounded-2xl px-5 py-2.5 text-sm font-semibold text-white disabled:opacity-60"
              style={{ backgroundColor: brand }}
            >
              {loading ? (
                <Loader2 size={17} className="animate-spin" />
              ) : (
                <Save size={17} />
              )}
              {loading ? "Salvataggio..." : "Aggiungi seduta"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

function Input({
  label,
  name,
  type = "text",
  placeholder,
  required,
  min,
  max,
}: {
  label: string;
  name: string;
  type?: string;
  placeholder?: string;
  required?: boolean;
  min?: string;
  max?: string;
}) {
  return (
    <div>
      <label className="mb-2 block text-sm font-semibold text-zinc-800">
        {label}
      </label>

      <input
        name={name}
        type={type}
        required={required}
        placeholder={placeholder}
        min={min}
        max={max}
        className="h-12 w-full rounded-2xl border border-zinc-300 bg-white px-4 text-sm text-zinc-900 placeholder:text-zinc-400"
      />
    </div>
  );
}