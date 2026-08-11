"use client";

import { useMemo, useState } from "react";
import Image from "next/image";
import { X } from "lucide-react";

export type StatoPresenza = "PM" | "PP" | "P" | "I" | "AG" | "AI";

type StatoPresenzaDef = {
  sigla: StatoPresenza;
  label: string;
};

// Stessa forma del tipo Allenamento definito in allenamenti/page.tsx: deve
// combaciare esattamente, perché salvaPresenza/eliminaPresenza (passate come
// prop da quella pagina) sono tipizzate su quell'oggetto completo, non solo
// sui campi usati per il menu a tendina.
type AllenamentoOpzione = {
  id: string;
  club_id: string;
  squadra_id: string | null;
  titolo: string | null;
  tipo_allenamento: string | null;
  data_allenamento: string;
  ora_inizio: string | null;
  ora_fine: string | null;
  luogo: string | null;
  obiettivo: string | null;
  note: string | null;
  durata_minuti: number | null;
  stato: string;
  created_at: string;
};

type Giocatore = {
  id: string;
  nome: string;
  cognome: string;
  foto_url: string | null;
};

type Props = {
  allenamenti: AllenamentoOpzione[];
  giocatori: Giocatore[];
  isAdmin: boolean;
  themeColor: string;
  formattaData: (data: string) => string;
  statiPresenza: StatoPresenzaDef[];
  coloreStato: Record<StatoPresenza, string>;
  statoGiocatore: (
    allenamentoId: string,
    giocatoreId: string,
  ) => StatoPresenza | undefined;
  salvaPresenza: (
    allenamento: AllenamentoOpzione,
    giocatoreId: string,
    stato: StatoPresenza,
  ) => void | Promise<void>;
  eliminaPresenza: (
    allenamentoId: string,
    giocatoreId: string,
  ) => void | Promise<void>;
  onClose: () => void;
};

export default function RegistraPresenzeModal({
  allenamenti,
  giocatori,
  isAdmin,
  themeColor,
  formattaData,
  statiPresenza,
  coloreStato,
  statoGiocatore,
  salvaPresenza,
  eliminaPresenza,
  onClose,
}: Props) {
  const [allenamentoId, setAllenamentoId] = useState<string>(
    allenamenti[0]?.id ?? "",
  );

  const allenamentoSelezionato = useMemo(
    () => allenamenti.find((item) => item.id === allenamentoId) ?? null,
    [allenamenti, allenamentoId],
  );

  return (
    <div
      className="max-h-[90vh] w-full max-w-5xl overflow-hidden rounded-2xl border bg-zinc-950 shadow-2xl"
      style={{ borderColor: `${themeColor}55` }}
    >
      <div className="flex items-center justify-between border-b border-zinc-800 p-5">
        <div>
          <h2 className="text-xl font-bold text-white">Registra presenze</h2>
          <p className="text-sm text-zinc-400">
            Seleziona la seduta e segna le presenze dei giocatori.
          </p>
        </div>

        <button
          onClick={onClose}
          className="rounded-xl bg-zinc-900 p-2 text-zinc-400 hover:text-white"
        >
          <X className="h-5 w-5" />
        </button>
      </div>

      <div className="border-b border-zinc-800 p-5">
        <label className="mb-2 block text-xs font-bold uppercase tracking-[0.18em] text-zinc-500">
          Seduta
        </label>

        {allenamenti.length === 0 ? (
          <p className="text-sm text-zinc-400">
            Nessuna seduta disponibile per la squadra selezionata.
          </p>
        ) : (
          <select
            value={allenamentoId}
            onChange={(event) => setAllenamentoId(event.target.value)}
            className="w-full rounded-xl border border-zinc-800 bg-zinc-900 px-4 py-3 text-sm font-semibold text-white focus:outline-none"
          >
            {allenamenti.map((allenamento) => (
              <option key={allenamento.id} value={allenamento.id}>
                {allenamento.titolo || "Seduta"} —{" "}
                {formattaData(allenamento.data_allenamento)}
              </option>
            ))}
          </select>
        )}
      </div>

      <div className="max-h-[60vh] space-y-3 overflow-y-auto p-5">
        {!allenamentoSelezionato ? (
          <p className="text-zinc-400">
            Seleziona una seduta per registrare le presenze.
          </p>
        ) : (
          <>
            {giocatori.map((giocatore) => {
              const statoAttivo = statoGiocatore(
                allenamentoSelezionato.id,
                giocatore.id,
              );

              return (
                <div
                  key={giocatore.id}
                  className="flex flex-wrap items-center justify-between gap-4 rounded-2xl border border-zinc-800 bg-zinc-900/60 p-4"
                >
                  <div className="flex items-center gap-3">
                    {giocatore.foto_url ? (
                      <Image
                        src={giocatore.foto_url}
                        alt={`${giocatore.nome} ${giocatore.cognome}`}
                        width={48}
                        height={48}
                        className="h-12 w-12 rounded-full object-cover"
                      />
                    ) : (
                      <div
                        className="flex h-12 w-12 items-center justify-center rounded-full text-sm font-bold text-white"
                        style={{ backgroundColor: `${themeColor}66` }}
                      >
                        {giocatore.nome.charAt(0)}
                        {giocatore.cognome.charAt(0)}
                      </div>
                    )}

                    <div>
                      <p className="font-semibold text-white">
                        {giocatore.nome} {giocatore.cognome}
                      </p>
                      <p className="text-sm text-zinc-500">
                        {statoAttivo
                          ? statiPresenza.find(
                              (stato) => stato.sigla === statoAttivo,
                            )?.label
                          : "Presenza non segnata"}
                      </p>
                    </div>
                  </div>

                  {isAdmin && (
                    <div className="grid grid-cols-3 gap-2 sm:flex sm:flex-wrap">
                      {statiPresenza.map((stato) => {
                        const active = statoAttivo === stato.sigla;

                        return (
                          <button
                            key={stato.sigla}
                            onClick={() => {
                              if (active) {
                                eliminaPresenza(
                                  allenamentoSelezionato.id,
                                  giocatore.id,
                                );
                                return;
                              }

                              salvaPresenza(
                                allenamentoSelezionato,
                                giocatore.id,
                                stato.sigla,
                              );
                            }}
                            className={`flex h-10 w-full items-center justify-center rounded-xl border px-2 text-sm font-bold disabled:cursor-not-allowed disabled:opacity-50 sm:w-10 ${
                              active
                                ? coloreStato[stato.sigla]
                                : "border-zinc-700 bg-zinc-950 text-zinc-300 hover:text-white"
                            }`}
                            style={
                              !active
                                ? { borderColor: `${themeColor}33` }
                                : undefined
                            }
                            title={stato.label}
                          >
                            <span className="shrink-0">{stato.sigla}</span>
                          </button>
                        );
                      })}
                    </div>
                  )}
                </div>
              );
            })}

            {giocatori.length === 0 && (
              <p className="text-zinc-400">
                Nessun giocatore trovato per la squadra selezionata.
              </p>
            )}
          </>
        )}
      </div>
    </div>
  );
}
