"use client";

import { useEffect, useMemo, useState, useTransition } from "react";
import { AlertTriangle, Loader2, Save, Search, Trash2, X } from "lucide-react";
import {
  caricaGiocatoriPresenti,
  caricaMisurazioniTest,
  eliminaMisurazioniTest,
  salvaMisurazioniTest,
} from "@/app/(dashboard)/test/actions";
import { DateInput } from "@/components/ui/DateInput";

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

type MisurazioneSalvata = {
  id: string;
  giocatore_id: string;
  valore: number | null;
  obiettivo: number | null;
  note: string | null;
  giocatore: Giocatore | null;
};

/** Sessione gia' salvata che si sta riaprendo per modificarla. */
export type SessioneDaModificare = {
  test_id: string;
  data_test: string;
};

type Props = {
  open: boolean;
  onClose: () => void;
  tests: TestPerformance[];
  coloreFlag: string;
  /** Se valorizzata, il modale si apre in modifica su quella sessione. */
  modifica?: SessioneDaModificare | null;
};

function testoValore(valore: number | null) {
  return valore === null || valore === undefined ? "" : String(valore);
}

function minutiDaSecondi(valore: string) {
  const secondi = Number(valore);
  return valore === "" || !Number.isFinite(secondi)
    ? ""
    : String(Math.floor(secondi / 60));
}

function restoSecondi(valore: string) {
  const secondi = Number(valore);
  if (valore === "" || !Number.isFinite(secondi)) return "";
  return String(Math.round((secondi % 60) * 100) / 100);
}

function ordinaGiocatori(elenco: Giocatore[]) {
  return [...elenco].sort((a, b) => {
    const perCognome = (a.cognome ?? "").localeCompare(b.cognome ?? "", "it-IT");

    if (perCognome !== 0) return perCognome;

    return (a.nome ?? "").localeCompare(b.nome ?? "", "it-IT");
  });
}

export default function AggiungiTestModal({
  open,
  onClose,
  tests,
  coloreFlag,
  modifica = null,
}: Props) {
  const [dataTest, setDataTest] = useState("");
  const [testId, setTestId] = useState("");
  const [giocatori, setGiocatori] = useState<Giocatore[]>([]);
  const [righe, setRighe] = useState<Record<string, RigaMisurazione>>({});
  const [misurazioniSalvate, setMisurazioniSalvate] = useState(0);
  const [errore, setErrore] = useState<string | null>(null);
  const [isLoadingGiocatori, startLoadingGiocatori] = useTransition();
  const [isSaving, startSaving] = useTransition();
  const [isDeleting, startDeleting] = useTransition();

  const selectedTest = useMemo(
    () => tests.find((test) => test.id === testId) ?? null,
    [tests, testId]
  );

  const inModifica = modifica !== null;

  const modificaTestId = modifica?.test_id ?? "";
  const modificaDataTest = modifica?.data_test ?? "";

  /**
   * All'apertura: in modifica carica subito la sessione scelta, altrimenti
   * riparte pulito.
   */
  useEffect(() => {
    if (!open) return;

    setErrore(null);

    if (modificaTestId && modificaDataTest) {
      setDataTest(modificaDataTest);
      setTestId(modificaTestId);
      caricaAtleti(modificaDataTest, modificaTestId);
      return;
    }

    setDataTest("");
    setTestId("");
    setGiocatori([]);
    setRighe({});
    setMisurazioniSalvate(0);
  }, [open, modificaTestId, modificaDataTest]);

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

  function aggiornaTempo(
    giocatoreId: string,
    field: "valore" | "obiettivo",
    parte: "minuti" | "secondi",
    value: string
  ) {
    const corrente = righe[giocatoreId]?.[field] ?? "";
    const minutiCorrenti = Number(minutiDaSecondi(corrente)) || 0;
    const secondiCorrenti = Number(restoSecondi(corrente)) || 0;
    const nuovoValore = value === "" ? 0 : Math.max(0, Number(value) || 0);
    const minuti = parte === "minuti" ? nuovoValore : minutiCorrenti;
    const secondi = parte === "secondi" ? Math.min(59.99, nuovoValore) : secondiCorrenti;

    aggiornaRiga(
      giocatoreId,
      field,
      minuti === 0 && secondi === 0 && value === ""
        ? ""
        : String(minuti * 60 + secondi)
    );
  }

  /**
   * Carica insieme i presenti di quella data e le misurazioni gia' salvate
   * per quel test: l'elenco e' l'unione dei due, con i valori gia' inseriti
   * precompilati. Cosi' reinserire lo stesso test lo aggiorna invece di
   * duplicarlo.
   */
  function caricaAtleti(data: string, test: string) {
    setErrore(null);

    startLoadingGiocatori(async () => {
      try {
        const [presentiRaw, salvateRaw] = await Promise.all([
          caricaGiocatoriPresenti(data),
          caricaMisurazioniTest(data, test),
        ]);

        const presenti = presentiRaw as Giocatore[];
        const salvate = salvateRaw as MisurazioneSalvata[];

        const perGiocatore = new Map<string, MisurazioneSalvata>();

        for (const misurazione of salvate) {
          perGiocatore.set(misurazione.giocatore_id, misurazione);
        }

        const elenco = new Map<string, Giocatore>();

        // Prima chi ha gia' una misurazione: potrebbe non risultare presente
        // oggi (presenza corretta a posteriori) e non deve sparire.
        for (const misurazione of salvate) {
          if (misurazione.giocatore) {
            elenco.set(misurazione.giocatore_id, misurazione.giocatore);
          }
        }

        for (const giocatore of presenti) {
          if (!elenco.has(giocatore.id)) {
            elenco.set(giocatore.id, giocatore);
          }
        }

        const ordinati = ordinaGiocatori(Array.from(elenco.values()));

        const nuoveRighe: Record<string, RigaMisurazione> = {};

        ordinati.forEach((giocatore) => {
          const salvata = perGiocatore.get(giocatore.id);

          nuoveRighe[giocatore.id] = {
            giocatore_id: giocatore.id,
            valore: testoValore(salvata?.valore ?? null),
            obiettivo: testoValore(salvata?.obiettivo ?? null),
            note: salvata?.note ?? "",
          };
        });

        setGiocatori(ordinati);
        setRighe(nuoveRighe);
        setMisurazioniSalvate(salvate.length);
      } catch (error) {
        setErrore(
          error instanceof Error
            ? error.message
            : "Errore durante il caricamento dei giocatori."
        );
      }
    });
  }

  /**
   * Svuota i campi di un giocatore: al salvataggio la sua misurazione
   * viene eliminata (vedi salvaMisurazioniTest).
   */
  function svuotaRiga(giocatoreId: string) {
    setRighe((prev) => ({
      ...prev,
      [giocatoreId]: {
        giocatore_id: giocatoreId,
        valore: "",
        obiettivo: "",
        note: "",
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

    caricaAtleti(dataTest, testId);
  }

  function eliminaSessione() {
    setErrore(null);

    const conferma = window.confirm(
      `Vuoi eliminare tutte le ${misurazioniSalvate} misurazioni salvate per questo test in questa data? L'operazione non e' reversibile.`
    );

    if (!conferma) return;

    startDeleting(async () => {
      try {
        await eliminaMisurazioniTest({
          data_test: dataTest,
          test_id: testId,
        });

        onClose();
        window.location.reload();
      } catch (error) {
        setErrore(
          error instanceof Error
            ? error.message
            : "Errore durante l'eliminazione."
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
        setMisurazioniSalvate(0);
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

  const testATempo = selectedTest?.unita_misura === "secondi";

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/75 px-3 py-3 backdrop-blur-sm sm:items-center sm:px-4">
      <div className="max-h-[94vh] w-full max-w-6xl overflow-hidden rounded-3xl border border-white/10 bg-[#111] shadow-2xl sm:max-h-[90vh]">
        <div className="flex items-start justify-between gap-4 border-b border-white/10 px-4 py-4 sm:items-center sm:px-5">
          <div className="min-w-0">
            <h2 className="text-lg font-black text-white">
              {inModifica ? "Modifica test salvato" : "Aggiungi test"}
            </h2>
            <p className="mt-1 text-xs leading-5 text-zinc-500 sm:text-sm">
              {inModifica
                ? "Correggi i valori, svuota un campo per togliere quella misurazione."
                : "Vengono caricati solo i presenti P, PM o PP nella squadra attiva."}
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
                <DateInput
                  value={dataTest}
                  disabled={inModifica}
                  onChange={(v) => {
                    setDataTest(v);
                    setGiocatori([]);
                    setRighe({});
                    setMisurazioniSalvate(0);
                    setErrore(null);
                  }}
                  wrapperStyle={{
                    borderColor: dataTest ? `${coloreFlag}80` : undefined,
                    boxShadow: dataTest
                      ? `0 0 0 1px ${coloreFlag}40`
                      : undefined,
                  }}
                  wrapperClassName="rounded-2xl border-white/10 bg-black"
                />
              </div>
            </div>

            <div>
              <label className="mb-2 block text-xs font-bold uppercase tracking-wide text-zinc-400 sm:text-sm sm:normal-case sm:tracking-normal sm:text-zinc-300">
                Test
              </label>

              <select
                value={testId}
                disabled={inModifica}
                onChange={(e) => {
                  setTestId(e.target.value);
                  setGiocatori([]);
                  setRighe({});
                  setMisurazioniSalvate(0);
                  setErrore(null);
                }}
                className="w-full rounded-2xl border border-white/10 bg-black px-4 py-3 text-sm text-white outline-none transition focus:border-white/30 disabled:opacity-60 sm:text-base"
              >
                <option value="">Seleziona test</option>
                {tests.map((test) => (
                  <option key={test.id} value={test.id}>
                    {test.nome}
                  </option>
                ))}
              </select>
            </div>

            <div className={`flex items-end ${inModifica ? "hidden" : ""}`}>
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

          {misurazioniSalvate > 0 && (
            <div className="mt-4 flex flex-col gap-3 rounded-2xl border border-amber-500/30 bg-amber-500/10 px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
              <div className="flex min-w-0 items-start gap-2 text-sm leading-5 text-amber-200">
                <AlertTriangle size={16} className="mt-0.5 shrink-0" />

                <span>
                  Ci sono gia&apos; {misurazioniSalvate}{" "}
                  {misurazioniSalvate === 1 ? "misurazione" : "misurazioni"}{" "}
                  per questo test in questa data: salvando le aggiorni, non
                  crei un doppione.
                </span>
              </div>

              <button
                onClick={eliminaSessione}
                disabled={isDeleting || isSaving}
                className="flex shrink-0 items-center justify-center gap-2 rounded-2xl border border-red-500/40 bg-red-500/10 px-4 py-2.5 text-sm font-bold text-red-300 transition hover:bg-red-500/20 disabled:opacity-60"
              >
                {isDeleting ? (
                  <Loader2 className="animate-spin" size={16} />
                ) : (
                  <Trash2 size={16} />
                )}
                Elimina test
              </button>
            </div>
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
                {isLoadingGiocatori
                  ? "Caricamento in corso..."
                  : "Seleziona una data e carica i presenti."}
              </div>
            ) : (
              <div className="divide-y divide-white/10">
                {giocatori.map((giocatore) => (
                  <div
                    key={giocatore.id}
                    className="grid gap-3 p-4 md:grid-cols-[1.4fr_1fr_1fr_1fr] md:items-center md:px-4 md:py-3"
                  >
                    <div className="flex min-w-0 items-center justify-between gap-2">
                      <p className="truncate text-base font-black text-white md:text-sm">
                        {giocatore.nome} {giocatore.cognome}
                      </p>

                      {(righe[giocatore.id]?.valore ?? "") !== "" && (
                        <button
                          type="button"
                          title="Svuota: al salvataggio questa misurazione viene eliminata"
                          aria-label={`Svuota la misurazione di ${giocatore.nome} ${giocatore.cognome}`}
                          onClick={() => svuotaRiga(giocatore.id)}
                          className="grid h-8 w-8 shrink-0 place-items-center rounded-xl border border-red-500/30 bg-red-500/10 text-red-300 transition hover:bg-red-500/20"
                        >
                          <Trash2 size={14} />
                        </button>
                      )}
                    </div>

                    <div>
                      <label className="mb-1.5 block text-[11px] font-bold uppercase tracking-wide text-zinc-500 md:hidden">
                        {labelValore}
                      </label>
                      {testATempo ? (
                        <div className="grid grid-cols-2 gap-2">
                          <label className="relative">
                            <input
                              type="number"
                              min="0"
                              step="1"
                              placeholder="0"
                              value={minutiDaSecondi(
                                righe[giocatore.id]?.valore ?? ""
                              )}
                              onChange={(e) =>
                                aggiornaTempo(
                                  giocatore.id,
                                  "valore",
                                  "minuti",
                                  e.target.value
                                )
                              }
                              className="w-full rounded-2xl border border-white/10 bg-black px-3 py-3 pr-9 text-sm text-white outline-none transition placeholder:text-zinc-600 focus:border-white/30 md:py-2"
                            />
                            <span className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-xs font-bold text-zinc-500">min</span>
                          </label>
                          <label className="relative">
                            <input
                              type="number"
                              min="0"
                              max="59.99"
                              step="0.01"
                              placeholder="0"
                              value={restoSecondi(
                                righe[giocatore.id]?.valore ?? ""
                              )}
                              onChange={(e) =>
                                aggiornaTempo(
                                  giocatore.id,
                                  "valore",
                                  "secondi",
                                  e.target.value
                                )
                              }
                              className="w-full rounded-2xl border border-white/10 bg-black px-3 py-3 pr-8 text-sm text-white outline-none transition placeholder:text-zinc-600 focus:border-white/30 md:py-2"
                            />
                            <span className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-xs font-bold text-zinc-500">sec</span>
                          </label>
                        </div>
                      ) : (
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
                      )}
                    </div>

                    <div>
                      <label className="mb-1.5 block text-[11px] font-bold uppercase tracking-wide text-zinc-500 md:hidden">
                        {labelObiettivo}
                      </label>
                      {testATempo ? (
                        <div className="grid grid-cols-2 gap-2">
                          <label className="relative">
                            <input
                              type="number"
                              min="0"
                              step="1"
                              placeholder="0"
                              value={minutiDaSecondi(
                                righe[giocatore.id]?.obiettivo ?? ""
                              )}
                              onChange={(e) =>
                                aggiornaTempo(
                                  giocatore.id,
                                  "obiettivo",
                                  "minuti",
                                  e.target.value
                                )
                              }
                              className="w-full rounded-2xl border border-white/10 bg-black px-3 py-3 pr-9 text-sm text-white outline-none transition placeholder:text-zinc-600 focus:border-white/30 md:py-2"
                            />
                            <span className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-xs font-bold text-zinc-500">min</span>
                          </label>
                          <label className="relative">
                            <input
                              type="number"
                              min="0"
                              max="59.99"
                              step="0.01"
                              placeholder="0"
                              value={restoSecondi(
                                righe[giocatore.id]?.obiettivo ?? ""
                              )}
                              onChange={(e) =>
                                aggiornaTempo(
                                  giocatore.id,
                                  "obiettivo",
                                  "secondi",
                                  e.target.value
                                )
                              }
                              className="w-full rounded-2xl border border-white/10 bg-black px-3 py-3 pr-8 text-sm text-white outline-none transition placeholder:text-zinc-600 focus:border-white/30 md:py-2"
                            />
                            <span className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-xs font-bold text-zinc-500">sec</span>
                          </label>
                        </div>
                      ) : (
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
                      )}
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
              {misurazioniSalvate > 0
                ? "Aggiorna misurazioni"
                : "Salva misurazioni"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
