import { createClient } from "@/lib/supabase-server";
import DashboardAttendanceClient from "@/components/dashboard/DashboardAttendanceClient";

async function getContesto() {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return {
      clubId: null,
      squadraId: null,
      coloreFlag: "#d71920",
      giocatoreId: null,
    };
  }

  const { data: profilo } = await supabase
    .from("profili")
    .select("id, last_club_id, last_squadra_id, tipo_profilo")
    .eq("auth_user_id", user.id)
    .single();

  if (!profilo?.last_club_id) {
    return {
      clubId: null,
      squadraId: null,
      coloreFlag: "#d71920",
      giocatoreId: null,
    };
  }

  const { data: club } = await supabase
    .from("club")
    .select("colore_flag")
    .eq("id", profilo.last_club_id)
    .single();

  // Un profilo "giocatore" deve vedere solo i propri dati nel grafico, non
  // la media/il conteggio di tutta la squadra: recuperiamo il giocatore
  // collegato (via giocatori.id_atleta) per filtrare a valle.
  let giocatoreId: string | null = null;

  if (String(profilo.tipo_profilo || "").toLowerCase() === "giocatore") {
    let giocatoreQuery = supabase
      .from("giocatori")
      .select("id")
      .eq("club_id", profilo.last_club_id)
      .eq("id_atleta", profilo.id);

    if (profilo.last_squadra_id) {
      giocatoreQuery = giocatoreQuery.eq(
        "squadra_id",
        profilo.last_squadra_id
      );
    }

    const { data: giocatore } = await giocatoreQuery.maybeSingle();
    giocatoreId = giocatore?.id ?? null;
  }

  return {
    clubId: profilo.last_club_id as string,
    squadraId: (profilo.last_squadra_id as string | null) ?? null,
    coloreFlag: club?.colore_flag || "#d71920",
    giocatoreId,
  };
}

export default async function DashboardAttendance() {
  const { clubId, squadraId, coloreFlag, giocatoreId } = await getContesto();

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
      giocatoreId={giocatoreId}
    />
  );
}
