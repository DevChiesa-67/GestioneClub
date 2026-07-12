
"use client";

import { useEffect, useMemo, useState } from "react";
import { Loader2 } from "lucide-react";

import { AppCard } from "@/components/ui/AppCard";
import { supabase } from "@/lib/supabase-client";

import LineChart from "@/components/charts/LineChart";
import BarChart from "@/components/charts/BarChart";
import DistanceVsSprintChart from "@/components/charts/DistanceVsSprintChart";

type TipoSeduta = "tutte" | "allenamento" | "partita";

type Row = {
  id: string;
  date: string;
  label: string;
  player_name: string | null;
  session_title: string | null;
  work_ratio: number | null;
  power_score: number | null;
  player_load: number | null;
  distance: number | null;
  sprint_distance: number | null;
};

type CatapultRow = {
  id: string;
  date: string | null;
  session_title: string | null;
  player_name: string | null;
  giocatore_id: string | null;
  work_ratio: number | string | null;
  power_score_w_kg: number | string | null;
  player_load: number | string | null;
  distance_metres: number | string | null;
  sprint_distance_m: number | string | null;
};

type Props = {
  clubId: string;
  squadraId: string | null;
  giocatoreId?: string | null;
  dataDa?: string;
  dataA?: string;
  tipoSeduta?: TipoSeduta;
  eventoId?: string | null;
  coloreFlag: string;
};

function n(value: unknown): number | null {
  if (value === null || value === undefined || value === "") return null;

  const parsed = Number(value);

  return Number.isFinite(parsed) ? parsed : null;
}

function avg(values: Array<number | null>) {
  const validValues = values.filter(
    (value): value is number => value !== null && Number.isFinite(value)
  );

  if (validValues.length === 0) return null;

  return validValues.reduce((sum, value) => sum + value, 0) / validValues.length;
}

function formatDateLabel(value: string) {
  const [year, month, day] = value.split("-");

  if (!year || !month || !day) return value;

  return `${day}/${month}`;
}

function aggregateByDate(rows: CatapultRow[]): Row[] { const groups = new Map< string, { date: string; work_ratio: Array<number | null>; power_score: Array<number | null>; player_load: Array<number | null>; distance: Array<number | null>; sprint_distance: Array<number | null>; } >(); for (const row of rows) { if (!row.date) continue; const key = row.date; const existing = groups.get(key) ?? { date: row.date, work_ratio: [], power_score: [], player_load: [], distance: [], sprint_distance: [], }; existing.work_ratio.push(n(row.work_ratio)); existing.power_score.push(n(row.power_score_w_kg)); existing.player_load.push(n(row.player_load)); existing.distance.push(n(row.distance_metres)); existing.sprint_distance.push(n(row.sprint_distance_m)); groups.set(key, existing); } return Array.from(groups.values()) .map((group) => ({ id: group.date, date: group.date, label: formatDateLabel(group.date), player_name: null, session_title: null, work_ratio: avg(group.work_ratio), power_score: avg(group.power_score), player_load: avg(group.player_load), distance: avg(group.distance), sprint_distance: avg(group.sprint_distance), })) .sort((a, b) => a.date.localeCompare(b.date)); }

export default function PerformanceDashboardChartsClient({
  clubId,
  squadraId,
  giocatoreId = null,
  dataDa = "",
  dataA = "",
  tipoSeduta = "tutte",
  eventoId = null,
  coloreFlag,
}: Props) {
  const [rows, setRows] = useState<Row[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;

    async function loadData() {
      setLoading(true);

      try {
        let query = supabase
          .from("catapult_data")
          .select(`
            id,
            date,
            session_title,
            player_name,
            giocatore_id,
            work_ratio,
            power_score_w_kg,
            player_load,
            distance_metres,
            sprint_distance_m,
            club_id,
            squadra_id
          `)
          .eq("club_id", clubId);

        if (squadraId) {
          query = query.or(`squadra_id.eq.${squadraId},squadra_id.is.null`);
        }

        if (giocatoreId) {
          query = query.eq("giocatore_id", giocatoreId);
        }

        if (dataDa) {
          query = query.gte("date", dataDa);
        }

        if (dataA) {
          query = query.lte("date", dataA);
        }

        if (tipoSeduta === "allenamento") {
          query = query.or(
            "session_title.ilike.%training%,session_title.ilike.%allenamento%"
          );
        }

        if (tipoSeduta === "partita") {
          query = query.or(
            "session_title.ilike.%game%,session_title.ilike.%match%,session_title.ilike.%partita%"
          );
        }

        void eventoId;

        query = query.order("date", { ascending: true });

        const { data, error } = await query;

        if (cancelled) return;

        if (error) {
          console.error(
            "Errore caricamento grafici performance:",
            JSON.stringify(error, null, 2)
          );

          setRows([]);
          return;
        }

        const catapultRows = (data ?? []) as CatapultRow[];

        setRows(aggregateByDate(catapultRows));
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    }

    void loadData();

    return () => {
      cancelled = true;
    };
  }, [
    clubId,
    squadraId,
    giocatoreId,
    dataDa,
    dataA,
    tipoSeduta,
    eventoId,
  ]);

  const cleanRows = useMemo(() => {
    return rows.filter((row) => row.date);
  }, [rows]);

  if (loading) {
    return (
      <AppCard>
        <div className="flex min-h-[260px] items-center justify-center sm:min-h-[320px]">
          <Loader2 size={28} className="animate-spin text-zinc-500" />
        </div>
      </AppCard>
    );
  }

  if (cleanRows.length === 0) {
    return (
      <AppCard>
        <div className="px-4 py-12 text-center text-sm font-semibold text-zinc-500 sm:py-16">
          Nessun dato disponibile per i grafici performance.
        </div>
      </AppCard>
    );
  }

  return (
    <div className="grid gap-4 sm:gap-6 xl:grid-cols-2">
      <div className="min-w-0 overflow-hidden">
        <LineChart
          title="Media Work Ratio per giornata"
          yLabel="Work Ratio medio (%)"
          rows={cleanRows}
          valueKey="work_ratio"
          coloreFlag={coloreFlag}
        />
      </div>

      <div className="min-w-0 overflow-hidden">
        <LineChart
          title="Media Power Score per giornata"
          yLabel="Power Score medio"
          rows={cleanRows}
          valueKey="power_score"
          coloreFlag={coloreFlag}
        />
      </div>

      <div className="min-w-0 overflow-hidden">
        <BarChart
          title="Media Player Load per giornata"
          yLabel="Player Load medio"
          rows={cleanRows}
          valueKey="player_load"
          coloreFlag={coloreFlag}
        />
      </div>

      <div className="min-w-0 overflow-hidden">
        <DistanceVsSprintChart rows={cleanRows} coloreFlag={coloreFlag} />
      </div>
    </div>
  );
}

