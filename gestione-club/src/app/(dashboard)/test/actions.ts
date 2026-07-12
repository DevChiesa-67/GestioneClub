"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase-server";

type CreaTipoTestInput = {
  nome: string;
  tipo_test: "atletica" | "forza";
  unita_misura: "secondi" | "kg" | "ripetizioni" | "metri" | "cm";
};

type MisurazioneInput = {
  giocatore_id: string;
  valore: number | null;
  obiettivo: number | null;
  note?: string | null;
};

type SalvaMisurazioniInput = {
  data_test: string;
  test_id: string;
  misurazioni: MisurazioneInput[];
};

async function getProfiloCorrente() {
  const supabase = await createClient();

  const {
    data: { user },
    error: userError,
  } = await supabase.auth.getUser();

  if (userError || !user) {
    throw new Error("Utente non autenticato.");
  }

  const { data: profilo, error } = await supabase
    .from("profili")
    .select("id,tipo_profilo,last_club_id,last_squadra_id")
    .eq("auth_user_id", user.id)
    .single();

  if (error || !profilo?.last_club_id || !profilo?.last_squadra_id) {
    throw new Error("Club o squadra non selezionati.");
  }

  return { supabase, user, profilo };
}

function assertAdmin(tipoProfilo: unknown) {
  if (String(tipoProfilo || "").toLowerCase() !== "admin") {
    throw new Error("Non hai i permessi per modificare i dati dei test.");
  }
}

export async function creaTipoTest(input: CreaTipoTestInput) {
  const { supabase, profilo } = await getProfiloCorrente();

  assertAdmin(profilo.tipo_profilo);

  const nome = input.nome.trim();

  if (!nome) {
    throw new Error("Nome test obbligatorio.");
  }

  const { error } = await supabase.from("test_atletici_forza").insert({
    nome,
    tipo_test: input.tipo_test,
    unita_misura: input.unita_misura,
  });

  if (error) {
    throw new Error(error.message);
  }

  revalidatePath("/test");
}

export async function caricaGiocatoriPresenti(dataTest: string) {
  const { supabase, profilo } = await getProfiloCorrente();

  const { data: allenamenti, error: allenamentiError } = await supabase
    .from("allenamenti")
    .select("id")
    .eq("club_id", profilo.last_club_id)
    .eq("squadra_id", profilo.last_squadra_id)
    .eq("data_allenamento", dataTest);

  if (allenamentiError) {
    throw new Error(allenamentiError.message);
  }

  const allenamentoIds = (allenamenti ?? []).map((a) => a.id);

  if (allenamentoIds.length === 0) {
    return [];
  }

  const { data, error } = await supabase
    .from("presenze_allenamenti")
    .select(`
      id,
      stato,
      giocatore_id,
      giocatori (
        id,
        nome,
        cognome,
        foto_url
      )
    `)
    .eq("club_id", profilo.last_club_id)
    .eq("squadra_id", profilo.last_squadra_id)
    .in("allenamento_id", allenamentoIds)
    .in("stato", ["presente_entrambe", "presente_mattina", "presente_pomeriggio"])
    .order("giocatore_id", { ascending: true });

  if (error) {
    throw new Error(error.message);
  }

  const unique = new Map<string, unknown>();

  for (const presenza of data ?? []) {
    const giocatore = Array.isArray(presenza.giocatori)
      ? presenza.giocatori[0]
      : presenza.giocatori;

    if (giocatore?.id) {
      unique.set(giocatore.id, giocatore);
    }
  }

  return Array.from(unique.values());
}

export async function salvaMisurazioniTest(input: SalvaMisurazioniInput) {
  const { supabase, user, profilo } = await getProfiloCorrente();

  assertAdmin(profilo.tipo_profilo);

  const rows = input.misurazioni
    .filter((m) => m.valore !== null && !Number.isNaN(m.valore))
    .map((m) => ({
      club_id: profilo.last_club_id,
      squadra_id: profilo.last_squadra_id,
      giocatore_id: m.giocatore_id,
      test_id: input.test_id,
      data_test: input.data_test,
      valore: m.valore,
      obiettivo: m.obiettivo,
      note: m.note ?? null,
      registrato_da: user.id,
    }));

  if (rows.length === 0) {
    throw new Error("Inserisci almeno una misurazione.");
  }

  const { error } = await supabase.from("test_misurazioni").insert(rows);

  if (error) {
    throw new Error(error.message);
  }

  revalidatePath("/test");
}