"use client";

import { useEffect, useMemo, useState } from "react";
import { Loader2 } from "lucide-react";
import { AppCard } from "@/components/ui/AppCard";
import { supabase } from "@/lib/supabase-client";
import {
  risolviTipiSeduta,
  type TipoSedutaSingolo,
} from "@/lib/performance/catapult-filtri";

export type StatoPresenzaDb =
| "presente_mattina"
| "presente_pomeriggio"
| "presente_entrambe"
| "infortunato"
| "assenza_giustificata"
| "assenza_ingiustificata";

type TipoSeduta = "tutte" | "allenamento" | "partita";

export type PresenzaRow = {
id: string;
stato: StatoPresenzaDb;
giocatore_id: string;
squadra_id: string | null;
allenamento_id: string;
allenamento: {
id: string;
data_allenamento: string;
} | null;
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
color: "#facc15",
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
<div className="flex h-80 items-end gap-3 overflow-x-auto">
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
 * Interroga presenze_allenamenti con lo stesso set di filtri usato dalla
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

  // Questa fonte legge presenze_allenamenti: nessun filtro (o
  // "allenamento" incluso) mostra i dati, "solo partita" selezionato
  // non ritorna nulla perché le presenze partita hanno una sorgente
  // diversa.
  const soloPartita =
    tipiSedutaEffettivi.length === 1 && tipiSedutaEffettivi[0] === "partita";

  if (soloPartita) return [];

  let query = supabase
    .from("presenze_allenamenti")
    .select(
      `
        id,
        stato,
        giocatore_id,
        squadra_id,
        allenamento_id,
        allenamento:allenamenti!presenze_allenamenti_allenamento_id_fkey (
          id,
          data_allenamento
        )
      `
    )
    .eq("club_id", params.clubId);

  if (params.squadraId) {
    query = query.eq("squadra_id", params.squadraId);
  }

  const filtroGiocatori =
    params.giocatoreIds && params.giocatoreIds.length > 0
      ? params.giocatoreIds
      : params.giocatoreId
        ? [params.giocatoreId]
        : null;

  if (filtroGiocatori) {
    query = query.in("giocatore_id", filtroGiocatori);
  }

  const { data, error } = await query;

  if (error) {
    console.error("Errore presenze_allenamenti:", error);
    return [];
  }

  const eventoDate = params.eventoDate ?? [];

  return ((data ?? []) as unknown as PresenzaRow[]).filter((row) => {
    const dataAllenamento = row.allenamento?.data_allenamento;

    if (!dataAllenamento) return false;
    if (params.dataDa && dataAllenamento < params.dataDa) return false;
    if (params.dataA && dataAllenamento > params.dataA) return false;

    // Filtro evento (le sessioni Catapult selezionate): approssimato per
    // data, dato che presenze_allenamenti non ha un riferimento a
    // session_title.
    if (eventoDate.length > 0 && !eventoDate.includes(dataAllenamento)) {
      return false;
    }

    return true;
  });
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
    const data = presenza.allenamento?.data_allenamento;
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
    const data = presenza.allenamento?.data_allenamento;
    if (data) mesi.add(data.slice(0, 7));
  });
  const mesiDisponibili = Array.from(mesi).sort();

  const totalePresenze = presenze.filter((p) =>
    [
      "presente_mattina",
      "presente_pomeriggio",
      "presente_entrambe",
    ].includes(p.stato)
  ).length;

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

}: Props) {
const [presenze, setPresenze] = useState<PresenzaRow[]>(
[]
);

const [loading, setLoading] = useState(true);

// Filtro attivato cliccando una delle card in alto (Presente, Infortunato,
// ecc.): isola quello stato nell'istogramma "Andamento presenze". Un
// secondo click sulla stessa card lo disattiva.
const [statoSelezionato, setStatoSelezionato] =
  useState<StatoPresenzaDb | null>(null);

function toggleStatoSelezionato(stato: StatoPresenzaDb) {
  setStatoSelezionato((current) => (current === stato ? null : stato));
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

return ( <div className="space-y-5"> <div className="grid gap-3 md:grid-cols-6">
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
        className={attivo ? "bg-zinc-800" : undefined}
      >
        <div className="flex items-center justify-between">
          <div>
            <p className="text-xs text-zinc-400">{stato.title}</p>

            <p className="mt-1 text-2xl font-bold text-white">
              {totalePerStato[stato.key] ?? 0}
            </p>
          </div>

          <div
            className="flex h-11 w-11 items-center justify-center rounded-full text-sm font-bold text-white"
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

  <div className="grid gap-3 md:grid-cols-3">
    <AppCard>
      <p className="text-xs font-bold uppercase tracking-widest text-zinc-500">
        Percentuale presenza
      </p>

      <p className="mt-2 text-3xl font-black text-white">
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

      <p className="mt-2 text-3xl font-black text-white">
        {totaleAllenamentiPeriodo}
      </p>
    </AppCard>

    <AppCard>
      <p className="text-xs font-bold uppercase tracking-widest text-zinc-500">
        Mesi disponibili
      </p>

      <p className="mt-2 text-3xl font-black text-white">
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

  <div className="grid gap-5 lg:grid-cols-4">
    <AppCard className="lg:col-span-3">
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
              onClick={() => setStatoSelezionato(null)}
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
</div>


);
}
