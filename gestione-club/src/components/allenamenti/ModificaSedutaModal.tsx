"use client";

import { useState } from "react";
import { X, Save, Loader2 } from "lucide-react";

import {
  modificaSeduta,
  type Intensita,
} from "@/app/(dashboard)/allenamenti/programmazione/actions";

const INTENSITA_OPTIONS: { value: Intensita; label: string }[] = [
  { value: "bassa", label: "Bassa" },
  { value: "media", label: "Media" },
  { value: "alta", label: "Alta" },
];

type Seduta = {
  id: string;
  data_seduta: string | null;
  tipo_sessione: string | null;
  tema: string | null;
  volume_min: number | null;
  durata_min: number | null;
  intensita: Intensita | null;
  note: string | null;
};

type Props = {
  open: boolean;
  onClose: () => void;
  brand: string;
  seduta: Seduta | null;
  minData?: string;
  maxData?: string;
};

export default function ModificaSedutaModal({
  open,
  onClose,
  brand,
  seduta,
  minData,
  maxData,
}: Props) {
  const [loading, setLoading] = useState(false);
  const [errore, setErrore] = useState<string | null>(null);

  if (!open || !seduta) return null;

  async function handleSubmit(formData: FormData) {
    if (!seduta) return;

    setLoading(true);
    setErrore(null);

    try {
      const intensitaValore = String(formData.get("intensita") ?? "");

      const res = await modificaSeduta({
        seduta_id: seduta.id,
        data_seduta: String(formData.get("data_seduta") ?? "") || null,
        tipo_sessione: String(formData.get("tipo_sessione") ?? "") || null,
        tema: String(formData.get("tema") ?? "") || null,
        volume_min: Number(formData.get("volume_min") ?? 0) || null,
        durata_min: Number(formData.get("durata_min") ?? 0) || null,
        intensita: intensitaValore
          ? (intensitaValore as Intensita)
          : null,
        note: String(formData.get("note") ?? "") || null,
      });

      if (!res.success) {
        setErrore(res.message);
        return;
      }

      onClose();
    } catch {
      setErrore("Errore durante l'aggiornamento della seduta.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/55 p-4 backdrop-blur-[2px]">
      <div className="w-full max-w-2xl overflow-hidden rounded-3xl bg-zinc-950 shadow-2xl">
        <div
          className="flex items-center justify-between px-6 py-5 text-white"
          style={{ backgroundColor: brand }}
        >
          <div>
            <h2 className="text-lg font-bold">Modifica seduta</h2>
            <p className="mt-1 text-sm text-white/75">
              Aggiorna i dettagli della seduta programmata.
            </p>
          </div>

          <button
            type="button"
            onClick={onClose}
            disabled={loading}
            className="flex h-9 w-9 items-center justify-center rounded-xl text-white transition hover:bg-black/15 disabled:opacity-50"
          >
            <X size={20} />
          </button>
        </div>

        <form action={handleSubmit} className="space-y-5 bg-zinc-950 p-6">
          <div className="grid gap-4 md:grid-cols-2">
            <div>
              <label className="mb-2 block text-sm font-semibold text-zinc-300">
                Data seduta
              </label>

              <input
                name="data_seduta"
                type="date"
                min={minData}
                max={maxData}
                defaultValue={seduta.data_seduta ?? ""}
                className="h-12 w-full rounded-2xl border border-zinc-700 bg-zinc-900 px-4 text-sm text-white outline-none focus:ring-2 focus:ring-zinc-600"
              />
            </div>

            <div>
              <label className="mb-2 block text-sm font-semibold text-zinc-300">
                Durata (min)
              </label>

              <input
                name="durata_min"
                type="number"
                min={0}
                defaultValue={seduta.durata_min ?? ""}
                placeholder="90"
                className="h-12 w-full rounded-2xl border border-zinc-700 bg-zinc-900 px-4 text-sm text-white outline-none focus:ring-2 focus:ring-zinc-600"
              />
            </div>
          </div>

          <div className="grid gap-4 md:grid-cols-2">
            <div>
              <label className="mb-2 block text-sm font-semibold text-zinc-300">
                Tipo sessione
              </label>

              <input
                name="tipo_sessione"
                type="text"
                defaultValue={seduta.tipo_sessione ?? ""}
                placeholder="Es. Campo, Palestra, Recupero"
                className="h-12 w-full rounded-2xl border border-zinc-700 bg-zinc-900 px-4 text-sm text-white outline-none focus:ring-2 focus:ring-zinc-600"
              />
            </div>

            <div>
              <label className="mb-2 block text-sm font-semibold text-zinc-300">
                Tema tecnico/tattico
              </label>

              <input
                name="tema"
                type="text"
                defaultValue={seduta.tema ?? ""}
                placeholder="Es. Attacco strutturato"
                className="h-12 w-full rounded-2xl border border-zinc-700 bg-zinc-900 px-4 text-sm text-white outline-none focus:ring-2 focus:ring-zinc-600"
              />
            </div>
          </div>

          <div className="grid gap-4 md:grid-cols-2">
            <div>
              <label className="mb-2 block text-sm font-semibold text-zinc-300">
                Volume lavoro (min)
              </label>

              <input
                name="volume_min"
                type="number"
                min={0}
                defaultValue={seduta.volume_min ?? ""}
                placeholder="60"
                className="h-12 w-full rounded-2xl border border-zinc-700 bg-zinc-900 px-4 text-sm text-white outline-none focus:ring-2 focus:ring-zinc-600"
              />
            </div>

            <div>
              <label className="mb-2 block text-sm font-semibold text-zinc-300">
                Intensità
              </label>

              <select
                name="intensita"
                defaultValue={seduta.intensita ?? ""}
                className="h-12 w-full rounded-2xl border border-zinc-700 bg-zinc-900 px-4 text-sm text-white outline-none focus:ring-2 focus:ring-zinc-600"
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

          <div>
            <label className="mb-2 block text-sm font-semibold text-zinc-300">
              Note allenatore
            </label>

            <textarea
              name="note"
              rows={3}
              defaultValue={seduta.note ?? ""}
              placeholder="Note sulla seduta..."
              className="w-full resize-none rounded-2xl border border-zinc-700 bg-zinc-900 px-4 py-3 text-sm text-white outline-none focus:ring-2 focus:ring-zinc-600"
            />
          </div>

          {errore && (
            <div className="rounded-2xl border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm font-medium text-red-300">
              {errore}
            </div>
          )}

          <div className="flex items-center justify-end gap-3 border-t border-zinc-800 pt-5">
            <button
              type="button"
              onClick={onClose}
              disabled={loading}
              className="rounded-2xl border border-zinc-700 bg-zinc-950 px-5 py-2.5 text-sm font-semibold text-zinc-300"
            >
              Annulla
            </button>

            <button
              type="submit"
              disabled={loading}
              className="inline-flex items-center justify-center gap-2 rounded-2xl px-5 py-2.5 text-sm font-semibold text-white disabled:opacity-60"
              style={{ backgroundColor: brand }}
            >
              {loading ? (
                <Loader2 size={17} className="animate-spin" />
              ) : (
                <Save size={17} />
              )}
              {loading ? "Salvataggio..." : "Salva modifiche"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
