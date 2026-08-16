"use client";

import { useMemo, useState } from "react";
import Image from "next/image";
import { Clock, Dumbbell, X } from "lucide-react";

import { DateInput } from "@/components/ui/DateInput";

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
  /*
   * Le presenze sono per GIORNATA: si sceglie una data e a fianco si
   * vedono gli allenamenti individuati in quel giorno. Gli stati
   * PM/PP/P dicono poi a quali sedute il giocatore ha partecipato.
   */
  const dateConSeduta = useMemo(
    () =>
      Array.from(
        new Set(allenamenti.map((item) => item.data_allenamento)),
      ).sort((a, b) => b.localeCompare(a)),
    [allenamenti],
  );

  const [data, setData] = useState<string>(dateConSeduta[0] ?? "");

  const allenamentiDelGiorno = useMemo(
    () =>
      allenamenti
        .filter((item) => item.data_allenamento === data)
        .sort((a, b) =>
          (a.ora_inizio ?? "").localeCompare(b.ora_inizio ?? ""),
        ),
    [allenamenti, data],
  );

  /*
   * salvaPresenza ha bisogno di un allenamento per ricavare club, squadra
   * e data: essendo la presenza giornaliera ne basta uno qualsiasi del
   * giorno, il primo in ordine di orario.
   */
  const allenamentoRiferimento = allenamentiDelGiorno[0] ?? null;

  return (
    <div
      className="max-h-[90vh] w-full max-w-5xl overflow-hidden rounded-2xl border bg-zinc-950 shadow-2xl"
      style={{ borderColor: `${themeColor}55` }}
    >
      <div className="flex items-center justify-between border-b border-zinc-800 p-5">
        <div>
          <h2 className="text-xl font-bold text-white">Registra presenze</h2>
          <p className="text-sm text-zinc-400">
            Scegli la data e segna le presenze della giornata.
          </p>
        </div>

        <button
          onClick={onClose}
          className="rounded-xl bg-zinc-900 p-2 text-zinc-400 hover:text-white"
        >
          <X className="h-5 w-5" />
        </button>
      </div>

      <div className="space-y-4 border-b border-zinc-800 p-4 sm:p-5">
        <div className="grid gap-4 sm:grid-cols-[minmax(0,220px)_minmax(0,1fr)] sm:items-start">
          <div className="min-w-0">
            <label className="mb-2 block text-xs font-bold uppercase tracking-[0.18em] text-zinc-500">
              Data
            </label>

            <DateInput
              value={data}
              onChange={setData}
              inputClassName="w-full rounded-xl border border-zinc-800 bg-zinc-900 px-4 py-3 text-sm font-semibold text-white focus:outline-none"
            />
          </div>

          <div className="min-w-0">
            <label className="mb-2 block text-xs font-bold uppercase tracking-[0.18em] text-zinc-500">
              Allenamenti individuati
              {data ? ` il ${formattaData(data)}` : ""}
            </label>

            {allenamentiDelGiorno.length === 0 ? (
              <p className="text-sm text-zinc-500">
                {data
                  ? "Nessun allenamento registrato in questa data."
                  : "Scegli una data per vedere le sedute di quel giorno."}
              </p>
            ) : (
              <div className="flex flex-wrap gap-2">
                {allenamentiDelGiorno.map((allenamento) => {
                  const orario = [allenamento.ora_inizio, allenamento.ora_fine]
                    .filter(Boolean)
                    .map((valore) => (valore as string).slice(0, 5))
                    .join(" - ");

                  return (
                    <span
                      key={allenamento.id}
                      className="flex items-center gap-2 rounded-xl border px-3 py-2 text-xs font-semibold text-white"
                      style={{
                        borderColor: `${themeColor}55`,
                        backgroundColor: `${themeColor}1a`,
                      }}
                    >
                      <Dumbbell className="h-3.5 w-3.5 shrink-0" />

                      <span className="truncate">
                        {allenamento.tipo_allenamento ||
                          allenamento.titolo ||
                          "Seduta"}
                      </span>

                      {orario && (
                        <span className="flex items-center gap-1 text-zinc-400">
                          <Clock className="h-3 w-3 shrink-0" />
                          {orario}
                        </span>
                      )}
                    </span>
                  );
                })}
              </div>
            )}
          </div>
        </div>

        {dateConSeduta.length > 0 && (
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-xs text-zinc-600">Ultime sedute:</span>

            {dateConSeduta.slice(0, 5).map((giorno) => {
              const attiva = giorno === data;

              return (
                <button
                  key={giorno}
                  type="button"
                  onClick={() => setData(giorno)}
                  className={`rounded-lg px-2.5 py-1 text-xs font-bold transition ${
                    attiva
                      ? "text-white"
                      : "bg-zinc-900 text-zinc-400 hover:text-white"
                  }`}
                  style={attiva ? { backgroundColor: themeColor } : undefined}
                >
                  {formattaData(giorno)}
                </button>
              );
            })}
          </div>
        )}

        <p className="text-xs text-zinc-600">
          Le presenze valgono per l&apos;intera giornata: usa PM, PP o P per
          indicare a quali sedute il giocatore ha partecipato.
        </p>
      </div>

      <div className="max-h-[60vh] space-y-3 overflow-y-auto p-5">
        {!allenamentoRiferimento ? (
          <p className="text-zinc-400">
            Scegli una data in cui la squadra si e&apos; allenata per
            registrare le presenze.
          </p>
        ) : (
          <>
            {giocatori.map((giocatore) => {
              const statoAttivo = statoGiocatore(
                allenamentoRiferimento.id,
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
                                  allenamentoRiferimento.id,
                                  giocatore.id,
                                );
                                return;
                              }

                              salvaPresenza(
                                allenamentoRiferimento,
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
