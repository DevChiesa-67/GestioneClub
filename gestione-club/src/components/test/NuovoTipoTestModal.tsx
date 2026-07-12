"use client";

import { useState, useTransition } from "react";
import { X, Loader2, Save } from "lucide-react";
import { creaTipoTest } from "@/app/(dashboard)/test/actions";

type Props = {
  open: boolean;
  onClose: () => void;
  coloreFlag: string;
};

type TipoTest = "atletica" | "forza";
type UnitaMisura = "secondi" | "kg" | "ripetizioni" | "metri" | "cm";

export default function NuovoTipoTestModal({
  open,
  onClose,
  coloreFlag,
}: Props) {
  const [nome, setNome] = useState("");
  const [tipoTest, setTipoTest] = useState<TipoTest>("atletica");
  const [unitaMisura, setUnitaMisura] = useState<UnitaMisura>("secondi");
  const [errore, setErrore] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  if (!open) return null;

  function handleSubmit() {
    setErrore(null);

    startTransition(async () => {
      try {
        await creaTipoTest({
          nome,
          tipo_test: tipoTest,
          unita_misura: unitaMisura,
        });

        setNome("");
        setTipoTest("atletica");
        setUnitaMisura("secondi");
        onClose();
        window.location.reload();
      } catch (error) {
        setErrore(
          error instanceof Error
            ? error.message
            : "Errore durante la creazione del test."
        );
      }
    });
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 px-4">
      <div className="w-full max-w-lg rounded-2xl border border-white/10 bg-[#111] shadow-2xl">
        <div className="flex items-center justify-between border-b border-white/10 px-5 py-4">
          <h2 className="text-lg font-bold text-white">Nuovo tipo di test</h2>

          <button onClick={onClose} className="text-zinc-400 hover:text-white">
            <X size={22} />
          </button>
        </div>

        <div className="space-y-5 p-5">
          <div>
            <label className="mb-2 block text-sm font-semibold text-zinc-300">
              Nome test
            </label>
            <input
              value={nome}
              onChange={(e) => setNome(e.target.value)}
              placeholder="Es. Sprint 10m-30m"
              className="w-full rounded-xl border border-white/10 bg-black px-4 py-3 text-white outline-none focus:border-white/30"
            />
          </div>

          <div>
            <label className="mb-2 block text-sm font-semibold text-zinc-300">
              Tipo test
            </label>
            <select
              value={tipoTest}
              onChange={(e) => {
                const value = e.target.value as TipoTest;
                setTipoTest(value);
                setUnitaMisura(value === "atletica" ? "secondi" : "kg");
              }}
              className="w-full rounded-xl border border-white/10 bg-black px-4 py-3 text-white outline-none focus:border-white/30"
            >
              <option value="atletica">Atletica</option>
              <option value="forza">Forza</option>
            </select>
          </div>

          <div>
            <label className="mb-2 block text-sm font-semibold text-zinc-300">
              Unità misura
            </label>
            <select
              value={unitaMisura}
              onChange={(e) => setUnitaMisura(e.target.value as UnitaMisura)}
              className="w-full rounded-xl border border-white/10 bg-black px-4 py-3 text-white outline-none focus:border-white/30"
            >
              {tipoTest === "atletica" ? (
                <>
                  <option value="secondi">Secondi</option>
                  <option value="metri">Metri</option>
                  <option value="cm">Centimetri</option>
                </>
              ) : (
                <>
                  <option value="kg">Kg</option>
                  <option value="ripetizioni">Ripetizioni</option>
                </>
              )}
            </select>
          </div>

          {errore && (
            <p className="rounded-xl border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-300">
              {errore}
            </p>
          )}

          <button
            onClick={handleSubmit}
            disabled={isPending}
            style={{ backgroundColor: coloreFlag }}
            className="flex w-full items-center justify-center gap-2 rounded-xl px-5 py-3 font-bold text-white disabled:opacity-60"
          >
            {isPending ? <Loader2 className="animate-spin" size={18} /> : <Save size={18} />}
            Salva test
          </button>
        </div>
      </div>
    </div>
  );
}