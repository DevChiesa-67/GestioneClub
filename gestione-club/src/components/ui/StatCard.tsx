import { ReactNode } from "react";
import { AppCard } from "./AppCard";

type StatCardProps = {
  title: string;
  value: string | number;
  description?: string;
  icon?: ReactNode;
};

export function StatCard({ title, value, description, icon }: StatCardProps) {
  return (
    <AppCard>
      <div className="flex items-center gap-4">
        {icon && (
          <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-[#d71920]">
            {icon}
          </div>
        )}

        <div>
          <p className="text-sm uppercase tracking-wide text-zinc-400">{title}</p>
          <p className="mt-1 text-3xl font-bold text-white">{value}</p>
          {description && <p className="mt-1 text-sm text-zinc-400">{description}</p>}
        </div>
      </div>
    </AppCard>
  );
}
