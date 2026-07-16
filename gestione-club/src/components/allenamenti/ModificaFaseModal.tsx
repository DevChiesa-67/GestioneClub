"use client";

import { useState } from "react";
import { X, Save, Loader2, Layers, FileText } from "lucide-react";

import { modificaFase } from "@/app/(dashboard)/allenamenti/programmazione/actions";

type Fase = {
  id: string;
  nome: string;
  colore: string | null;
  obiettivo: string | null;
};

type Props = {
  open: boolean;
  onClose: () => void;
  brand: string;
  fase: Fase | null;
};

export default function ModificaFaseModal({
  open,
  onClose,
  brand,
  fase,
}: Props) {
  const [loading, setLoading] = useState(false);
  const [errore, setErrore] = useState<string | null>(null);

  if (!open || !fase) return null;

  async function handleSubmit(formData: FormData) {
    if (!fase) return;

    setLoading(true);
    setErrore(null);

    try {
      const res = await modificaFase({
        fase_id: fase.id,
        nome: String(formData.get("nome") ?? ""),
        colore: String(formData.get("colore") ?? "") || null,
        obiettivo: String(formData.get("obiettivo") ?? "") || null,
      });

      if (!res.success) {
        setErrore(res.message);
        return;
      }

      onClose();
    } catch {
      setErrore("Errore durante l'aggiornamento della fase.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/55 p-4 backdrop-blur-[2px]">
      <div className="w-full max-w-xl overflow-hidden rounded-3xl bg-zinc-950 shadow-2xl">
        <div
          className="flex items-center justify-between px-6 py-5 text-white"
          style={{ backgroundColor: brand }}
        >
          <div>
            <h2 className="text-lg font-bold">Modifica fase</h2>
            <p className="mt-1 text-sm text-white/75">
              Aggiorna nome, colore e obiettivo della fase.
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
          <div>
            <label className="mb-2 block text-sm font-semibold text-zinc-300">
              Nome fase
            </label>

            <div className="relative">
              <Layers
                size={18}
                className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-zinc-500"
              />

              <input
                name="nome"
                type="text"
                required
                defaultValue={fase.nome}
                className="block h-12 w-full rounded-2xl border border-zinc-700 bg-zinc-900 py-3 pl-11 pr-4 text-sm text-white outline-none focus:ring-2 focus:ring-zinc-600"
              />
            </div>
          </div>

          <div>
            <label className="mb-2 block text-sm font-semibold text-zinc-300">
              Colore fase
            </label>

            <input
              name="colore"
              type="color"
              defaultValue={fase.colore ?? brand}
              className="h-12 w-full cursor-pointer rounded-2xl border border-zinc-700 bg-zinc-900 p-1"
            />
          </div>

          <div>
            <label className="mb-2 block text-sm font-semibold text-zinc-300">
              Obiettivo fase
            </label>

            <div className="relative">
              <FileText
                size={18}
                className="pointer-events-none absolute left-4 top-4 text-zinc-500"
              />

              <textarea
                name="obiettivo"
                rows={4}
                defaultValue={fase.obiettivo ?? ""}
                placeholder="Obiettivi della fase..."
                className="block min-h-28 w-full resize-none rounded-2xl border border-zinc-700 bg-zinc-900 py-3 pl-11 pr-4 text-sm text-white outline-none focus:ring-2 focus:ring-zinc-600"
              />
            </div>
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
