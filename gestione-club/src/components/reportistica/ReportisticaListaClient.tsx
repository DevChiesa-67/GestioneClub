"use client";

import { useRouter } from "next/navigation";
import { useTransition } from "react";
import { BarChart3, LineChart, PieChart, Sigma, Table2, Trash2 } from "lucide-react";

import { useToast } from "@/components/ui/Toast";
import {
  eliminaReportPersonalizzato,
  impostaPubblicazioneReport,
} from "@/app/(dashboard)/reportistica/nuovo/actions";

type ReportRow = {
  id: string;
  nome: string;
  descrizione: string | null;
  sezione_performance: "presenze" | "performance" | "test";
  tipo_visualizzazione: "bar" | "line" | "pie" | "table" | "kpi";
  pubblicato: boolean;
  tipi_profilo_visibili: string[];
  campo_catapult: string | null;
};

type Props = {
  reports: ReportRow[];
  nomiTipiProfilo: Record<string, string>;
};

const LABEL_SEZIONE: Record<ReportRow["sezione_performance"], string> = {
  presenze: "Presenze",
  performance: "Performance",
  test: "Test",
};

function IconaVisualizzazione({
  tipo,
}: {
  tipo: ReportRow["tipo_visualizzazione"];
}) {
  const className = "h-4 w-4";

  switch (tipo) {
    case "bar":
      return <BarChart3 className={className} />;
    case "line":
      return <LineChart className={className} />;
    case "pie":
      return <PieChart className={className} />;
    case "table":
      return <Table2 className={className} />;
    case "kpi":
      return <Sigma className={className} />;
  }
}

export default function ReportisticaListaClient({
  reports,
  nomiTipiProfilo,
}: Props) {
  const { showToast } = useToast();
  const router = useRouter();
  const [isPending, startTransition] = useTransition();

  function togglePubblicato(report: ReportRow) {
    if (report.sezione_performance !== "performance" || !report.campo_catapult) {
      showToast({
        type: "error",
        message:
          "Solo i report Performance con un parametro Catapult selezionato possono essere pubblicati.",
      });
      return;
    }

    startTransition(async () => {
      const result = await impostaPubblicazioneReport(
        report.id,
        !report.pubblicato
      );

      showToast({
        type: result.success ? "success" : "error",
        message: result.message,
      });

      if (result.success) {
        router.refresh();
      }
    });
  }

  function elimina(report: ReportRow) {
    const conferma = window.confirm(
      `Eliminare definitivamente il report "${report.nome}"?`
    );

    if (!conferma) return;

    startTransition(async () => {
      const result = await eliminaReportPersonalizzato(report.id);

      showToast({
        type: result.success ? "success" : "error",
        message: result.message,
      });

      if (result.success) {
        router.refresh();
      }
    });
  }

  if (reports.length === 0) {
    return (
      <div className="rounded-xl border border-dashed border-zinc-800 bg-zinc-950 p-8 text-center text-sm text-zinc-500">
        Nessun report creato per questo club.
      </div>
    );
  }

  return (
    <div className="overflow-hidden rounded-xl border border-zinc-800">
      <table className="w-full text-left">
        <thead className="bg-zinc-900">
          <tr>
            <th className="px-4 py-3 text-xs font-medium text-zinc-500">
              Report
            </th>
            <th className="px-4 py-3 text-xs font-medium text-zinc-500">
              Sezione
            </th>
            <th className="px-4 py-3 text-xs font-medium text-zinc-500">
              Tipo
            </th>
            <th className="px-4 py-3 text-xs font-medium text-zinc-500">
              Gruppi
            </th>
            <th className="px-4 py-3 text-right text-xs font-medium text-zinc-500">
              Pubblicato
            </th>
            <th className="px-4 py-3 text-right text-xs font-medium text-zinc-500">
              Azioni
            </th>
          </tr>
        </thead>

        <tbody>
          {reports.map((report) => (
            <tr
              key={report.id}
              className="border-t border-zinc-800 bg-zinc-950"
            >
              <td className="px-4 py-4">
                <div className="flex items-center gap-3">
                  <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-zinc-900 text-zinc-400">
                    <IconaVisualizzazione tipo={report.tipo_visualizzazione} />
                  </div>

                  <div className="min-w-0">
                    <span className="block truncate text-sm font-medium text-white">
                      {report.nome}
                    </span>

                    {report.campo_catapult && (
                      <span className="block truncate text-[11px] text-zinc-500">
                        {report.campo_catapult}
                      </span>
                    )}
                  </div>
                </div>
              </td>

              <td className="px-4 py-4 text-sm text-zinc-400">
                {LABEL_SEZIONE[report.sezione_performance]}
              </td>

              <td className="px-4 py-4 text-sm text-zinc-400">
                {report.tipo_visualizzazione}
              </td>

              <td className="px-4 py-4 text-sm text-zinc-400">
                {report.tipi_profilo_visibili.length === 0
                  ? "—"
                  : report.tipi_profilo_visibili
                      .map((codice) => nomiTipiProfilo[codice] ?? codice)
                      .join(", ")}
              </td>

              <td className="px-4 py-4 text-right">
                <button
                  type="button"
                  disabled={isPending}
                  onClick={() => togglePubblicato(report)}
                  className={[
                    "inline-flex h-7 w-12 items-center rounded-full border transition disabled:opacity-50",
                    report.pubblicato
                      ? "border-emerald-500/40 bg-emerald-500/80"
                      : "border-zinc-700 bg-zinc-800",
                  ].join(" ")}
                  title={
                    report.pubblicato
                      ? "Rimuovi dal riepilogo"
                      : "Pubblica nel riepilogo"
                  }
                >
                  <span
                    className={[
                      "h-5 w-5 rounded-full bg-white transition",
                      report.pubblicato ? "translate-x-6" : "translate-x-1",
                    ].join(" ")}
                  />
                </button>
              </td>

              <td className="px-4 py-4">
                <div className="flex justify-end gap-2">
                  <button
                    type="button"
                    disabled={isPending}
                    onClick={() => elimina(report)}
                    title="Elimina report"
                    className="rounded-lg border border-zinc-800 p-2 text-zinc-400 transition hover:border-red-500/40 hover:text-red-400 disabled:opacity-50"
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                </div>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
