
"use client";

import { useEffect, useMemo, useState } from "react";
import { EyeOff, Loader2, Plus, Trash2 } from "lucide-react";

import { AppCard } from "@/components/ui/AppCard";
import { supabase } from "@/lib/supabase-client";

type TipoSeduta = "tutte" | "allenamento" | "partita";

type PerformanceRow = {
  id: string;
  club_id: string;
  squadra_id: string | null;
  giocatore_id: string | null;
  date: string | null;
  session_title: string | null;
  player_name: string | null;
  split_name: string | null;
  duration: number | null;
  distance: number | null;
  sprint_distance: number | null;
  top_speed: number | null;
  distance_per_minute: number | null;
  power_score: number | null;
  work_ratio: number | null;
  player_load: number | null;
  impacts: number | null;
  max_acc: number | null;
  max_dec: number | null;
};

type CatapultRow = {
  id: string;
  club_id: string;
  squadra_id: string | null;
  giocatore_id: string | null;
  date: string | null;
  session_title: string | null;
  player_name: string | null;
  split_name: string | null;
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

type Props = {
  mode: "summary" | "table";
  clubId: string;
  squadraId: string | null;
  giocatoreId?: string | null;
  dataDa?: string;
  dataA?: string;
  tipoSeduta?: TipoSeduta;
  eventoId?: string | null;
};

type BaseColumn = {
  key: keyof PerformanceRow;
  label: string;
  align?: "left" | "right";
  decimals?: number;
  type?: "date" | "text" | "number";
};

type CustomColumn = {
  id: string;
  label: string;
  formula: string;
  decimals: number;
};

const BASE_COLUMNS: BaseColumn[] = [
  { key: "date", label: "Data", type: "date" },
  { key: "session_title", label: "Sessione", type: "text" },
  { key: "player_name", label: "Giocatore", type: "text" },
  { key: "split_name", label: "Split", type: "text" },
  { key: "duration", label: "Durata (min)", type: "number", align: "right", decimals: 0 },
  { key: "distance", label: "Distanza (m)", type: "number", align: "right", decimals: 0 },
  { key: "sprint_distance", label: "Sprint Distance (m)", type: "number", align: "right", decimals: 0 },
  { key: "top_speed", label: "Top Speed (m/s)", type: "number", align: "right", decimals: 2 },
  { key: "distance_per_minute", label: "Distanza/min (m/min)", type: "number", align: "right", decimals: 2 },
  { key: "power_score", label: "Power Score", type: "number", align: "right", decimals: 1 },
  { key: "work_ratio", label: "Work Ratio (%)", type: "number", align: "right", decimals: 1 },
  { key: "player_load", label: "Player Load", type: "number", align: "right", decimals: 0 },
  { key: "impacts", label: "Impacts", type: "number", align: "right", decimals: 0 },
  { key: "max_acc", label: "Max Acc (m/s²)", type: "number", align: "right", decimals: 2 },
  { key: "max_dec", label: "Max Dec (m/s²)", type: "number", align: "right", decimals: 2 },
];

const NUMERIC_FIELDS = BASE_COLUMNS.filter((column) => column.type === "number");

function formatDate(value: string | null) {
  if (!value) return "—";
  const [year, month, day] = value.split("-");
  if (!year || !month || !day) return value;
  return `${day}/${month}/${year}`;
}

function formatNumber(value: number | null | undefined, decimals = 0) {
  if (value === null || value === undefined || Number.isNaN(value)) return "—";

  return new Intl.NumberFormat("it-IT", {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  }).format(value);
}

function normalizeNumber(value: unknown): number | null {
  if (value === null || value === undefined || value === "") return null;
  const number = Number(value);
  return Number.isFinite(number) ? number : null;
}

function safeCalculateFormula(row: PerformanceRow, formula: string): number | null {
  try {
    let expression = formula.trim();

    if (!expression) return null;

    for (const field of NUMERIC_FIELDS) {
      const value = row[field.key];
      const number = typeof value === "number" && Number.isFinite(value) ? value : 0;

      expression = expression.replace(
        new RegExp(`\\b${String(field.key)}\\b`, "g"),
        String(number)
      );
    }

    if (!/^[0-9+\-*/().\s]+$/.test(expression)) {
      return null;
    }

    const result = Function(`"use strict"; return (${expression});`)();

    if (typeof result !== "number" || !Number.isFinite(result)) {
      return null;
    }

    return result;
  } catch {
    return null;
  }
}

function StatRow({
  label,
  value,
}: {
  label: string;
  value: string | number;
}) {
  return (
    <div className="grid grid-cols-[1fr_auto] border-b border-white/10 py-2 last:border-b-0">
      <span className="text-sm font-semibold text-zinc-300">{label}</span>
      <span className="text-sm font-black text-white">{value}</span>
    </div>
  );
}

function PerformanceSummary({ rows }: { rows: PerformanceRow[] }) {
  const stats = useMemo(() => {
    const numeroSessioni = rows.length;

    const distanzaTotale = rows.reduce(
      (sum, row) => sum + (row.distance ?? 0),
      0
    );

    const distanzaMedia = numeroSessioni > 0 ? distanzaTotale / numeroSessioni : 0;

    const topSpeedMassimo = Math.max(
      0,
      ...rows.map((row) => row.top_speed ?? 0)
    );

    const playerLoadTotale = rows.reduce(
      (sum, row) => sum + (row.player_load ?? 0),
      0
    );

    const playerLoadMedio =
      numeroSessioni > 0 ? playerLoadTotale / numeroSessioni : 0;

    const ultimaSessione =
      rows.length > 0
        ? [...rows]
            .filter((row) => row.date)
            .sort((a, b) => (b.date ?? "").localeCompare(a.date ?? ""))[0] ?? null
        : null;

    return {
      numeroSessioni,
      distanzaMedia,
      topSpeedMassimo,
      playerLoadMedio,
      playerLoadTotale,
      ultimaSessione,
    };
  }, [rows]);

  return (
    <div className="grid gap-6 xl:grid-cols-2">
      <AppCard title="Riepilogo statistiche">
        <div className="space-y-1">
          <StatRow label="Numero sessioni registrate" value={stats.numeroSessioni} />
          <StatRow label="Distanza media (m)" value={formatNumber(stats.distanzaMedia, 0)} />
          <StatRow label="Top Speed massimo (m/s)" value={formatNumber(stats.topSpeedMassimo, 2)} />
          <StatRow label="Player Load medio" value={formatNumber(stats.playerLoadMedio, 0)} />
          <StatRow label="Player Load totale" value={formatNumber(stats.playerLoadTotale, 0)} />
        </div>
      </AppCard>

      <AppCard title="Ultima sessione">
        {stats.ultimaSessione ? (
          <div className="space-y-1">
            <StatRow label="Data" value={formatDate(stats.ultimaSessione.date)} />
            <StatRow label="Sessione" value={stats.ultimaSessione.session_title ?? "—"} />
            <StatRow label="Player Load" value={formatNumber(stats.ultimaSessione.player_load, 0)} />
            <StatRow label="Top Speed (m/s)" value={formatNumber(stats.ultimaSessione.top_speed, 2)} />
          </div>
        ) : (
          <div className="py-10 text-center text-sm font-semibold text-zinc-500">
            Nessuna sessione disponibile.
          </div>
        )}
      </AppCard>
    </div>
  );
}


function PerformanceTable({ rows }: { rows: PerformanceRow[] }) {
  const [showCreateColumnPanel, setShowCreateColumnPanel] = useState(false);
  const [showHideColumnsPanel, setShowHideColumnsPanel] = useState(false);

  const [visibleColumns, setVisibleColumns] = useState<Record<string, boolean>>(
    () =>
      Object.fromEntries(
        BASE_COLUMNS.map((column) => [String(column.key), true])
      )
  );

  const [customColumns, setCustomColumns] = useState<CustomColumn[]>([]);
  const [newLabel, setNewLabel] = useState("");
  const [newFormula, setNewFormula] = useState("");
  const [newDecimals, setNewDecimals] = useState(2);

  const activeBaseColumns = BASE_COLUMNS.filter(
    (column) => visibleColumns[String(column.key)]
  );

  function toggleColumn(key: string) {
    setVisibleColumns((prev) => ({
      ...prev,
      [key]: !prev[key],
    }));
  }

  function showAllColumns() {
    setVisibleColumns(
      Object.fromEntries(
        BASE_COLUMNS.map((column) => [String(column.key), true])
      )
    );
  }

  function hideAllColumns() {
    setVisibleColumns(
      Object.fromEntries(
        BASE_COLUMNS.map((column) => [String(column.key), false])
      )
    );
  }

  function addCustomColumn() {
    const label = newLabel.trim();
    const formula = newFormula.trim();

    if (!label || !formula) return;

    setCustomColumns((prev) => [
      ...prev,
      {
        id: crypto.randomUUID(),
        label,
        formula,
        decimals: newDecimals,
      },
    ]);

    setNewLabel("");
    setNewFormula("");
    setNewDecimals(2);
    setShowCreateColumnPanel(false);
  }

  function removeCustomColumn(id: string) {
    setCustomColumns((prev) =>
      prev.filter((column) => column.id !== id)
    );
  }

  return (
    <AppCard title="Performance">
      {/* PULSANTI AZIONE */}
      <div className="mb-5 flex flex-wrap items-center gap-3">
        <button
          type="button"
          onClick={() => {
            setShowCreateColumnPanel((prev) => !prev);
            setShowHideColumnsPanel(false);
          }}
          className={[
            "inline-flex items-center justify-center gap-2 rounded-xl border px-4 py-2.5 text-sm font-black transition",
            showCreateColumnPanel
              ? "border-white bg-white text-zinc-950"
              : "border-white/10 bg-white/5 text-white hover:bg-white/10",
          ].join(" ")}
        >
          <Plus size={17} />
          Crea Colonna
        </button>

        <button
          type="button"
          onClick={() => {
            setShowHideColumnsPanel((prev) => !prev);
            setShowCreateColumnPanel(false);
          }}
          className={[
            "inline-flex items-center justify-center gap-2 rounded-xl border px-4 py-2.5 text-sm font-black transition",
            showHideColumnsPanel
              ? "border-white bg-white text-zinc-950"
              : "border-white/10 bg-white/5 text-white hover:bg-white/10",
          ].join(" ")}
        >
          <EyeOff size={17} />
          Nascondi Colonne
        </button>
      </div>

      {/* PANNELLO CREA COLONNA */}
      {showCreateColumnPanel && (
        <div className="mb-5 rounded-2xl border border-white/10 bg-zinc-950/70 p-4">
          <div className="mb-4">
            <h3 className="text-sm font-black uppercase tracking-wide text-white">
              Crea nuova colonna
            </h3>

            <p className="mt-1 text-xs font-semibold text-zinc-500">
              Crea una colonna calcolata usando operazioni matematiche
              sui dati disponibili.
            </p>
          </div>

          <div className="grid gap-3 lg:grid-cols-[1fr_1.5fr_120px_auto]">
            <div>
              <label className="mb-1.5 block text-xs font-bold text-zinc-400">
                Nome colonna
              </label>

              <input
                value={newLabel}
                onChange={(event) => setNewLabel(event.target.value)}
                placeholder="Es. PL/min"
                className="w-full rounded-xl border border-white/10 bg-zinc-900 px-3 py-2.5 text-sm font-semibold text-white outline-none transition placeholder:text-zinc-600 focus:border-white/30"
              />
            </div>

            <div>
              <label className="mb-1.5 block text-xs font-bold text-zinc-400">
                Formula
              </label>

              <input
                value={newFormula}
                onChange={(event) => setNewFormula(event.target.value)}
                placeholder="Es. player_load / duration"
                className="w-full rounded-xl border border-white/10 bg-zinc-900 px-3 py-2.5 text-sm font-semibold text-white outline-none transition placeholder:text-zinc-600 focus:border-white/30"
              />
            </div>

            <div>
              <label className="mb-1.5 block text-xs font-bold text-zinc-400">
                Decimali
              </label>

              <input
                type="number"
                min={0}
                max={4}
                value={newDecimals}
                onChange={(event) =>
                  setNewDecimals(
                    Math.min(
                      4,
                      Math.max(0, Number(event.target.value))
                    )
                  )
                }
                className="w-full rounded-xl border border-white/10 bg-zinc-900 px-3 py-2.5 text-sm font-semibold text-white outline-none transition focus:border-white/30"
              />
            </div>

            <div className="flex items-end">
              <button
                type="button"
                onClick={addCustomColumn}
                disabled={!newLabel.trim() || !newFormula.trim()}
                className="inline-flex w-full items-center justify-center gap-2 rounded-xl bg-white px-4 py-2.5 text-sm font-black text-zinc-950 transition hover:bg-zinc-200 disabled:cursor-not-allowed disabled:opacity-40"
              >
                <Plus size={16} />
                Crea
              </button>
            </div>
          </div>

          {/* CAMPI DISPONIBILI */}
          <div className="mt-4 border-t border-white/10 pt-4">
            <p className="mb-2 text-xs font-bold text-zinc-500">
              Clicca un campo per inserirlo nella formula:
            </p>

            <div className="flex flex-wrap gap-2">
              {NUMERIC_FIELDS.map((field) => (
                <button
                  key={String(field.key)}
                  type="button"
                  onClick={() => {
                    const fieldName = String(field.key);

                    setNewFormula((prev) =>
                      prev.trim()
                        ? `${prev} ${fieldName}`
                        : fieldName
                    );
                  }}
                  className="rounded-lg border border-white/10 bg-white/5 px-2.5 py-1.5 text-xs font-bold text-zinc-300 transition hover:border-white/20 hover:bg-white/10 hover:text-white"
                >
                  {String(field.key)}
                </button>
              ))}
            </div>
          </div>

          {/* OPERATORI */}
          <div className="mt-4">
            <p className="mb-2 text-xs font-bold text-zinc-500">
              Operatori:
            </p>

            <div className="flex flex-wrap gap-2">
              {["+", "-", "*", "/", "(", ")"].map((operator) => (
                <button
                  key={operator}
                  type="button"
                  onClick={() =>
                    setNewFormula((prev) =>
                      prev.trim()
                        ? `${prev} ${operator}`
                        : operator
                    )
                  }
                  className="flex h-9 min-w-9 items-center justify-center rounded-lg border border-white/10 bg-zinc-900 px-3 text-sm font-black text-white transition hover:bg-white/10"
                >
                  {operator}
                </button>
              ))}
            </div>
          </div>

          {/* ANTEPRIMA FORMULA */}
          {newFormula.trim() && (
            <div className="mt-4 rounded-xl border border-white/10 bg-black/30 px-3 py-2.5">
              <span className="text-xs font-bold text-zinc-500">
                Formula:{" "}
              </span>

              <code className="text-xs font-bold text-white">
                {newFormula}
              </code>
            </div>
          )}
        </div>
      )}

      {/* PANNELLO NASCONDI COLONNE */}
      {showHideColumnsPanel && (
        <div className="mb-5 rounded-2xl border border-white/10 bg-zinc-950/70 p-4">
          <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
            <div>
              <h3 className="text-sm font-black uppercase tracking-wide text-white">
                Gestisci colonne visibili
              </h3>

              <p className="mt-1 text-xs font-semibold text-zinc-500">
                Seleziona quali colonne mostrare nella tabella.
              </p>
            </div>

            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={showAllColumns}
                className="rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-xs font-black text-white transition hover:bg-white/10"
              >
                Mostra tutte
              </button>

              <button
                type="button"
                onClick={hideAllColumns}
                className="rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-xs font-black text-zinc-400 transition hover:bg-white/10 hover:text-white"
              >
                Nascondi tutte
              </button>
            </div>
          </div>

          <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
            {BASE_COLUMNS.map((column) => {
              const key = String(column.key);
              const active = visibleColumns[key];

              return (
                <button
                  key={key}
                  type="button"
                  onClick={() => toggleColumn(key)}
                  className={[
                    "flex items-center justify-between rounded-xl border px-3 py-2.5 text-left text-sm font-bold transition",
                    active
                      ? "border-white/20 bg-white/10 text-white"
                      : "border-white/5 bg-transparent text-zinc-600",
                  ].join(" ")}
                >
                  <span>{column.label}</span>

                  <span
                    className={[
                      "ml-3 flex h-5 w-5 shrink-0 items-center justify-center rounded-md border text-[10px]",
                      active
                        ? "border-white bg-white text-zinc-950"
                        : "border-white/10 text-transparent",
                    ].join(" ")}
                  >
                    ✓
                  </span>
                </button>
              );
            })}
          </div>
        </div>
      )}

      {/* COLONNE PERSONALIZZATE CREATE */}
      {customColumns.length > 0 && (
        <div className="mb-5 rounded-2xl border border-white/10 bg-white/[0.03] p-4">
          <p className="mb-3 text-xs font-black uppercase tracking-wide text-zinc-500">
            Colonne calcolate
          </p>

          <div className="flex flex-wrap gap-2">
            {customColumns.map((column) => (
              <div
                key={column.id}
                className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/5 px-3 py-1.5 text-xs font-bold text-white"
              >
                <span>{column.label}</span>

                <span className="text-zinc-500">
                  {column.formula}
                </span>

                <button
                  type="button"
                  onClick={() => removeCustomColumn(column.id)}
                  className="ml-1 text-zinc-500 transition hover:text-red-400"
                  aria-label={`Elimina colonna ${column.label}`}
                >
                  <Trash2 size={14} />
                </button>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* TABELLA */}
      <div className="overflow-x-auto rounded-2xl border border-white/10">
        <table className="w-full min-w-max border-collapse">
          <thead>
            <tr className="bg-zinc-950">
              {activeBaseColumns.map((column) => (
                <th
                  key={String(column.key)}
                  className={[
                    "whitespace-nowrap border-b border-white/10 px-4 py-4 text-xs font-black uppercase tracking-wide text-zinc-400",
                    column.align === "right"
                      ? "text-right"
                      : "text-left",
                  ].join(" ")}
                >
                  {column.label}
                </th>
              ))}

              {customColumns.map((column) => (
                <th
                  key={column.id}
                  className="whitespace-nowrap border-b border-white/10 px-4 py-4 text-right text-xs font-black uppercase tracking-wide text-zinc-400"
                >
                  {column.label}
                </th>
              ))}
            </tr>
          </thead>

          <tbody>
            {rows.length === 0 ? (
              <tr>
                <td
                  colSpan={
                    activeBaseColumns.length +
                      customColumns.length || 1
                  }
                  className="px-6 py-16 text-center text-sm font-semibold text-zinc-500"
                >
                  Nessun dato performance disponibile.
                </td>
              </tr>
            ) : activeBaseColumns.length === 0 &&
              customColumns.length === 0 ? (
              <tr>
                <td className="px-6 py-16 text-center text-sm font-semibold text-zinc-500">
                  Nessuna colonna visibile. Usa il pulsante
                  &quot;Nascondi Colonne&quot; per riattivarle.
                </td>
              </tr>
            ) : (
              rows.map((row) => (
                <tr
                  key={row.id}
                  className="border-b border-white/5 transition hover:bg-white/[0.03]"
                >
                  {activeBaseColumns.map((column) => {
                    const value = row[column.key];

                    return (
                      <td
                        key={String(column.key)}
                        className={[
                          "whitespace-nowrap px-4 py-3 text-sm font-semibold text-zinc-300",
                          column.align === "right"
                            ? "text-right"
                            : "text-left",
                          column.key === "date"
                            ? "font-bold text-white"
                            : "",
                        ].join(" ")}
                      >
                        {column.type === "date"
                          ? formatDate(value as string | null)
                          : column.type === "number"
                            ? formatNumber(
                                value as number | null,
                                column.decimals ?? 0
                              )
                            : value ?? "—"}
                      </td>
                    );
                  })}

                  {customColumns.map((column) => (
                    <td
                      key={column.id}
                      className="whitespace-nowrap px-4 py-3 text-right text-sm font-black text-white"
                    >
                      {formatNumber(
                        safeCalculateFormula(
                          row,
                          column.formula
                        ),
                        column.decimals
                      )}
                    </td>
                  ))}
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </AppCard>
  );
}



export default function ReportPerformanceSessioniClient({
  mode,
  clubId,
  squadraId,
  giocatoreId = null,
  dataDa = "",
  dataA = "",
  tipoSeduta = "tutte",
  eventoId = null,
}: Props) {
  const [rows, setRows] = useState<PerformanceRow[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;

    async function loadPerformance() {
      setLoading(true);

      try {
        let query = supabase
          .from("catapult_data")
          .select(`
            id,
            club_id,
            squadra_id,
            giocatore_id,
            date,
            session_title,
            player_name,
            split_name,
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
            max_deceleration_m_s_s
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
            "Errore caricamento performance:",
            JSON.stringify(error, null, 2)
          );

          setRows([]);
          return;
        }

        const catapultRows = (data ?? []) as CatapultRow[];

        setRows(
          catapultRows.map((row) => ({
            id: row.id,
            club_id: row.club_id,
            squadra_id: row.squadra_id,
            giocatore_id: row.giocatore_id,
            date: row.date,
            session_title: row.session_title,
            player_name: row.player_name,
            split_name: row.split_name,
            duration: normalizeNumber(row.duration),
            distance: normalizeNumber(row.distance_metres),
            sprint_distance: normalizeNumber(row.sprint_distance_m),
            top_speed: normalizeNumber(row.top_speed_m_s),
            distance_per_minute: normalizeNumber(row.distance_per_min_m_min),
            power_score: normalizeNumber(row.power_score_w_kg),
            work_ratio: normalizeNumber(row.work_ratio),
            player_load: normalizeNumber(row.player_load),
            impacts: normalizeNumber(row.impacts),
            max_acc: normalizeNumber(row.max_acceleration_m_s_s),
            max_dec: normalizeNumber(row.max_deceleration_m_s_s),
          }))
        );
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    }

    void loadPerformance();

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

  if (loading) {
    return (
      <AppCard>
        <div className="flex min-h-[260px] items-center justify-center">
          <Loader2 size={28} className="animate-spin text-zinc-500" />
        </div>
      </AppCard>
    );
  }

  if (mode === "summary") {
    return <PerformanceSummary rows={rows} />;
  }

  return <PerformanceTable rows={rows} />;
}

