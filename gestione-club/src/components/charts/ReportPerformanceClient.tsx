"use client";

import { useEffect, useMemo, useState } from "react";
import Image from "next/image";
import { Loader2 } from "lucide-react";
import { AppCard } from "@/components/ui/AppCard";
import { supabase } from "@/lib/supabase-client";
import {
  risolviTipiSeduta,
  type TipoSedutaSingolo,
} from "@/lib/performance/catapult-filtri";
import {
  caricaPresenzeGiornaliere,
  isPresente,
} from "@/lib/presenze/presenze-giornaliere";

export type StatoPresenzaDb =
| "presente_mattina"
| "presente_pomeriggio"
| "presente_entrambe"
| "infortunato"
| "assenza_giustificata"
| "assenza_ingiustificata";

type TipoSeduta = "tutte" | "allenamento" | "partita";

/*
 * Una riga per (giocatore, giornata). Le assenze non registrate vengono
 * dedotte dalla rosa attiva e arrivano qui con registrata = false: sono
 * quelle che tengono onesto il denominatore della percentuale.
 */
export type GiocatoreAnagrafica = {
  id: string;
  nome: string | null;
  cognome: string | null;
  foto_url: string | null;
};

export type PresenzaRow = {
id: string;
stato: StatoPresenzaDb;
giocatore_id: string;
squadra_id: string | null;
data: string;
registrata: boolean;
/** Motivo scritto nel popup quando si segna l'assenza giustificata. */
giustificazione: string | null;
};

type Props = {
clubId: string;
squadraId: string | null;
dataDa?: string;
dataA?: string;
tipoSeduta?: TipoSeduta;
tipiSeduta?: TipoSedutaSingolo[];
giocatoreId?: string | null;
giocatoreIds?: string[];
eventoDate?: string[];
hideFilters?: boolean;
/*
 * Anagrafica per la tabella per giocatore/data: senza questa il
 * componente conosce solo i giocatore_id delle presenze, non nomi e foto.
 */
giocatori?: GiocatoreAnagrafica[];
// Stato selezionato cliccando una card (filtro sull'istogramma). Sollevato
// al chiamante in modo che anche l'export PDF nella pagina Performance
// possa sapere quale card è attiva e generare un PDF coerente.
statoSelezionato?: StatoPresenzaDb | null;
onStatoSelezionatoChange?: (stato: StatoPresenzaDb | null) => void;
};

export const STATI: {
key: StatoPresenzaDb;
label: string;
title: string;
color: string;
}[] = [
{
key: "presente_entrambe",
label: "P",
title: "Presente",
color: "#16a34a",
},
{
key: "presente_mattina",
label: "PM",
title: "Presente mattina",
color: "#facc15",
},
{
key: "presente_pomeriggio",
label: "PP",
title: "Presente pomeriggio",
color: "#f97316",
},
{
key: "infortunato",
label: "I",
title: "Infortunato",
color: "#38bdf8",
},
{
key: "assenza_giustificata",
label: "AG",
title: "Assenza giustificata",
color: "#f87171",
},
{
key: "assenza_ingiustificata",
label: "AI",
title: "Assenza ingiustificata",
color: "#991b1b",
},
];

function formatData(value: string) {
return new Intl.DateTimeFormat("it-IT", {
day: "2-digit",
month: "2-digit",
}).format(new Date(value));
}

function formatMese(value: string) {
const [anno, mese] = value.split("-");

return new Intl.DateTimeFormat("it-IT", {
month: "long",
year: "numeric",
}).format(new Date(Number(anno), Number(mese) - 1, 1));
}

type DatoGraficoPresenza = {
data: string;
totale: number;
perStato: Record<StatoPresenzaDb, number>;
};

function BarChart({
dati,
statoAttivo = null,
}: {
dati: DatoGraficoPresenza[];
statoAttivo?: StatoPresenzaDb | null;
}) {
// Con un filtro attivo il totale della colonna è solo quello stato (barra
// di un colore solo); senza filtro la colonna resta segmentata per tutti
// gli stati, così l'istogramma mostra la composizione di ogni giornata.
const valoreColonna = (item: DatoGraficoPresenza) =>
statoAttivo ? (item.perStato[statoAttivo] ?? 0) : item.totale;

const max = Math.max(...dati.map(valoreColonna), 1);

const statiDaMostrare = statoAttivo
? STATI.filter((stato) => stato.key === statoAttivo)
: STATI;

return (
<>
<div className="-mx-3 flex h-80 min-w-0 items-end gap-3 overflow-x-auto overscroll-x-contain px-3 [touch-action:pan-x_pan-y] sm:-mx-5 sm:px-5">
{dati.length === 0 && ( <div className="flex h-full w-full items-center justify-center text-sm text-zinc-500">
Nessun dato disponibile. </div>
)}


  {dati.map((item) => {
    const totaleColonna = valoreColonna(item);
    const altezza =
      totaleColonna > 0 ? Math.max((totaleColonna / max) * 240, 8) : 0;

    return (
      <div
        key={item.data}
        className="flex min-w-20 flex-col items-center justify-end gap-2"
      >
        <p className="text-sm font-bold text-white">
          {totaleColonna}
        </p>

        <div
          className="flex w-9 flex-col-reverse overflow-hidden rounded-t-xl"
          style={{ height: `${altezza}px` }}
        >
          {statiDaMostrare.map((stato) => {
            const valore = item.perStato[stato.key] ?? 0;

            if (valore <= 0) return null;

            const quota =
              totaleColonna > 0 ? (valore / totaleColonna) * 100 : 0;

            return (
              <div
                key={stato.key}
                title={`${stato.title}: ${valore}`}
                style={{
                  height: `${quota}%`,
                  backgroundColor: stato.color,
                }}
              />
            );
          })}
        </div>

        <p className="max-w-20 truncate text-center text-xs text-zinc-500">
          {formatData(item.data)}
        </p>
      </div>
    );
  })}
</div>

{dati.length > 3 && (
  <p className="mt-1 text-center text-[10px] text-zinc-600 sm:hidden">
    Scorri lateralmente per vedere tutte le giornate.
  </p>
)}
</>

);
}

function LegendaStati() {
return (
<div className="mt-4 flex flex-wrap gap-x-4 gap-y-2">
{STATI.map((stato) => (
<span
key={stato.key}
className="flex items-center gap-1.5 text-xs text-zinc-500"
>
<span
className="h-2.5 w-2.5 rounded-full"
style={{ backgroundColor: stato.color }}
/>
{stato.title}
</span>
))}
</div>
);
}

/*
 * Matrice presenze: una riga per giocatore, una colonna per giornata di
 * allenamento nel periodo filtrato. Nella cella la sigla dello stato
 * (P, PM, PP, I, AG, AI) col colore della legenda.
 *
 * Le date sono in colonna e possono essere molte: la tabella scorre in
 * orizzontale e la colonna del giocatore resta agganciata a sinistra,
 * altrimenti scorrendo non si saprebbe piu\' di chi e\' la riga.
 */
function TabellaPresenzePerGiocatore({
  presenze,
  giocatori,
  themeColor,
}: {
  presenze: PresenzaRow[];
  giocatori: GiocatoreAnagrafica[];
  themeColor: string;
}) {
  const date = useMemo(
    () =>
      Array.from(new Set(presenze.map((riga) => riga.data)))
        .filter(Boolean)
        .sort((a, b) => a.localeCompare(b)),
    [presenze]
  );

  const perGiocatore = useMemo(() => {
    const mappa = new Map<string, Map<string, PresenzaRow>>();

    for (const riga of presenze) {
      const righeGiocatore = mappa.get(riga.giocatore_id) ?? new Map();
      righeGiocatore.set(riga.data, riga);
      mappa.set(riga.giocatore_id, righeGiocatore);
    }

    return mappa;
  }, [presenze]);

  const anagrafica = useMemo(
    () => new Map(giocatori.map((giocatore) => [giocatore.id, giocatore])),
    [giocatori]
  );

  /*
   * Ordine per cognome, ma solo tra i giocatori che compaiono davvero
   * nelle presenze filtrate: se il filtro seleziona tre atleti la
   * tabella ne mostra tre.
   */
  const righeGiocatori = useMemo(() => {
    return Array.from(perGiocatore.keys())
      .map((id) => ({
        id,
        anagrafica: anagrafica.get(id) ?? null,
      }))
      .sort((a, b) => {
        const nomeA = `${a.anagrafica?.cognome ?? ""} ${a.anagrafica?.nome ?? ""}`.trim();
        const nomeB = `${b.anagrafica?.cognome ?? ""} ${b.anagrafica?.nome ?? ""}`.trim();

        return nomeA.localeCompare(nomeB, "it", { sensitivity: "base" });
      });
  }, [perGiocatore, anagrafica]);

  if (date.length === 0 || righeGiocatori.length === 0) {
    return (
      <p className="text-sm text-zinc-500">
        Nessuna presenza da mostrare con i filtri selezionati.
      </p>
    );
  }

  return (
    <div className="overflow-x-auto rounded-2xl border border-white/10">
      <table className="w-full border-collapse">
        <thead>
          <tr className="bg-black/30">
            <th className="sticky left-0 z-10 bg-[#18181b] px-3 py-3 text-left text-xs font-black uppercase tracking-wide text-zinc-400">
              Giocatore
            </th>

            {date.map((data) => (
              <th
                key={data}
                className="whitespace-nowrap border-b border-white/10 px-2 py-3 text-center text-[11px] font-black text-zinc-400"
              >
                {formatData(data)}
              </th>
            ))}

            <th className="whitespace-nowrap border-b border-white/10 px-3 py-3 text-center text-[11px] font-black text-zinc-400">
              Presenze
            </th>
          </tr>
        </thead>

        <tbody>
          {righeGiocatori.map(({ id, anagrafica: giocatore }) => {
            const righe = perGiocatore.get(id);

            const presenti = date.filter((data) => {
              const stato = righe?.get(data)?.stato;

              return (
                stato === "presente_entrambe" ||
                stato === "presente_mattina" ||
                stato === "presente_pomeriggio"
              );
            }).length;

            const nomeCompleto =
              [giocatore?.cognome, giocatore?.nome].filter(Boolean).join(" ") ||
              "Giocatore non in rosa";

            const iniziali = `${giocatore?.nome?.charAt(0) ?? "?"}${
              giocatore?.cognome?.charAt(0) ?? ""
            }`.toUpperCase();

            return (
              <tr key={id} className="border-t border-white/5">
                <th className="sticky left-0 z-10 bg-[#18181b] px-3 py-2 text-left">
                  <span className="flex items-center gap-2">
                    {giocatore?.foto_url ? (
                      <Image
                        src={giocatore.foto_url}
                        alt={nomeCompleto}
                        width={64}
                        height={64}
                        className="h-8 w-8 shrink-0 rounded-full object-cover"
                      />
                    ) : (
                      <span
                        className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-[10px] font-bold text-white"
                        style={{ backgroundColor: `${themeColor}66` }}
                      >
                        {iniziali}
                      </span>
                    )}

                    <span className="whitespace-nowrap text-sm font-semibold text-white">
                      {nomeCompleto}
                    </span>
                  </span>
                </th>

                {date.map((data) => {
                  const riga = righe?.get(data);

                  /*
                   * Solo le presenze davvero registrate dallo staff hanno
                   * una sigla. Le assenze dedotte dalla rosa non sono un
                   * dato inserito da nessuno: lasciano il quadrato vuoto,
                   * cosi\' si vede a colpo d'occhio dove manca la
                   * registrazione invece di leggerlo come un'assenza
                   * accertata.
                   */
                  const info =
                    riga && riga.registrata
                      ? STATI.find((voce) => voce.key === riga.stato)
                      : undefined;

                  return (
                    <td key={data} className="px-2 py-2 text-center">
                      {info ? (
                        <span
                          title={info.title}
                          className="inline-flex h-7 min-w-7 items-center justify-center rounded-lg px-1.5 text-[11px] font-black text-white"
                          style={{ backgroundColor: info.color }}
                        >
                          {info.label}
                        </span>
                      ) : (
                        <span
                          title="Presenza non segnata"
                          aria-label="Presenza non segnata"
                          className="inline-flex h-7 w-7 rounded-lg border border-dashed border-white/15"
                        />
                      )}
                    </td>
                  );
                })}

                <td className="whitespace-nowrap px-3 py-2 text-center text-sm font-bold text-white">
                  {presenti}/{date.length}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

function PieChartCustom({
distribuzione,
}: {
distribuzione: {
stato: StatoPresenzaDb;
totale: number;
}[];
}) {
const totale = distribuzione.reduce(
(sum, item) => sum + item.totale,
0
);

const gradient =
totale > 0
? distribuzione
.map((item, index) => {
const start = distribuzione
.slice(0, index)
.reduce(
(sum, current) =>
sum + (current.totale / totale) * 100,
0
);


        const end =
          start + (item.totale / totale) * 100;

        const stato = STATI.find(
          (s) => s.key === item.stato
        );

        return `${
          stato?.color ?? "#71717a"
        } ${start}% ${end}%`;
      })
      .join(", ")
  : "#27272a 0% 100%";


return (
<>
<div
className="mx-auto mt-6 h-44 w-44 rounded-full"
style={{
background: `conic-gradient(${gradient})`,
}}
/>


  <div className="mt-6 space-y-3">
    {distribuzione.length === 0 && (
      <p className="text-sm text-zinc-500">
        Nessun dato disponibile.
      </p>
    )}

    {distribuzione.map((item) => {
      const stato = STATI.find(
        (s) => s.key === item.stato
      );

      return (
        <div
          key={item.stato}
          className="flex items-center justify-between gap-3 text-sm"
        >
          <span className="flex items-center gap-2 text-zinc-400">
            <span
              className="h-3 w-3 rounded-full"
              style={{
                backgroundColor:
                  stato?.color ?? "#71717a",
              }}
            />

            {stato?.title ?? item.stato}
          </span>

          <span className="font-bold text-white">
            {item.totale}
          </span>
        </div>
      );
    })}
  </div>
</>


);
}

/**
 * Interroga presenze_giornaliere con lo stesso set di filtri usato dalla
 * tab Presenze (giocatori, periodo, tipo seduta, eventi) e ritorna le
 * righe filtrate. Estratta come funzione a sé in modo da poter essere
 * richiamata anche fuori dal ciclo di vita di questo componente, ad
 * esempio dal pulsante "Scarica PDF" nell'header della pagina Performance
 * quando la tab "Presenze" è quella attiva.
 */
export async function fetchPresenzeRows(params: {
  clubId: string;
  squadraId: string | null;
  dataDa?: string;
  dataA?: string;
  tipiSeduta?: TipoSedutaSingolo[];
  giocatoreId?: string | null;
  giocatoreIds?: string[];
  eventoDate?: string[];
}): Promise<PresenzaRow[]> {
  const tipiSedutaEffettivi = params.tipiSeduta ?? [];

  // Questa fonte legge presenze_giornaliere: nessun filtro (o
  // "allenamento" incluso) mostra i dati, "solo partita" selezionato
  // non ritorna nulla perché le presenze partita hanno una sorgente
  // diversa.
  const soloPartita =
    tipiSedutaEffettivi.length === 1 && tipiSedutaEffettivi[0] === "partita";

  if (soloPartita) return [];

  const filtroGiocatori =
    params.giocatoreIds && params.giocatoreIds.length > 0
      ? params.giocatoreIds
      : params.giocatoreId
        ? [params.giocatoreId]
        : undefined;

  const presenze = await caricaPresenzeGiornaliere(supabase, {
    clubId: params.clubId,
    squadraId: params.squadraId,
    giocatoreIds: filtroGiocatori,
    dataDa: params.dataDa || undefined,
    dataA: params.dataA || undefined,
  });

  const eventoDate = params.eventoDate ?? [];

  // Filtro evento (le sessioni Catapult selezionate): resta approssimato
  // per data, perche' le presenze non hanno un riferimento a
  // session_title. Con le presenze giornaliere pero' l'approssimazione e'
  // ora coerente con il modello dei dati.
  if (eventoDate.length === 0) return presenze;

  return presenze.filter((riga) => eventoDate.includes(riga.data));
}

export type StatistichePresenze = {
  totalePerStato: Record<StatoPresenzaDb, number>;
  datiGrafico: DatoGraficoPresenza[];
  distribuzione: { stato: StatoPresenzaDb; totale: number }[];
  mesiDisponibili: string[];
  totalePresenze: number;
  totaleRilevazioni: number;
  percentualePresenza: number;
};

/**
 * Calcola tutte le statistiche derivate mostrate nella tab Presenze
 * (usata anche dall'export PDF) a partire dalle righe grezze.
 */
export function calcolaStatistichePresenze(
  presenze: PresenzaRow[]
): StatistichePresenze {
  const totalePerStato = {} as Record<StatoPresenzaDb, number>;

  for (const stato of STATI) {
    totalePerStato[stato.key] = 0;
  }

  for (const row of presenze) {
    totalePerStato[row.stato] = (totalePerStato[row.stato] ?? 0) + 1;
  }

  // Raggruppato per data E per stato, in modo che l'istogramma possa
  // mostrare ogni colonna segmentata per colore (o isolare un solo stato
  // quando l'utente filtra da una card).
  const grouped = presenze.reduce<
    Record<string, { totale: number; perStato: Record<StatoPresenzaDb, number> }>
  >((acc, presenza) => {
    const data = presenza.data;
    if (!data) return acc;

    if (!acc[data]) {
      const perStato = {} as Record<StatoPresenzaDb, number>;
      for (const stato of STATI) perStato[stato.key] = 0;
      acc[data] = { totale: 0, perStato };
    }

    acc[data].totale += 1;
    acc[data].perStato[presenza.stato] =
      (acc[data].perStato[presenza.stato] ?? 0) + 1;

    return acc;
  }, {});

  const datiGrafico = Object.entries(grouped)
    .map(([data, valori]) => ({
      data,
      totale: valori.totale,
      perStato: valori.perStato,
    }))
    .sort((a, b) => a.data.localeCompare(b.data));

  const distribuzione = Object.entries(totalePerStato)
    .map(([stato, totale]) => ({ stato: stato as StatoPresenzaDb, totale }))
    .filter((item) => item.totale > 0)
    .sort((a, b) => b.totale - a.totale);

  const mesi = new Set<string>();
  presenze.forEach((presenza) => {
    if (presenza.data) mesi.add(presenza.data.slice(0, 7));
  });
  const mesiDisponibili = Array.from(mesi).sort();

  const totalePresenze = presenze.filter((p) => isPresente(p.stato)).length;

  /*
   * Il denominatore e' rosa attiva x giornate di allenamento: le righe
   * dedotte (assenze mai registrate) sono gia' incluse in "presenze",
   * quindi la percentuale resta veritiera anche senza pre-inserire le
   * assenze nel database.
   */
  const totaleRilevazioni = presenze.length;

  const percentualePresenza =
    totaleRilevazioni > 0
      ? Math.round((totalePresenze / totaleRilevazioni) * 100)
      : 0;

  return {
    totalePerStato,
    datiGrafico,
    distribuzione,
    mesiDisponibili,
    totalePresenze,
    totaleRilevazioni,
    percentualePresenza,
  };
}

export default function ReportPerformanceClient({
clubId,
squadraId,
dataDa = "",
dataA = "",
tipoSeduta = "tutte",
tipiSeduta = [],
giocatoreId = null,
giocatoreIds = [],
eventoDate = [],
giocatori = [],
statoSelezionato = null,
onStatoSelezionatoChange = () => {},

}: Props) {
const [presenze, setPresenze] = useState<PresenzaRow[]>(
[]
);

const [loading, setLoading] = useState(true);

function toggleStatoSelezionato(stato: StatoPresenzaDb) {
  onStatoSelezionatoChange(statoSelezionato === stato ? null : stato);
}

const tipiSedutaEffettivi = risolviTipiSeduta(tipoSeduta, tipiSeduta);

useEffect(() => {
  let cancelled = false;

  async function caricaPresenze() {
    setLoading(true);

    const rows = await fetchPresenzeRows({
      clubId,
      squadraId,
      dataDa,
      dataA,
      tipiSeduta: tipiSedutaEffettivi,
      giocatoreId,
      giocatoreIds,
      eventoDate,
    });

    if (cancelled) return;

    setPresenze(rows);
    setLoading(false);
  }

  void caricaPresenze();

  return () => {
    cancelled = true;
  };
}, [
  clubId,
  squadraId,
  dataDa,
  dataA,
  tipiSedutaEffettivi.join(","),
  giocatoreId,
  giocatoreIds.join(","),
  eventoDate.join(","),
]);

const {
  totalePerStato,
  datiGrafico,
  distribuzione,
  mesiDisponibili,
  totalePresenze,
  totaleRilevazioni: totaleAllenamentiPeriodo,
  percentualePresenza,
} = useMemo(() => calcolaStatistichePresenze(presenze), [presenze]);

return ( <div className="space-y-4 sm:space-y-5"> <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-3 sm:gap-3 md:grid-cols-6">
{STATI.map((stato) => {
  const attivo = statoSelezionato === stato.key;

  return (
    <button
      key={stato.key}
      type="button"
      onClick={() => toggleStatoSelezionato(stato.key)}
      className="rounded-xl text-left transition"
      style={
        attivo
          ? {
              boxShadow: `0 0 0 2px ${stato.color}`,
              borderRadius: "0.75rem",
            }
          : undefined
      }
      title={
        attivo
          ? "Clicca di nuovo per rimuovere il filtro"
          : `Mostra solo ${stato.title} nell'istogramma`
      }
    >
      <AppCard
        noPadding
        className={attivo ? "bg-zinc-800" : undefined}
      >
        <div className="flex items-center justify-between gap-2 p-3 sm:p-5">
          <div className="min-w-0">
            <p className="truncate text-[11px] text-zinc-400 sm:text-xs">
              {stato.title}
            </p>

            <p className="mt-1 text-xl font-bold text-white sm:text-2xl">
              {totalePerStato[stato.key] ?? 0}
            </p>
          </div>

          <div
            className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-xs font-bold text-white sm:h-11 sm:w-11 sm:text-sm"
            style={{
              backgroundColor: stato.color,
            }}
          >
            {stato.label}
          </div>
        </div>
      </AppCard>
    </button>
  );
})}
  </div>

  <div className="grid grid-cols-2 gap-2.5 sm:gap-3 md:grid-cols-3">
    <AppCard>
      <p className="text-xs font-bold uppercase tracking-widest text-zinc-500">
        Percentuale presenza
      </p>

      <p className="mt-2 text-2xl font-black text-white sm:text-3xl">
        {percentualePresenza}%
      </p>

      <p className="mt-1 text-sm text-zinc-500">
        {totalePresenze} su{" "}
        {totaleAllenamentiPeriodo}
      </p>
    </AppCard>

    <AppCard>
      <p className="text-xs font-bold uppercase tracking-widest text-zinc-500">
        Rilevazioni registrate
      </p>

      <p className="mt-2 text-2xl font-black text-white sm:text-3xl">
        {totaleAllenamentiPeriodo}
      </p>
    </AppCard>

    <AppCard className="col-span-2 md:col-span-1">
      <p className="text-xs font-bold uppercase tracking-widest text-zinc-500">
        Mesi disponibili
      </p>

      <p className="mt-2 text-2xl font-black text-white sm:text-3xl">
        {mesiDisponibili.length}
      </p>

      <p className="mt-1 text-sm capitalize text-zinc-500">
        {mesiDisponibili.length > 0
          ? mesiDisponibili
              .map(formatMese)
              .join(", ")
          : "Nessun mese"}
      </p>
    </AppCard>
  </div>

  <div className="grid min-w-0 gap-4 sm:gap-5 lg:grid-cols-4">
    <AppCard className="min-w-0 lg:col-span-3">
      <div className="mb-4 flex items-center justify-between gap-3">
        <h2 className="text-lg font-semibold text-white">
          Andamento presenze allenamenti
          {statoSelezionato && (
            <span className="ml-2 text-sm font-normal text-zinc-400">
              —{" "}
              {
                STATI.find((s) => s.key === statoSelezionato)
                  ?.title
              }
            </span>
          )}
        </h2>

        <div className="flex items-center gap-3">
          {statoSelezionato && (
            <button
              type="button"
              onClick={() => onStatoSelezionatoChange(null)}
              className="text-xs font-bold text-zinc-400 transition hover:text-white"
            >
              Mostra tutte
            </button>
          )}

          {loading && (
            <Loader2 className="h-5 w-5 animate-spin text-zinc-400" />
          )}
        </div>
      </div>

      <BarChart dati={datiGrafico} statoAttivo={statoSelezionato} />

      <LegendaStati />
    </AppCard>

    <AppCard>
      <h2 className="mb-4 text-lg font-semibold text-white">
        Tipologie presenze / assenze
      </h2>

      <PieChartCustom
        distribuzione={distribuzione}
      />
    </AppCard>
  </div>

  <AppCard>
    <div className="mb-4 flex flex-wrap items-baseline justify-between gap-2">
      <h2 className="text-lg font-semibold text-white">
        Presenze per giocatore
      </h2>

      <p className="text-xs text-zinc-500">
        Le sigle seguono la legenda dell&apos;istogramma. Il quadrato vuoto
        significa che per quella giornata non è stata segnata nessuna
        presenza.
      </p>
    </div>

    <TabellaPresenzePerGiocatore
      presenze={presenze}
      giocatori={giocatori}
      themeColor="#d71920"
    />
  </AppCard>
</div>


);
}
