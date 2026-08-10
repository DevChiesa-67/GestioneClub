import { createClient } from "@/lib/supabase-server";
import {
  getUpcomingEventiClub,
  getUpcomingPartite,
} from "@/lib/services/dashboard.service";
import DashboardEventCard from "./DashboardEventCard";

async function getThemeColor() {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) return "#d71920";

  const { data: profile } = await supabase
    .from("profili")
    .select("last_club_id")
    .eq("auth_user_id", user.id)
    .single();

  if (!profile?.last_club_id) return "#d71920";

  const { data: club } = await supabase
    .from("club")
    .select("colore_flag")
    .eq("id", profile.last_club_id)
    .single();

  return club?.colore_flag || "#d71920";
}

export default async function DashboardProssimePartite() {
  const [partite, eventiClub, themeColor] = await Promise.all([
    getUpcomingPartite(4),
    getUpcomingEventiClub(4),
    getThemeColor(),
  ]);

  const agenda = [...partite, ...eventiClub]
    .sort((a, b) => {
      const dateComparison = a.date.localeCompare(b.date);

      if (dateComparison !== 0) {
        return dateComparison;
      }

      return a.time.localeCompare(b.time);
    })
    .slice(0, 4);

  return (
    <DashboardEventCard
      titolo="Prossimi appuntamenti"
      eventi={agenda}
      themeColor={themeColor}
      messaggioVuoto="Nessuna partita o evento in programma."
    />
  );
}
