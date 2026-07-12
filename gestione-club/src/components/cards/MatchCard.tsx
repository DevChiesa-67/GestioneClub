import { cn } from "@/lib/utils";

interface MatchCardProps {
  homeTeam: string;
  awayTeam: string;
  date: string;
  time: string;
  location: string;
  /** "scheduled" | "live" | "completed" */
  status: "scheduled" | "live" | "completed";
  homeScore?: number;
  awayScore?: number;
  competition?: string;
  className?: string;
}

const statusConfig = {
  scheduled: { label: "PARTITA", className: "bg-zinc-800 text-zinc-300" },
  live: { label: "IN CORSO", className: "bg-red-600 text-white animate-pulse" },
  completed: { label: "TERMINATA", className: "bg-zinc-700 text-zinc-400" },
};

export function MatchCard({
  homeTeam,
  awayTeam,
  date,
  time,
  location,
  status,
  homeScore,
  awayScore,
  competition,
  className,
}: MatchCardProps) {
  const { label, className: statusClass } = statusConfig[status];

  return (
    <div
      className={cn(
        "flex items-center gap-4 rounded-xl border border-zinc-800 bg-zinc-900 px-5 py-4",
        className
      )}
    >
      {/* Date block */}
      <div className="flex w-12 shrink-0 flex-col items-center text-center">
        <span className="text-xs font-semibold uppercase text-zinc-400 leading-none">
          {date.split(" ")[0]}
        </span>
        <span className="text-2xl font-bold text-white leading-tight">
          {date.split(" ")[1]}
        </span>
        <span className="text-xs font-semibold uppercase text-red-500 leading-none">
          {date.split(" ")[2]}
        </span>
      </div>

      {/* Icon */}
      <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-zinc-800">
        <svg
          xmlns="http://www.w3.org/2000/svg"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth={1.5}
          className="h-5 w-5 text-zinc-300"
        >
          <ellipse cx="12" cy="12" rx="4" ry="7" />
          <path d="M12 5C8 5 4 8 4 12s4 7 8 7" />
          <path d="M12 5c4 0 8 3 8 7s-4 7-8 7" />
          <line x1="4" y1="12" x2="20" y2="12" />
        </svg>
      </div>

      {/* Info */}
      <div className="min-w-0 flex-1">
        <p className="truncate font-semibold text-white leading-tight">
          {homeTeam}
          {status === "completed" && homeScore !== undefined && awayScore !== undefined && (
            <span className="mx-1 text-red-500">
              {homeScore} – {awayScore}
            </span>
          )}
          {status !== "completed" && " vs "}
          {status !== "completed" && awayTeam}
        </p>
        {status === "completed" && (
          <p className="truncate text-sm text-zinc-400">{awayTeam}</p>
        )}
        <p className="mt-0.5 text-xs text-zinc-500">
          {time} · {location}
        </p>
        {competition && (
          <p className="text-xs text-zinc-600">{competition}</p>
        )}
      </div>

      {/* Status badge */}
      <span
        className={cn(
          "shrink-0 rounded px-2 py-0.5 text-xs font-semibold tracking-wide",
          statusClass
        )}
      >
        {label}
      </span>
    </div>
  );
}