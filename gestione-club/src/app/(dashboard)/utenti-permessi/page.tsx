// src/app/(dashboard)/utenti-permessi/page.tsx

import { redirect } from "next/navigation";

import { createClient } from "@/lib/supabase-server";
import { AppCard } from "@/components/ui/AppCard";
import UtentiPermessiClient from "@/components/utenti/UtentiPermessiClient";
import { PAGINE_GESTIONALE } from "@/lib/permessi/pagine-gestionale";

export default async function UtentiPermessiPage() {
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
    .select(`
      id,
      tipo_profilo,
      last_club_id,
      last_squadra_id
    `)
    .eq("auth_user_id", user.id)
    .single();

  if (profiloError || !profilo) {
    return (
      <AppCard>
        <p className="text-sm text-red-400">Profilo non trovato.</p>
      </AppCard>
    );
  }

  if (!profilo.last_club_id) {
    return (
      <AppCard>
        <p className="text-sm text-zinc-400">
          Nessun club attivo selezionato.
        </p>
      </AppCard>
    );
  }

  const clubId = profilo.last_club_id;

  const [
    { data: utentiData, error: utentiError },
    { data: permessiPagineData, error: permessiPagineError },
    { data: tipiProfiloData, error: tipiProfiloError },
  ] = await Promise.all([
    supabase
      .from("profili")
      .select(`
        id,
        nome,
        cognome,
        email,
        tipo_profilo,
        club_id
      `)
      .contains("club_id", [clubId])
      .order("tipo_profilo")
      .order("cognome"),

    supabase
      .from("permessi_pagine_tipo_profilo")
      .select(`
        id,
        club_id,
        tipo_profilo,
        pagina_key,
        can_view
      `)
      .eq("club_id", clubId),

    supabase
      .from("tipi_profili")
      .select(`
        id,
        codice,
        nome,
        descrizione,
        protetto,
        attivo
      `)
      .order("nome"),
  ]);

  if (utentiError) {
    console.error("Errore caricamento utenti:", utentiError);
  }

  if (permessiPagineError) {
    console.error("Errore caricamento pagine visibili:", permessiPagineError);
  }

  if (tipiProfiloError) {
    console.error("Errore caricamento tipi profilo:", tipiProfiloError);
  }

  const tipiProfilo = tipiProfiloData ?? [];
  const permessiPagine = permessiPagineData ?? [];

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold text-white">
          Utenti e permessi
        </h1>

        <p className="mt-1 text-sm text-zinc-400">
          Gestisci le pagine visibili per ogni tipo profilo del club corrente.
        </p>
      </div>

      <UtentiPermessiClient
        clubId={clubId}
        currentUserId={user.id}
        currentTipoProfilo={profilo.tipo_profilo ?? ""}
        utenti={utentiData ?? []}
        permessiPagine={permessiPagine}
        pagine={PAGINE_GESTIONALE.map((pagina) => ({
          key: pagina.key,
          label: pagina.label,
        }))}
        tipiProfilo={tipiProfilo}
      />
    </div>
  );
}