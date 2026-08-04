import { redirect } from "next/navigation";
import Link from "next/link";
import { Plus, LayoutDashboard, Users, Activity, FlaskConical } from "lucide-react";

import { createClient } from "@/lib/supabase-server";
import { AppCard } from "@/components/ui/AppCard";
import ReportisticaListaClient from "@/components/reportistica/ReportisticaListaClient";

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

export default async function ReportisticaPage() {
  const supabase = await createClient();

  const {
    data: { user },
    error: userError,
  } = await supabase.auth.getUser();

  if (userError || !user) {
    redirect("/login");
  }

  const { data: profilo, error: profiloError } = await supabase
    .from("profili")
    .select("id, tipo_profilo, last_club_id")
    .eq("auth_user_id", user.id)
    .single();

  if (profiloError || !profilo) {
    return (
      <AppCard>
        <p className="text-sm text-red-400">Profilo non trovato.</p>
      </AppCard>
    );
  }

  const isAdmin =
    String(profilo.tipo_profilo ?? "").toLowerCase() === "admin";

  if (!isAdmin) {
    return (
      <AppCard>
        <p className="text-sm text-zinc-400">
          La reportistica è riservata agli amministratori del club.
        </p>
      </AppCard>
    );
  }

  if (!profilo.last_club_id) {
    return (
      <AppCard>
        <p className="text-sm text-zinc-400">
          Nessun club attivo selezionato.
        </p>
      </AppCard>
    );
  }

  const [{ data: reportData, error: reportError }, { data: tipiProfiloData }] =
    await Promise.all([
      supabase
        .from("report_personalizzati")
        .select(
          "id, nome, descrizione, sezione_performance, tipo_visualizzazione, pubblicato, tipi_profilo_visibili, campo_catapult"
        )
        .eq("club_id", profilo.last_club_id)
        .order("created_at", { ascending: false }),
      supabase.from("tipi_profili").select("codice, nome"),
    ]);

  if (reportError) {
    console.error("Errore caricamento report_personalizzati:", reportError);
  }

  const nomiTipiProfilo = Object.fromEntries(
    (tipiProfiloData ?? []).map((tipo) => [tipo.codice, tipo.nome])
  );

  return (
    <div className="space-y-6">
      <div className="flex flex-col justify-between gap-4 md:flex-row md:items-center">
        <div>
          <h1 className="text-2xl font-semibold text-white">Reportistica</h1>
          <p className="mt-1 text-sm text-zinc-400">
            Crea report personalizzati e pubblica i parametri Catapult che
            vuoi mostrare nel riepilogo Performance, per gruppo.
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
              Elenco dei report creati per il club corrente. Attiva
              &quot;Pubblicato&quot; per farli comparire nel riepilogo
              Performance ai gruppi selezionati.
            </p>
          </div>

          <LayoutDashboard className="h-5 w-5 text-zinc-600" />
        </div>

        <ReportisticaListaClient
          reports={reportData ?? []}
          nomiTipiProfilo={nomiTipiProfilo}
        />
      </AppCard>
    </div>
  );
}
