import { cn } from "@/lib/utils";

interface AppCardProps {
  children: React.ReactNode;
  className?: string;
  title?: string;
  headerAction?: React.ReactNode;
  noPadding?: boolean;
}

export function AppCard({
  children,
  className,
  title,
  headerAction,
  noPadding = false,
}: AppCardProps) {
  return (
    <div
      className={cn(
        "rounded-xl border border-zinc-800 bg-zinc-900",
        className
      )}
    >
      {(title || headerAction) && (
        <div className="flex items-center justify-between px-5 pt-5 pb-4 border-b border-zinc-800">
          {title && (
            <h2 className="text-base font-semibold text-white">{title}</h2>
          )}
          {headerAction && (
            <div className="flex items-center gap-2">{headerAction}</div>
          )}
        </div>
      )}
      <div className={cn(!noPadding && "p-5")}>{children}</div>
    </div>
  );
}