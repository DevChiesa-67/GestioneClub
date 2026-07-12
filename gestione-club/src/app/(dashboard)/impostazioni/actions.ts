"use server";

import { createClient } from "@/lib/supabase-server";
import { revalidatePath } from "next/cache";

type Input = {
  nome: string;
  cognome: string;
};

export async function aggiornaProfiloPersonale(input: Input) {
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

  const { error } = await supabase
    .from("profili")
    .update({
      nome: input.nome.trim(),
      cognome: input.cognome.trim(),
    })
    .eq("auth_user_id", user.id);

  if (error) {
    return {
      success: false,
      message: error.message,
    };
  }

  revalidatePath("/impostazioni");

  return {
    success: true,
    message: "Profilo aggiornato correttamente.",
  };
}