import Link from "next/link";
import { Megaphone } from "lucide-react";
import { getRecentCommunications } from "@/lib/services/dashboard.service";

export default async function DashboardCommunications() {
  const communications = await getRecentCommunications();

  return (
    <div className="rounded-2xl border border-white/10 bg-[#171717] p-4 sm:p-6">
      <h2 className="mb-5 text-lg font-bold text-white sm:text-xl">
        Comunicazioni recenti
      </h2>

      <div className="space-y-5">
        {communications.length === 0 && (
          <p className="text-sm text-zinc-500">
            Nessuna comunicazione recente.
          </p>
        )}

        {communications.map((item) => (
          <Link
            key={item.id}
            href={`/comunicazioni/${item.id}`}
            className="-m-2 flex gap-4 rounded-xl p-2 transition-colors hover:bg-white/5"
          >
            <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-[#d71920] text-white">
              <Megaphone size={22} />
            </div>

            <div className="min-w-0">
              <p className="truncate font-bold text-white">{item.titolo}</p>

              <p className="line-clamp-2 text-sm text-zinc-400">
                {item.descrizione}
              </p>

              <p className="mt-1 text-sm text-zinc-500">
                {new Date(item.created_at).toLocaleDateString("it-IT")}
              </p>
            </div>
          </Link>
        ))}
      </div>
    </div>
  );
}