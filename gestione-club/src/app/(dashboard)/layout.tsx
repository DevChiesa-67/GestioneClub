import type { Metadata } from "next";

import { AppShell } from "@/components/layout/AppShell";
import { createClient } from "@/lib/supabase-server";

// Favicon dinamica: mostra il logo del club attivo (profili.last_club_id)
// al posto dell'icona di default, così le tab del browser si distinguono
// subito quando si gestiscono più club. Se l'utente non è autenticato o
// il club non ha un logo caricato, resta l'icona di default del sito
// (definita in src/app/layout.tsx).
export async function generateMetadata(): Promise<Metadata> {
  try {
    const supabase = await createClient();

    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) return {};

    const { data: profilo } = await supabase
      .from("profili")
      .select("last_club_id")
      .eq("auth_user_id", user.id)
      .single();

    if (!profilo?.last_club_id) return {};

    const { data: club } = await supabase
      .from("club")
      .select("logo_url")
      .eq("id", profilo.last_club_id)
      .single();

    if (!club?.logo_url) return {};

    return {
      icons: {
        icon: club.logo_url,
        shortcut: club.logo_url,
        apple: club.logo_url,
      },
    };
  } catch (error) {
    console.error("Errore generazione favicon dinamica:", error);
    return {};
  }
}

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <AppShell>{children}</AppShell>;
}
