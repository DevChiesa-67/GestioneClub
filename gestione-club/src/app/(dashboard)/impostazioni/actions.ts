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

export async function aggiornaPreferenzaVistaLavori(
  clubId: string,
  preferenza: "card" | "tabella"
) {
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
    .select("tipo_profilo")
    .eq("auth_user_id", user.id)
    .single();

  if (profiloError) {
    return {
      success: false,
      message: profiloError.message,
    };
  }

  if (String(profilo?.tipo_profilo || "").toLowerCase() !== "admin") {
    return {
      success: false,
      message: "Non autorizzato: solo un amministratore può modificare questa impostazione.",
    };
  }

  if (!clubId) {
    return {
      success: false,
      message: "Nessun club associato al profilo.",
    };
  }

  const valore = preferenza === "tabella" ? "tabella" : "card";

  const { error } = await supabase
    .from("club")
    .update({ preferenza_vista_lavori: valore })
    .eq("id", clubId);

  if (error) {
    return {
      success: false,
      message: error.message,
    };
  }

  revalidatePath("/impostazioni");
  revalidatePath("/allenamenti");

  return {
    success: true,
    message: "Preferenza aggiornata correttamente.",
  };
}