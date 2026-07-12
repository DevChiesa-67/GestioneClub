"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase-client";

type UserProfile = {
  nome: string | null;
  cognome: string | null;
};

export default function UserProfile() {
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [role, setRole] = useState<string>("");

  useEffect(() => {
    async function loadProfile() {
      const {
        data: { user },
      } = await supabase.auth.getUser();

      if (!user) return;

      const { data: profilo } = await supabase
        .from("profili")
        .select("nome,cognome")
        .eq("auth_user_id", user.id)
        .maybeSingle();

      const { data: clubRole } = await supabase
        .from("utenti_club")
        .select("ruolo")
        .eq("user_id", user.id)
        .eq("attivo", true)
        .maybeSingle();

      setProfile(profilo);
      setRole(clubRole?.ruolo ?? "utente");
    }

    loadProfile();
  }, []);

  const initials =
    profile?.nome && profile?.cognome
      ? `${profile.nome[0]}${profile.cognome[0]}`
      : "?";

  return (
    <div className="flex items-center gap-3 rounded-2xl bg-[#171717] p-3">
      <div className="flex h-12 w-12 items-center justify-center rounded-full bg-[#d71920] font-bold text-white">
        {initials}
      </div>

      <div className="flex-1">
        <p className="font-semibold text-white">
          {profile
            ? `${profile.nome ?? ""} ${profile.cognome ?? ""}`
            : "Profilo"}
        </p>

        <p className="text-sm capitalize text-zinc-500">{role}</p>
      </div>
    </div>
  );
}