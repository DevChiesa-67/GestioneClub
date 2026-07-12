import { cn } from "@/lib/utils";

interface TrainingCardProps {
  title: string;
  /** e.g. "MER 22 MAG" – space-separated weekday / day / month-abbr */
  date: string;
  startTime: string;
  endTime: string;
  location: string;
  team?: string;
  onClick?: () => void;
  className?: string;
}

export function TrainingCard({
  title,
  date,
  startTime,
  endTime,
  location,
  team,
  onClick,
  className,
}: TrainingCardProps) {
  const [weekday, day, month] = date.split(" ");

  return (
    <div
      role={onClick ? "button" : undefined}
      tabIndex={onClick ? 0 : undefined}
      onClick={onClick}
      onKeyDown={onClick ? (e) => e.key === "Enter" && onClick() : undefined}
      className={cn(
        "flex items-center gap-4 rounded-xl border border-zinc-800 bg-zinc-900 px-5 py-4 transition-colors",
        onClick && "cursor-pointer hover:border-zinc-600 hover:bg-zinc-800/60",
        className
      )}
    >
      {/* Date block */}
      <div className="flex w-12 shrink-0 flex-col items-center text-center">
        <span className="text-xs font-semibold uppercase text-zinc-400 leading-none">
          {weekday}
        </span>
        <span className="text-2xl font-bold text-white leading-tight">{day}</span>
        <span className="text-xs font-semibold uppercase text-red-500 leading-none">
          {month}
        </span>
      </div>

      {/* Dumbbell icon */}
      <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-red-600">
        <svg
          xmlns="http://www.w3.org/2000/svg"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth={1.8}
          className="h-5 w-5 text-white"
        >
          <path d="M6.5 6.5h11M6.5 17.5h11" />
          <rect x="3" y="5" width="3" height="14" rx="1" />
          <rect x="18" y="5" width="3" height="14" rx="1" />
          <line x1="12" y1="6.5" x2="12" y2="17.5" />
        </svg>
      </div>

      {/* Info */}
      <div className="min-w-0 flex-1">
        <p className="truncate font-semibold text-white leading-tight">{title}</p>
        <p className="mt-0.5 text-xs text-zinc-400">
          {startTime} – {endTime}
        </p>
        <p className="text-xs text-zinc-500">{location}</p>
      </div>

      {/* Badge */}
      <div className="flex shrink-0 flex-col items-end gap-1">
        <span className="rounded bg-zinc-800 px-2 py-0.5 text-xs font-semibold text-zinc-300 tracking-wide uppercase">
          Allenamento
        </span>
        {team && (
          <span className="text-xs text-zinc-500">{team}</span>
        )}
      </div>
    </div>
  );
}