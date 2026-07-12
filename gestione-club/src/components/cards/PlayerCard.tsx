import { cn } from "@/lib/utils";

interface PlayerCardProps {
  name: string;
  role?: string;
  team?: string;
  avatarUrl?: string;
  /** ISO date string */
  medicalExpiry?: string;
  number?: number;
  onClick?: () => void;
  className?: string;
}

function getDaysUntil(dateStr: string): number {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const target = new Date(dateStr);
  return Math.ceil((target.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
}

function expiryBadge(days: number) {
  if (days <= 10)
    return { label: `${days} giorni`, className: "bg-red-600 text-white" };
  if (days <= 20)
    return { label: `${days} giorni`, className: "bg-orange-500 text-white" };
  return { label: `${days} giorni`, className: "bg-zinc-700 text-zinc-300" };
}

export function PlayerCard({
  name,
  role,
  team,
  avatarUrl,
  medicalExpiry,
  number,
  onClick,
  className,
}: PlayerCardProps) {
  const days = medicalExpiry ? getDaysUntil(medicalExpiry) : null;
  const badge = days !== null ? expiryBadge(days) : null;

  const initials = name
    .split(" ")
    .map((n) => n[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();

  return (
    <div
      role={onClick ? "button" : undefined}
      tabIndex={onClick ? 0 : undefined}
      onClick={onClick}
      onKeyDown={onClick ? (e) => e.key === "Enter" && onClick() : undefined}
      className={cn(
        "flex items-center gap-3 rounded-xl border border-zinc-800 bg-zinc-900 px-4 py-3 transition-colors",
        onClick && "cursor-pointer hover:border-zinc-600 hover:bg-zinc-800/60",
        className
      )}
    >
      {/* Avatar */}
      <div className="relative shrink-0">
        {avatarUrl ? (
          <img
            src={avatarUrl}
            alt={name}
            className="h-10 w-10 rounded-full object-cover"
          />
        ) : (
          <div className="flex h-10 w-10 items-center justify-center rounded-full bg-zinc-700 text-sm font-semibold text-white">
            {initials}
          </div>
        )}
        {number !== undefined && (
          <span className="absolute -bottom-1 -right-1 flex h-5 w-5 items-center justify-center rounded-full bg-red-600 text-[10px] font-bold text-white ring-2 ring-zinc-900">
            {number}
          </span>
        )}
      </div>

      {/* Info */}
      <div className="min-w-0 flex-1">
        <p className="truncate font-semibold text-white leading-tight">{name}</p>
        <p className="truncate text-xs text-zinc-400">
          {[role, team].filter(Boolean).join(" · ")}
        </p>
        {medicalExpiry && (
          <p className="text-xs text-zinc-500 mt-0.5">
            Scadenza: {new Date(medicalExpiry).toLocaleDateString("it-IT")}
          </p>
        )}
      </div>

      {/* Medical expiry badge */}
      {badge && (
        <span
          className={cn(
            "shrink-0 rounded-full px-2.5 py-0.5 text-xs font-semibold",
            badge.className
          )}
        >
          {badge.label}
        </span>
      )}
    </div>
  );
}