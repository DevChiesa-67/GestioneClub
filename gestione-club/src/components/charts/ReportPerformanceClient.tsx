"use client";

import { useEffect, useMemo, useState } from "react";
import { Loader2 } from "lucide-react";
import { AppCard } from "@/components/ui/AppCard";
import { supabase } from "@/lib/supabase-client";
import {
  risolviTipiSeduta,
  type TipoSedutaSingolo,
} from "@/lib/performance/catapult-filtri";

type StatoPresenzaDb =
| "presente_mattina"
| "presente_pomeriggio"
| "presente_entrambe"
| "infortunato"
| "assenza_giustificata"
| "assenza_ingiustificata";

type TipoSeduta = "tutte" | "allenamento" | "partita";

type PresenzaRow = {
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
eventoId?: string | null;
eventoIds?: string[];
hideFilters?: boolean;
};

const STATI: {
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

function BarChart({
dati,
}: {
dati: { data: string; totale: number }[];
}) {
const max = Math.max(...dati.map((d) => d.totale), 1);

return ( 
<div className="flex h-80 items-end gap-3 overflow-x-auto">
{dati.length === 0 && ( <div className="flex h-full w-full items-center justify-center text-sm text-zinc-500">
Nessun dato disponibile. </div>
)}


  {dati.map((item) => {
    const altezza = Math.max((item.totale / max) * 240, 8);

    return (
      <div
        key={item.data}
        className="flex min-w-20 flex-col items-center justify-end gap-2"
      >
        <p className="text-sm font-bold text-white">
          {item.totale}
        </p>

        <div
          className="w-9 rounded-t-xl bg-[#d71920]"
          style={{ height: `${altezza}px` }}
        />

        <p className="max-w-20 truncate text-center text-xs text-zinc-500">
          {formatData(item.data)}
        </p>
      </div>
    );
  })}
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

export default function ReportPerformanceClient({
clubId,
squadraId,
dataDa = "",
dataA = "",
tipoSeduta = "tutte",
tipiSeduta = [],
giocatoreId = null,
giocatoreIds = [],
eventoId = null,
eventoIds = [],

}: Props) {
const [presenze, setPresenze] = useState<PresenzaRow[]>(
[]
);

const [loading, setLoading] = useState(true);

const tipiSedutaEffettivi = risolviTipiSeduta(tipoSeduta, tipiSeduta);

useEffect(() => {
let cancelled = false;


async function loadPresenze() {
  setLoading(true);

  /*
   * Questo componente legge presenze_allenamenti.
   *
   * Quindi:
   * - nessun filtro, o "allenamento" incluso -> mostra i dati
   * - solo "partita" selezionato -> nessun dato, perché le
   *   presenze partita appartengono a una sorgente diversa
   */
  const soloPartita =
    tipiSedutaEffettivi.length === 1 &&
    tipiSedutaEffettivi[0] === "partita";

  if (soloPartita) {
    if (!cancelled) {
      setPresenze([]);
      setLoading(false);
    }
    return;
  }

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
    .eq("club_id", clubId);

  /*
   * Multi-squadra:
   * filtra sempre per la squadra attiva quando presente.
   */
  if (squadraId) {
    query = query.eq("squadra_id", squadraId);
  }

  /*
   * Filtro giocatore (supporta selezione multipla).
   */
  const filtroGiocatori =
    giocatoreIds.length > 0
      ? giocatoreIds
      : giocatoreId
        ? [giocatoreId]
        : null;

  if (filtroGiocatori) {
    query = query.in("giocatore_id", filtroGiocatori);
  }

  /*
   * Filtro evento specifico (supporta selezione multipla).
   * In questo componente l'evento è un allenamento.
   */
  const filtroEventi =
    eventoIds.length > 0 ? eventoIds : eventoId ? [eventoId] : null;

  if (filtroEventi) {
    query = query.in("allenamento_id", filtroEventi);
  }

  const { data, error } = await query;

  if (cancelled) return;

  if (error) {
    console.error(
      "Errore presenze_allenamenti:",
      error
    );

    setPresenze([]);
    setLoading(false);
    return;
  }

  const rows = (
    (data ?? []) as unknown as PresenzaRow[]
  ).filter((row) => {
    const dataAllenamento =
      row.allenamento?.data_allenamento;

    if (!dataAllenamento) return false;

    if (dataDa && dataAllenamento < dataDa) {
      return false;
    }

    if (dataA && dataAllenamento > dataA) {
      return false;
    }

    return true;
  });

  setPresenze(rows);
  setLoading(false);
}

loadPresenze();

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
eventoId,
eventoIds.join(","),
]);

const totalePerStato = useMemo(() => {
const result = {} as Record<
StatoPresenzaDb,
number
>;


for (const stato of STATI) {
  result[stato.key] = 0;
}

for (const row of presenze) {
  result[row.stato] =
    (result[row.stato] ?? 0) + 1;
}

return result;


}, [presenze]);

const datiGrafico = useMemo(() => {
const grouped = presenze.reduce<
Record<string, number>
>((acc, presenza) => {
const data =
presenza.allenamento?.data_allenamento;


  if (!data) return acc;

  acc[data] = (acc[data] ?? 0) + 1;

  return acc;
}, {});

return Object.entries(grouped)
  .map(([data, totale]) => ({
    data,
    totale,
  }))
  .sort((a, b) => a.data.localeCompare(b.data));


}, [presenze]);

const distribuzione = useMemo(() => {
return Object.entries(totalePerStato)
.map(([stato, totale]) => ({
stato: stato as StatoPresenzaDb,
totale,
}))
.filter((item) => item.totale > 0)
.sort((a, b) => b.totale - a.totale);
}, [totalePerStato]);

const mesiDisponibili = useMemo(() => {
const mesi = new Set<string>();


presenze.forEach((presenza) => {
  const data =
    presenza.allenamento?.data_allenamento;

  if (data) {
    mesi.add(data.slice(0, 7));
  }
});

return Array.from(mesi).sort();


}, [presenze]);

const totalePresenze = presenze.filter((p) =>
[
"presente_mattina",
"presente_pomeriggio",
"presente_entrambe",
].includes(p.stato)
).length;

const totaleAllenamentiPeriodo = presenze.length;

const percentualePresenza =
totaleAllenamentiPeriodo > 0
? Math.round(
(totalePresenze /
totaleAllenamentiPeriodo) *
100
)
: 0;

return ( <div className="space-y-5"> <div className="grid gap-3 md:grid-cols-6">
{STATI.map((stato) => ( <AppCard key={stato.key}> <div className="flex items-center justify-between"> <div> <p className="text-xs text-zinc-400">
{stato.title} </p>


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
    ))}
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
      <div className="mb-4 flex items-center justify-between">
        <h2 className="text-lg font-semibold text-white">
          Andamento presenze allenamenti
        </h2>

        {loading && (
          <Loader2 className="h-5 w-5 animate-spin text-zinc-400" />
        )}
      </div>

      <BarChart dati={datiGrafico} />
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
