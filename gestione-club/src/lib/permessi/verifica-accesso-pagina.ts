// src/lib/permessi/verifica-accesso-pagina.ts

import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase-server";
import {
  getContestoUtente,
  type ContestoUtente,
} from "@/lib/auth/get-contesto-utente";

export async function verificaAccessoPagina(
  paginaKey: string
): Promise<ContestoUtente> {
  const contesto = await getContestoUtente();

  if (contesto.isAdmin) {
    return contesto;
  }

  const supabase = await createClient();

  const { data: permesso, error } = await supabase
    .from("permessi_pagine_tipo_profilo")
    .select("can_view")
    .eq("club_id", contesto.clubId)
    .eq("tipo_profilo", contesto.tipoProfilo)
    .eq("pagina_key", paginaKey)
    .maybeSingle();

  if (error) {
    console.error("Errore verifica accesso pagina:", error);
    redirect("/accesso-negato");
  }

  if (!permesso?.can_view) {
    redirect("/accesso-negato");
  }

  return contesto;
}