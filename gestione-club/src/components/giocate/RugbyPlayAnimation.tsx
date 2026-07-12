"use client";

import RamboAnimation from "./animazioni/RamboAnimation";

type Props = {
  animationKey?: string | null;
  coloreClub?: string;
};

export default function RugbyPlayAnimation({
  animationKey,
  coloreClub = "#E3A71E",
}: Props) {
  if (!animationKey) {
    return <EmptyAnimation coloreClub={coloreClub} />;
  }

  switch (animationKey.toLowerCase()) {
    case "rambo":
      return <RamboAnimation coloreClub={coloreClub} />;

    default:
      return <EmptyAnimation coloreClub={coloreClub} />;
  }
}

function EmptyAnimation({ coloreClub }: { coloreClub: string }) {
  return (
    <div className="flex aspect-[16/10] w-full items-center justify-center rounded-3xl border border-dashed border-zinc-800 bg-zinc-950 p-6 text-center">
      <div>
        <div
          className="mx-auto mb-3 h-3 w-3 rounded-full"
          style={{ backgroundColor: coloreClub }}
        />

        <p className="text-sm font-medium text-zinc-300">
          Animazione non disponibile
        </p>

        <p className="mt-1 text-xs text-zinc-500">
          Verrà aggiunta per questa giocata.
        </p>
      </div>
    </div>
  );
}