import Link from "next/link";
import {
  BarChart3,
  Plus,
  LayoutDashboard,
  Users,
  Activity,
  FlaskConical,
  Eye,
  Pencil,
} from "lucide-react";
import { AppCard } from "@/components/ui/AppCard";

const sezioni = [
  {
    key: "presenze",
    titolo: "Presenze",
    descrizione: "Report collegati a presenze, assenze e partecipazione.",
    icon: Users,
  },
  {
    key: "performance",
    titolo: "Performance",
    descrizione: "Report su carichi, GPS, Catapult e metriche atletiche.",
    icon: Activity,
  },
  {
    key: "test",
    titolo: "Test",
    descrizione: "Report su test atletici, forza e misurazioni.",
    icon: FlaskConical,
  },
];

const reportDemo = [
  {
    id: "1",
    nome: "Presenze per giocatore",
    sezione: "Presenze",
    tipo: "Grafico barre",
  },
  {
    id: "2",
    nome: "Distanza media settimanale",
    sezione: "Performance",
    tipo: "Linea",
  },
  {
    id: "3",
    nome: "Confronto test velocità",
    sezione: "Test",
    tipo: "Tabella",
  },
];

export default function ReportisticaPage() {
  return (
    <div className="space-y-6">
      <div className="flex flex-col justify-between gap-4 md:flex-row md:items-center">
        <div>
          <h1 className="text-2xl font-semibold text-white">Reportistica</h1>
          <p className="mt-1 text-sm text-zinc-400">
            Crea report personalizzati e pubblicali nelle sezioni Presenze,
            Performance e Test.
          </p>
        </div>

        <Link
          href="/reportistica/nuovo"
          className="inline-flex items-center justify-center gap-2 rounded-xl bg-white px-4 py-2 text-sm font-semibold text-black transition hover:bg-zinc-200"
        >
          <Plus className="h-4 w-4" />
          Nuovo report
        </Link>
      </div>

      <div className="grid gap-4 md:grid-cols-3">
        {sezioni.map((sezione) => {
          const Icon = sezione.icon;

          return (
            <AppCard key={sezione.key}>
              <div className="flex items-start gap-4">
                <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-zinc-900 text-zinc-300">
                  <Icon className="h-5 w-5" />
                </div>

                <div>
                  <h2 className="text-sm font-semibold text-white">
                    {sezione.titolo}
                  </h2>
                  <p className="mt-1 text-xs leading-5 text-zinc-500">
                    {sezione.descrizione}
                  </p>
                </div>
              </div>
            </AppCard>
          );
        })}
      </div>

      <AppCard>
        <div className="mb-4 flex items-center justify-between">
          <div>
            <h2 className="text-base font-semibold text-white">
              I tuoi report
            </h2>
            <p className="mt-1 text-sm text-zinc-500">
              Elenco dei report creati per il club corrente.
            </p>
          </div>

          <LayoutDashboard className="h-5 w-5 text-zinc-600" />
        </div>

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
                <th className="px-4 py-3 text-right text-xs font-medium text-zinc-500">
                  Azioni
                </th>
              </tr>
            </thead>

            <tbody>
              {reportDemo.map((report) => (
                <tr
                  key={report.id}
                  className="border-t border-zinc-800 bg-zinc-950"
                >
                  <td className="px-4 py-4">
                    <div className="flex items-center gap-3">
                      <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-zinc-900 text-zinc-400">
                        <BarChart3 className="h-4 w-4" />
                      </div>

                      <span className="text-sm font-medium text-white">
                        {report.nome}
                      </span>
                    </div>
                  </td>

                  <td className="px-4 py-4 text-sm text-zinc-400">
                    {report.sezione}
                  </td>

                  <td className="px-4 py-4 text-sm text-zinc-400">
                    {report.tipo}
                  </td>

                  <td className="px-4 py-4">
                    <div className="flex justify-end gap-2">
                      <button className="rounded-lg border border-zinc-800 p-2 text-zinc-400 transition hover:border-zinc-700 hover:text-white">
                        <Eye className="h-4 w-4" />
                      </button>

                      <Link
                        href={`/reportistica/${report.id}`}
                        className="rounded-lg border border-zinc-800 p-2 text-zinc-400 transition hover:border-zinc-700 hover:text-white"
                      >
                        <Pencil className="h-4 w-4" />
                      </Link>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </AppCard>
    </div>
  );
}