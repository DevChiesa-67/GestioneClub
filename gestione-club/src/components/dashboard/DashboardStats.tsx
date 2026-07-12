import {
  Users,
  Shirt,
  CalendarDays,
  Trophy,
  
} from "lucide-react";

import {
  getDashboardStats,
  getDashboardTheme,
} from "@/lib/services/dashboard.service";

const cards = [
  {
    key: "giocatori",
    title: "Giocatori",
    subtitle: "Tesserati attivi",
    icon: Users,
    highlight: true,
    showValue: true,
  },
  {
    key: "squadre",
    title: "Squadre",
    subtitle: "Del club",
    icon: Shirt,
    highlight: false,
    showValue: true,
  },
  {
    key: "allenamenti",
    title: "Allenamenti",
    subtitle: "Prossimi",
    icon: CalendarDays,
    highlight: true,
    showValue: true,
  },
  {
    key: "partite",
    title: "Partite",
    subtitle: "Programmate",
    icon: Trophy,
    highlight: false,
    showValue: true,
  },
  
] as const;

export default async function DashboardStats() {
  const [stats, theme] = await Promise.all([
    getDashboardStats(),
    getDashboardTheme(),
  ]);

  const themeColor = theme.themeColor;

  return (
    <section className="grid grid-cols-2 gap-3 sm:gap-4 xl:grid-cols-5 xl:gap-5">
      {cards.map((card) => {
        const Icon = card.icon;
        const value = stats[card.key];

        return (
          <div
            key={card.key}
            className="rounded-2xl border border-white/10 bg-[#171717] p-4 shadow-xl transition hover:-translate-y-0.5 hover:border-white/20 sm:p-5 xl:p-6"
            style={{
              boxShadow: card.highlight
                ? `0 14px 34px ${themeColor}22`
                : undefined,
            }}
          >
            <div className="flex items-center gap-3 sm:gap-4">
              <div
                className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl text-white sm:h-14 sm:w-14 xl:h-16 xl:w-16"
                style={
                  card.highlight
                    ? { backgroundColor: themeColor }
                    : {
                        backgroundColor: "rgba(0,0,0,0.45)",
                        border: "1px solid rgba(255,255,255,0.1)",
                      }
                }
              >
                <Icon size={22} className="sm:h-6 sm:w-6 xl:h-7 xl:w-7" />
              </div>

              <div className="min-w-0">
                <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-zinc-400 sm:text-[11px] xl:text-xs">
                  {card.title}
                </p>

                {card.showValue && (
                  <h2 className="leading-none text-3xl font-black text-white sm:text-4xl">
                    {value}
                  </h2>
                )}

                <p className="mt-1 text-[11px] leading-tight text-zinc-500 sm:text-xs xl:text-sm">
                  {card.subtitle}
                </p>
              </div>
            </div>
          </div>
        );
      })}
    </section>
  );
}