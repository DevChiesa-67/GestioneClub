import { createClient } from "@/lib/supabase-server";
import { FileText, ChevronRight } from "lucide-react";
import { getRecentReports } from "@/lib/services/dashboard.service";

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

export default async function DashboardReports() {
  const reports = await getRecentReports();
  const themeColor = await getThemeColor();

  return (
    <div className="rounded-2xl border border-white/10 bg-[#171717] p-6">
      <h2 className="mb-5 text-xl font-bold text-white">
        Report da leggere
      </h2>

      <div className="space-y-4">
        {reports.length === 0 && (
          <p className="text-zinc-500">Nessun report disponibile.</p>
        )}

        {reports.map((report) => (
          <div
            key={report.id}
            className="flex items-center gap-4 rounded-xl border border-white/10 p-4 transition hover:bg-white/5"
          >
            <div
              className="flex h-11 w-11 items-center justify-center rounded-xl border text-white"
              style={{
                borderColor: `${themeColor}66`,
                color: themeColor,
              }}
            >
              <FileText size={21} />
            </div>

            <div className="flex-1">
              <p className="font-bold text-white">{report.titolo}</p>

              <p className="text-sm text-zinc-500">
                Generato il{" "}
                {new Date(report.created_at).toLocaleDateString("it-IT")}
              </p>
            </div>

            <ChevronRight
              size={20}
              style={{
                color: themeColor,
              }}
            />
          </div>
        ))}
      </div>

      <button
        className="mt-5 w-full rounded-xl border py-3 text-sm font-bold transition hover:text-white"
        style={{
          color: themeColor,
          borderColor: `${themeColor}55`,
        }}
      >
        Vedi tutti i report
      </button>
    </div>
  );
}