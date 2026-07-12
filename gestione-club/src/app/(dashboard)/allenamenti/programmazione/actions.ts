// src/app/(dashboard)/allenamenti/programmazione/actions.ts

"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase-server";

type CreaSedutaFaseInput = {
  settimana_index: number;
  data_seduta?: string | null;
  tipo_sessione?: string | null;
  tema?: string | null;
  volume_min?: number | null;
  rpe?: number | null;
  note?: string | null;
};

type CreaFaseInput = {
  programmazione_id: string;
  nome: string;
  colore?: string | null;
  data_inizio: string;
  data_fine: string;
  obiettivo?: string | null;
  sedute?: CreaSedutaFaseInput[];
};

type CreaSedutaInput = {
  settimana_id: string;
  data_seduta?: string | null;
  tipo_sessione?: string | null;
  tema?: string | null;
  volume_min?: number | null;
  rpe?: number | null;
  note?: string | null;
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

  if (error || !profilo?.last_club_id) {
    throw new Error("Club attivo non trovato.");
  }

  return {
    supabase,
    user,
    profilo,
    clubId: profilo.last_club_id,
    squadraId: profilo.last_squadra_id,
    isAdmin: String(profilo.tipo_profilo ?? "").toLowerCase() === "admin",
  };
}

function addDays(date: Date, days: number) {
  const next = new Date(date);
  next.setDate(next.getDate() + days);
  return next;
}

function toDateString(date: Date) {
  return date.toISOString().slice(0, 10);
}

function generaSettimane(dataInizio: string, dataFine: string) {
  const start = new Date(`${dataInizio}T00:00:00`);
  const end = new Date(`${dataFine}T00:00:00`);

  const settimane: {
    numero_settimana: number;
    data_inizio: string;
    data_fine: string;
  }[] = [];

  let currentStart = start;
  let numero = 1;

  while (currentStart <= end) {
    const currentEnd = addDays(currentStart, 6);
    const safeEnd = currentEnd > end ? end : currentEnd;

    settimane.push({
      numero_settimana: numero,
      data_inizio: toDateString(currentStart),
      data_fine: toDateString(safeEnd),
    });

    currentStart = addDays(currentEnd, 1);
    numero += 1;
  }

  return settimane;
}

export async function creaProgrammazione(formData: FormData) {
  const { supabase, clubId, squadraId, user, isAdmin } =
    await getProfiloCorrente();

  if (!isAdmin) {
    return {
      success: false,
      message: "Non hai i permessi per creare una programmazione.",
    };
  }

  const titolo = String(formData.get("titolo") ?? "").trim();
  const stagione = String(formData.get("stagione") ?? "").trim() || null;
  const dataInizio = String(formData.get("data_inizio") ?? "");
  const dataFine = String(formData.get("data_fine") ?? "");
  const descrizione =
    String(formData.get("descrizione") ?? "").trim() || null;

  if (!titolo) {
    return {
      success: false,
      message: "Inserisci il titolo della programmazione.",
    };
  }

  if (!dataInizio || !dataFine) {
    return {
      success: false,
      message: "Inserisci data inizio e data fine.",
    };
  }

  if (dataFine < dataInizio) {
    return {
      success: false,
      message: "La data fine non può essere precedente alla data inizio.",
    };
  }

  const { error } = await supabase.from("programmazioni").insert({
    club_id: clubId,
    squadra_id: squadraId,
    titolo,
    stagione,
    data_inizio: dataInizio,
    data_fine: dataFine,
    descrizione,
    created_by: user.id,
  });

  if (error) {
    return {
      success: false,
      message: error.message,
    };
  }

  revalidatePath("/allenamenti/programmazione");

  return {
    success: true,
    message: "Programmazione creata correttamente.",
  };
}

export async function creaFaseConSettimane(input: CreaFaseInput) {
  const { supabase, clubId, squadraId, isAdmin } = await getProfiloCorrente();

  if (!isAdmin) {
    return {
      success: false,
      message: "Non hai i permessi per creare una fase.",
    };
  }

  if (!input.programmazione_id) {
    return {
      success: false,
      message: "Programmazione non valida.",
    };
  }

  if (!input.nome.trim()) {
    return {
      success: false,
      message: "Inserisci il nome della fase.",
    };
  }

  if (!input.data_inizio || !input.data_fine) {
    return {
      success: false,
      message: "Inserisci data inizio e data fine.",
    };
  }

  if (input.data_fine < input.data_inizio) {
    return {
      success: false,
      message: "La data fine non può essere precedente alla data inizio.",
    };
  }

  const { data: programmazione, error: programmazioneError } = await supabase
    .from("programmazioni")
    .select("id")
    .eq("id", input.programmazione_id)
    .eq("club_id", clubId)
    .maybeSingle();

  if (programmazioneError || !programmazione) {
    return {
      success: false,
      message: "Programmazione non trovata per il club attivo.",
    };
  }

  const { count } = await supabase
    .from("programmazione_fasi")
    .select("id", { count: "exact", head: true })
    .eq("programmazione_id", input.programmazione_id)
    .eq("club_id", clubId);

  const ordine = (count ?? 0) + 1;

  const { data: fase, error: faseError } = await supabase
    .from("programmazione_fasi")
    .insert({
      club_id: clubId,
      squadra_id: squadraId,
      programmazione_id: input.programmazione_id,
      nome: input.nome.trim(),
      colore: input.colore || null,
      data_inizio: input.data_inizio,
      data_fine: input.data_fine,
      obiettivo: input.obiettivo || null,
      ordine,
    })
    .select("id")
    .single();

  if (faseError || !fase) {
    return {
      success: false,
      message: faseError?.message ?? "Errore durante la creazione della fase.",
    };
  }

  const settimane = generaSettimane(input.data_inizio, input.data_fine);

  const { data: settimaneCreate, error: settimaneError } = await supabase
  .from("programmazione_settimane")
  .insert(
    settimane.map((settimana) => ({
      club_id: clubId,
      squadra_id: squadraId,
      fase_id: fase.id,
      ...settimana,
    }))
  )
  .select("id,numero_settimana,data_inizio,data_fine");

if (settimaneError || !settimaneCreate) {
  return {
    success: false,
    message:
      settimaneError?.message ??
      "Fase creata, ma errore nella generazione settimane.",
  };
}

const settimaneOrdinate = [...settimaneCreate].sort(
  (a, b) => a.numero_settimana - b.numero_settimana
);

const seduteDaInserire = (input.sedute ?? [])
  .map((seduta) => {
    const settimana = settimaneOrdinate[seduta.settimana_index];

    if (!settimana) return null;

    const volume = Number(seduta.volume_min ?? 0);
    const rpe = Number(seduta.rpe ?? 0);

    return {
      club_id: clubId,
      squadra_id: squadraId,
      settimana_id: settimana.id,
      fase_id: fase.id,
      data_seduta: seduta.data_seduta || null,
      tipo_sessione: seduta.tipo_sessione?.trim() || null,
      tema: seduta.tema?.trim() || null,
      volume_min: volume > 0 ? volume : null,
      rpe: rpe > 0 ? rpe : null,
      note: seduta.note?.trim() || null,
    };
  })
  .filter(
    (seduta): seduta is NonNullable<typeof seduta> => seduta !== null
  );

if (seduteDaInserire.length > 0) {
  const { error: seduteError } = await supabase
    .from("programmazione_sedute")
    .insert(seduteDaInserire);

  if (seduteError) {
    return {
      success: false,
      message:
        seduteError.message ??
        "Fase e settimane create, ma errore nel salvataggio sedute.",
    };
  }
}

revalidatePath("/allenamenti/programmazione");

return {
  success: true,
  message: "Fase, settimane e sedute create correttamente.",
};
}

export async function creaSedutaSettimana(input: CreaSedutaInput) {
  const { supabase, clubId, squadraId, isAdmin } = await getProfiloCorrente();

  if (!isAdmin) {
    return {
      success: false,
      message: "Non hai i permessi per aggiungere una seduta.",
    };
  }

  if (!input.settimana_id) {
    return {
      success: false,
      message: "Settimana non valida.",
    };
  }

  const { data: settimana, error: settimanaError } = await supabase
    .from("programmazione_settimane")
    .select("id,data_inizio,data_fine")
    .eq("id", input.settimana_id)
    .eq("club_id", clubId)
    .maybeSingle();

  if (settimanaError || !settimana) {
    return {
      success: false,
      message: "Settimana non trovata per il club attivo.",
    };
  }

  if (
    input.data_seduta &&
    (input.data_seduta < settimana.data_inizio ||
      input.data_seduta > settimana.data_fine)
  ) {
    return {
      success: false,
      message: "La data seduta deve rientrare nella settimana selezionata.",
    };
  }

  const volume = Number(input.volume_min ?? 0);
  const rpe = Number(input.rpe ?? 0);
  const carico = volume && rpe ? volume * rpe : null;

  const { error } = await supabase.from("programmazione_sedute").insert({
    club_id: clubId,
    squadra_id: squadraId,
    settimana_id: input.settimana_id,
    data_seduta: input.data_seduta || null,
    tipo_sessione: input.tipo_sessione || null,
    tema: input.tema || null,
    volume_min: volume || null,
    rpe: rpe || null,
    carico,
    note: input.note || null,
  });

  if (error) {
    return {
      success: false,
      message: error.message,
    };
  }

  revalidatePath("/allenamenti/programmazione");

  return {
    success: true,
    message: "Seduta aggiunta correttamente.",
  };
}