// src/app/(dashboard)/allenamenti/programmazione/actions.ts

"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase-server";

export type Intensita =
  | "bassa"
  | "medio-bassa"
  | "media"
  | "medio-alta"
  | "alta";

const INTENSITA_RPE: Record<Intensita, number> = {
  bassa: 2,
  "medio-bassa": 4,
  media: 6,
  "medio-alta": 8,
  alta: 10,
};

function intensitaToRpe(intensita?: Intensita | null): number | null {
  if (!intensita) return null;
  return INTENSITA_RPE[intensita] ?? null;
}

// Il "RPE target/seduta" della settimana è testo libero (non più un numero
// singolo) per permettere sia un valore secco ("5") sia un intervallo
// ("5-6"), coerente con come i preparatori lo esprimono nella pratica.
// Qui validiamo comunque il formato per evitare dati sporchi in tabella.
type RisultatoRpeTarget =
  | { ok: true; valore: string | null }
  | { ok: false; errore: string };

function normalizzaRpeTarget(value?: string | null): RisultatoRpeTarget {
  const grezzo = value?.trim();

  if (!grezzo) {
    return { ok: true, valore: null };
  }

  const match = grezzo.match(/^(10|[0-9])(?:\s*-\s*(10|[0-9]))?$/);

  if (!match) {
    return {
      ok: false,
      errore:
        'RPE target non valido: usa un numero da 0 a 10 (es. "5") o un intervallo (es. "5-6").',
    };
  }

  const [, daStr, aStr] = match;

  if (aStr !== undefined && Number(daStr) > Number(aStr)) {
    return {
      ok: false,
      errore:
        "Nell'intervallo RPE il primo numero deve essere minore o uguale al secondo (es. \"5-6\").",
    };
  }

  return { ok: true, valore: aStr !== undefined ? `${daStr}-${aStr}` : daStr };
}

type DettagliSettimanaInput = {
  settimana_index: number;
  data_seduta?: string | null;
  focus_tecnico?: string | null;
  intensita?: Intensita | null;
  rpe_target?: string | null;
  focus_avanti?: string | null;
  focus_trequarti?: string | null;
};

type CreaFaseInput = {
  programmazione_id: string;
  nome: string;
  colore?: string | null;
  data_inizio: string;
  data_fine: string;
  obiettivo?: string | null;
  settimane_dettagli?: DettagliSettimanaInput[];
};

type ModificaDettagliSettimanaInput = {
  settimana_id: string;
  data_seduta?: string | null;
  focus_tecnico?: string | null;
  intensita?: Intensita | null;
  rpe_target?: string | null;
  focus_avanti?: string | null;
  focus_trequarti?: string | null;
};

type CreaSedutaInput = {
  settimana_id: string;
  data_seduta?: string | null;
  tipo_sessione?: string | null;
  tema?: string | null;
  volume_min?: number | null;
  durata_min?: number | null;
  intensita?: Intensita | null;
  note?: string | null;
};

type ModificaProgrammazioneInput = {
  programmazione_id: string;
  titolo: string;
  stagione?: string | null;
  data_inizio: string;
  data_fine: string;
  descrizione?: string | null;
};

type ModificaFaseInput = {
  fase_id: string;
  nome: string;
  colore?: string | null;
  obiettivo?: string | null;
};

type ModificaSedutaInput = {
  seduta_id: string;
  data_seduta?: string | null;
  tipo_sessione?: string | null;
  tema?: string | null;
  volume_min?: number | null;
  durata_min?: number | null;
  intensita?: Intensita | null;
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
      message: "Non hai i permessi per creare un mesociclo.",
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
      message: "Inserisci il nome del mesociclo.",
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

  // Validiamo il RPE target di tutte le settimane prima di scrivere
  // qualsiasi cosa a DB, così un valore malformato non lascia un mesociclo
  // creato a metà (fase salvata ma senza le sue settimane).
  const rpeTargetValidati = new Map<number, string | null>();

  for (const dettaglio of input.settimane_dettagli ?? []) {
    const risultato = normalizzaRpeTarget(dettaglio.rpe_target);

    if (!risultato.ok) {
      return {
        success: false,
        message: `Settimana ${dettaglio.settimana_index + 1}: ${risultato.errore}`,
      };
    }

    rpeTargetValidati.set(dettaglio.settimana_index, risultato.valore);
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
      message: faseError?.message ?? "Errore durante la creazione del mesociclo.",
    };
  }

  const settimane = generaSettimane(input.data_inizio, input.data_fine);

  const dettagliPerIndice = new Map(
    (input.settimane_dettagli ?? []).map((dettaglio) => [
      dettaglio.settimana_index,
      dettaglio,
    ])
  );

  const { data: settimaneCreate, error: settimaneError } = await supabase
    .from("programmazione_settimane")
    .insert(
      settimane.map((settimana, index) => {
        const dettaglio = dettagliPerIndice.get(index);

        return {
          club_id: clubId,
          squadra_id: squadraId,
          fase_id: fase.id,
          ...settimana,
          data_seduta: dettaglio?.data_seduta || null,
          focus_tecnico: dettaglio?.focus_tecnico?.trim() || null,
          intensita: dettaglio?.intensita || null,
          rpe_target: rpeTargetValidati.get(index) ?? null,
          focus_avanti: dettaglio?.focus_avanti?.trim() || null,
          focus_trequarti: dettaglio?.focus_trequarti?.trim() || null,
        };
      })
    )
    .select("id,numero_settimana,data_inizio,data_fine");

  if (settimaneError || !settimaneCreate) {
    return {
      success: false,
      message:
        settimaneError?.message ??
        "Mesociclo creato, ma errore nella generazione settimane.",
    };
  }

  revalidatePath("/allenamenti/programmazione");

  return {
    success: true,
    message: "Mesociclo e settimane create correttamente.",
  };
}

export async function modificaDettagliSettimana(
  input: ModificaDettagliSettimanaInput
) {
  const { supabase, clubId, isAdmin } = await getProfiloCorrente();

  if (!isAdmin) {
    return {
      success: false,
      message: "Non hai i permessi per modificare la settimana.",
    };
  }

  const { data: settimana, error: settimanaError } = await supabase
    .from("programmazione_settimane")
    .select("id,data_inizio,data_fine")
    .eq("id", input.settimana_id)
    .eq("club_id", clubId)
    .maybeSingle();

  if (settimanaError || !settimana) {
    return { success: false, message: "Settimana non trovata." };
  }

  if (
    input.data_seduta &&
    (input.data_seduta < settimana.data_inizio ||
      input.data_seduta > settimana.data_fine)
  ) {
    return {
      success: false,
      message: "La data deve rientrare nella settimana selezionata.",
    };
  }

  const rpeTarget = normalizzaRpeTarget(input.rpe_target);

  if (!rpeTarget.ok) {
    return { success: false, message: rpeTarget.errore };
  }

  const { error } = await supabase
    .from("programmazione_settimane")
    .update({
      data_seduta: input.data_seduta || null,
      focus_tecnico: input.focus_tecnico?.trim() || null,
      intensita: input.intensita || null,
      rpe_target: rpeTarget.valore,
      focus_avanti: input.focus_avanti?.trim() || null,
      focus_trequarti: input.focus_trequarti?.trim() || null,
    })
    .eq("id", input.settimana_id)
    .eq("club_id", clubId);

  if (error) {
    return {
      success: false,
      message: error.message,
    };
  }

  revalidatePath("/allenamenti/programmazione");

  return {
    success: true,
    message: "Settimana aggiornata correttamente.",
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
  const durata = Number(input.durata_min ?? 0);
  const rpe = intensitaToRpe(input.intensita);
  const carico = volume && rpe ? volume * rpe : null;

  const { error } = await supabase.from("programmazione_sedute").insert({
    club_id: clubId,
    squadra_id: squadraId,
    settimana_id: input.settimana_id,
    data_seduta: input.data_seduta || null,
    tipo_sessione: input.tipo_sessione || null,
    tema: input.tema || null,
    volume_min: volume || null,
    durata_min: durata || null,
    intensita: input.intensita || null,
    rpe,
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

export async function modificaProgrammazione(input: ModificaProgrammazioneInput) {
  const { supabase, clubId, isAdmin } = await getProfiloCorrente();

  if (!isAdmin) {
    return {
      success: false,
      message: "Non hai i permessi per modificare la programmazione.",
    };
  }

  const titolo = input.titolo.trim();

  if (!titolo) {
    return {
      success: false,
      message: "Inserisci il titolo della programmazione.",
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

  const { error } = await supabase
    .from("programmazioni")
    .update({
      titolo,
      stagione: input.stagione?.trim() || null,
      data_inizio: input.data_inizio,
      data_fine: input.data_fine,
      descrizione: input.descrizione?.trim() || null,
    })
    .eq("id", input.programmazione_id)
    .eq("club_id", clubId);

  if (error) {
    return {
      success: false,
      message: error.message,
    };
  }

  revalidatePath("/allenamenti/programmazione");

  return {
    success: true,
    message: "Programmazione aggiornata correttamente.",
  };
}

export async function eliminaProgrammazione(programmazioneId: string) {
  const { supabase, clubId, isAdmin } = await getProfiloCorrente();

  if (!isAdmin) {
    return {
      success: false,
      message: "Non hai i permessi per eliminare la programmazione.",
    };
  }

  const { data: fasi, error: fasiError } = await supabase
    .from("programmazione_fasi")
    .select("id")
    .eq("programmazione_id", programmazioneId)
    .eq("club_id", clubId);

  if (fasiError) {
    return { success: false, message: fasiError.message };
  }

  const faseIds = (fasi ?? []).map((fase) => fase.id);

  if (faseIds.length > 0) {
    const { data: settimane, error: settimaneError } = await supabase
      .from("programmazione_settimane")
      .select("id")
      .in("fase_id", faseIds)
      .eq("club_id", clubId);

    if (settimaneError) {
      return { success: false, message: settimaneError.message };
    }

    const settimanaIds = (settimane ?? []).map((settimana) => settimana.id);

    if (settimanaIds.length > 0) {
      const { error: seduteError } = await supabase
        .from("programmazione_sedute")
        .delete()
        .in("settimana_id", settimanaIds)
        .eq("club_id", clubId);

      if (seduteError) {
        return { success: false, message: seduteError.message };
      }
    }

    const { error: settimaneDeleteError } = await supabase
      .from("programmazione_settimane")
      .delete()
      .in("fase_id", faseIds)
      .eq("club_id", clubId);

    if (settimaneDeleteError) {
      return { success: false, message: settimaneDeleteError.message };
    }

    const { error: fasiDeleteError } = await supabase
      .from("programmazione_fasi")
      .delete()
      .eq("programmazione_id", programmazioneId)
      .eq("club_id", clubId);

    if (fasiDeleteError) {
      return { success: false, message: fasiDeleteError.message };
    }
  }

  const { error: programmazioneDeleteError } = await supabase
    .from("programmazioni")
    .delete()
    .eq("id", programmazioneId)
    .eq("club_id", clubId);

  if (programmazioneDeleteError) {
    return { success: false, message: programmazioneDeleteError.message };
  }

  revalidatePath("/allenamenti/programmazione");

  return {
    success: true,
    message: "Programmazione eliminata correttamente.",
  };
}

export async function modificaFase(input: ModificaFaseInput) {
  const { supabase, clubId, isAdmin } = await getProfiloCorrente();

  if (!isAdmin) {
    return {
      success: false,
      message: "Non hai i permessi per modificare il mesociclo.",
    };
  }

  const nome = input.nome.trim();

  if (!nome) {
    return {
      success: false,
      message: "Inserisci il nome del mesociclo.",
    };
  }

  const { error } = await supabase
    .from("programmazione_fasi")
    .update({
      nome,
      colore: input.colore || null,
      obiettivo: input.obiettivo?.trim() || null,
    })
    .eq("id", input.fase_id)
    .eq("club_id", clubId);

  if (error) {
    return {
      success: false,
      message: error.message,
    };
  }

  revalidatePath("/allenamenti/programmazione");

  return {
    success: true,
    message: "Mesociclo aggiornato correttamente.",
  };
}

export async function eliminaFase(faseId: string) {
  const { supabase, clubId, isAdmin } = await getProfiloCorrente();

  if (!isAdmin) {
    return {
      success: false,
      message: "Non hai i permessi per eliminare il mesociclo.",
    };
  }

  const { data: settimane, error: settimaneError } = await supabase
    .from("programmazione_settimane")
    .select("id")
    .eq("fase_id", faseId)
    .eq("club_id", clubId);

  if (settimaneError) {
    return { success: false, message: settimaneError.message };
  }

  const settimanaIds = (settimane ?? []).map((settimana) => settimana.id);

  if (settimanaIds.length > 0) {
    const { error: seduteError } = await supabase
      .from("programmazione_sedute")
      .delete()
      .in("settimana_id", settimanaIds)
      .eq("club_id", clubId);

    if (seduteError) {
      return { success: false, message: seduteError.message };
    }
  }

  const { error: settimaneDeleteError } = await supabase
    .from("programmazione_settimane")
    .delete()
    .eq("fase_id", faseId)
    .eq("club_id", clubId);

  if (settimaneDeleteError) {
    return { success: false, message: settimaneDeleteError.message };
  }

  const { error: faseDeleteError } = await supabase
    .from("programmazione_fasi")
    .delete()
    .eq("id", faseId)
    .eq("club_id", clubId);

  if (faseDeleteError) {
    return { success: false, message: faseDeleteError.message };
  }

  revalidatePath("/allenamenti/programmazione");

  return {
    success: true,
    message: "Mesociclo eliminato correttamente.",
  };
}

export async function modificaSeduta(input: ModificaSedutaInput) {
  const { supabase, clubId, isAdmin } = await getProfiloCorrente();

  if (!isAdmin) {
    return {
      success: false,
      message: "Non hai i permessi per modificare la seduta.",
    };
  }

  const { data: seduta, error: sedutaError } = await supabase
    .from("programmazione_sedute")
    .select("id,settimana_id")
    .eq("id", input.seduta_id)
    .eq("club_id", clubId)
    .maybeSingle();

  if (sedutaError || !seduta) {
    return { success: false, message: "Seduta non trovata." };
  }

  if (input.data_seduta) {
    const { data: settimana } = await supabase
      .from("programmazione_settimane")
      .select("data_inizio,data_fine")
      .eq("id", seduta.settimana_id)
      .eq("club_id", clubId)
      .maybeSingle();

    if (
      settimana &&
      (input.data_seduta < settimana.data_inizio ||
        input.data_seduta > settimana.data_fine)
    ) {
      return {
        success: false,
        message: "La data seduta deve rientrare nella settimana selezionata.",
      };
    }
  }

  const volume = Number(input.volume_min ?? 0);
  const durata = Number(input.durata_min ?? 0);
  const rpe = intensitaToRpe(input.intensita);
  const carico = volume && rpe ? volume * rpe : null;

  const { error } = await supabase
    .from("programmazione_sedute")
    .update({
      data_seduta: input.data_seduta || null,
      tipo_sessione: input.tipo_sessione || null,
      tema: input.tema || null,
      volume_min: volume || null,
      durata_min: durata || null,
      intensita: input.intensita || null,
      rpe,
      carico,
      note: input.note || null,
    })
    .eq("id", input.seduta_id)
    .eq("club_id", clubId);

  if (error) {
    return {
      success: false,
      message: error.message,
    };
  }

  revalidatePath("/allenamenti/programmazione");

  return {
    success: true,
    message: "Seduta aggiornata correttamente.",
  };
}

export async function eliminaSeduta(sedutaId: string) {
  const { supabase, clubId, isAdmin } = await getProfiloCorrente();

  if (!isAdmin) {
    return {
      success: false,
      message: "Non hai i permessi per eliminare la seduta.",
    };
  }

  const { error } = await supabase
    .from("programmazione_sedute")
    .delete()
    .eq("id", sedutaId)
    .eq("club_id", clubId);

  if (error) {
    return {
      success: false,
      message: error.message,
    };
  }

  revalidatePath("/allenamenti/programmazione");

  return {
    success: true,
    message: "Seduta eliminata correttamente.",
  };
}