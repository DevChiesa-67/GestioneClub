
import { createClient } from "@/lib/supabase-server";
import { comunicazioneVisibilePerProfilo } from "@/lib/comunicazioni/destinatari";



async function getSelectedContext() {
  const supabase = await createClient();

  const {
    data: { user },
    error: userError,
  } = await supabase.auth.getUser();

  if (userError || !user) {
    return {
      supabase,
      clubId: null,
      squadraId: null,
    };
  }

  const { data: profile, error: profileError } = await supabase
    .from("profili")
    .select("last_club_id,last_squadra_id")
    .eq("auth_user_id", user.id)
    .single();

  if (profileError || !profile) {
    return {
      supabase,
      clubId: null,
      squadraId: null,
    };
  }

  return {
    supabase,
    clubId: profile.last_club_id ?? null,
    squadraId: profile.last_squadra_id ?? null,
  };
}
export async function getDashboardTheme() {
  const { supabase, clubId } = await getSelectedContext();

  if (!clubId) {
    return {
      clubId: null,
      themeColor: "#d71920",
    };
  }

  const { data: club, error } = await supabase
    .from("club")
    .select("colore_flag")
    .eq("id", clubId)
    .single();

  if (error || !club) {
    return {
      clubId,
      themeColor: "#d71920",
    };
  }

  return {
    clubId,
    themeColor: club.colore_flag || "#d71920",
  };
}

export async function getDashboardStats() {
  const { supabase, clubId, squadraId } = await getSelectedContext();

  if (!clubId) {
    return {
      giocatori: 0,
      squadre: 0,
      allenamenti: 0,
      partite: 0,
      report: 0,
    };
  }

  const today = new Date().toISOString().slice(0, 10);

  let giocatoriQuery = supabase
    .from("giocatori")
    .select("id", { count: "exact", head: true })
    .eq("club_id", clubId)
    .eq("attivo", true);

  if (squadraId) {
    giocatoriQuery = giocatoriQuery.eq("squadra_id", squadraId);
  }

  const squadreQuery = supabase
    .from("squadre")
    .select("id", { count: "exact", head: true })
    .eq("club_id", clubId);

  let allenamentiQuery = supabase
    .from("allenamenti")
    .select("id", { count: "exact", head: true })
    .eq("club_id", clubId)
    .gte("data_allenamento", today);

  if (squadraId) {
    allenamentiQuery = allenamentiQuery.eq("squadra_id", squadraId);
  }

  let partiteQuery = supabase
    .from("partite")
    .select("id", { count: "exact", head: true })
    .eq("club_id", clubId)
    .gte("data_partita", today);

  if (squadraId) {
    partiteQuery = partiteQuery.eq("squadra_id", squadraId);
  }

  let reportQuery = supabase
    .from("report")
    .select("id", { count: "exact", head: true })
    .eq("club_id", clubId);

  if (squadraId) {
    reportQuery = reportQuery.eq("squadra_id", squadraId);
  }

  const [giocatori, squadre, allenamenti, partite, report] =
    await Promise.all([
      giocatoriQuery,
      squadreQuery,
      allenamentiQuery,
      partiteQuery,
      reportQuery,
    ]);

  return {
    giocatori: giocatori.count ?? 0,
    squadre: squadre.count ?? 0,
    allenamenti: allenamenti.count ?? 0,
    partite: partite.count ?? 0,
    report: report.count ?? 0,
  };
}

type SquadraPartitaJoin = {
  nome: string | null;
  logo_path: string | null;
};

function firstJoin<T>(
  value: T | T[] | null | undefined
): T | null {
  if (Array.isArray(value)) {
    return value[0] ?? null;
  }

  return value ?? null;
}

async function getLogoSignedUrl(
  supabase: Awaited<ReturnType<typeof createClient>>,
  logoPath: string | null | undefined
) {
  if (!logoPath) return null;

  if (
    logoPath.startsWith("http://") ||
    logoPath.startsWith("https://")
  ) {
    return logoPath;
  }

  const cleanPath = logoPath
    .trim()
    .replace(/^\/+/, "")
    .replace(/^loghi-squadre\//, "");

  const { data, error } = await supabase.storage
    .from("loghi-squadre")
    .createSignedUrl(cleanPath, 60 * 60);

  if (error) {
    console.error("Errore signed URL logo squadra:", error);
    return null;
  }

  return data.signedUrl;
}

export async function getUpcomingEvents() {
  const { supabase, clubId, squadraId } =
    await getSelectedContext();

  if (!clubId) {
    return [];
  }

  const today = new Date().toISOString().slice(0, 10);

  let allenamentiQuery = supabase
    .from("allenamenti")
    .select(`
      id,
      titolo,
      data_allenamento,
      ora_inizio,
      ora_fine,
      luogo,
      club_id,
      squadra_id
    `)
    .gte("data_allenamento", today)
    .eq("club_id", clubId)
    .order("data_allenamento", {
      ascending: true,
    })
    .order("ora_inizio", {
      ascending: true,
    })
    .limit(4);

  let partiteQuery = supabase
    .from("partite")
    .select(`
      id,
      avversario,
      data_partita,
      ora_partita,
      luogo,
      casa_fuori,
      squadra_casa:squadre_partite!partite_squadra_casa_id_fkey (
        nome,
        logo_path
      ),
      squadra_fuori:squadre_partite!partite_squadra_fuori_id_fkey (
        nome,
        logo_path
      )
    `)
    .eq("club_id", clubId)
    .eq("stato_partita", "programmata")
    .gte("data_partita", today)
    .order("data_partita", {
      ascending: true,
    })
    .order("ora_partita", {
      ascending: true,
    })
    .limit(5);

  if (squadraId) {
    allenamentiQuery = allenamentiQuery.eq(
      "squadra_id",
      squadraId
    );

    partiteQuery = partiteQuery.eq(
      "squadra_id",
      squadraId
    );
  }

  const [
    {
      data: allenamenti,
      error: allenamentiError,
    },
    {
      data: partite,
      error: partiteError,
    },
  ] = await Promise.all([
    allenamentiQuery,
    partiteQuery,
  ]);

  if (allenamentiError) {
    console.error(
      "Errore caricamento allenamenti dashboard:",
      allenamentiError
    );
  }

  if (partiteError) {
    console.error(
      "Errore caricamento partite dashboard:",
      partiteError
    );
  }

  const eventiAllenamenti = (allenamenti ?? []).map(
    (allenamento) => ({
      id: allenamento.id,
      type: "Allenamento" as const,
      title: allenamento.titolo,
      date: allenamento.data_allenamento,
      time: `${
        allenamento.ora_inizio?.slice(0, 5) ?? ""
      }${
        allenamento.ora_fine
          ? ` - ${allenamento.ora_fine.slice(0, 5)}`
          : ""
      }`,
      place: allenamento.luogo ?? "Campo",
      logoCasa: null,
      logoFuori: null,
    })
  );

  const eventiPartite = await Promise.all(
  (partite ?? []).map(async (partita) => {
    const squadraCasa = firstJoin(
      partita.squadra_casa as
        | SquadraPartitaJoin
        | SquadraPartitaJoin[]
        | null
    );

    const squadraFuori = firstJoin(
      partita.squadra_fuori as
        | SquadraPartitaJoin
        | SquadraPartitaJoin[]
        | null
    );

    return {
      id: partita.id,
      type: "Partita" as const,
      title:
        squadraCasa?.nome && squadraFuori?.nome
          ? `${squadraCasa.nome} vs ${squadraFuori.nome}`
          : `Partita vs ${partita.avversario ?? "avversario"}`,
      date: partita.data_partita,
      time: partita.ora_partita?.slice(0, 5) ?? "",
      place: partita.luogo ?? "Campo",
      logoCasa: await getLogoSignedUrl(supabase, squadraCasa?.logo_path),
      logoFuori: await getLogoSignedUrl(supabase, squadraFuori?.logo_path),
    };
  })
);

  return [
    ...eventiAllenamenti,
    ...eventiPartite,
  ]
    .sort((a, b) => {
      const dateComparison =
        a.date.localeCompare(b.date);

      if (dateComparison !== 0) {
        return dateComparison;
      }

      return a.time.localeCompare(b.time);
    })
    .slice(0, 4);
}

export async function getRecentCommunications() {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) return [];

  const { data: profilo, error: profiloError } = await supabase
    .from("profili")
    .select("id, tipo_profilo, last_club_id")
    .eq("auth_user_id", user.id)
    .single();

  if (profiloError) {
  console.error("Errore profilo dashboard comunicazioni:", {
    message: profiloError.message,
    code: profiloError.code,
    details: profiloError.details,
    hint: profiloError.hint,
  });

  return [];
}

if (!profilo?.last_club_id) {
  console.warn(
    "Dashboard comunicazioni: profilo senza last_club_id."
  );

  return [];
}

  const { data, error } = await supabase
    .from("comunicazioni")
    .select(`
      id,
      titolo,
      descrizione,
      destinatari_tipo,
      destinatari_profili,
      created_at,
      club_id
    `)
    .eq("club_id", profilo.last_club_id)
    .order("created_at", { ascending: false })
    .limit(50);

  if (error) {
    console.error(
      "Errore caricamento comunicazioni dashboard:",
      JSON.stringify(error, null, 2)
    );

    return [];
  }

  const visibili = (data ?? []).filter((comunicazione) =>
    comunicazioneVisibilePerProfilo(comunicazione, {
      id: profilo.id,
      tipoProfilo: profilo.tipo_profilo,
    })
  );

  return visibili.slice(0, 5);
}

export async function getRecentReports() {
  const { supabase, clubId, squadraId } = await getSelectedContext();

  if (!clubId) {
    return [];
  }

  let query = supabase
    .from("report")
    .select(`
      id,
      titolo,
      descrizione,
      created_at,
      club_id,
      squadra_id
    `)
    .eq("club_id", clubId)
    .order("created_at", { ascending: false })
    .limit(2);

  if (squadraId) {
    query = query.eq("squadra_id", squadraId);
  }

  const { data, error } = await query;

  if (error) {
    console.error(
      "Errore caricamento report dashboard:",
      error
    );

    return [];
  }

  return data ?? [];
}

export async function getMedicalExpiringPlayers() {
  const { supabase, clubId, squadraId } = await getSelectedContext();

  if (!clubId) {
    return [];
  }

  let query = supabase
    .from("giocatori")
    .select(`
      id,
      nome,
      cognome,
      club_id,
      squadra_id
    `)
    .eq("club_id", clubId)
    .eq("attivo", true)
    .limit(3);

  if (squadraId) {
    query = query.eq("squadra_id", squadraId);
  }

  const { data, error } = await query;

  if (error) {
    console.error(
      "Errore caricamento giocatori dashboard:",
      error
    );

    return [];
  }

  return data ?? [];
}

export async function getPerformanceData() {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) return [];

  const { data: profilo, error: profiloError } = await supabase
    .from("profili")
    .select("last_club_id, last_squadra_id, tipo_profilo")
    .eq("auth_user_id", user.id)
    .single();

  if (profiloError || !profilo?.last_club_id) {
    console.error(
      "Errore profilo performance dashboard:",
      JSON.stringify(profiloError, null, 2)
    );

    return [];
  }

  let query = supabase
    .from("catapult_data")
    .select("*")
    .eq("club_id", profilo.last_club_id)
    .ilike("split_name", "ALL")
    .order("created_at", { ascending: false })
    .limit(100);

  if (profilo.last_squadra_id) {
    query = query.eq("squadra_id", profilo.last_squadra_id);
  }

  const { data, error } = await query;

  if (error) {
    console.error(
      "Errore caricamento performance dashboard:",
      JSON.stringify(error, null, 2)
    );

    return [];
  }

  return data ?? [];
}


export type DashboardPlayerLoadPoint = {
  data: string;
  player_load: number;
  acwr_medio: number | null;
};

export type DashboardAcwrTeamPoint = {
  data: string;
  acwr_ewma: number;
};

export async function getDashboardPlayerLoadData(): Promise<DashboardAcwrTeamPoint[]> {
  const supabase = await createClient();

  const {
    data: { user },
    error: userError,
  } = await supabase.auth.getUser();

  if (userError || !user) return [];

  const { data: profilo } = await supabase
    .from("profili")
    .select("last_club_id, last_squadra_id")
    .eq("auth_user_id", user.id)
    .single();

  if (!profilo?.last_club_id) return [];

  const fourteenDaysAgo = new Date();
  fourteenDaysAgo.setDate(fourteenDaysAgo.getDate() - 14);
  const startDate = fourteenDaysAgo.toISOString().slice(0, 10);

  let query = supabase
    .from("catapult_acwr")
    .select("data, acwr_ewma")
    .eq("club_id", profilo.last_club_id)
    .not("acwr_ewma", "is", null)
    .gte("data", startDate)
    .order("data", { ascending: true });

  if (profilo.last_squadra_id) {
    query = query.eq("squadra_id", profilo.last_squadra_id);
  }

  const { data, error } = await query;

  if (error || !data) {
    console.error("Errore caricamento ACWR dashboard:", error);
    return [];
  }

  const grouped = new Map<string, { sum: number; count: number }>();

  for (const row of data) {
    const current = grouped.get(row.data) ?? { sum: 0, count: 0 };

    current.sum += Number(row.acwr_ewma ?? 0);
    current.count += 1;

    grouped.set(row.data, current);
  }

  return Array.from(grouped.entries()).map(([data, value]) => ({
    data,
    acwr_ewma: value.count > 0 ? value.sum / value.count : 0,
  }));
}