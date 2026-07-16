// src/app/(dashboard)/allenamenti/[id]/modifica/page.tsx

import { redirect } from "next/navigation";

import { createClient } from "@/lib/supabase-server";
import ModificaAllenamentoClient from "@/components/allenamenti/ModificaAllenamentoClient";

export default async function ModificaAllenamentoPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;

  const supabase = await createClient();

  const {
    data: { user },
    error: userError,
  } = await supabase.auth.getUser();

  if (userError || !user) {
    redirect("/login");
  }

  const { data: profilo, error: profiloError } = await supabase
    .from("profili")
    .select("id, tipo_profilo, last_club_id")
    .eq("auth_user_id", user.id)
    .single();

  if (profiloError || !profilo?.last_club_id) {
    return (
      <div className="p-4 sm:p-6">
        <div className="rounded-2xl border border-red-500/20 bg-red-500/10 p-4 text-sm text-red-300">
          Profilo non trovato o nessun club attivo selezionato.
        </div>
      </div>
    );
  }

  const isAdmin = String(profilo.tipo_profilo || "").toLowerCase() === "admin";

  if (!isAdmin) {
    return (
      <div className="p-4 sm:p-6">
        <div className="rounded-2xl border border-zinc-800 bg-zinc-950 p-4 text-sm text-zinc-400">
          Non hai i permessi per modificare gli allenamenti.
        </div>
      </div>
    );
  }

  const { data: club } = await supabase
    .from("club")
    .select("id, colore_flag")
    .eq("id", profilo.last_club_id)
    .single();

  const { data: allenamento, error: allenamentoError } = await supabase
    .from("allenamenti")
    .select("*")
    .eq("id", id)
    .eq("club_id", profilo.last_club_id)
    .maybeSingle();

  if (allenamentoError || !allenamento) {
    return (
      <div className="p-4 sm:p-6">
        <div className="rounded-2xl border border-red-500/20 bg-red-500/10 p-4 text-sm text-red-300">
          Allenamento non trovato.
        </div>
      </div>
    );
  }

  const { data: lavori, error: lavoriError } = await supabase
    .from("lavori_allenamento")
    .select(
      "id, allenamento_id, sezione, descrizione, obbiettivo, tempo_lavoro, ripetizione, tempo_recupero, tempo_totale, ordine"
    )
    .eq("allenamento_id", id)
    .order("ordine", { ascending: true });

  if (lavoriError) {
    console.error("Errore caricamento lavori allenamento:", lavoriError);
  }

  return (
    <ModificaAllenamentoClient
      themeColor={club?.colore_flag || "#d71920"}
      allenamento={allenamento}
      lavoriIniziali={lavori ?? []}
    />
  );
}
