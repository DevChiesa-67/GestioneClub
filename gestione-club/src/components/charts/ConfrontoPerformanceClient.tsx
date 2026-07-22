"use client";

import { useEffect, useMemo, useState } from "react";
import { ArrowRight, Loader2, Users } from "lucide-react";

import { AppCard } from "@/components/ui/AppCard";
import { supabase } from "@/lib/supabase-client";
import {
  tagsPerTipiSeduta,
  risolviTipiSeduta,
  type TipoSedutaSingolo,
} from "@/lib/performance/catapult-filtri";

type TipoSeduta = "tutte" | "allenamento" | "partita";

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
  dataDa?: string;
  dataA?: string;
  tipoSeduta?: TipoSeduta;
  tipiSeduta?: TipoSedutaSingolo[];
  sessionTitles?: string[];
  splitSelezionati?: string[];
  coloreFlag: string;
};

type CatapultRow = {
  id: string;
  date: string | null;
  session_title: string | null;
  giocatore_id: string | null;
  duration: number | string | null;
  distance_metres: number | string | null;
  sprint_distance_m: number | string | null;
  top_speed_m_s: number | string | null;
  distance_per_min_m_min: number | string | null;
  power_score_w_kg: number | string | null;
  work_ratio: number | string | null;
  player_load: number | string | null;
  impacts: number | string | null;
  max_acceleration_m_s_s: number | string | null;
  max_deceleration_m_s_s: number | string | null;
};

type Metrica = {
  key: keyof CatapultRow;
  label: string;
  unita: string;
  decimals: number;
};

const METRICHE: Metrica[] = [
  { key: "distance_metres", label: "Distanza", unita: "m", decimals: 0 },
  { key: "sprint_distance_m", label: "Sprint Distance", unita: "m", decimals: 0 },
  { key: "top_speed_m_s", label: "Top Speed", unita: "m/s", decimals: 2 },
  { key: "distance_per_min_m_min", label: "Distanza/min", unita: "m/min", decimals: 2 },
  { key: "power_score_w_kg", label: "Power Score", unita: "", decimals: 1 },
  { key: "work_ratio", label: "Work Ratio", unita: "%", decimals: 1 },
  { key: "player_load", label: "Player Load", unita: "", decimals: 0 },
  { key: "impacts", label: "Impacts", unita: "", decimals: 0 },
  { key: "duration", label: "Durata", unita: "min", decimals: 0 },
  { key: "max_acceleration_m_s_s", label: "Max Acc", unita: "m/s²", decimals: 2 },
  { key: "max_deceleration_m_s_s", label: "Max Dec", unita: "m/s²", decimals: 2 },
];

function n(value: unknown): number | null {
  if (value === null || value === undefined || value === "") return null;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

function nomeCompleto(giocatore?: Giocatore | null) {
  if (!giocatore) return "—";
  return `${giocatore.nome ?? ""} ${giocatore.cognome ?? ""}`.trim() || "Senza nome";
}

function formatNumber(value: number | null, decimals = 1) {
  if (value === null || value === undefined || Number.isNaN(value)) return "—";

  return new Intl.NumberFormat("it-IT", {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  }).format(value);
}

function formatDate(value: string) {
  const [year, month, day] = value.split("-");
  if (!year || !month || !day) return value;
  return `${day}/${month}/${year}`;
}

async function fetchCatapultRows(params: {
  clubId: string;
  squadraId: string | null;
  giocatoreIds?: string[];
  dataDa?: string;
  dataA?: string;
  tipiSeduta?: TipoSedutaSingolo[];
  sessionTitles?: string[];
  splitSelezionati?: string[];
}) {
  const tags = tagsPerTipiSeduta(params.tipiSeduta ?? []);

  let query = supabase
    .from("catapult_data")
    .select(`
      id,
      date,
      session_title,
      giocatore_id,
      duration,
      distance_metres,
      sprint_distance_m,
      top_speed_m_s,
      distance_per_min_m_min,
      power_score_w_kg,
      work_ratio,
      player_load,
      impacts,
      max_acceleration_m_s_s,
      max_deceleration_m_s_s,
      club_id,
      squadra_id
    `)
    .eq("club_id", params.clubId);

  if (params.squadraId) {
    query = query.or(`squadra_id.eq.${params.squadraId},squadra_id.is.null`);
  }

  if (params.giocatoreIds && params.giocatoreIds.length > 0) {
    query = query.in("giocatore_id", params.giocatoreIds);
  }

  if (params.dataDa) {
    query = query.gte("date", params.dataDa);
  }

  if (params.dataA) {
    query = query.lte("date", params.dataA);
  }

  if (tags !== null) {
    query = query.in("tags", tags);
  }

  if (params.sessionTitles && params.sessionTitles.length > 0) {
    query = query.in("session_title", params.sessionTitles);
  }

  if (params.splitSelezionati && params.splitSelezionati.length > 0) {
    query = query.in("split_name", params.splitSelezionati);
  }

  const { data, error } = await query.order("date", { ascending: false });

  if (error) {
    console.error("Errore caricamento confronto performance:", error);
    return [] as CatapultRow[];
  }

  return (data ?? []) as CatapultRow[];
}

function avg(values: number[]) {
  if (values.length === 0) return null;
  return values.reduce((sum, value) => sum + value, 0) / values.length;
}

/* =========================================================
   MODALITA 1: CONFRONTO TRA GIOCATORI
========================================================= */

function ConfrontoTraGiocatori({
  clubId,
  squadraId,
  giocatori,
  giocatoreIds,
  dataDa,
  dataA,
  tipoSeduta,
  tipiSeduta,
  sessionTitles = [],
  splitSelezionati = [],
  coloreFlag,
}: Props) {
  const [metricaKey, setMetricaKey] = useState<keyof CatapultRow>(
    "distance_metres"
  );
  const [rows, setRows] = useState<CatapultRow[]>([]);
  const [loading, setLoading] = useState(false);

  const abilitato = giocatoreIds.length >= 2;
  const tipiSedutaEffettivi = risolviTipiSeduta(tipoSeduta, tipiSeduta);

  useEffect(() => {
    if (!abilitato) {
      setRows([]);
      return;
    }

    let cancelled = false;

    async function load() {
      setLoading(true);

      const data = await fetchCatapultRows({
        clubId,
        squadraId,
        giocatoreIds,
        dataDa,
        dataA,
        tipiSeduta: tipiSedutaEffettivi,
        sessionTitles,
        splitSelezionati,
      });

      if (!cancelled) {
        setRows(data);
        setLoading(false);
      }
    }

    void load();

    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    clubId,
    squadraId,
    giocatoreIds.join(","),
    dataDa,
    dataA,
    tipiSedutaEffettivi.join(","),
    sessionTitles.join(","),
    splitSelezionati.join(","),
  ]);

  const metrica = METRICHE.find((m) => m.key === metricaKey) ?? METRICHE[0];

  const statsPerGiocatore = useMemo(() => {
    return giocatoreIds
      .map((id) => {
        const giocatore = giocatori.find((g) => g.id === id) ?? null;

        const valori = rows
          .filter((row) => row.giocatore_id === id)
          .map((row) => n(row[metricaKey]))
          .filter((value): value is number => value !== null);

        return {
          giocatore,
          id,
          sessioni: valori.length,
          media: avg(valori),
          massimo: valori.length > 0 ? Math.max(...valori) : null,
          minimo: valori.length > 0 ? Math.min(...valori) : null,
        };
      })
      .sort((a, b) => (b.media ?? 0) - (a.media ?? 0));
  }, [rows, giocatoreIds, giocatori, metricaKey]);

  const massimoMedia = Math.max(
    1,
    ...statsPerGiocatore.map((s) => s.media ?? 0)
  );

  if (!abilitato) {
    return (
      <AppCard>
        <div className="flex flex-col items-center justify-center gap-3 py-16 text-center">
          <Users className="h-8 w-8 text-zinc-600" />
          <p className="text-sm font-semibold text-zinc-400">
            Seleziona almeno 2 giocatori dal filtro &quot;Giocatore&quot; qui
            sopra per confrontarli.
          </p>
        </div>
      </AppCard>
    );
  }

  return (
    <div className="space-y-4">
      <AppCard>
        <label className="mb-2 block text-xs font-bold uppercase tracking-wide text-zinc-500">
          Metrica da confrontare
        </label>

        <select
          value={metricaKey}
          onChange={(e) => setMetricaKey(e.target.value as keyof CatapultRow)}
          className="h-[48px] w-full max-w-sm rounded-2xl border border-white/10 bg-zinc-950 px-4 text-sm font-bold text-white outline-none transition focus:border-white/30"
        >
          {METRICHE.map((m) => (
            <option key={String(m.key)} value={String(m.key)}>
              {m.label}
            </option>
          ))}
        </select>
      </AppCard>

      <AppCard
        title={`${metrica.label} media per giocatore`}
      >
        {loading ? (
          <div className="flex min-h-[200px] items-center justify-center">
            <Loader2 size={28} className="animate-spin text-zinc-500" />
          </div>
        ) : (
          <div className="space-y-4">
            {statsPerGiocatore.map((stat) => {
              const percentuale =
                stat.media !== null
                  ? Math.max(4, (stat.media / massimoMedia) * 100)
                  : 0;

              return (
                <div key={stat.id}>
                  <div className="mb-1 flex items-center justify-between gap-2">
                    <span className="truncate text-sm font-bold text-white">
                      {nomeCompleto(stat.giocatore)}
                    </span>

                    <span className="shrink-0 text-sm font-black text-white">
                      {formatNumber(stat.media, metrica.decimals)}{" "}
                      <span className="text-xs font-semibold text-zinc-500">
                        {metrica.unita}
                      </span>
                    </span>
                  </div>

                  <div className="h-3 w-full overflow-hidden rounded-full bg-white/5">
                    <div
                      className="h-full rounded-full transition-all"
                      style={{
                        width: `${percentuale}%`,
                        backgroundColor: coloreFlag,
                      }}
                    />
                  </div>

                  <p className="mt-1 text-xs text-zinc-500">
                    {stat.sessioni} sessioni · min{" "}
                    {formatNumber(stat.minimo, metrica.decimals)} · max{" "}
                    {formatNumber(stat.massimo, metrica.decimals)}
                  </p>
                </div>
              );
            })}

            {statsPerGiocatore.length === 0 && (
              <p className="py-8 text-center text-sm text-zinc-500">
                Nessun dato disponibile per i giocatori selezionati.
              </p>
            )}
          </div>
        )}
      </AppCard>
    </div>
  );
}

/* =========================================================
   MODALITA 2: ANDAMENTO DI UN GIOCATORE TRA DUE SEDUTE
========================================================= */

type Sessione = {
  chiave: string;
  date: string;
  session_title: string | null;
  righe: CatapultRow[];
};

function aggregaSessioni(rows: CatapultRow[]): Sessione[] {
  const map = new Map<string, Sessione>();

  for (const row of rows) {
    if (!row.date) continue;

    const chiave = `${row.date}__${row.session_title ?? ""}`;
    const esistente = map.get(chiave);

    if (esistente) {
      esistente.righe.push(row);
    } else {
      map.set(chiave, {
        chiave,
        date: row.date,
        session_title: row.session_title,
        righe: [row],
      });
    }
  }

  return Array.from(map.values()).sort((a, b) =>
    b.date.localeCompare(a.date)
  );
}

function mediaMetricaSessione(sessione: Sessione, key: keyof CatapultRow) {
  const valori = sessione.righe
    .map((row) => n(row[key]))
    .filter((value): value is number => value !== null);

  return avg(valori);
}

function AndamentoSedute({
  clubId,
  squadraId,
  giocatori,
  coloreFlag,
}: Props) {
  const [giocatoreId, setGiocatoreId] = useState("");
  const [rows, setRows] = useState<CatapultRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [sedutaA, setSedutaA] = useState("");
  const [sedutaB, setSedutaB] = useState("");

  useEffect(() => {
    if (!giocatoreId) {
      setRows([]);
      return;
    }

    let cancelled = false;

    async function load() {
      setLoading(true);

      const data = await fetchCatapultRows({
        clubId,
        squadraId,
        giocatoreIds: [giocatoreId],
      });

      if (!cancelled) {
        setRows(data);
        setLoading(false);
        setSedutaA("");
        setSedutaB("");
      }
    }

    void load();

    return () => {
      cancelled = true;
    };
  }, [clubId, squadraId, giocatoreId]);

  const sessioni = useMemo(() => aggregaSessioni(rows), [rows]);

  const sessioneA = sessioni.find((s) => s.chiave === sedutaA) ?? null;
  const sessioneB = sessioni.find((s) => s.chiave === sedutaB) ?? null;

  function labelSessione(sessione: Sessione) {
    return `${formatDate(sessione.date)}${
      sessione.session_title ? ` — ${sessione.session_title}` : ""
    }`;
  }

  return (
    <div className="space-y-4">
      <AppCard>
        <div className="grid gap-4 sm:grid-cols-3">
          <div>
            <label className="mb-2 block text-xs font-bold uppercase tracking-wide text-zinc-500">
              Giocatore
            </label>

            <select
              value={giocatoreId}
              onChange={(e) => setGiocatoreId(e.target.value)}
              className="h-[48px] w-full rounded-2xl border border-white/10 bg-zinc-950 px-4 text-sm font-bold text-white outline-none transition focus:border-white/30"
            >
              <option value="">Seleziona giocatore</option>
              {giocatori.map((g) => (
                <option key={g.id} value={g.id}>
                  {nomeCompleto(g)}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="mb-2 block text-xs font-bold uppercase tracking-wide text-zinc-500">
              Seduta A
            </label>

            <select
              value={sedutaA}
              onChange={(e) => setSedutaA(e.target.value)}
              disabled={!giocatoreId}
              className="h-[48px] w-full rounded-2xl border border-white/10 bg-zinc-950 px-4 text-sm font-bold text-white outline-none transition focus:border-white/30 disabled:opacity-40"
            >
              <option value="">Seleziona seduta</option>
              {sessioni.map((s) => (
                <option key={s.chiave} value={s.chiave}>
                  {labelSessione(s)}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="mb-2 block text-xs font-bold uppercase tracking-wide text-zinc-500">
              Seduta B
            </label>

            <select
              value={sedutaB}
              onChange={(e) => setSedutaB(e.target.value)}
              disabled={!giocatoreId}
              className="h-[48px] w-full rounded-2xl border border-white/10 bg-zinc-950 px-4 text-sm font-bold text-white outline-none transition focus:border-white/30 disabled:opacity-40"
            >
              <option value="">Seleziona seduta</option>
              {sessioni.map((s) => (
                <option key={s.chiave} value={s.chiave}>
                  {labelSessione(s)}
                </option>
              ))}
            </select>
          </div>
        </div>
      </AppCard>

      {loading && (
        <AppCard>
          <div className="flex min-h-[160px] items-center justify-center">
            <Loader2 size={28} className="animate-spin text-zinc-500" />
          </div>
        </AppCard>
      )}

      {!loading && giocatoreId && sessioni.length === 0 && (
        <AppCard>
          <p className="py-8 text-center text-sm text-zinc-500">
            Nessuna sessione disponibile per questo giocatore.
          </p>
        </AppCard>
      )}

      {!loading && sessioneA && sessioneB && (
        <AppCard title="Confronto tra le due sedute">
          <div className="mb-4 flex flex-wrap items-center justify-center gap-3 text-sm font-bold text-white">
            <span className="rounded-xl border border-white/10 bg-white/5 px-3 py-2">
              {labelSessione(sessioneA)}
            </span>

            <ArrowRight className="h-4 w-4 text-zinc-500" />

            <span className="rounded-xl border border-white/10 bg-white/5 px-3 py-2">
              {labelSessione(sessioneB)}
            </span>
          </div>

          <div className="overflow-x-auto rounded-2xl border border-white/10">
            <table className="w-full min-w-[640px] border-collapse">
              <thead>
                <tr className="bg-zinc-950">
                  <th className="border-b border-white/10 px-4 py-3 text-left text-xs font-black uppercase tracking-wide text-zinc-400">
                    Metrica
                  </th>
                  <th className="border-b border-white/10 px-4 py-3 text-right text-xs font-black uppercase tracking-wide text-zinc-400">
                    Seduta A
                  </th>
                  <th className="border-b border-white/10 px-4 py-3 text-right text-xs font-black uppercase tracking-wide text-zinc-400">
                    Seduta B
                  </th>
                  <th className="border-b border-white/10 px-4 py-3 text-right text-xs font-black uppercase tracking-wide text-zinc-400">
                    Δ
                  </th>
                </tr>
              </thead>

              <tbody>
                {METRICHE.map((metrica) => {
                  const valoreA = mediaMetricaSessione(
                    sessioneA,
                    metrica.key
                  );
                  const valoreB = mediaMetricaSessione(
                    sessioneB,
                    metrica.key
                  );

                  const delta =
                    valoreA !== null && valoreB !== null
                      ? valoreB - valoreA
                      : null;

                  return (
                    <tr
                      key={String(metrica.key)}
                      className="border-b border-white/5"
                    >
                      <td className="px-4 py-3 text-sm font-bold text-white">
                        {metrica.label}
                        {metrica.unita && (
                          <span className="ml-1 text-xs font-semibold text-zinc-500">
                            ({metrica.unita})
                          </span>
                        )}
                      </td>

                      <td className="px-4 py-3 text-right text-sm font-semibold text-zinc-300">
                        {formatNumber(valoreA, metrica.decimals)}
                      </td>

                      <td className="px-4 py-3 text-right text-sm font-semibold text-zinc-300">
                        {formatNumber(valoreB, metrica.decimals)}
                      </td>

                      <td
                        className="px-4 py-3 text-right text-sm font-black"
                        style={{
                          color:
                            delta === null
                              ? undefined
                              : delta >= 0
                                ? coloreFlag
                                : "#f87171",
                        }}
                      >
                        {delta === null
                          ? "—"
                          : `${delta > 0 ? "+" : ""}${formatNumber(
                              delta,
                              metrica.decimals
                            )}`}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </AppCard>
      )}
    </div>
  );
}

/* =========================================================
   COMPONENTE PRINCIPALE
========================================================= */

export default function ConfrontoPerformanceClient(props: Props) {
  const [modalita, setModalita] = useState<"giocatori" | "sedute">(
    "giocatori"
  );

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap gap-2 rounded-2xl border border-white/10 bg-zinc-950 p-2">
        <button
          type="button"
          onClick={() => setModalita("giocatori")}
          className="rounded-xl px-4 py-2.5 text-sm font-black transition"
          style={
            modalita === "giocatori"
              ? { backgroundColor: props.coloreFlag, color: "#fff" }
              : { backgroundColor: "transparent", color: "#a1a1aa" }
          }
        >
          Tra giocatori
        </button>

        <button
          type="button"
          onClick={() => setModalita("sedute")}
          className="rounded-xl px-4 py-2.5 text-sm font-black transition"
          style={
            modalita === "sedute"
              ? { backgroundColor: props.coloreFlag, color: "#fff" }
              : { backgroundColor: "transparent", color: "#a1a1aa" }
          }
        >
          Andamento tra due sedute
        </button>
      </div>

      {modalita === "giocatori" ? (
        <ConfrontoTraGiocatori {...props} />
      ) : (
        <AndamentoSedute {...props} />
      )}
    </div>
  );
}
