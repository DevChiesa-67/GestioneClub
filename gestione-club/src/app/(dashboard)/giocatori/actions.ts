"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase-server";
import { supabaseAdmin } from "@/lib/supabase-admin";

export async function impostaAccademiaGiocatore(
  giocatoreId: string,
  accademia: boolean
) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new Error("Utente non autenticato.");

  const { data: profilo } = await supabase
    .from("profili")
    .select("tipo_profilo,last_club_id")
    .eq("auth_user_id", user.id)
    .single();

  if (
    String(profilo?.tipo_profilo ?? "").toLowerCase() !== "admin" ||
    !profilo?.last_club_id
  ) {
    throw new Error("Non hai i permessi per modificare il giocatore.");
  }

  const { error } = await supabaseAdmin
    .from("giocatori")
    .update({ accademia, updated_at: new Date().toISOString() })
    .eq("id", giocatoreId)
    .eq("club_id", profilo.last_club_id);

  if (error) throw new Error(error.message);
  revalidatePath("/giocatori");
  revalidatePath(`/giocatori/${giocatoreId}`);
}
