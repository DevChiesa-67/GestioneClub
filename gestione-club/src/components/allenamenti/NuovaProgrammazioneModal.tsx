"use client";

import { useState } from "react";
import {
  X,
  Save,
  Loader2,
  CalendarDays,
  Trophy,
  FileText,
} from "lucide-react";

import { creaProgrammazione } from "@/app/(dashboard)/allenamenti/programmazione/actions";

type Props = {
  open: boolean;
  onClose: () => void;
  brand: string;
};

export default function NuovaProgrammazioneModal({
  open,
  onClose,
  brand,
}: Props) {
  const [loading, setLoading] = useState(false);
  const [errore, setErrore] = useState<string | null>(null);

  if (!open) return null;

  async function handleSubmit(formData: FormData) {
    setLoading(true);
    setErrore(null);

    try {
      const res = await creaProgrammazione(formData);

      if (!res.success) {
        setErrore(res.message);
        return;
      }

      onClose();
    } catch {
      setErrore("Errore durante la creazione della programmazione.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/55 p-4 backdrop-blur-[2px]">
      <div className="w-full max-w-2xl overflow-hidden rounded-3xl bg-white shadow-2xl">
        <div
          className="flex items-center justify-between px-6 py-5 text-white"
          style={{ backgroundColor: brand }}
        >
          <div>
            <h2 className="text-lg font-bold">Nuova programmazione</h2>
            <p className="mt-1 text-sm text-white/75">
              Crea il macrociclo generale. Le fasi verranno aggiunte dopo.
            </p>
          </div>

          <button
            type="button"
            onClick={onClose}
            disabled={loading}
            className="flex h-9 w-9 items-center justify-center rounded-xl text-white transition hover:bg-white/15 disabled:opacity-50"
            aria-label="Chiudi"
          >
            <X size={20} />
          </button>
        </div>

        <form action={handleSubmit} className="space-y-5 bg-white p-6">
          <div>
            <label
              htmlFor="titolo"
              className="mb-2 block text-sm font-semibold text-zinc-800"
            >
              Titolo programmazione
            </label>

            <div className="relative">
              <Trophy
                size={18}
                className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-zinc-400"
              />

              <input
                id="titolo"
                name="titolo"
                type="text"
                required
                autoComplete="off"
                placeholder="Es. Pre-Season U18 2026-27"
                className="block h-12 w-full rounded-2xl border border-zinc-300 bg-white py-3 pl-11 pr-4 text-sm text-zinc-900 placeholder:text-zinc-400 outline-none transition focus:border-zinc-500 focus:ring-2 focus:ring-zinc-200"
              />
            </div>
          </div>

          <div>
            <label
              htmlFor="stagione"
              className="mb-2 block text-sm font-semibold text-zinc-800"
            >
              Stagione
            </label>

            <input
              id="stagione"
              name="stagione"
              type="text"
              autoComplete="off"
              placeholder="Es. 2026-27"
              className="block h-12 w-full rounded-2xl border border-zinc-300 bg-white px-4 py-3 text-sm text-zinc-900 placeholder:text-zinc-400 outline-none transition focus:border-zinc-500 focus:ring-2 focus:ring-zinc-200"
            />
          </div>

          <div className="grid gap-4 md:grid-cols-2">
            <DateInput
              id="data_inizio"
              name="data_inizio"
              label="Data inizio macrociclo"
            />

            <DateInput
              id="data_fine"
              name="data_fine"
              label="Data fine macrociclo"
            />
          </div>

          <div>
            <label
              htmlFor="descrizione"
              className="mb-2 block text-sm font-semibold text-zinc-800"
            >
              Descrizione
            </label>

            <div className="relative">
              <FileText
                size={18}
                className="pointer-events-none absolute left-4 top-4 text-zinc-400"
              />

              <textarea
                id="descrizione"
                name="descrizione"
                rows={4}
                placeholder="Obiettivi generali, note metodologiche, gestione dei carichi..."
                className="block min-h-28 w-full resize-none rounded-2xl border border-zinc-300 bg-white py-3 pl-11 pr-4 text-sm text-zinc-900 placeholder:text-zinc-400 outline-none transition focus:border-zinc-500 focus:ring-2 focus:ring-zinc-200"
              />
            </div>
          </div>

          {errore && (
            <div className="rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm font-medium text-red-700">
              {errore}
            </div>
          )}

          <div className="flex items-center justify-end gap-3 border-t border-zinc-200 pt-5">
            <button
              type="button"
              onClick={onClose}
              disabled={loading}
              className="rounded-2xl border border-zinc-300 bg-white px-5 py-2.5 text-sm font-semibold text-zinc-700 transition hover:bg-zinc-50 disabled:cursor-not-allowed disabled:opacity-50"
            >
              Annulla
            </button>

            <button
              type="submit"
              disabled={loading}
              className="inline-flex items-center justify-center gap-2 rounded-2xl px-5 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-60"
              style={{ backgroundColor: brand }}
            >
              {loading ? (
                <Loader2 size={17} className="animate-spin" />
              ) : (
                <Save size={17} />
              )}

              {loading ? "Creazione..." : "Crea programmazione"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

function DateInput({
  id,
  name,
  label,
}: {
  id: string;
  name: string;
  label: string;
}) {
  return (
    <div>
      <label
        htmlFor={id}
        className="mb-2 block text-sm font-semibold text-zinc-800"
      >
        {label}
      </label>

      <div className="relative">
        <CalendarDays
          size={18}
          className="pointer-events-none absolute left-4 top-1/2 z-10 -translate-y-1/2 text-zinc-400"
        />

        <input
          id={id}
          name={name}
          type="date"
          required
          className="block h-12 w-full rounded-2xl border border-zinc-300 bg-white py-3 pl-11 pr-4 text-sm text-zinc-900 outline-none transition focus:border-zinc-500 focus:ring-2 focus:ring-zinc-200"
        />
      </div>
    </div>
  );
}