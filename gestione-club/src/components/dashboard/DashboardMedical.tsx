import Image from "next/image";
import { createClient } from "@/lib/supabase-server";

type GiocatoreDashboard = {
  id: string;
  nome: string | null;
  cognome: string | null;
  foto_url: string | null;
};

type InfortunioDashboard = {
  id: string;
  tipo_infortunio: string;
  data_rientro: string | null;
  stato: string;
  giocatori: GiocatoreDashboard | null;
};

type InfortunioDashboardRow = {
  id: string;
  tipo_infortunio: string;
  data_rientro: string | null;
  stato: string;
  giocatori: GiocatoreDashboard | GiocatoreDashboard[] | null;
};

async function getDashboardContext() {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return {
      supabase,
      lastClubId: null,
      lastSquadraId: null,
      themeColor: "#d71920",
    };
  }

  const { data: profile } = await supabase
    .from("profili")
    .select("last_club_id,last_squadra_id")
    .eq("auth_user_id", user.id)
    .single();

  if (!profile?.last_club_id) {
    return {
      supabase,
      lastClubId: null,
      lastSquadraId: null,
      themeColor: "#d71920",
    };
  }

  const { data: club } = await supabase
    .from("club")
    .select("colore_flag")
    .eq("id", profile.last_club_id)
    .single();

  return {
    supabase,
    lastClubId: profile.last_club_id as string,
    lastSquadraId: profile.last_squadra_id as string | null,
    themeColor: club?.colore_flag || "#d71920",
  };
}

async function getInfortuniDashboard() {
  const { supabase, lastClubId, lastSquadraId } = await getDashboardContext();

  if (!lastClubId) return [];

  let query = supabase
    .from("infortuni")
    .select(`
      id,
      tipo_infortunio,
      data_rientro,
      stato,
      giocatori:giocatore_id (
        id,
        nome,
        cognome,
        foto_url
      )
    `)
    .eq("club_id", lastClubId)
    .neq("stato", "rientrato")
    .order("data_rientro", { ascending: true, nullsFirst: false })
    .limit(5);

  if (lastSquadraId) {
    query = query.eq("squadra_id", lastSquadraId);
  }

  const { data, error } = await query;

  if (error) {
    console.error(error);
    return [];
  }

  const rows = (data ?? []) as unknown as InfortunioDashboardRow[];

  return rows.map((row) => ({
    ...row,
    giocatori: Array.isArray(row.giocatori)
      ? row.giocatori[0] ?? null
      : row.giocatori,
  })) satisfies InfortunioDashboard[];
}

function getRientroLabel(dataRientro: string | null) {
  if (!dataRientro) return "Da definire";

  const today = new Date();
  const rientro = new Date(`${dataRientro}T00:00:00`);

  today.setHours(0, 0, 0, 0);

  const diffTime = rientro.getTime() - today.getTime();
  const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

  if (diffDays < 0) return "Rientro scaduto";
  if (diffDays === 0) return "Rientro oggi";
  if (diffDays === 1) return "1 giorno";

  return `${diffDays} giorni`;
}

function isUrgentRientro(dataRientro: string | null) {
  if (!dataRientro) return false;

  const today = new Date();
  const rientro = new Date(`${dataRientro}T00:00:00`);

  today.setHours(0, 0, 0, 0);

  const diffTime = rientro.getTime() - today.getTime();
  const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

  return diffDays <= 1;
}

export default async function DashboardMedical() {
  const [{ themeColor }, infortuni] = await Promise.all([
    getDashboardContext(),
    getInfortuniDashboard(),
  ]);

  return (
    <div
      className="rounded-2xl border bg-[#171717] p-6"
      style={{
        borderColor: `${themeColor}33`,
      }}
    >
      <div className="mb-5 flex items-center justify-between gap-4">
        <h2 className="text-xl font-bold text-white">
          Stato infortuni e rientri previsti
        </h2>

        <span
          className="h-2.5 w-2.5 rounded-full"
          style={{ backgroundColor: themeColor }}
        />
      </div>

      <div className="space-y-4">
        {infortuni.length === 0 && (
          <p className="text-zinc-500">Nessun giocatore infortunato.</p>
        )}

        {infortuni.map((infortunio) => {
          const player = infortunio.giocatori;
          const label = getRientroLabel(infortunio.data_rientro);
          const urgent = isUrgentRientro(infortunio.data_rientro);

          return (
            <div
              key={infortunio.id}
              className="flex items-center justify-between gap-4 rounded-2xl border border-white/5 bg-white/[0.03] p-3"
            >
              <div className="flex min-w-0 items-center gap-3">
                <div
                  className="relative h-11 w-11 shrink-0 overflow-hidden rounded-full border bg-zinc-800"
                  style={{
                    borderColor: `${themeColor}66`,
                  }}
                >
                  {player?.foto_url ? (
                    <Image
                      src={player.foto_url}
                      alt={`${player.nome ?? ""} ${player.cognome ?? ""}`}
                      fill
                      className="object-cover"
                    />
                  ) : (
                    <div
                      className="flex h-full w-full items-center justify-center text-sm font-bold text-white"
                      style={{
                        backgroundColor: `${themeColor}55`,
                      }}
                    >
                      {player?.nome?.[0] ?? "?"}
                      {player?.cognome?.[0] ?? ""}
                    </div>
                  )}
                </div>

                <div className="min-w-0">
                  <p className="truncate font-bold text-white">
                    {player?.nome} {player?.cognome}
                  </p>
                  <p className="truncate text-sm text-zinc-400">
                    {infortunio.tipo_infortunio}
                  </p>
                </div>
              </div>

              <span
                className="shrink-0 rounded-full border px-3 py-1 text-xs font-bold text-white"
                style={{
                  backgroundColor: urgent ? themeColor : `${themeColor}22`,
                  borderColor: `${themeColor}55`,
                  color: urgent ? "#ffffff" : themeColor,
                }}
              >
                {label}
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
}