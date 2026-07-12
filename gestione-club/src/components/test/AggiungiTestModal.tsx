"use client";

import { useMemo, useState, useTransition } from "react";
import { Loader2, Save, Search, X } from "lucide-react";
import {
  caricaGiocatoriPresenti,
  salvaMisurazioniTest,
} from "@/app/(dashboard)/test/actions";

type TestPerformance = {
  id: string;
  nome: string;
  tipo_test: "atletica" | "forza";
  unita_misura: string;
};

type Giocatore = {
  id: string;
  nome: string;
  cognome: string;
  foto_url: string | null;
};

type RigaMisurazione = {
  giocatore_id: string;
  valore: string;
  obiettivo: string;
  note: string;
};

type Props = {
  open: boolean;
  onClose: () => void;
  tests: TestPerformance[];
  coloreFlag: string;
};

export default function AggiungiTestModal({
  open,
  onClose,
  tests,
  coloreFlag,
}: Props) {
  const [dataTest, setDataTest] = useState("");
  const [testId, setTestId] = useState("");
  const [giocatori, setGiocatori] = useState<Giocatore[]>([]);
  const [righe, setRighe] = useState<Record<string, RigaMisurazione>>({});
  const [errore, setErrore] = useState<string | null>(null);
  const [isLoadingGiocatori, startLoadingGiocatori] = useTransition();
  const [isSaving, startSaving] = useTransition();

  const selectedTest = useMemo(
    () => tests.find((test) => test.id === testId) ?? null,
    [tests, testId]
  );

  if (!open) return null;

  function aggiornaRiga(
    giocatoreId: string,
    field: keyof RigaMisurazione,
    value: string
  ) {
    setRighe((prev) => ({
      ...prev,
      [giocatoreId]: {
        giocatore_id: giocatoreId,
        valore: prev[giocatoreId]?.valore ?? "",
        obiettivo: prev[giocatoreId]?.obiettivo ?? "",
        note: prev[giocatoreId]?.note ?? "",
        [field]: value,
      },
    }));
  }

  function cercaGiocatori() {
    setErrore(null);

    if (!dataTest) {
      setErrore("Seleziona prima la data del test.");
      return;
    }

    if (!testId) {
      setErrore("Seleziona prima il tipo di test.");
      return;
    }

    startLoadingGiocatori(async () => {
      try {
        const result = (await caricaGiocatoriPresenti(dataTest)) as Giocatore[];

        setGiocatori(result);

        const nuoveRighe: Record<string, RigaMisurazione> = {};

        result.forEach((giocatore) => {
          nuoveRighe[giocatore.id] = {
            giocatore_id: giocatore.id,
            valore: "",
            obiettivo: "",
            note: "",
          };
        });

        setRighe(nuoveRighe);
      } catch (error) {
        setErrore(
          error instanceof Error
            ? error.message
            : "Errore durante il caricamento dei giocatori."
        );
      }
    });
  }

  function salva() {
    setErrore(null);

    if (!dataTest || !testId) {
      setErrore("Seleziona data e test.");
      return;
    }

    const misurazioni = Object.values(righe).map((riga) => ({
      giocatore_id: riga.giocatore_id,
      valore: riga.valore ? Number(riga.valore) : null,
      obiettivo: riga.obiettivo ? Number(riga.obiettivo) : null,
      note: riga.note || null,
    }));

    startSaving(async () => {
      try {
        await salvaMisurazioniTest({
          data_test: dataTest,
          test_id: testId,
          misurazioni,
        });

        setDataTest("");
        setTestId("");
        setGiocatori([]);
        setRighe({});
        onClose();
        window.location.reload();
      } catch (error) {
        setErrore(
          error instanceof Error
            ? error.message
            : "Errore durante il salvataggio."
        );
      }
    });
  }

  const labelValore = selectedTest
    ? selectedTest.tipo_test === "atletica"
      ? `Misurazione (${selectedTest.unita_misura})`
      : `Carico / Ripetizioni (${selectedTest.unita_misura})`
    : "Misurazione";

  const labelObiettivo = selectedTest
    ? `Obiettivo (${selectedTest.unita_misura})`
    : "Obiettivo";

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/75 px-3 py-3 backdrop-blur-sm sm:items-center sm:px-4">
      <div className="max-h-[94vh] w-full max-w-6xl overflow-hidden rounded-3xl border border-white/10 bg-[#111] shadow-2xl sm:max-h-[90vh]">
        <div className="flex items-start justify-between gap-4 border-b border-white/10 px-4 py-4 sm:items-center sm:px-5">
          <div className="min-w-0">
            <h2 className="text-lg font-black text-white">Aggiungi test</h2>
            <p className="mt-1 text-xs leading-5 text-zinc-500 sm:text-sm">
              Vengono caricati solo i presenti P, PM o PP nella squadra attiva.
            </p>
          </div>

          <button
            onClick={onClose}
            className="grid h-10 w-10 shrink-0 place-items-center rounded-2xl border border-white/10 bg-white/5 text-zinc-400 transition hover:bg-white/10 hover:text-white"
          >
            <X size={20} />
          </button>
        </div>

        <div className="max-h-[calc(94vh-82px)] overflow-y-auto p-4 sm:max-h-[calc(90vh-80px)] sm:p-5">
          <div className="grid gap-3 md:grid-cols-[1fr_1fr_auto] md:gap-4">
            <div>
              <label className="mb-2 block text-xs font-bold uppercase tracking-wide text-zinc-400 sm:text-sm sm:normal-case sm:tracking-normal sm:text-zinc-300">
                Data test
              </label>

              <div className="relative">
                <input
                  type="date"
                  value={dataTest}
                  onChange={(e) => {
                    setDataTest(e.target.value);
                    setGiocatori([]);
                    setRighe({});
                    setErrore(null);
                  }}
                  style={{
                    borderColor: dataTest ? `${coloreFlag}80` : undefined,
                    boxShadow: dataTest
                      ? `0 0 0 1px ${coloreFlag}40`
                      : undefined,
                  }}
                  className="w-full rounded-2xl border border-white/10 bg-black px-4 py-3 text-sm text-white outline-none transition [color-scheme:dark] focus:border-white/30 sm:text-base"
                />

                {dataTest && (
                  <div
                    className="pointer-events-none absolute right-4 top-1/2 h-2 w-2 -translate-y-1/2 rounded-full"
                    style={{ backgroundColor: coloreFlag }}
                  />
                )}
              </div>
            </div>

            <div>
              <label className="mb-2 block text-xs font-bold uppercase tracking-wide text-zinc-400 sm:text-sm sm:normal-case sm:tracking-normal sm:text-zinc-300">
                Test
              </label>

              <select
                value={testId}
                onChange={(e) => {
                  setTestId(e.target.value);
                  setGiocatori([]);
                  setRighe({});
                  setErrore(null);
                }}
                className="w-full rounded-2xl border border-white/10 bg-black px-4 py-3 text-sm text-white outline-none transition focus:border-white/30 sm:text-base"
              >
                <option value="">Seleziona test</option>
                {tests.map((test) => (
                  <option key={test.id} value={test.id}>
                    {test.nome}
                  </option>
                ))}
              </select>
            </div>

            <div className="flex items-end">
              <button
                onClick={cercaGiocatori}
                disabled={isLoadingGiocatori || !dataTest || !testId}
                style={{ backgroundColor: coloreFlag }}
                className="flex h-12 w-full items-center justify-center gap-2 rounded-2xl px-5 text-sm font-black text-white shadow-lg transition active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-50 md:w-auto sm:text-base"
              >
                {isLoadingGiocatori ? (
                  <Loader2 className="animate-spin" size={18} />
                ) : (
                  <Search size={18} />
                )}
                Cerca presenti
              </button>
            </div>
          </div>

          {errore && (
            <p className="mt-4 rounded-2xl border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm leading-5 text-red-300">
              {errore}
            </p>
          )}

          <div className="mt-5 overflow-hidden rounded-2xl border border-white/10 sm:mt-6">
            <div className="hidden grid-cols-[1.4fr_1fr_1fr_1fr] bg-white/5 px-4 py-3 text-xs font-bold uppercase tracking-wide text-zinc-400 md:grid">
              <span>Giocatore</span>
              <span>{labelValore}</span>
              <span>{labelObiettivo}</span>
              <span>Note</span>
            </div>

            {giocatori.length === 0 ? (
              <div className="px-4 py-10 text-center text-sm text-zinc-500">
                Seleziona una data e carica i presenti.
              </div>
            ) : (
              <div className="divide-y divide-white/10">
                {giocatori.map((giocatore) => (
                  <div
                    key={giocatore.id}
                    className="grid gap-3 p-4 md:grid-cols-[1.4fr_1fr_1fr_1fr] md:items-center md:px-4 md:py-3"
                  >
                    <div className="min-w-0">
                      <p className="truncate text-base font-black text-white md:text-sm">
                        {giocatore.nome} {giocatore.cognome}
                      </p>
                    </div>

                    <div>
                      <label className="mb-1.5 block text-[11px] font-bold uppercase tracking-wide text-zinc-500 md:hidden">
                        {labelValore}
                      </label>
                      <input
                        type="number"
                        step="0.01"
                        value={righe[giocatore.id]?.valore ?? ""}
                        onChange={(e) =>
                          aggiornaRiga(
                            giocatore.id,
                            "valore",
                            e.target.value
                          )
                        }
                        className="w-full rounded-2xl border border-white/10 bg-black px-3 py-3 text-sm text-white outline-none transition placeholder:text-zinc-600 focus:border-white/30 md:py-2"
                      />
                    </div>

                    <div>
                      <label className="mb-1.5 block text-[11px] font-bold uppercase tracking-wide text-zinc-500 md:hidden">
                        {labelObiettivo}
                      </label>
                      <input
                        type="number"
                        step="0.01"
                        value={righe[giocatore.id]?.obiettivo ?? ""}
                        onChange={(e) =>
                          aggiornaRiga(
                            giocatore.id,
                            "obiettivo",
                            e.target.value
                          )
                        }
                        className="w-full rounded-2xl border border-white/10 bg-black px-3 py-3 text-sm text-white outline-none transition placeholder:text-zinc-600 focus:border-white/30 md:py-2"
                      />
                    </div>

                    <div>
                      <label className="mb-1.5 block text-[11px] font-bold uppercase tracking-wide text-zinc-500 md:hidden">
                        Note
                      </label>
                      <input
                        value={righe[giocatore.id]?.note ?? ""}
                        onChange={(e) =>
                          aggiornaRiga(giocatore.id, "note", e.target.value)
                        }
                        placeholder="Note"
                        className="w-full rounded-2xl border border-white/10 bg-black px-3 py-3 text-sm text-white outline-none transition placeholder:text-zinc-600 focus:border-white/30 md:py-2"
                      />
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          <div className="sticky bottom-0 -mx-4 mt-5 border-t border-white/10 bg-[#111]/95 px-4 pb-1 pt-4 backdrop-blur sm:static sm:mx-0 sm:border-t-0 sm:bg-transparent sm:p-0 sm:pt-5">
            <button
              onClick={salva}
              disabled={isSaving || giocatori.length === 0}
              style={{ backgroundColor: coloreFlag }}
              className="flex w-full items-center justify-center gap-2 rounded-2xl px-5 py-3.5 text-sm font-black text-white shadow-lg transition active:scale-[0.98] disabled:opacity-60 sm:text-base"
            >
              {isSaving ? (
                <Loader2 className="animate-spin" size={18} />
              ) : (
                <Save size={18} />
              )}
              Salva misurazioni
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}