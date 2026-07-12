"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase-server";

type SalvaReportInput = {
  nome: string;
  descrizione?: string | null;
  sezione_performance: "presenze" | "performance" | "test";
  tipo_visualizzazione: "bar" | "line" | "pie" | "table" | "kpi";
  configurazione: Record<string, unknown>;
};

export async function salvaReportPersonalizzato(input: SalvaReportInput) {
  const supabase = await createClient();

  const {
    data: { user },
    error: userError,
  } = await supabase.auth.getUser();

  if (userError || !user) {
    return {
      success: false,
      message: "Utente non autenticato.",
    };
  }

  const { data: profilo, error: profiloError } = await supabase
    .from("profili")
    .select("id, last_club_id, club_id")
    .eq("auth_user_id", user.id)
    .single();

  if (profiloError || !profilo) {
    return {
      success: false,
      message: "Profilo non trovato.",
    };
  }

  const clubId = profilo.last_club_id ?? profilo.club_id;

  if (!clubId) {
    return {
      success: false,
      message: "Nessun club selezionato.",
    };
  }

  const { error } = await supabase.from("report_personalizzati").insert({
    club_id: clubId,
    created_by: profilo.id,
    nome: input.nome,
    descrizione: input.descrizione ?? null,
    sezione_performance: input.sezione_performance,
    tipo_visualizzazione: input.tipo_visualizzazione,
    configurazione: input.configurazione,
  });

  if (error) {
    return {
      success: false,
      message: error.message,
    };
  }

  revalidatePath("/reportistica");
  revalidatePath("/performance");

  return {
    success: true,
    message: "Report salvato correttamente.",
  };
}