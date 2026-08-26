"use client";

import { useEffect, useState, useTransition } from "react";
import { X, Loader2, Save } from "lucide-react";
import {
  aggiornaTipoTest,
  creaTipoTest,
} from "@/app/(dashboard)/test/actions";
import {
  componentiPerCategoria,
  serializzaUnitaTest,
  unitaEffettivaTest,
  parseUnitaTest,
  type CategoriaUnitaTest,
  type ComponenteUnitaTest,
} from "@/lib/test-unita";

type Props = {
  open: boolean;
  onClose: () => void;
  coloreFlag: string;
  testDaModificare?: {
    id: string;
    nome: string;
    tipo_test: "atletica" | "forza";
    unita_misura: string;
  } | null;
};

export default function NuovoTipoTestModal({
  open,
  onClose,
  coloreFlag,
  testDaModificare = null,
}: Props) {
  const [nome, setNome] = useState("");
  const [categoria, setCategoria] = useState<CategoriaUnitaTest>("tempo");
  const [componenti, setComponenti] = useState<ComponenteUnitaTest[]>([
    "secondi",
  ]);
  const [errore, setErrore] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  useEffect(() => {
    if (!open) return;
    if (!testDaModificare) {
      setNome("");
      setCategoria("tempo");
      setComponenti(["secondi"]);
      return;
    }

    const configurazione = parseUnitaTest(
      unitaEffettivaTest(
        testDaModificare.nome,
        testDaModificare.unita_misura
      )
    );
    setNome(testDaModificare.nome);
    setCategoria(
      configurazione.categoria === "peso" ||
        configurazione.categoria === "lunghezza"
        ? configurazione.categoria
        : "tempo"
    );
    setComponenti(configurazione.componenti);
  }, [open, testDaModificare]);

  if (!open) return null;

  function handleSubmit() {
    setErrore(null);

    if (componenti.length === 0) {
      setErrore("Seleziona almeno un'unità di misura.");
      return;
    }

    startTransition(async () => {
      try {
        const payload = {
          nome,
          tipo_test: categoria === "peso" ? "forza" : "atletica",
          unita_misura: unitaEffettivaTest(
            nome,
            serializzaUnitaTest(categoria, componenti)
          ),
        } as const;

        if (testDaModificare) {
          await aggiornaTipoTest({ id: testDaModificare.id, ...payload });
        } else {
          await creaTipoTest(payload);
        }

        setNome("");
        setCategoria("tempo");
        setComponenti(["secondi"]);
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
          <h2 className="text-lg font-bold text-white">
            {testDaModificare ? "Modifica tipo di test" : "Nuovo tipo di test"}
          </h2>

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
              onChange={(e) => {
                const nuovoNome = e.target.value;
                setNome(nuovoNome);
                if (/agility/i.test(nuovoNome)) {
                  setCategoria("tempo");
                  setComponenti(["secondi", "centesimi"]);
                }
              }}
              placeholder="Es. Sprint 10m-30m"
              className="w-full rounded-xl border border-white/10 bg-black px-4 py-3 text-white outline-none focus:border-white/30"
            />
          </div>

          <div className="rounded-2xl border border-white/10 bg-white/[0.025] p-4">
            <label className="mb-2 block text-sm font-semibold text-zinc-300">
              Unità misura
            </label>
            <div className="flex flex-col gap-3 sm:flex-row sm:items-start">
              <select
                value={categoria}
                onChange={(e) => {
                  const nuovaCategoria = e.target.value as CategoriaUnitaTest;
                  setCategoria(nuovaCategoria);
                  setComponenti([
                    nuovaCategoria === "tempo"
                      ? "secondi"
                      : nuovaCategoria === "peso"
                        ? "kg"
                        : "metri",
                  ]);
                }}
                className="h-12 w-full rounded-xl border border-white/10 bg-black px-4 text-white outline-none focus:border-white/30 sm:w-40"
              >
                <option value="tempo">Tempo</option>
                <option value="peso">Peso</option>
                <option value="lunghezza">Lunghezza</option>
              </select>

              <div className="flex flex-wrap gap-2">
                {componentiPerCategoria(categoria).map((componente) => {
                  const selezionato = componenti.includes(componente);
                  return (
                    <button
                      key={componente}
                      type="button"
                      aria-pressed={selezionato}
                      onClick={() =>
                        setComponenti((precedenti) =>
                          selezionato
                            ? precedenti.filter((voce) => voce !== componente)
                            : componentiPerCategoria(categoria).filter((voce) =>
                                [...precedenti, componente].includes(voce)
                              )
                        )
                      }
                      className={`h-12 min-w-20 rounded-xl border px-3 text-xs font-black capitalize transition ${
                        selezionato
                          ? "border-white bg-white text-black"
                          : "border-white/10 bg-black text-zinc-400 hover:border-white/30 hover:text-white"
                      }`}
                    >
                      {componente}
                    </button>
                  );
                })}
              </div>
            </div>
            <p className="mt-2 text-xs text-zinc-500">
              Puoi selezionare più unità. Il valore verrà salvato in{" "}
              {categoria === "tempo"
                ? "secondi"
                : categoria === "peso"
                  ? "chilogrammi"
                  : "metri"}
              .
            </p>
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
            {testDaModificare ? "Aggiorna test" : "Salva test"}
          </button>
        </div>
      </div>
    </div>
  );
}
