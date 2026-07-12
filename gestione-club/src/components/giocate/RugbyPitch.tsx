"use client";

import type { ReactNode } from "react";

type Props = {
  children?: ReactNode;
  className?: string;
};

export default function RugbyPitch({ children, className = "" }: Props) {
  return (
    <div
      className={`relative aspect-[16/10] w-full overflow-hidden rounded-3xl border border-zinc-800 bg-emerald-950 ${className}`}
    >
      <svg
        viewBox="0 0 100 62"
        className="absolute inset-0 h-full w-full"
        preserveAspectRatio="none"
      >
        <rect x="0" y="0" width="100" height="62" fill="#143625" />

        <line x1="50" y1="0" x2="50" y2="62" stroke="rgba(255,255,255,.28)" />
        <line x1="22" y1="0" x2="22" y2="62" stroke="rgba(255,255,255,.18)" />
        <line x1="78" y1="0" x2="78" y2="62" stroke="rgba(255,255,255,.18)" />

        <line x1="5" y1="0" x2="5" y2="62" stroke="rgba(255,255,255,.35)" />
        <line x1="95" y1="0" x2="95" y2="62" stroke="rgba(255,255,255,.35)" />

        <text x="8" y="7" fill="rgba(255,255,255,.45)" fontSize="3">
          NOSTRA META
        </text>
        <text x="78" y="7" fill="rgba(255,255,255,.45)" fontSize="3">
          META AVVERSARIA
        </text>
      </svg>

      <div className="absolute inset-0">{children}</div>
    </div>
  );
}