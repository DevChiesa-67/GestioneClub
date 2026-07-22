
"use client";

import { useEffect, useMemo, useState } from "react";
import {
  Dumbbell,
  Loader2,
  Target,
  TrendingUp,
  
} from "lucide-react";

import { AppCard } from "@/components/ui/AppCard";
import { supabase } from "@/lib/supabase-client";

type Props = {
  clubId: string;
  squadraId: string | null;
  giocatoreId?: string | null;
  giocatoreIds?: string[];
  dataDa?: string;
  dataA?: string;
  coloreFlag: string;
};

type GiocatoreRelation = {
  id: string;
  nome: string;
  cognome: string;
  foto_url: string | null;
};

type TestRelation = {
  id: string;
  nome: string | null;
};

type SupabaseMisurazioneRow = {
  id: string;
  club_id: string;
  squadra_id: string | null;
  giocatore_id: string;
  test_id: string;
  data_test: string;
  valore: number | string;
  obiettivo: number | string | null;
  note: string | null;
  created_at: string;
  giocatori: GiocatoreRelation | GiocatoreRelation[] | null;
  test_atletici_forza: TestRelation | TestRelation[] | null;
};

type MisurazioneRow = {
  id: string;
  club_id: string;
  squadra_id: string | null;
  giocatore_id: string;
  test_id: string;
  data_test: string;
  valore: number;
  obiettivo: number | null;
  note: string | null;
  created_at: string;
  giocatore: GiocatoreRelation | null;
  test: TestRelation | null;
};

function normalizeNumber(value: unknown): number | null {
  if (value === null || value === undefined || value === "") return null;

  const parsed = Number(value);

  return Number.isFinite(parsed) ? parsed : null;
}

function firstRelation<T>(value: T | T[] | null): T | null {
  if (!value) return null;
  return Array.isArray(value) ? value[0] ?? null : value;
}

function formatDate(value: string | null | undefined) {
  if (!value) return "—";

  const [year, month, day] = value.split("-");

  if (!year || !month || !day) return value;

  return `${day}/${month}/${year}`;
}

function formatNumber(value: number | null | undefined, decimals = 2) {
  if (value === null || value === undefined || Number.isNaN(value)) {
    return "—";
  }

  return new Intl.NumberFormat("it-IT", {
    minimumFractionDigits: 0,
    maximumFractionDigits: decimals,
  }).format(value);
}

function getNomeGiocatore(row: MisurazioneRow) {
  if (!row.giocatore) return "Giocatore non trovato";

  return `${row.giocatore.nome} ${row.giocatore.cognome}`.trim();
}

export default function ReportTestClient({
  clubId,
  squadraId,
  giocatoreId = null,
  giocatoreIds = [],
  dataDa = "",
  dataA = "",
  coloreFlag,
}: Props) {
  const [rows, setRows] = useState<MisurazioneRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedTestId, setSelectedTestId] = useState("");

  useEffect(() => {
    let cancelled = false;

    async function loadData() {
      setLoading(true);

      try {
        let query = supabase
          .from("test_misurazioni")
          .select(`
            id,
            club_id,
            squadra_id,
            giocatore_id,
            test_id,
            data_test,
            valore,
            obiettivo,
            note,
            created_at,
            giocatori (
              id,
              nome,
              cognome,
              foto_url
            ),
            test_atletici_forza (
              id,
              nome
            )
          `)
          .eq("club_id", clubId);

        if (squadraId) {
          query = query.or(
            `squadra_id.eq.${squadraId},squadra_id.is.null`
          );
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
          query = query.gte("data_test", dataDa);
        }

        if (dataA) {
          query = query.lte("data_test", dataA);
        }

        query = query.order("data_test", { ascending: false });

        const { data, error } = await query;

        if (cancelled) return;

        if (error) {
          console.error(
            "Errore caricamento report test:",
            JSON.stringify(error, null, 2)
          );

          setRows([]);
          return;
        }

        const rawRows = (data ?? []) as unknown as SupabaseMisurazioneRow[];

        const normalizedRows: MisurazioneRow[] = rawRows
          .map((row) => {
            const valore = normalizeNumber(row.valore);

            if (valore === null) return null;

            return {
              id: row.id,
              club_id: row.club_id,
              squadra_id: row.squadra_id,
              giocatore_id: row.giocatore_id,
              test_id: row.test_id,
              data_test: row.data_test,
              valore,
              obiettivo: normalizeNumber(row.obiettivo),
              note: row.note,
              created_at: row.created_at,
              giocatore: firstRelation(row.giocatori),
              test: firstRelation(row.test_atletici_forza),
            };
          })
          .filter((row): row is MisurazioneRow => row !== null);

        setRows(normalizedRows);
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
  }, [clubId, squadraId, giocatoreId, giocatoreIds.join(","), dataDa, dataA]);

  const tests = useMemo(() => {
    const map = new Map<string, { id: string; nome: string }>();

    for (const row of rows) {
      if (!row.test) continue;

      map.set(row.test.id, {
        id: row.test.id,
        nome: row.test.nome ?? "Test senza nome",
      });
    }

    return Array.from(map.values()).sort((a, b) =>
      a.nome.localeCompare(b.nome, "it")
    );
  }, [rows]);

  const filteredRows = useMemo(() => {
    return rows.filter((row) => {
      if (selectedTestId && row.test_id !== selectedTestId) {
        return false;
      }

      return true;
    });
  }, [rows, selectedTestId]);

  const stats = useMemo(() => {
    const totale = filteredRows.length;

    const media =
      totale > 0
        ? filteredRows.reduce((sum, row) => sum + row.valore, 0) / totale
        : null;

    const migliore =
      totale > 0
        ? filteredRows.reduce(
            (best, row) => (row.valore > best ? row.valore : best),
            filteredRows[0].valore
          )
        : null;

    const conObiettivo = filteredRows.filter((row) => row.obiettivo !== null);

    const obiettiviRaggiunti = conObiettivo.filter(
      (row) => row.obiettivo !== null && row.valore >= row.obiettivo
    ).length;

    return {
      totale,
      media,
      migliore,
      obiettiviRaggiunti,
      totaleConObiettivo: conObiettivo.length,
    };
  }, [filteredRows]);

  if (loading) {
    return (
      <AppCard>
        <div className="flex min-h-[280px] items-center justify-center">
          <Loader2 size={28} className="animate-spin text-zinc-500" />
        </div>
      </AppCard>
    );
  }

  return (
    <div className="space-y-4 sm:space-y-6">
      <div className="grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-4">
        <AppCard>
          <div className="flex items-center gap-2 text-zinc-500">
            <Dumbbell size={16} />
            <span className="truncate text-[11px] font-black uppercase sm:text-xs">
              Misurazioni
            </span>
          </div>

          <div className="mt-2 text-xl font-black text-white sm:text-2xl">
            {stats.totale}
          </div>
        </AppCard>

        <AppCard>
          <div className="flex items-center gap-2 text-zinc-500">
            <Target size={16} />
            <span className="truncate text-[11px] font-black uppercase sm:text-xs">
              Media
            </span>
          </div>

          <div className="mt-2 text-xl font-black text-white sm:text-2xl">
            {formatNumber(stats.media)}
          </div>
        </AppCard>

        <AppCard>
          <div className="flex items-center gap-2 text-zinc-500">
            <TrendingUp size={16} />
            <span className="truncate text-[11px] font-black uppercase sm:text-xs">
              Migliore
            </span>
          </div>

          <div className="mt-2 text-xl font-black text-white sm:text-2xl">
            {formatNumber(stats.migliore)}
          </div>
        </AppCard>

        <AppCard>
          <div className="flex items-center gap-2 text-zinc-500">
            <Target size={16} />
            <span className="truncate text-[11px] font-black uppercase sm:text-xs">
              Obiettivi
            </span>
          </div>

          <div className="mt-2 text-xl font-black text-white sm:text-2xl">
            {stats.obiettiviRaggiunti}
            <span className="ml-1 text-sm text-zinc-500">
              / {stats.totaleConObiettivo}
            </span>
          </div>
        </AppCard>
      </div>

      <AppCard>
        <div className="grid gap-3 sm:grid-cols-[1fr_auto]">
          <select
            value={selectedTestId}
            onChange={(event) => setSelectedTestId(event.target.value)}
            className="h-[46px] w-full rounded-xl border border-white/10 bg-zinc-950 px-3 text-sm font-bold text-white outline-none transition focus:border-white/30"
          >
            <option value="">Tutti i test</option>

            {tests.map((test) => (
              <option key={test.id} value={test.id}>
                {test.nome}
              </option>
            ))}
          </select>

          <button
            type="button"
            onClick={() => setSelectedTestId("")}
            className="h-[46px] rounded-xl border border-white/10 bg-white/5 px-4 text-sm font-bold text-zinc-300 transition hover:bg-white/10 hover:text-white"
          >
            Reset test
          </button>
        </div>
      </AppCard>

      <div className="hidden md:block">
        <AppCard title="Misurazioni Test">
          <div className="overflow-x-auto rounded-2xl border border-white/10">
            <table className="w-full min-w-[900px] border-collapse">
              <thead>
                <tr className="bg-zinc-950">
                  {[
                    "Data",
                    "Giocatore",
                    "Test",
                    "Valore",
                    "Obiettivo",
                    "Scostamento",
                    "Note",
                  ].map((header) => (
                    <th
                      key={header}
                      className="border-b border-white/10 px-4 py-4 text-left text-xs font-black uppercase tracking-wide text-zinc-400"
                    >
                      {header}
                    </th>
                  ))}
                </tr>
              </thead>

              <tbody>
                {filteredRows.length === 0 ? (
                  <tr>
                    <td
                      colSpan={7}
                      className="px-6 py-16 text-center text-sm font-semibold text-zinc-500"
                    >
                      Nessuna misurazione disponibile.
                    </td>
                  </tr>
                ) : (
                  filteredRows.map((row) => {
                    const scostamento =
                      row.obiettivo !== null
                        ? row.valore - row.obiettivo
                        : null;

                    return (
                      <tr
                        key={row.id}
                        className="border-b border-white/5 transition hover:bg-white/[0.03]"
                      >
                        <td className="whitespace-nowrap px-4 py-3 text-sm font-bold text-white">
                          {formatDate(row.data_test)}
                        </td>

                        <td className="px-4 py-3 text-sm font-bold text-white">
                          {getNomeGiocatore(row)}
                        </td>

                        <td className="px-4 py-3 text-sm font-semibold text-zinc-300">
                          {row.test?.nome ?? "—"}
                        </td>

                        <td className="px-4 py-3 text-right text-sm font-black text-white">
                          {formatNumber(row.valore)}
                        </td>

                        <td className="px-4 py-3 text-right text-sm font-semibold text-zinc-300">
                          {formatNumber(row.obiettivo)}
                        </td>

                        <td
                          className="px-4 py-3 text-right text-sm font-black"
                          style={{
                            color:
                              scostamento !== null && scostamento >= 0
                                ? coloreFlag
                                : undefined,
                          }}
                        >
                          {scostamento === null
                            ? "—"
                            : `${scostamento > 0 ? "+" : ""}${formatNumber(
                                scostamento
                              )}`}
                        </td>

                        <td className="max-w-[280px] truncate px-4 py-3 text-sm font-semibold text-zinc-400">
                          {row.note ?? "—"}
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </AppCard>
      </div>

      <div className="space-y-3 md:hidden">
        {filteredRows.length === 0 ? (
          <AppCard>
            <div className="py-12 text-center text-sm font-semibold text-zinc-500">
              Nessuna misurazione disponibile.
            </div>
          </AppCard>
        ) : (
          filteredRows.map((row) => {
            const scostamento =
              row.obiettivo !== null ? row.valore - row.obiettivo : null;

            return (
              <AppCard key={row.id}>
                <div className="min-w-0">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <div className="truncate text-sm font-black text-white">
                        {getNomeGiocatore(row)}
                      </div>

                      <div className="mt-1 truncate text-xs font-semibold text-zinc-500">
                        {row.test?.nome ?? "Test"}
                      </div>
                    </div>

                    <div className="shrink-0 text-xs font-bold text-zinc-500">
                      {formatDate(row.data_test)}
                    </div>
                  </div>

                  <div className="mt-4 grid grid-cols-3 gap-2">
                    <div className="rounded-xl border border-white/10 bg-white/[0.03] p-2.5">
                      <div className="text-[10px] font-black uppercase text-zinc-600">
                        Valore
                      </div>

                      <div className="mt-1 text-sm font-black text-white">
                        {formatNumber(row.valore)}
                      </div>
                    </div>

                    <div className="rounded-xl border border-white/10 bg-white/[0.03] p-2.5">
                      <div className="text-[10px] font-black uppercase text-zinc-600">
                        Obiettivo
                      </div>

                      <div className="mt-1 text-sm font-black text-white">
                        {formatNumber(row.obiettivo)}
                      </div>
                    </div>

                    <div className="rounded-xl border border-white/10 bg-white/[0.03] p-2.5">
                      <div className="text-[10px] font-black uppercase text-zinc-600">
                        Delta
                      </div>

                      <div
                        className="mt-1 text-sm font-black"
                        style={{
                          color:
                            scostamento !== null && scostamento >= 0
                              ? coloreFlag
                              : undefined,
                        }}
                      >
                        {scostamento === null
                          ? "—"
                          : `${scostamento > 0 ? "+" : ""}${formatNumber(
                              scostamento
                            )}`}
                      </div>
                    </div>
                  </div>

                  {row.note && (
                    <div className="mt-3 border-t border-white/10 pt-3 text-xs font-semibold leading-relaxed text-zinc-400">
                      {row.note}
                    </div>
                  )}
                </div>
              </AppCard>
            );
          })
        )}
      </div>
    </div>
  );
}