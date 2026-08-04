import { createClient } from "@/lib/supabase-server";
import { getUpcomingPartite } from "@/lib/services/dashboard.service";
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
  const [eventi, themeColor] = await Promise.all([
    getUpcomingPartite(4),
    getThemeColor(),
  ]);

  return (
    <DashboardEventCard
      titolo="Prossime partite"
      eventi={eventi}
      themeColor={themeColor}
      messaggioVuoto="Nessuna partita in programma."
    />
  );
}
