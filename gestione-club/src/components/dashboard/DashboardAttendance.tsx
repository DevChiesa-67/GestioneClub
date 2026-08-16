import { createClient } from "@/lib/supabase-server";
import DashboardAttendanceClient from "@/components/dashboard/DashboardAttendanceClient";
import { supabaseAdmin } from "@/lib/supabase-admin";

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

  let rpeQuery = supabaseAdmin
    .from("misurazioni_benessere")
    .select("data_compilazione, rpe, minutaggio_lavoro")
    .eq("club_id", clubId)
    .in("tipo_compilazione", ["campo", "palestra"])
    .not("rpe", "is", null)
    .order("data_compilazione", { ascending: true });

  if (squadraId) {
    rpeQuery = rpeQuery.eq("squadra_id", squadraId);
  }

  if (giocatoreId) {
    rpeQuery = rpeQuery.eq("giocatore_id", giocatoreId);
  }

  const { data: misurazioniRpe } = await rpeQuery;
  const raggruppate = new Map<
    string,
    { rpe: number[]; srpe: number[] }
  >();

  for (const misurazione of misurazioniRpe ?? []) {
    const gruppo = raggruppate.get(misurazione.data_compilazione) ?? {
      rpe: [],
      srpe: [],
    };
    const rpe = Number(misurazione.rpe);
    gruppo.rpe.push(rpe);

    if (misurazione.minutaggio_lavoro !== null) {
      gruppo.srpe.push(rpe * Number(misurazione.minutaggio_lavoro));
    }

    raggruppate.set(misurazione.data_compilazione, gruppo);
  }

  const rpeGrezzi = Array.from(raggruppate.entries()).map(([data, valori]) => ({
    data,
    valore: valori.rpe.reduce((somma, valore) => somma + valore, 0) / valori.rpe.length,
  }));
  const srpeGrezzi = Array.from(raggruppate.entries())
    .filter(([, valori]) => valori.srpe.length > 0)
    .map(([data, valori]) => ({
      data,
      valore:
        valori.srpe.reduce((somma, valore) => somma + valore, 0) /
        valori.srpe.length,
    }));

  return (
    <DashboardAttendanceClient
      clubId={clubId}
      squadraId={squadraId}
      coloreFlag={coloreFlag}
      giocatoreId={giocatoreId}
      rpeGrezzi={rpeGrezzi}
      srpeGrezzi={srpeGrezzi}
    />
  );
}
