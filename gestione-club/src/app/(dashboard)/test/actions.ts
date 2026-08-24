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

type EliminaMisurazioniInput = {
  data_test: string;
  test_id: string;
};

type GiocatoreRelazione = {
  id: string;
  nome: string;
  cognome: string;
  foto_url: string | null;
};

export type MisurazioneSalvata = {
  id: string;
  giocatore_id: string;
  valore: number | null;
  obiettivo: number | null;
  note: string | null;
  giocatore: GiocatoreRelazione | null;
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

  /*
   * Le presenze sono giornaliere: basta filtrare per data, non serve piu'
   * passare dagli id delle sedute di quel giorno.
   */
  const { data, error } = await supabase
    .from("presenze_giornaliere")
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
    .eq("data", dataTest)
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

/**
 * Misurazioni gia' salvate per una data + un test, nella squadra attiva.
 * Serve a precompilare il modale: reinserire lo stesso test non deve
 * creare doppioni, deve aggiornare quello che c'e' gia'.
 */
export async function caricaMisurazioniTest(
  dataTest: string,
  testId: string
): Promise<MisurazioneSalvata[]> {
  const { supabase, profilo } = await getProfiloCorrente();

  if (!dataTest || !testId) {
    return [];
  }

  const { data, error } = await supabase
    .from("test_misurazioni")
    .select(`
      id,
      giocatore_id,
      valore,
      obiettivo,
      note,
      giocatori (
        id,
        nome,
        cognome,
        foto_url
      )
    `)
    .eq("club_id", profilo.last_club_id)
    .eq("squadra_id", profilo.last_squadra_id)
    .eq("test_id", testId)
    .eq("data_test", dataTest);

  if (error) {
    throw new Error(error.message);
  }

  return (data ?? []).map((riga) => {
    const giocatore = Array.isArray(riga.giocatori)
      ? riga.giocatori[0] ?? null
      : riga.giocatori ?? null;

    return {
      id: riga.id as string,
      giocatore_id: riga.giocatore_id as string,
      valore: riga.valore === null ? null : Number(riga.valore),
      obiettivo: riga.obiettivo === null ? null : Number(riga.obiettivo),
      note: (riga.note as string | null) ?? null,
      giocatore: (giocatore as GiocatoreRelazione | null) ?? null,
    };
  });
}

/**
 * Salvataggio idempotente su (club, squadra, test, data):
 * - valore compilato e riga gia' esistente -> aggiorna;
 * - valore compilato e riga nuova          -> inserisce;
 * - valore svuotato su riga esistente      -> elimina quella misurazione.
 *
 * Prima questa action faceva solo insert, quindi risalvare lo stesso test
 * nello stesso giorno creava doppioni.
 */
export async function salvaMisurazioniTest(input: SalvaMisurazioniInput) {
  const { supabase, user, profilo } = await getProfiloCorrente();

  assertAdmin(profilo.tipo_profilo);

  const { data: esistenti, error: erroreEsistenti } = await supabase
    .from("test_misurazioni")
    .select("id,giocatore_id")
    .eq("club_id", profilo.last_club_id)
    .eq("squadra_id", profilo.last_squadra_id)
    .eq("test_id", input.test_id)
    .eq("data_test", input.data_test);

  if (erroreEsistenti) {
    throw new Error(erroreEsistenti.message);
  }

  const idPerGiocatore = new Map<string, string>();

  for (const riga of esistenti ?? []) {
    idPerGiocatore.set(riga.giocatore_id as string, riga.id as string);
  }

  const daInserire: Record<string, unknown>[] = [];
  const daAggiornare: { id: string; valori: Record<string, unknown> }[] = [];
  const daEliminare: string[] = [];

  for (const misurazione of input.misurazioni) {
    const idEsistente = idPerGiocatore.get(misurazione.giocatore_id) ?? null;

    const valoreValido =
      misurazione.valore !== null && !Number.isNaN(misurazione.valore);

    if (!valoreValido) {
      if (idEsistente) {
        daEliminare.push(idEsistente);
      }

      continue;
    }

    if (idEsistente) {
      daAggiornare.push({
        id: idEsistente,
        valori: {
          valore: misurazione.valore,
          obiettivo: misurazione.obiettivo,
          note: misurazione.note ?? null,
        },
      });

      continue;
    }

    daInserire.push({
      club_id: profilo.last_club_id,
      squadra_id: profilo.last_squadra_id,
      giocatore_id: misurazione.giocatore_id,
      test_id: input.test_id,
      data_test: input.data_test,
      valore: misurazione.valore,
      obiettivo: misurazione.obiettivo,
      note: misurazione.note ?? null,
      registrato_da: user.id,
    });
  }

  if (
    daInserire.length === 0 &&
    daAggiornare.length === 0 &&
    daEliminare.length === 0
  ) {
    throw new Error("Inserisci almeno una misurazione.");
  }

  if (daInserire.length > 0) {
    const { error } = await supabase
      .from("test_misurazioni")
      .insert(daInserire);

    if (error) {
      throw new Error(error.message);
    }
  }

  for (const riga of daAggiornare) {
    const { error } = await supabase
      .from("test_misurazioni")
      .update(riga.valori)
      .eq("id", riga.id);

    if (error) {
      throw new Error(error.message);
    }
  }

  if (daEliminare.length > 0) {
    const { error } = await supabase
      .from("test_misurazioni")
      .delete()
      .in("id", daEliminare);

    if (error) {
      throw new Error(error.message);
    }
  }

  revalidatePath("/test");

  return {
    inserite: daInserire.length,
    aggiornate: daAggiornare.length,
    eliminate: daEliminare.length,
  };
}

/**
 * Elimina la misurazione di un singolo giocatore: serve a correggere un
 * dato sbagliato senza toccare il resto della sessione.
 * Il filtro su club e squadra evita che un id arrivato dal client possa
 * cancellare righe di un'altra squadra.
 */
export async function eliminaMisurazione(id: string) {
  const { supabase, profilo } = await getProfiloCorrente();

  assertAdmin(profilo.tipo_profilo);

  if (!id) {
    throw new Error("Misurazione non trovata.");
  }

  const { error } = await supabase
    .from("test_misurazioni")
    .delete()
    .eq("id", id)
    .eq("club_id", profilo.last_club_id)
    .eq("squadra_id", profilo.last_squadra_id);

  if (error) {
    throw new Error(error.message);
  }

  revalidatePath("/test");
}

/** Elimina l'intera sessione di test (tutte le righe di quel test in quella data). */
export async function eliminaMisurazioniTest(input: EliminaMisurazioniInput) {
  const { supabase, profilo } = await getProfiloCorrente();

  assertAdmin(profilo.tipo_profilo);

  if (!input.data_test || !input.test_id) {
    throw new Error("Test o data mancanti.");
  }

  const { error } = await supabase
    .from("test_misurazioni")
    .delete()
    .eq("club_id", profilo.last_club_id)
    .eq("squadra_id", profilo.last_squadra_id)
    .eq("test_id", input.test_id)
    .eq("data_test", input.data_test);

  if (error) {
    throw new Error(error.message);
  }

  revalidatePath("/test");
}