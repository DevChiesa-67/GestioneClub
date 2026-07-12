import Image from "next/image";
import { Activity, Dumbbell } from "lucide-react";
import { createClient } from "@/lib/supabase-server";
import { getUpcomingEvents } from "@/lib/services/dashboard.service";

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

export default async function DashboardEvents() {
  const events = await getUpcomingEvents();
  const themeColor = await getThemeColor();

  return (
    <div className="rounded-2xl border border-white/10 bg-[#171717] p-3 sm:p-6">
      <h2 className="mb-5 text-lg font-bold text-white sm:mb-6 sm:text-xl">
        Prossimi appuntamenti
      </h2>

      <div className="space-y-4">
        {events.length === 0 && (
          <p className="text-sm text-zinc-500">
            Nessun appuntamento in programma.
          </p>
        )}

        {events.map((event) => {
          const isPartita = event.type === "Partita";

          const date = new Date(event.date);
          const day = date.toLocaleDateString("it-IT", {
            weekday: "short",
          });
          const num = date.toLocaleDateString("it-IT", {
            day: "2-digit",
          });
          const month = date.toLocaleDateString("it-IT", {
            month: "short",
          });

          return (
            <div
  key={`${event.type}-${event.id}`}
  className="relative mt-4 rounded-2xl border border-white/10 bg-black/20 px-3 pb-3 pt-5 sm:mt-0 sm:p-4"
>
  {/* DATA MOBILE - LINGUETTA INTEGRATA IN ALTO A DESTRA */}
  <div
    className="
      absolute
      -top-[17px]
      right-2
      z-10
      flex
      h-[30px]
      items-center
      rounded-xl
      px-4
      shadow-lg
      sm:hidden
    "
    style={{
      backgroundColor: isPartita
        ? themeColor
        : "rgba(39,39,42,0.98)",
      boxShadow: `0 6px 18px ${
        isPartita ? `${themeColor}30` : "rgba(0,0,0,0.35)"
      }`,
    }}
  >
    <div className="flex items-baseline gap-1.5 whitespace-nowrap text-white">
      <span className="text-[9px] font-bold uppercase tracking-wide text-white/75">
        {day}
      </span>

      <span className="text-[13px] font-black leading-none">
        {num}
      </span>

      <span className="text-[9px] font-bold uppercase tracking-wide text-white/90">
        {month}
      </span>
    </div>
  </div>

  <div className="flex items-center gap-3 sm:gap-4">
    {/* DATA DESKTOP */}
    <div
      className="hidden w-16 shrink-0 rounded-xl p-3 text-center sm:block"
      style={{
        backgroundColor: isPartita
          ? themeColor
          : "rgba(0,0,0,0.45)",
      }}
    >
      <p className="text-xs uppercase text-white/70">
        {day}
      </p>

      <p className="text-2xl font-black leading-none text-white">
        {num}
      </p>

      <p className="mt-1 text-xs font-bold uppercase text-white">
        {month}
      </p>
    </div>

    {/* LOGO CASA */}
    <div
      className="
        flex h-11 w-11 shrink-0
        items-center justify-center
        rounded-full  sm:h-24 sm:w-24
      "
      style={{
        borderColor: themeColor,
        color: themeColor,
      }}
    >
      {isPartita && event.logoCasa ? (
        <Image
          src={event.logoCasa}
          alt="Squadra casa"
          width={96}
          height={96}
          className="h-15 w-15 rounded-full object-contain  sm:h-24 sm:w-24"
        />
      ) : event.type === "Allenamento" ? (
        <Dumbbell size={21} />
      ) : (
        <Activity size={21} />
      )}
    </div>

    {/* CONTENUTO */}
    <div className="min-w-0 flex-1 text-center">
  <p className="line-clamp-2 text-sm font-bold leading-5 text-white sm:text-base">
    {event.title}
  </p>

  <p className="mt-0.5 text-xs text-zinc-400 sm:text-sm">
    {event.time}
  </p>

  {event.place && (
    <p className="line-clamp-1 text-xs text-zinc-500 sm:text-sm">
      {event.place}
    </p>
  )}
</div>

    {/* LOGO FUORI */}
    {isPartita && event.logoFuori && (
      <div
        className="
          flex h-11 w-11 shrink-0
          items-center justify-center
          rounded-full  sm:h-24 sm:w-24
        "
      >
        <Image
          src={event.logoFuori}
          alt="Squadra fuori"
          width={96}
          height={96}
          className="h-15 w-15 rounded-full object-contain  sm:h-24 sm:w-24"
        />
      </div>
    )}
  </div>
</div>
          );
        })}
      </div>
    </div>
  );
}