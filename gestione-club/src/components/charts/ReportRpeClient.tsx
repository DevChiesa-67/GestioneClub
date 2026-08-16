"use client";

import { useState } from "react";
import {
  CartesianGrid,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

import { AppCard } from "@/components/ui/AppCard";
import { formatDataIT } from "@/lib/date";

export type RpePerformanceRow = {
  id: string;
  giocatore_id: string;
  data_compilazione: string;
  tipo_compilazione: "campo" | "palestra";
  seduta: string | null;
  rpe: number;
  minutaggio_lavoro: number | null;
};

type Giocatore = {
  id: string;
  nome: string | null;
  cognome: string | null;
};

type Props = {
  mode: "table" | "charts";
  rows: RpePerformanceRow[];
  giocatori: Giocatore[];
  giocatoreIds: string[];
  dataDa: string;
  dataA: string;
};

type PuntoRpe = {
  data: string;
  label: string;
  rpe: number;
  srpe: number | null;
};

function nomeGiocatore(giocatore: Giocatore | undefined) {
  if (!giocatore) return "Giocatore non disponibile";
  return `${giocatore.nome ?? ""} ${giocatore.cognome ?? ""}`.trim() || "Giocatore senza nome";
}

export default function ReportRpeClient({
  mode,
  rows,
  giocatori,
  giocatoreIds,
  dataDa,
  dataA,
}: Props) {
  const nomi = new Map(giocatori.map((giocatore) => [giocatore.id, giocatore]));
  const filtrate = rows.filter((row) => {
    if (giocatoreIds.length > 0 && !giocatoreIds.includes(row.giocatore_id)) return false;
    if (dataDa && row.data_compilazione < dataDa) return false;
    if (dataA && row.data_compilazione > dataA) return false;
    return true;
  });

  if (mode === "table") {
    return (
      <AppCard title="RPE e sRPE">
        <div className="overflow-x-auto rounded-2xl border border-white/10">
          <table className="w-full min-w-[900px] border-collapse text-sm">
            <thead className="bg-zinc-950 text-left text-xs font-black uppercase tracking-wide text-zinc-400">
              <tr>
                <th className="px-4 py-4">Data</th>
                <th className="px-4 py-4">Giocatore</th>
                <th className="px-4 py-4">Tipo</th>
                <th className="px-4 py-4">Seduta</th>
                <th className="px-4 py-4 text-right">Minuti</th>
                <th className="px-4 py-4 text-right">RPE</th>
                <th className="px-4 py-4 text-right">sRPE</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/5">
              {filtrate.map((row) => (
                <tr key={row.id} className="text-zinc-300 transition hover:bg-white/[0.03]">
                  <td className="whitespace-nowrap px-4 py-3">{formatDataIT(row.data_compilazione)}</td>
                  <td className="px-4 py-3 font-bold text-white">
                    {nomeGiocatore(nomi.get(row.giocatore_id))}
                  </td>
                  <td className="px-4 py-3 capitalize">{row.tipo_compilazione}</td>
                  <td className="px-4 py-3">{row.seduta || "—"}</td>
                  <td className="px-4 py-3 text-right">
                    {row.minutaggio_lavoro !== null ? row.minutaggio_lavoro : "—"}
                  </td>
                  <td className="px-4 py-3 text-right font-bold text-sky-400">{row.rpe}/10</td>
                  <td className="px-4 py-3 text-right font-bold text-orange-400">
                    {row.minutaggio_lavoro !== null ? row.rpe * row.minutaggio_lavoro : "—"}
                  </td>
                </tr>
              ))}
              {filtrate.length === 0 && (
                <tr>
                  <td colSpan={7} className="px-6 py-16 text-center text-zinc-500">
                    Nessuna misurazione RPE disponibile con i filtri selezionati.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </AppCard>
    );
  }

  const gruppi = new Map<string, { rpe: number[]; srpe: number[] }>();
  for (const row of filtrate) {
    const gruppo = gruppi.get(row.data_compilazione) ?? { rpe: [], srpe: [] };
    gruppo.rpe.push(row.rpe);
    if (row.minutaggio_lavoro !== null) gruppo.srpe.push(row.rpe * row.minutaggio_lavoro);
    gruppi.set(row.data_compilazione, gruppo);
  }
  const puntiGiornalieri: PuntoRpe[] = Array.from(gruppi.entries())
    .sort((a, b) => a[0].localeCompare(b[0]))
    .map(([data, valori]) => ({
      data,
      label: formatDataIT(data).slice(0, 5),
      rpe: valori.rpe.reduce((somma, valore) => somma + valore, 0) / valori.rpe.length,
      srpe:
        valori.srpe.length > 0
          ? valori.srpe.reduce((somma, valore) => somma + valore, 0) / valori.srpe.length
          : null,
    }));

  const punti7gg: PuntoRpe[] = puntiGiornalieri.map((punto) => {
    const inizioPeriodo = new Date(`${punto.data}T12:00:00`);
    inizioPeriodo.setDate(inizioPeriodo.getDate() - 6);
    const inizioPeriodoIso = [
      inizioPeriodo.getFullYear(),
      String(inizioPeriodo.getMonth() + 1).padStart(2, "0"),
      String(inizioPeriodo.getDate()).padStart(2, "0"),
    ].join("-");
    const righePeriodo = filtrate.filter(
      (row) =>
        row.data_compilazione >= inizioPeriodoIso &&
        row.data_compilazione <= punto.data,
    );
    const valoriRpe = righePeriodo.map((row) => row.rpe);
    const valoriSrpe = righePeriodo
      .filter((row) => row.minutaggio_lavoro !== null)
      .map((row) => row.rpe * Number(row.minutaggio_lavoro));

    return {
      data: punto.data,
      label: punto.label,
      rpe:
        valoriRpe.reduce((somma, valore) => somma + valore, 0) /
        valoriRpe.length,
      srpe:
        valoriSrpe.length > 0
          ? valoriSrpe.reduce((somma, valore) => somma + valore, 0) /
            valoriSrpe.length
          : null,
    };
  });

  return (
    <div className="grid gap-4 xl:grid-cols-2">
      <Grafico
        title="RPE medio"
        dataKey="rpe"
        puntiGiornalieri={puntiGiornalieri}
        punti7gg={punti7gg}
        colore="#38bdf8"
        dominio={[0, 10]}
        decimali={1}
      />
      <Grafico
        title="sRPE medio"
        dataKey="srpe"
        puntiGiornalieri={puntiGiornalieri}
        punti7gg={punti7gg}
        colore="#f97316"
        decimali={0}
      />
    </div>
  );
}

function Grafico({
  title,
  dataKey,
  puntiGiornalieri,
  punti7gg,
  colore,
  dominio,
  decimali,
}: {
  title: string;
  dataKey: "rpe" | "srpe";
  puntiGiornalieri: PuntoRpe[];
  punti7gg: PuntoRpe[];
  colore: string;
  dominio?: [number, number];
  decimali: number;
}) {
  const [visualizzazione, setVisualizzazione] = useState<
    "giornaliera" | "sette_giorni"
  >("giornaliera");
  const punti =
    visualizzazione === "giornaliera" ? puntiGiornalieri : punti7gg;

  return (
    <AppCard title={title}>
      <div className="mb-4 flex flex-wrap gap-2">
        <button
          type="button"
          onClick={() => setVisualizzazione("giornaliera")}
          className="rounded-lg px-3 py-2 text-xs font-bold transition"
          style={
            visualizzazione === "giornaliera"
              ? { backgroundColor: colore, color: "#09090b" }
              : { backgroundColor: "rgba(255,255,255,0.06)", color: "#a1a1aa" }
          }
        >
          Media Giornaliera
        </button>
        <button
          type="button"
          onClick={() => setVisualizzazione("sette_giorni")}
          className="rounded-lg px-3 py-2 text-xs font-bold transition"
          style={
            visualizzazione === "sette_giorni"
              ? { backgroundColor: colore, color: "#09090b" }
              : { backgroundColor: "rgba(255,255,255,0.06)", color: "#a1a1aa" }
          }
        >
          Media 7 GG
        </button>
      </div>
      {punti.length === 0 ? (
        <div className="flex h-72 items-center justify-center text-sm text-zinc-500">Nessun dato disponibile.</div>
      ) : (
        <div className="h-72 w-full">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={punti} margin={{ top: 10, right: 12, left: 0, bottom: 0 }}>
              <CartesianGrid stroke="#27272a" strokeDasharray="4 4" />
              <XAxis dataKey="label" tick={{ fill: "#a1a1aa", fontSize: 11 }} tickLine={false} axisLine={false} />
              <YAxis domain={dominio} tick={{ fill: "#a1a1aa", fontSize: 11 }} tickLine={false} axisLine={false} width={44} />
              <Tooltip
                formatter={(value) => Number(value).toFixed(decimali)}
                contentStyle={{ background: "#18181b", border: "1px solid #3f3f46", borderRadius: 12 }}
              />
              <Line type="monotone" dataKey={dataKey} name={title} stroke={colore} strokeWidth={3} dot={{ r: 4, fill: colore, strokeWidth: 0 }} connectNulls={false} />
            </LineChart>
          </ResponsiveContainer>
        </div>
      )}
    </AppCard>
  );
}
