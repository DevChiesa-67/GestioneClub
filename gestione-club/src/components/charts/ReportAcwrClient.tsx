"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { Loader2 } from "lucide-react";

import { AppCard } from "@/components/ui/AppCard";
import { supabase } from "@/lib/supabase-client";
import {
  dateCatapultPerTipiSeduta,
  type TipoSedutaSingolo,
} from "@/lib/performance/catapult-filtri";

type AcwrRow = {
  id: string;
  club_id: string;
  squadra_id: string | null;
  giocatore_id: string | null;
  data: string;
  player_load_giornaliero: number;
  acuto_media_7gg: number | null;
  cronico_media_28gg: number | null;
  acwr_media_mobile: number | null;
  acuto_ewma: number | null;
  cronico_ewma: number | null;
  acwr_ewma: number | null;
};

type AcwrParametriModello = {
  id: string;
  club_id: string;
  squadra_id: string | null;
  finestra_acuta_giorni: number;
  finestra_cronica_giorni: number;
  lambda_acuto_ewma: number;
  lambda_cronico_ewma: number;
  sotto_carico_max: number;
  zona_ottimale_min: number;
  zona_ottimale_max: number;
  attenzione_min: number;
  attenzione_max: number;
  rischio_elevato_min: number;
};

type Props = {
  mode: "chart" | "table";
  clubId: string;
  squadraId: string | null;
  giocatoreId?: string | null;
  giocatoreIds?: string[];
  dataDa?: string;
  dataA?: string;
  tipiSeduta?: TipoSedutaSingolo[];
  coloreFlag: string;
};

function formatDate(value: string) {
  const [year, month, day] = value.split("-");
  return `${day}/${month}/${year}`;
}

function formatNumber(value: number | null, decimals = 1) {
  if (value === null || value === undefined) return "—";

  return new Intl.NumberFormat("it-IT", {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  }).format(value);
}

function formatAcwr(value: number | null) {
  if (value === null || value === undefined) return "—";

  return new Intl.NumberFormat("it-IT", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(value);
}

/*
 * Colora un valore ACWR in base alle soglie del modello attivo per il
 * club/squadra (catapult_acwr_parametri_modello). Se il modello non è
 * configurato, usiamo soglie standard di letteratura come fallback
 * (0.8 / 1.3 / 1.5).
 */
function coloreZonaAcwr(
  value: number | null,
  parametri: AcwrParametriModello | null
): string | undefined {
  if (value === null || value === undefined) return undefined;

  const sottoCaricoMax = parametri?.sotto_carico_max ?? 0.8;
  const zonaOttimaleMax = parametri?.zona_ottimale_max ?? 1.3;
  const attenzioneMax = parametri?.attenzione_max ?? 1.5;

  if (value < sottoCaricoMax) return "#7dd3fc"; // sky-300, sotto-carico
  if (value <= zonaOttimaleMax) return "#6ee7b7"; // emerald-300, zona ottimale
  if (value <= attenzioneMax) return "#fcd34d"; // amber-300, attenzione
  return "#fca5a5"; // red-300, rischio elevato
}

function AcwrChart({
  rows,
  coloreFlag,
}: {
  rows: AcwrRow[];
  coloreFlag: string;
}) {
  const width = 1200;
  const height = 430;

  const paddingLeft = 70;
  const paddingRight = 30;
  const paddingTop = 30;
  const paddingBottom = 90;

  const chartWidth = width - paddingLeft - paddingRight;
  const chartHeight = height - paddingTop - paddingBottom;

  const valori = rows.flatMap((row) => {
    const result: number[] = [];

    if (row.acwr_media_mobile !== null) result.push(row.acwr_media_mobile);
    if (row.acwr_ewma !== null) result.push(row.acwr_ewma);

    return result;
  });

  const minValue = valori.length > 0 ? Math.min(...valori) : 0.8;
  const maxValue = valori.length > 0 ? Math.max(...valori) : 1.2;

  const minY = Math.min(0.4, Math.floor((minValue - 0.1) * 10) / 10);
  const maxY = Math.max(1.2, Math.ceil((maxValue + 0.1) * 10) / 10);

  const xForIndex = useCallback(
    (index: number) => {
      if (rows.length <= 1) {
        return paddingLeft + chartWidth / 2;
      }

      return paddingLeft + (index / (rows.length - 1)) * chartWidth;
    },
    [rows.length, chartWidth]
  );

  const yForValue = useCallback(
    (value: number) => {
      const range = maxY - minY || 1;
      const normalized = (value - minY) / range;

      return paddingTop + chartHeight - normalized * chartHeight;
    },
    [maxY, minY, chartHeight]
  );

  const mediaMobileSegments = useMemo(() => {
    const segments: string[][] = [];
    let current: string[] = [];

    rows.forEach((row, index) => {
      if (row.acwr_media_mobile === null) {
        if (current.length > 0) {
          segments.push(current);
          current = [];
        }

        return;
      }

      current.push(`${xForIndex(index)},${yForValue(row.acwr_media_mobile)}`);
    });

    if (current.length > 0) segments.push(current);

    return segments;
  }, [rows, xForIndex, yForValue]);

  const ewmaSegments = useMemo(() => {
    const segments: string[][] = [];
    let current: string[] = [];

    rows.forEach((row, index) => {
      if (row.acwr_ewma === null) {
        if (current.length > 0) {
          segments.push(current);
          current = [];
        }

        return;
      }

      current.push(`${xForIndex(index)},${yForValue(row.acwr_ewma)}`);
    });

    if (current.length > 0) segments.push(current);

    return segments;
  }, [rows, xForIndex, yForValue]);

  const tickCount = 5;

  const yTicks = Array.from({ length: tickCount }, (_, index) => {
    return minY + ((maxY - minY) / (tickCount - 1)) * index;
  });

  const labelStep = Math.max(1, Math.ceil(rows.length / 14));

  if (rows.length === 0) {
    return (
      <div className="flex min-h-[360px] items-center justify-center text-sm font-semibold text-zinc-500">
        Nessun dato ACWR disponibile.
      </div>
    );
  }

  return (
    <div className="w-full overflow-x-auto">
      <div className="min-w-[900px]">
        <svg
          viewBox={`0 0 ${width} ${height}`}
          className="h-auto w-full"
          role="img"
          aria-label="ACWR nel tempo"
        >
          {yTicks.map((tick) => {
            const y = yForValue(tick);

            return (
              <g key={tick}>
                <line
                  x1={paddingLeft}
                  x2={width - paddingRight}
                  y1={y}
                  y2={y}
                  stroke="rgba(255,255,255,0.12)"
                  strokeWidth="1"
                />

                <text
                  x={paddingLeft - 14}
                  y={y + 5}
                  textAnchor="end"
                  fill="#a1a1aa"
                  fontSize="13"
                >
                  {tick.toFixed(2).replace(".", ",")}
                </text>
              </g>
            );
          })}

          <line
            x1={paddingLeft}
            x2={paddingLeft}
            y1={paddingTop}
            y2={height - paddingBottom}
            stroke="rgba(255,255,255,0.25)"
          />

          <line
            x1={paddingLeft}
            x2={width - paddingRight}
            y1={height - paddingBottom}
            y2={height - paddingBottom}
            stroke="rgba(255,255,255,0.25)"
          />

          {mediaMobileSegments.map((segment, index) => (
            <polyline
              key={`mobile-${index}`}
              points={segment.join(" ")}
              fill="none"
              stroke={coloreFlag}
              strokeWidth="4"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          ))}

          {ewmaSegments.map((segment, index) => (
            <polyline
              key={`ewma-${index}`}
              points={segment.join(" ")}
              fill="none"
              stroke="#ef4444"
              strokeWidth="4"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          ))}

          {rows.map((row, index) => {
            if (index % labelStep !== 0 && index !== rows.length - 1) {
              return null;
            }

            const x = xForIndex(index);

            return (
              <g
                key={row.id}
                transform={`translate(${x}, ${
                  height - paddingBottom + 20
                }) rotate(-45)`}
              >
                <text textAnchor="end" fill="#a1a1aa" fontSize="11">
                  {formatDate(row.data)}
                </text>
              </g>
            );
          })}
        </svg>

        <div className="mt-2 flex flex-wrap items-center justify-center gap-6">
          <div className="flex items-center gap-2">
            <span
              className="h-[3px] w-8 rounded-full"
              style={{ backgroundColor: coloreFlag }}
            />

            <span className="text-sm font-bold text-zinc-300">
              ACWR Media Mobile
            </span>
          </div>

          <div className="flex items-center gap-2">
            <span className="h-[3px] w-8 rounded-full bg-red-500" />

            <span className="text-sm font-bold text-zinc-300">ACWR EWMA</span>
          </div>
        </div>
      </div>
    </div>
  );
}

function AcwrTable({
  rows,
  parametri,
}: {
  rows: AcwrRow[];
  parametri: AcwrParametriModello | null;
}) {
  return (
    <div className="overflow-x-auto rounded-2xl border border-white/10">
      <table className="w-full min-w-[1350px] border-collapse">
        <thead>
          <tr className="bg-zinc-950">
            <th className="border-b border-white/10 px-4 py-4 text-left text-xs font-black uppercase tracking-wide text-zinc-400">
              Data
            </th>
            <th className="border-b border-white/10 px-4 py-4 text-right text-xs font-black uppercase tracking-wide text-zinc-400">
              Player Load
              <br />
              <span className="normal-case text-zinc-600">giornaliero</span>
            </th>
            <th className="border-b border-white/10 px-4 py-4 text-right text-xs font-black uppercase tracking-wide text-zinc-400">
              Acuto
              <br />
              <span className="normal-case text-zinc-600">Media 7gg</span>
            </th>
            <th className="border-b border-white/10 px-4 py-4 text-right text-xs font-black uppercase tracking-wide text-zinc-400">
              Cronico
              <br />
              <span className="normal-case text-zinc-600">Media 28gg</span>
            </th>
            <th className="border-b border-white/10 px-4 py-4 text-right text-xs font-black uppercase tracking-wide text-zinc-400">
              ACWR
              <br />
              <span className="normal-case text-zinc-600">Media Mobile</span>
            </th>
            <th className="border-b border-white/10 px-4 py-4 text-right text-xs font-black uppercase tracking-wide text-zinc-400">
              Acuto EWMA
            </th>
            <th className="border-b border-white/10 px-4 py-4 text-right text-xs font-black uppercase tracking-wide text-zinc-400">
              Cronico EWMA
            </th>
            <th className="border-b border-white/10 px-4 py-4 text-right text-xs font-black uppercase tracking-wide text-zinc-400">
              ACWR EWMA
            </th>
          </tr>
        </thead>

        <tbody>
          {rows.length === 0 ? (
            <tr>
              <td
                colSpan={8}
                className="px-6 py-16 text-center text-sm font-semibold text-zinc-500"
              >
                Nessun dato ACWR disponibile.
              </td>
            </tr>
          ) : (
            rows.map((row) => (
              <tr
                key={row.id}
                className="border-b border-white/5 transition hover:bg-white/[0.03]"
              >
                <td className="whitespace-nowrap px-4 py-3 text-sm font-bold text-white">
                  {formatDate(row.data)}
                </td>
                <td className="px-4 py-3 text-right text-sm font-semibold text-zinc-300">
                  {formatNumber(row.player_load_giornaliero, 0)}
                </td>
                <td className="px-4 py-3 text-right text-sm font-semibold text-zinc-300">
                  {formatNumber(row.acuto_media_7gg)}
                </td>
                <td className="px-4 py-3 text-right text-sm font-semibold text-zinc-300">
                  {formatNumber(row.cronico_media_28gg)}
                </td>
                <td
                  className="px-4 py-3 text-right text-sm font-black"
                  style={{
                    color:
                      coloreZonaAcwr(row.acwr_media_mobile, parametri) ??
                      "#ffffff",
                  }}
                >
                  {formatAcwr(row.acwr_media_mobile)}
                </td>
                <td className="px-4 py-3 text-right text-sm font-semibold text-zinc-300">
                  {formatNumber(row.acuto_ewma)}
                </td>
                <td className="px-4 py-3 text-right text-sm font-semibold text-zinc-300">
                  {formatNumber(row.cronico_ewma)}
                </td>
                <td
                  className="px-4 py-3 text-right text-sm font-black"
                  style={{
                    color: coloreZonaAcwr(row.acwr_ewma, parametri) ?? "#ffffff",
                  }}
                >
                  {formatAcwr(row.acwr_ewma)}
                </td>
              </tr>
            ))
          )}
        </tbody>
      </table>
    </div>
  );
}

function AcwrRiskLegend({
  parametri,
}: {
  parametri: AcwrParametriModello | null;
}) {
  if (!parametri) return null;

  return (
    <div className="mt-6 rounded-2xl border border-white/10 bg-zinc-950/70 p-5">
      <div className="mb-4">
        <h3 className="text-sm font-black uppercase tracking-wide text-white">
          Zone di rischio ACWR
        </h3>

        <p className="mt-1 text-xs text-zinc-500">
          Interpretazione del rapporto carico acuto / cronico secondo i
          parametri del modello attivo.
        </p>
      </div>

      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <div className="rounded-2xl border border-sky-500/20 bg-sky-500/10 p-4">
          <p className="text-sm font-black text-sky-300">Sotto-carico</p>
          <p className="text-xs text-zinc-500">Detraining</p>
          <div className="mt-4 text-xl font-black text-white">
            &lt; {formatAcwr(parametri.sotto_carico_max)}
          </div>
        </div>

        <div className="rounded-2xl border border-emerald-500/20 bg-emerald-500/10 p-4">
          <p className="text-sm font-black text-emerald-300">Zona ottimale</p>
          <p className="text-xs text-zinc-500">Carico controllato</p>
          <div className="mt-4 text-xl font-black text-white">
            {formatAcwr(parametri.zona_ottimale_min)} –{" "}
            {formatAcwr(parametri.zona_ottimale_max)}
          </div>
        </div>

        <div className="rounded-2xl border border-amber-500/20 bg-amber-500/10 p-4">
          <p className="text-sm font-black text-amber-300">Attenzione</p>
          <p className="text-xs text-zinc-500">Carico da monitorare</p>
          <div className="mt-4 text-xl font-black text-white">
            {formatAcwr(parametri.attenzione_min)} –{" "}
            {formatAcwr(parametri.attenzione_max)}
          </div>
        </div>

        <div className="rounded-2xl border border-red-500/20 bg-red-500/10 p-4">
          <p className="text-sm font-black text-red-300">Rischio elevato</p>
          <p className="text-xs text-zinc-500">Rischio infortunio</p>
          <div className="mt-4 text-xl font-black text-white">
            &gt; {formatAcwr(parametri.rischio_elevato_min)}
          </div>
        </div>
      </div>

      <div className="mt-4 flex flex-wrap gap-x-6 gap-y-2 border-t border-white/10 pt-4 text-xs text-zinc-500">
        <span>
          Finestra acuta:{" "}
          <strong className="text-zinc-300">
            {parametri.finestra_acuta_giorni} giorni
          </strong>
        </span>

        <span>
          Finestra cronica:{" "}
          <strong className="text-zinc-300">
            {parametri.finestra_cronica_giorni} giorni
          </strong>
        </span>

        <span>
          λ Acuto:{" "}
          <strong className="text-zinc-300">
            {formatNumber(parametri.lambda_acuto_ewma, 4)}
          </strong>
        </span>

        <span>
          λ Cronico:{" "}
          <strong className="text-zinc-300">
            {formatNumber(parametri.lambda_cronico_ewma, 4)}
          </strong>
        </span>
      </div>
    </div>
  );
}

export default function ReportAcwrClient({
  mode,
  clubId,
  squadraId,
  giocatoreId = null,
  giocatoreIds = [],
  dataDa = "",
  dataA = "",
  tipiSeduta = [],
  coloreFlag,
}: Props) {
  const [rows, setRows] = useState<AcwrRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [parametri, setParametri] = useState<AcwrParametriModello | null>(null);

  useEffect(() => {
    let cancelled = false;

    async function loadParametri() {
      let query = supabase
        .from("catapult_acwr_parametri_modello")
        .select(
          `
          id,
          club_id,
          squadra_id,
          finestra_acuta_giorni,
          finestra_cronica_giorni,
          lambda_acuto_ewma,
          lambda_cronico_ewma,
          sotto_carico_max,
          zona_ottimale_min,
          zona_ottimale_max,
          attenzione_min,
          attenzione_max,
          rischio_elevato_min
        `
        )
        .eq("club_id", clubId);

      if (squadraId) {
        query = query.eq("squadra_id", squadraId);
      } else {
        query = query.is("squadra_id", null);
      }

      const { data, error } = await query.maybeSingle();

      if (cancelled) return;

      if (error) {
        console.error("Errore caricamento parametri ACWR:", error);
        setParametri(null);
        return;
      }

      if (!data) {
        setParametri(null);
        return;
      }

      setParametri({
        id: data.id,
        club_id: data.club_id,
        squadra_id: data.squadra_id,
        finestra_acuta_giorni: Number(data.finestra_acuta_giorni),
        finestra_cronica_giorni: Number(data.finestra_cronica_giorni),
        lambda_acuto_ewma: Number(data.lambda_acuto_ewma),
        lambda_cronico_ewma: Number(data.lambda_cronico_ewma),
        sotto_carico_max: Number(data.sotto_carico_max),
        zona_ottimale_min: Number(data.zona_ottimale_min),
        zona_ottimale_max: Number(data.zona_ottimale_max),
        attenzione_min: Number(data.attenzione_min),
        attenzione_max: Number(data.attenzione_max),
        rischio_elevato_min: Number(data.rischio_elevato_min),
      });
    }

    void loadParametri();

    return () => {
      cancelled = true;
    };
  }, [clubId, squadraId]);

  useEffect(() => {
    let cancelled = false;

    async function loadAcwr() {
      setLoading(true);

      const dateSeduta = await dateCatapultPerTipiSeduta({
        clubId,
        tipiSeduta,
      });

      if (cancelled) return;

      if (dateSeduta !== null && dateSeduta.length === 0) {
        setRows([]);
        setLoading(false);
        return;
      }

      let query = supabase
        .from("catapult_acwr")
        .select(
          `
          id,
          club_id,
          squadra_id,
          giocatore_id,
          data,
          player_load_giornaliero,
          acuto_media_7gg,
          cronico_media_28gg,
          acwr_media_mobile,
          acuto_ewma,
          cronico_ewma,
          acwr_ewma
        `
        )
        .eq("club_id", clubId)
        .order("data", { ascending: true });

      if (squadraId) {
        query = query.eq("squadra_id", squadraId);
      }

      const filtroGiocatori =
        giocatoreIds.length > 0
          ? giocatoreIds
          : giocatoreId
            ? [giocatoreId]
            : null;

      if (filtroGiocatori) {
        query = query.in("giocatore_id", filtroGiocatori);
      }

      if (dataDa) {
        query = query.gte("data", dataDa);
      }

      if (dataA) {
        query = query.lte("data", dataA);
      }

      if (dateSeduta !== null) {
        query = query.in("data", dateSeduta);
      }

      const { data, error } = await query;

      if (cancelled) return;

      if (error) {
        console.error("Errore caricamento catapult_acwr:", error);
        setRows([]);
        setLoading(false);
        return;
      }

      setRows(
        (data ?? []).map((row) => ({
          id: row.id,
          club_id: row.club_id,
          squadra_id: row.squadra_id,
          giocatore_id: row.giocatore_id,
          data: row.data,
          player_load_giornaliero: Number(row.player_load_giornaliero),
          acuto_media_7gg:
            row.acuto_media_7gg === null ? null : Number(row.acuto_media_7gg),
          cronico_media_28gg:
            row.cronico_media_28gg === null
              ? null
              : Number(row.cronico_media_28gg),
          acwr_media_mobile:
            row.acwr_media_mobile === null
              ? null
              : Number(row.acwr_media_mobile),
          acuto_ewma: row.acuto_ewma === null ? null : Number(row.acuto_ewma),
          cronico_ewma:
            row.cronico_ewma === null ? null : Number(row.cronico_ewma),
          acwr_ewma: row.acwr_ewma === null ? null : Number(row.acwr_ewma),
        }))
      );

      setLoading(false);
    }

    void loadAcwr();

    return () => {
      cancelled = true;
    };
  }, [
    clubId,
    squadraId,
    giocatoreId,
    giocatoreIds.join(","),
    dataDa,
    dataA,
    tipiSeduta.join(","),
  ]);

  if (loading) {
    return (
      <AppCard>
        <div className="flex min-h-[360px] items-center justify-center">
          <Loader2 size={28} className="animate-spin text-zinc-500" />
        </div>
      </AppCard>
    );
  }

  if (mode === "chart") {
    return (
      <AppCard title="ACWR nel tempo — Media Mobile vs EWMA">
        <AcwrChart rows={rows} coloreFlag={coloreFlag} />
        <AcwrRiskLegend parametri={parametri} />
      </AppCard>
    );
  }

  return (
    <AppCard title="ACWR">
      <AcwrTable rows={rows} parametri={parametri} />
      <AcwrRiskLegend parametri={parametri} />
    </AppCard>
  );
}