"use client";

import Image from "next/image";
import { useEffect, useMemo, useState } from "react";
import { Loader2, Timer, UserRound } from "lucide-react";

import { AppCard } from "@/components/ui/AppCard";
import { supabase } from "@/lib/supabase-client";
import {
  calcolaMinutaggioPartita,
  type Intervallo,
} from "@/lib/minutaggi/calcola-minutaggio";

type Giocatore = {
  id: string;
  nome: string | null;
  cognome: string | null;
  foto_url: string | null;
};

type Props = {
  clubId: string;
  squadraId: string | null;
  giocatori: Giocatore[];
  giocatoreIds: string[];
  dataDa: string;
  dataA: string;
  coloreFlag: string;
};

type SquadraNome = { nome: string } | { nome: string }[] | null;

type PartitaMinutaggio = {
  importId: string;
  partitaId: string;
  dataPartita: string;
  squadraCasa: string;
  squadraFuori: string;
  durataMinuti: number;
};

type RigaGiocatore = {
  giocatoreId: string;
  minutoIngresso: number;
  minutoUscita: number;
  minutiGiocati: number;
  titolare: boolean;
  // Tutti i periodi in campo: più di uno quando il giocatore è uscito e
  // poi rientrato. Ingresso/uscita restano il primo e l'ultimo.
  intervalli: Intervallo[];
};

function unicoNome(valore: SquadraNome): string {
  if (!valore) return "—";
  if (Array.isArray(valore)) return valore[0]?.nome || "—";
  return valore.nome || "—";
}

function formatDataPartita(data: string) {
  return new Intl.DateTimeFormat("it-IT", {
    weekday: "short",
    day: "2-digit",
    month: "short",
    year: "numeric",
  }).format(new Date(`${data}T12:00:00`));
}

function nomeCompleto(giocatore: Giocatore | undefined) {
  if (!giocatore) return "Giocatore sconosciuto";
  return `${giocatore.nome ?? ""} ${giocatore.cognome ?? ""}`.trim() || "—";
}

export default function MinutaggioPartiteClient({
  clubId,
  squadraId,
  giocatori,
  giocatoreIds,
  dataDa,
  dataA,
  coloreFlag,
}: Props) {
  const [loading, setLoading] = useState(true);
  const [partite, setPartite] = useState<PartitaMinutaggio[]>([]);
  const [righePerPartita, setRighePerPartita] = useState<
    Map<string, RigaGiocatore[]>
  >(new Map());

  useEffect(() => {
    let cancelled = false;

    async function carica() {
      setLoading(true);

      try {
        let importQuery = supabase
          .from("partite_minutaggi_import")
          .select(
            `
            id,
            partita_id,
            durata_minuti,
            partite:partita_id (
              id,
              data_partita,
              squadra_id,
              squadra_casa:squadra_casa_id ( nome ),
              squadra_fuori:squadra_fuori_id ( nome )
            )
          `
          )
          .eq("club_id", clubId)
          .not("partita_id", "is", null);

        const { data: importRows, error: importError } = await importQuery;

        if (importError) {
          console.error("Errore caricamento minutaggi:", importError);
          if (!cancelled) {
            setPartite([]);
            setRighePerPartita(new Map());
          }
          return;
        }

        type ImportRow = {
          id: string;
          partita_id: string;
          durata_minuti: number;
          partite: {
            id: string;
            data_partita: string;
            squadra_id: string | null;
            squadra_casa: SquadraNome;
            squadra_fuori: SquadraNome;
          } | null;
        };

        let righe = ((importRows ?? []) as unknown as ImportRow[]).filter(
          (riga) => riga.partite !== null
        );

        if (squadraId) {
          righe = righe.filter(
            (riga) => riga.partite?.squadra_id === squadraId
          );
        }

        if (dataDa) {
          righe = righe.filter(
            (riga) => (riga.partite?.data_partita ?? "") >= dataDa
          );
        }

        if (dataA) {
          righe = righe.filter(
            (riga) => (riga.partite?.data_partita ?? "") <= dataA
          );
        }

        const partiteCostruite: PartitaMinutaggio[] = righe.map((riga) => ({
          importId: riga.id,
          partitaId: riga.partita_id,
          dataPartita: riga.partite!.data_partita,
          squadraCasa: unicoNome(riga.partite!.squadra_casa),
          squadraFuori: unicoNome(riga.partite!.squadra_fuori),
          durataMinuti: riga.durata_minuti,
        }));

        partiteCostruite.sort((a, b) =>
          b.dataPartita.localeCompare(a.dataPartita)
        );

        if (cancelled) return;
        setPartite(partiteCostruite);

        if (partiteCostruite.length === 0) {
          setRighePerPartita(new Map());
          return;
        }

        const importIds = partiteCostruite.map((p) => p.importId);
        const partitaIds = Array.from(
          new Set(partiteCostruite.map((p) => p.partitaId))
        );

        const [{ data: cambiData }, { data: convocazioniData }] =
          await Promise.all([
            supabase
              .from("partite_minutaggi_cambi")
              .select("import_id, giocatore_id, minuto, tipo")
              .in("import_id", importIds)
              .not("giocatore_id", "is", null),
            supabase
              .from("partite_convocazioni")
              .select("partita_id, giocatore_id")
              .in("partita_id", partitaIds)
              .eq("titolare", true),
          ]);

        const titolariPerPartita = new Map<string, string[]>();
        for (const row of convocazioniData ?? []) {
          const lista = titolariPerPartita.get(row.partita_id) ?? [];
          lista.push(row.giocatore_id);
          titolariPerPartita.set(row.partita_id, lista);
        }

        const cambiPerImport = new Map<
          string,
          { giocatoreId: string; minuto: number; tipo: "entra" | "esce" }[]
        >();
        for (const row of cambiData ?? []) {
          if (!row.giocatore_id) continue;
          const lista = cambiPerImport.get(row.import_id) ?? [];
          lista.push({
            giocatoreId: row.giocatore_id,
            minuto: Number(row.minuto),
            tipo: row.tipo,
          });
          cambiPerImport.set(row.import_id, lista);
        }

        const risultato = new Map<string, RigaGiocatore[]>();

        for (const partita of partiteCostruite) {
          const titolari = titolariPerPartita.get(partita.partitaId) ?? [];
          const eventi = cambiPerImport.get(partita.importId) ?? [];

          const calcolo = calcolaMinutaggioPartita(
            titolari,
            eventi,
            partita.durataMinuti
          );

          const righeGiocatori: RigaGiocatore[] = Array.from(
            calcolo.values()
          )
            .map((m) => ({
              giocatoreId: m.giocatoreId,
              minutoIngresso: m.minutoIngresso,
              minutoUscita: m.minutoUscita,
              minutiGiocati: m.minutiGiocati,
              titolare: m.titolare,
              intervalli: m.intervalli,
            }))
            .sort((a, b) => a.minutoIngresso - b.minutoIngresso);

          risultato.set(partita.importId, righeGiocatori);
        }

        if (!cancelled) setRighePerPartita(risultato);
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    void carica();

    return () => {
      cancelled = true;
    };
  }, [clubId, squadraId, dataDa, dataA]);

  const giocatoriMap = useMemo(() => {
    return new Map(giocatori.map((g) => [g.id, g]));
  }, [giocatori]);

  /*
   * FILTRO PARTITA
   * ===============
   * Vive qui dentro e non fra i filtri comuni della pagina report: le
   * altre tab lavorano su intervalli di date e sessioni Catapult, una
   * singola partita non vuol dire niente per loro.
   *
   * Il valore e' l'importId (una partita puo' avere piu' import, ed e'
   * l'import che porta i cambi). "tutte" e' il default.
   */
  const [partitaScelta, setPartitaScelta] = useState<string>("tutte");

  // Se cambiano i filtri a monte la partita scelta puo' non esserci piu':
  // senza questo si resterebbe su un elenco vuoto senza capire perche'.
  useEffect(() => {
    if (
      partitaScelta !== "tutte" &&
      !partite.some((partita) => partita.importId === partitaScelta)
    ) {
      setPartitaScelta("tutte");
    }
  }, [partite, partitaScelta]);

  const partiteVisibili = useMemo(
    () =>
      partitaScelta === "tutte"
        ? partite
        : partite.filter((partita) => partita.importId === partitaScelta),
    [partite, partitaScelta]
  );

  /*
   * RIEPILOGO PER GIOCATORE
   * ========================
   * Partite giocate e minuti totali sulle partite attualmente visibili:
   * con il filtro su una partita sola diventa il riepilogo di quella
   * partita, che e' il comportamento che ci si aspetta da un filtro.
   *
   * Una partita conta come "giocata" solo con minuti > 0: un convocato
   * rimasto in panchina tutta la gara non ha giocato.
   */
  const riepilogo = useMemo(() => {
    const per = new Map<
      string,
      { giocatoreId: string; partite: number; minuti: number }
    >();

    for (const partita of partiteVisibili) {
      const righe = righePerPartita.get(partita.importId) ?? [];

      for (const riga of righe) {
        if (
          giocatoreIds.length > 0 &&
          !giocatoreIds.includes(riga.giocatoreId)
        ) {
          continue;
        }

        if (riga.minutiGiocati <= 0) continue;

        const corrente = per.get(riga.giocatoreId) ?? {
          giocatoreId: riga.giocatoreId,
          partite: 0,
          minuti: 0,
        };

        corrente.partite += 1;
        corrente.minuti += riga.minutiGiocati;

        per.set(riga.giocatoreId, corrente);
      }
    }

    return Array.from(per.values()).sort((a, b) => {
      if (b.minuti !== a.minuti) return b.minuti - a.minuti;

      return nomeCompleto(giocatoriMap.get(a.giocatoreId)).localeCompare(
        nomeCompleto(giocatoriMap.get(b.giocatoreId))
      );
    });
  }, [partiteVisibili, righePerPartita, giocatoreIds, giocatoriMap]);

  const minutiTotali = riepilogo.reduce((somma, r) => somma + r.minuti, 0);

  if (loading) {
    return (
      <AppCard>
        <div className="flex min-h-[200px] items-center justify-center">
          <Loader2 size={28} className="animate-spin text-zinc-500" />
        </div>
      </AppCard>
    );
  }

  if (partite.length === 0) {
    return (
      <AppCard>
        <div className="flex flex-col items-center justify-center px-4 py-14 text-center">
          <Timer className="mb-3 h-10 w-10 text-zinc-700" />
          <h3 className="font-semibold text-white">
            Nessun minutaggio partita disponibile
          </h3>
          <p className="mt-1 max-w-sm text-sm text-zinc-500">
            Carica un file MINUTAGGIO da Partite → Minutaggi e associalo a
            una partita per vederlo qui.
          </p>
        </div>
      </AppCard>
    );
  }

  return (
    <div className="space-y-5">
      {/* FILTRO PARTITA (solo in questa tab) */}
      <AppCard>
        <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
          <label className="min-w-0 flex-1 sm:max-w-md">
            <span className="mb-2 block text-xs font-bold uppercase tracking-[0.18em] text-zinc-500">
              Partita
            </span>

            <select
              value={partitaScelta}
              onChange={(evento) => setPartitaScelta(evento.target.value)}
              className="w-full rounded-xl border border-zinc-800 bg-zinc-900 px-4 py-3 text-sm font-semibold text-white outline-none transition focus:border-zinc-600"
            >
              <option value="tutte">
                Tutte le partite ({partite.length})
              </option>

              {partite.map((partita) => (
                <option key={partita.importId} value={partita.importId}>
                  {formatDataPartita(partita.dataPartita)} ·{" "}
                  {partita.squadraCasa} vs {partita.squadraFuori}
                </option>
              ))}
            </select>
          </label>

          <p className="text-sm text-zinc-400">
            {partiteVisibili.length}{" "}
            {partiteVisibili.length === 1 ? "partita" : "partite"} ·{" "}
            {riepilogo.length}{" "}
            {riepilogo.length === 1 ? "giocatore" : "giocatori"} ·{" "}
            {minutiTotali} min totali
          </p>
        </div>
      </AppCard>

      {/* RIEPILOGO: NOME, PARTITE GIOCATE, MINUTI TOTALI */}
      <AppCard title="Riepilogo giocatori">
        {riepilogo.length === 0 ? (
          <p className="text-sm text-zinc-500">
            Nessun minutaggio da riepilogare con i filtri attivi.
          </p>
        ) : (
          <div className="scrollbar-gestionale overflow-x-auto rounded-xl border border-zinc-800">
            <table className="w-full min-w-[460px] border-collapse text-sm">
              <thead style={{ backgroundColor: coloreFlag }}>
                <tr className="text-left text-white">
                  <th className="px-3 py-2.5 font-semibold">Giocatore</th>
                  <th className="px-3 py-2.5 text-right font-semibold">
                    Partite giocate
                  </th>
                  <th className="px-3 py-2.5 text-right font-semibold">
                    Minuti totali
                  </th>
                </tr>
              </thead>

              <tbody>
                {riepilogo.map((riga, index) => {
                  const giocatore = giocatoriMap.get(riga.giocatoreId);

                  return (
                    <tr
                      key={riga.giocatoreId}
                      className={
                        index % 2 === 0 ? "bg-zinc-950" : "bg-zinc-900/40"
                      }
                    >
                      <td className="border-t border-zinc-800 px-3 py-2.5">
                        <div className="flex items-center gap-2.5">
                          {giocatore?.foto_url ? (
                            <Image
                              src={giocatore.foto_url}
                              alt={nomeCompleto(giocatore)}
                              width={32}
                              height={32}
                              className="h-8 w-8 rounded-full object-cover ring-2 ring-white/10"
                            />
                          ) : (
                            <span className="flex h-8 w-8 items-center justify-center rounded-full bg-white/10 text-zinc-300 ring-2 ring-white/10">
                              <UserRound size={15} />
                            </span>
                          )}

                          <span className="font-medium text-zinc-200">
                            {nomeCompleto(giocatore)}
                          </span>
                        </div>
                      </td>

                      <td className="border-t border-zinc-800 px-3 py-2.5 text-right text-zinc-300">
                        {riga.partite}
                      </td>

                      <td className="border-t border-zinc-800 px-3 py-2.5 text-right font-bold text-white">
                        {riga.minuti} min
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </AppCard>
    </div>
  );
}
