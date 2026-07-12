"use client";

import { useEffect, useState } from "react";
import Image from "next/image";
import { ChevronsUpDown, X } from "lucide-react";
import { supabase } from "@/lib/supabase-client";

type Club = {
  id: string;
  nome: string;
  logo_url: string | null;
  slug: string;
};

type Profile = {
  club_id: string[] | null;
  last_club_id: string | null;
  tipo_profilo: string | null;
};

export default function ClubSwitcher() {
  const [clubs, setClubs] = useState<Club[]>([]);
  const [activeClub, setActiveClub] = useState<Club | null>(null);
  const [open, setOpen] = useState(false);
  const [isAdmin, setIsAdmin] = useState(false);

  useEffect(() => {
    loadClubs();
  }, []);

  async function loadClubs() {
    const {
      data: { user },
      error: userError,
    } = await supabase.auth.getUser();

    if (userError || !user) return;

    const { data: profile, error: profileError } = await supabase
      .from("profili")
      .select("club_id, last_club_id, tipo_profilo")
      .eq("auth_user_id", user.id)
      .single<Profile>();

    if (profileError || !profile) return;

    const admin = profile.tipo_profilo === "admin";

    setIsAdmin(admin);

    const clubIds = profile.club_id ?? [];

    let formattedClubs: Club[] = [];

    if (admin) {
      const { data: allClubs } = await supabase
        .from("club")
        .select("id,nome,logo_url,slug")
        .eq("attivo", true)
        .order("created_at", { ascending: true });

      formattedClubs = allClubs ?? [];
    } else {
      if (clubIds.length > 0) {
        const { data: userClubs } = await supabase
          .from("club")
          .select("id,nome,logo_url,slug")
          .in("id", clubIds)
          .eq("attivo", true)
          .order("created_at", { ascending: true });

        formattedClubs = userClubs ?? [];
      }
    }

    setClubs(formattedClubs);

    const selected =
      formattedClubs.find((club) => club.id === profile.last_club_id) ??
      formattedClubs[0] ??
      null;

    setActiveClub(selected);

    if (selected && profile.last_club_id !== selected.id) {
      await supabase
        .from("profili")
        .update({
          last_club_id: selected.id,
          updated_at: new Date().toISOString(),
        })
        .eq("auth_user_id", user.id);
    }
  }

  async function selectClub(club: Club) {
    if (!isAdmin) return;

    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) return;

    const { error } = await supabase
      .from("profili")
      .update({
        last_club_id: club.id,
        updated_at: new Date().toISOString(),
      })
      .eq("auth_user_id", user.id);

    if (error) {
      console.error(error);
      return;
    }

    setActiveClub(club);
    setOpen(false);
    window.location.reload();
  }

  return (
    <>
      <div className="relative border-b border-white/10 px-6 py-8">
        {isAdmin && (
          <button
            onClick={() => setOpen(true)}
            className="absolute right-4 top-4 rounded-xl bg-white/5 p-2 text-zinc-400 transition hover:bg-white/10 hover:text-white"
            title="Cambia club"
          >
            <ChevronsUpDown size={18} />
          </button>
        )}

        <div className="flex flex-col items-center">
          <div className="flex h-40 w-40 items-center justify-center">
            <Image
              src={
                activeClub?.logo_url ||
                "/images/Monferrato_logo_lion-full.png"
              }
              alt={activeClub?.nome || "Club"}
              width={180}
              height={180}
              className="h-auto w-40 object-contain"
              priority
            />
          </div>

          <h2 className="mt-3 text-center text-sm font-semibold uppercase tracking-[0.25em] text-zinc-300">
            {activeClub?.nome || "Seleziona club"}
          </h2>

          
        </div>
      </div>

      {open && isAdmin && (
        <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/70 px-6 backdrop-blur-sm">
          <div className="w-full max-w-3xl rounded-3xl border border-white/10 bg-[#171717] p-6 shadow-2xl">
            <div className="mb-6 flex items-center justify-between">
              <div>
                <h2 className="text-2xl font-black text-white">
                  Cambia club
                </h2>
                <p className="mt-1 text-sm text-zinc-400">
                  Seleziona il club che vuoi gestire.
                </p>
              </div>

              <button
                onClick={() => setOpen(false)}
                className="rounded-xl bg-white/5 p-2 text-zinc-400 hover:bg-white/10 hover:text-white"
              >
                <X size={20} />
              </button>
            </div>

            <div className="grid gap-4 md:grid-cols-2">
              {clubs.map((club) => (
                <button
                  key={club.id}
                  onClick={() => selectClub(club)}
                  className={`rounded-2xl border p-5 text-left transition ${
                    activeClub?.id === club.id
                      ? "border-[#d71920] bg-[#d71920]/10"
                      : "border-white/10 bg-black/20 hover:border-white/30"
                  }`}
                >
                  <div className="flex items-center gap-4">
                    <div className="flex h-20 w-20 items-center justify-center rounded-2xl bg-white">
                      <Image
                        src={
                          club.logo_url ||
                          "/images/Monferrato_logo_lion-full.png"
                        }
                        alt={club.nome}
                        width={72}
                        height={72}
                        className="object-contain"
                      />
                    </div>

                    <div>
                      <h3 className="text-lg font-bold text-white">
                        {club.nome}
                      </h3>
                      <p className="text-sm text-zinc-500">
                        {activeClub?.id === club.id
                          ? "Club attivo"
                          : "Clicca per gestire"}
                      </p>
                    </div>
                  </div>
                </button>
              ))}

              {clubs.length === 0 && (
                <p className="text-zinc-500">Nessun club disponibile.</p>
              )}
            </div>
          </div>
        </div>
      )}
    </>
  );
}