"use client";

import { useState, useTransition } from "react";
import { Loader2, Pencil, Trash2, X } from "lucide-react";
import { eliminaTipoTest } from "@/app/(dashboard)/test/actions";
import { etichettaUnitaTest, parseUnitaTest, unitaEffettivaTest } from "@/lib/test-unita";

export type TipoTestGestibile = {
  id: string;
  nome: string;
  tipo_test: "atletica" | "forza";
  unita_misura: string;
};

export default function GestisciTipiTestModal({
  open,
  tests,
  onClose,
  onEdit,
}: {
  open: boolean;
  tests: TipoTestGestibile[];
  onClose: () => void;
  onEdit: (test: TipoTestGestibile) => void;
}) {
  const [errore, setErrore] = useState<string | null>(null);
  const [eliminandoId, setEliminandoId] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  if (!open) return null;

  function elimina(test: TipoTestGestibile) {
    if (!window.confirm(`Eliminare definitivamente il tipo di test “${test.nome}”?`)) {
      return;
    }

    setErrore(null);
    setEliminandoId(test.id);
    startTransition(async () => {
      try {
        await eliminaTipoTest(test.id);
        window.location.reload();
      } catch (error) {
        setErrore(
          error instanceof Error ? error.message : "Errore durante l'eliminazione."
        );
        setEliminandoId(null);
      }
    });
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 px-4 backdrop-blur-sm">
      <div className="max-h-[88vh] w-full max-w-3xl overflow-hidden rounded-3xl border border-white/10 bg-[#111] shadow-2xl">
        <div className="flex items-center justify-between border-b border-white/10 px-5 py-4">
          <div>
            <h2 className="text-lg font-black text-white">Tipi di test</h2>
            <p className="mt-1 text-sm text-zinc-500">
              Configurazioni disponibili per inserimento e visualizzazione.
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="grid h-10 w-10 place-items-center rounded-xl text-zinc-400 hover:bg-white/5 hover:text-white"
            aria-label="Chiudi"
          >
            <X size={20} />
          </button>
        </div>

        <div className="max-h-[calc(88vh-80px)] space-y-3 overflow-y-auto p-5">
          {errore && (
            <p className="rounded-xl border border-red-500/30 bg-red-500/10 p-3 text-sm text-red-300">
              {errore}
            </p>
          )}

          {tests.length === 0 ? (
            <p className="py-10 text-center text-sm text-zinc-500">
              Nessun tipo di test configurato.
            </p>
          ) : (
            tests.map((test) => {
              const unita = unitaEffettivaTest(test.nome, test.unita_misura);
              const config = parseUnitaTest(unita);
              return (
                <div
                  key={test.id}
                  className="flex flex-col gap-3 rounded-2xl border border-white/10 bg-black p-4 sm:flex-row sm:items-center sm:justify-between"
                >
                  <div className="min-w-0">
                    <p className="truncate font-black text-white">{test.nome}</p>
                    <div className="mt-2 flex flex-wrap gap-2 text-xs font-bold">
                      <span className="rounded-full bg-white/5 px-2.5 py-1 capitalize text-zinc-400">
                        {config.categoria === "altro"
                          ? test.tipo_test
                          : config.categoria}
                      </span>
                      <span className="rounded-full bg-white/5 px-2.5 py-1 text-zinc-300">
                        {etichettaUnitaTest(unita)}
                      </span>
                    </div>
                  </div>

                  <div className="flex shrink-0 gap-2">
                    <button
                      type="button"
                      onClick={() => onEdit(test)}
                      className="inline-flex flex-1 items-center justify-center gap-2 rounded-xl border border-white/10 px-3 py-2 text-sm font-bold text-zinc-300 hover:bg-white/5 hover:text-white"
                    >
                      <Pencil size={15} /> Modifica
                    </button>
                    <button
                      type="button"
                      onClick={() => elimina(test)}
                      disabled={isPending}
                      className="inline-flex flex-1 items-center justify-center gap-2 rounded-xl border border-red-500/30 bg-red-500/10 px-3 py-2 text-sm font-bold text-red-300 hover:bg-red-500/20 disabled:opacity-50"
                    >
                      {eliminandoId === test.id ? (
                        <Loader2 className="animate-spin" size={15} />
                      ) : (
                        <Trash2 size={15} />
                      )}
                      Elimina
                    </button>
                  </div>
                </div>
              );
            })
          )}
        </div>
      </div>
    </div>
  );
}
