import { createClient } from "@/lib/supabase-server";
import { getDashboardAttendanceData } from "@/lib/services/dashboard.service";

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

export default async function DashboardAttendance() {
  const data = await getDashboardAttendanceData();
  const themeColor = await getThemeColor();

  const width = 600;
  const height = 230;

  const minChartValue = 0;
  const maxChartValue = 100;

  const chartTop = 35;
  const chartBottom = height - 38;

  const points = data.map((d, index) => {
    const x =
      data.length === 1
        ? width / 2
        : (index / (data.length - 1)) * width;

    const y =
      chartBottom -
      ((d.percentuale - minChartValue) / (maxChartValue - minChartValue)) *
        (chartBottom - chartTop);

    return {
      x,
      y,
      label: new Date(d.data).toLocaleDateString("it-IT", {
        day: "2-digit",
        month: "short",
      }),
      value: d.percentuale,
    };
  });

  return (
    <div className="rounded-2xl border border-white/10 bg-[#171717] p-4 sm:p-6">
      <div className="mb-5 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <h2 className="text-lg font-bold text-white sm:text-xl">
          Andamento presenze sedute
        </h2>

        <div className="flex flex-wrap gap-3 text-xs sm:gap-4 sm:text-sm">
          <span style={{ color: themeColor }}>━ % presenza per seduta</span>
        </div>
      </div>

      {data.length === 0 ? (
        <div className="flex h-72 items-center justify-center rounded-xl bg-black/20 text-zinc-500">
          Nessuna presenza registrata.
        </div>
      ) : (
        <div className="rounded-xl bg-black/20 p-3 sm:p-6">
          <div className="overflow-x-auto overflow-y-hidden pb-2">
            <svg
              viewBox={`0 0 ${width} ${height}`}
              className="h-[230px] min-w-[620px] sm:h-full sm:min-w-0 sm:w-full"
            >
              {[50, 95, 140, 185].map((y) => (
                <line
                  key={y}
                  x1="0"
                  x2={width}
                  y1={y}
                  y2={y}
                  stroke="rgba(255,255,255,0.10)"
                  strokeWidth="1"
                />
              ))}

              <polyline
                fill="none"
                stroke={themeColor}
                strokeWidth="4"
                strokeLinecap="round"
                strokeLinejoin="round"
                points={points.map((p) => `${p.x},${p.y}`).join(" ")}
              />

              {points.map((point, index) => (
                <g key={`${point.label}-${index}`}>
                  <circle cx={point.x} cy={point.y} r="5" fill={themeColor} />

                  <text
                    x={point.x}
                    y={point.y - 12}
                    textAnchor="middle"
                    className="fill-white text-[11px] font-bold"
                  >
                    {point.value}%
                  </text>
                </g>
              ))}

              {points.map((point, index) => (
                <text
                  key={`date-${point.label}-${index}`}
                  x={point.x}
                  y={height - 5}
                  textAnchor="middle"
                  className="fill-zinc-500 text-[10px]"
                >
                  {point.label}
                </text>
              ))}
            </svg>
          </div>

          <div className="mt-2 text-center text-[10px] text-zinc-500 sm:hidden">
            Scorri lateralmente per vedere tutte le sedute
          </div>

          <div className="mt-4 grid grid-cols-2 gap-3 text-xs text-zinc-400 sm:grid-cols-4">
            {data.slice(-4).map((item) => (
              <div key={item.data} className="rounded-lg bg-black/30 p-2">
                <p className="text-zinc-500">
                  {new Date(item.data).toLocaleDateString("it-IT", {
                    day: "2-digit",
                    month: "short",
                  })}
                </p>

                <p className="font-bold text-white">{item.percentuale}%</p>

                <p className="text-[10px] text-zinc-500">
                  {item.presenti}/{item.totale} presenti
                </p>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
