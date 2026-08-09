"use client";

import Image from "next/image";
import { useEffect, useMemo, useState } from "react";
import { Loader2, Timer, UserRound } from "lucide-react";

import { AppCard } from "@/components/ui/AppCard";
import { supabase } from "@/lib/supabase-client";
import { calcolaMinutaggioPartita } from "@/lib/minutaggi/calcola-minutaggio";

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
      {partite.map((partita) => {
        const righe = (righePerPartita.get(partita.importId) ?? []).filter(
          (riga) =>
            giocatoreIds.length === 0 || giocatoreIds.includes(riga.giocatoreId)
        );

        return (
          <AppCard key={partita.importId}>
            <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
              <div>
                <h3 className="text-lg font-bold text-white">
                  {partita.squadraCasa} vs {partita.squadraFuori}
                </h3>
                <p className="mt-1 text-sm text-zinc-400">
                  {formatDataPartita(partita.dataPartita)} · Durata{" "}
                  {partita.durataMinuti} min
                </p>
              </div>
            </div>

            {righe.length === 0 ? (
              <p className="text-sm text-zinc-500">
                Nessun giocatore da mostrare per questa partita.
              </p>
            ) : (
              <div className="overflow-x-auto rounded-xl border border-zinc-800">
                <table className="w-full min-w-[560px] border-collapse text-sm">
                  <thead style={{ backgroundColor: coloreFlag }}>
                    <tr className="text-left text-white">
                      <th className="px-3 py-2.5 font-semibold">Giocatore</th>
                      <th className="px-3 py-2.5 text-right font-semibold">
                        Ingresso
                      </th>
                      <th className="px-3 py-2.5 text-right font-semibold">
                        Uscita
                      </th>
                      <th className="px-3 py-2.5 text-right font-semibold">
                        Minuti giocati
                      </th>
                    </tr>
                  </thead>

                  <tbody>
                    {righe.map((riga, index) => {
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

                              {riga.titolare && (
                                <span className="rounded-full border border-zinc-700 bg-zinc-900 px-2 py-0.5 text-[10px] font-bold uppercase text-zinc-400">
                                  Titolare
                                </span>
                              )}
                            </div>
                          </td>

                          <td className="border-t border-zinc-800 px-3 py-2.5 text-right text-zinc-300">
                            {riga.minutoIngresso}&apos;
                          </td>

                          <td className="border-t border-zinc-800 px-3 py-2.5 text-right text-zinc-300">
                            {riga.minutoUscita >= partita.durataMinuti
                              ? "Fine"
                              : `${riga.minutoUscita}'`}
                          </td>

                          <td className="border-t border-zinc-800 px-3 py-2.5 text-right font-bold text-white">
                            {riga.minutiGiocati} min
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </AppCard>
        );
      })}
    </div>
  );
}
