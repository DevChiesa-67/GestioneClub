import { createClient } from "@/lib/supabase-server";
import DashboardAttendanceClient from "@/components/dashboard/DashboardAttendanceClient";

async function getContesto() {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return { clubId: null, squadraId: null, coloreFlag: "#d71920" };
  }

  const { data: profilo } = await supabase
    .from("profili")
    .select("last_club_id, last_squadra_id")
    .eq("auth_user_id", user.id)
    .single();

  if (!profilo?.last_club_id) {
    return { clubId: null, squadraId: null, coloreFlag: "#d71920" };
  }

  const { data: club } = await supabase
    .from("club")
    .select("colore_flag")
    .eq("id", profilo.last_club_id)
    .single();

  return {
    clubId: profilo.last_club_id as string,
    squadraId: (profilo.last_squadra_id as string | null) ?? null,
    coloreFlag: club?.colore_flag || "#d71920",
  };
}

export default async function DashboardAttendance() {
  const { clubId, squadraId, coloreFlag } = await getContesto();

  if (!clubId) {
    return (
      <div className="rounded-2xl border border-white/10 bg-[#171717] p-4 sm:p-6">
        <p className="text-sm text-zinc-500">Nessun club attivo selezionato.</p>
      </div>
    );
  }

  return (
    <DashboardAttendanceClient
      clubId={clubId}
      squadraId={squadraId}
      coloreFlag={coloreFlag}
    />
  );
}
