import { redirect } from "next/navigation";

import { createClient } from "@/lib/supabase-server";
import { AppCard } from "@/components/ui/AppCard";
import NuovoReportClient from "@/components/reportistica/NuovoReportClient";

export default async function NuovoReportPage() {
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
          Il report builder è riservato agli amministratori del club.
        </p>
      </AppCard>
    );
  }

  const { data: tipiProfiloData } = await supabase
    .from("tipi_profili")
    .select("codice, nome")
    .eq("attivo", true)
    .order("nome");

  return <NuovoReportClient tipiProfilo={tipiProfiloData ?? []} />;
}
