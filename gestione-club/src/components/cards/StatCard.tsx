import { cn } from "@/lib/utils";
import { LucideIcon } from "lucide-react";

interface StatCardProps {
  label: string;
  value: string | number;
  subtext?: string;
  icon: LucideIcon;
  iconColor?: "red" | "zinc";
  className?: string;
}

export function StatCard({
  label,
  value,
  subtext,
  icon: Icon,
  iconColor = "red",
  className,
}: StatCardProps) {
  return (
    <div
      className={cn(
        "flex items-center gap-4 rounded-xl border border-zinc-800 bg-zinc-900 px-5 py-4",
        className
      )}
    >
      <div
        className={cn(
          "flex h-12 w-12 shrink-0 items-center justify-center rounded-full",
          iconColor === "red"
            ? "bg-red-600 text-white"
            : "bg-zinc-800 text-zinc-300"
        )}
      >
        <Icon size={22} />
      </div>

      <div className="min-w-0">
        <p className="text-xs font-medium uppercase tracking-widest text-zinc-400">
          {label}
        </p>
        <p className="text-2xl font-bold text-white leading-tight">{value}</p>
        {subtext && (
          <p className="mt-0.5 text-xs text-red-500 font-medium">{subtext}</p>
        )}
      </div>
    </div>
  );
}