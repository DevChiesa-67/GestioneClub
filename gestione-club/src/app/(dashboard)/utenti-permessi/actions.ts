"use server";

import { revalidatePath } from "next/cache";
import { createClient as createSupabaseAdminClient } from "@supabase/supabase-js";
import { createClient } from "@/lib/supabase-server";

/*
 * I ruoli disponibili NON sono piu' una lista congelata qui dentro: la
 * fonte e' l'anagrafica tipi_profili, la stessa che alimenta il menu a
 * tendina della pagina. Prima un ruolo aggiunto all'enum del database e
 * a tipi_profili veniva comunque rifiutato da questo file, che non lo
 * conosceva (era il caso di "accompagnatore"). L'autorita' finale resta
 * comunque Postgres: se il valore non e' nell'enum tipo_profilo_enum
 * l'insert fallisce con 22P02, gestito piu' sotto con un messaggio
 * esplicito.
 */
type TipoProfilo = string;

type PermessoPaginaInput = {
  pagina_key: string;
  can_view: boolean;
};

type CreaAccountUtenteInput = {
  email: string;
  nome?: string | null;
  cognome?: string | null;
  telefono?: string | null;
  avatar_url?: string | null;
  tipo_profilo: string;
  id_atleta?: string | null;
  squadra_id?: string | null;
};

type CreaTipoProfiloInput = {
  nome: string;
  codice?: string;
  descrizione?: string | null;
};

type TipoProfiloRecord = {
  id: string;
  codice: string;
  nome: string;
  descrizione: string | null;
  protetto: boolean;
  attivo: boolean;
  created_at?: string;
  updated_at?: string;
};

type ActionResult<T = undefined> = {
  success: boolean;
  message: string;
  data?: T;
};

function createAdminClient() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL?.trim();
  const serviceRoleKey = (
    process.env.SUPABASE_SECRET_KEY ?? process.env.SUPABASE_SERVICE_ROLE_KEY
  )?.trim();

  if (!supabaseUrl) {
    throw new Error("Variabile NEXT_PUBLIC_SUPABASE_URL non configurata.");
  }

  if (!serviceRoleKey) {
    throw new Error(
      "SUPABASE_SECRET_KEY o SUPABASE_SERVICE_ROLE_KEY non configurata."
    );
  }

  return createSupabaseAdminClient(supabaseUrl, serviceRoleKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
      detectSessionInUrl: false,
    },
    // Vedi supabase-admin.ts: header fissi per evitare che la risoluzione
    // dinamica del token (non necessaria per un client service-role) possa
    // produrre un Authorization/apikey corrotto ("Headers.set: ... is an
    // invalid header value").
    global: {
      headers: {
        apikey: serviceRoleKey,
        Authorization: `Bearer ${serviceRoleKey}`,
      },
    },
  });
}

function normalizzaTesto(value: string | null | undefined) {
  return value?.trim().replace(/\s+/g, " ") ?? "";
}

function normalizzaEmail(value: string | null | undefined) {
  return value?.trim().toLowerCase() ?? "";
}

function normalizzaCodiceTipoProfilo(value: string | null | undefined) {
  return (value ?? "")
    .trim()
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "");
}

function isEmailValida(email: string) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

async function getContestoAdmin() {
  const supabase = await createClient();
  const supabaseAdmin = createAdminClient();

  const {
    data: { user },
    error: userError,
  } = await supabase.auth.getUser();

  let authUserId = user?.id ?? "";
  let authUserEmail = user?.email ?? "";

  // getUser() interroga il servizio Auth e può fallire temporaneamente anche
  // quando il cookie contiene ancora un JWT valido. In quel caso verifichiamo
  // crittograficamente i claim della stessa sessione prima di negare l'azione.
  if (!authUserId) {
    const { data: claimsData, error: claimsError } =
      await supabase.auth.getClaims();
    const claims = claimsData?.claims;

    if (claimsError || !claims?.sub) {
      console.error("Sessione non disponibile nella Server Action:", {
        getUser: userError?.message,
        getClaims: claimsError?.message,
      });
      throw new Error(
        "Sessione scaduta o non disponibile. Ricarica la pagina ed effettua nuovamente l'accesso."
      );
    }

    authUserId = claims.sub;
    authUserEmail = typeof claims.email === "string" ? claims.email : "";
  }

  const emailUtente = normalizzaEmail(authUserEmail);

  if (!emailUtente) {
    throw new Error("L'utente autenticato non possiede un indirizzo email.");
  }

  type ProfiloContesto = {
    id: string;
    auth_user_id: string | null;
    email: string;
    last_club_id: string | null;
    last_squadra_id: string | null;
    tipo_profilo: TipoProfilo | null;
    attivo: boolean;
  };

  let profilo: ProfiloContesto | null = null;

  const { data: profiloDaAuth, error: profiloDaAuthError } =
    await supabaseAdmin
      .from("profili")
      .select(
        "id,auth_user_id,email,last_club_id,last_squadra_id,tipo_profilo,attivo"
      )
      .eq("auth_user_id", authUserId)
      .maybeSingle();

  if (profiloDaAuthError) {
    console.error(
      "Errore recupero profilo tramite auth_user_id:",
      profiloDaAuthError
    );
    throw new Error("Non è stato possibile recuperare il profilo.");
  }

  profilo = profiloDaAuth as ProfiloContesto | null;

  if (!profilo) {
    const { data: profiloDaEmail, error: profiloDaEmailError } =
      await supabaseAdmin
        .from("profili")
        .select(
          "id,auth_user_id,email,last_club_id,last_squadra_id,tipo_profilo,attivo"
        )
        .ilike("email", emailUtente)
        .limit(1)
        .maybeSingle();

    if (profiloDaEmailError) {
      console.error(
        "Errore recupero profilo tramite email:",
        profiloDaEmailError
      );
      throw new Error("Non è stato possibile recuperare il profilo.");
    }

    profilo = profiloDaEmail as ProfiloContesto | null;
  }

  if (!profilo) {
    throw new Error(`Nessun profilo trovato con l'email ${emailUtente}.`);
  }

  if (!profilo.attivo) {
    throw new Error("Il tuo profilo è stato disattivato.");
  }

  if (!profilo.last_club_id) {
    throw new Error("Nessun club attivo selezionato.");
  }

  if (profilo.tipo_profilo !== "admin") {
    throw new Error("Non sei autorizzato a modificare utenti e permessi.");
  }

  if (!profilo.auth_user_id) {
    const { data: profiloCollegato, error: collegamentoError } =
      await supabaseAdmin
        .from("profili")
        .update({
          auth_user_id: authUserId,
          updated_at: new Date().toISOString(),
        })
        .eq("id", profilo.id)
        .is("auth_user_id", null)
        .select("id,auth_user_id")
        .maybeSingle();

    if (collegamentoError) {
      console.error(
        "Errore collegamento profilo con utente Auth:",
        collegamentoError
      );
      throw new Error(
        "Profilo trovato, ma non è stato possibile collegarlo all'account."
      );
    }

    if (!profiloCollegato) {
      throw new Error("Il profilo è stato collegato a un altro account.");
    }

    profilo.auth_user_id = authUserId;
  } else if (profilo.auth_user_id !== authUserId) {
    throw new Error("Il profilo risulta già collegato a un altro account.");
  }

  return {
    supabaseAdmin,
    clubId: profilo.last_club_id,
    squadraId: profilo.last_squadra_id,
    // Servono a impedire che un admin cancelli se stesso.
    profiloCorrenteId: profilo.id,
    authUserIdCorrente: authUserId,
  };
}

async function verificaTipoProfiloConfigurato(
  codiceTipoProfilo: string
): Promise<TipoProfilo> {
  const codice = normalizzaCodiceTipoProfilo(codiceTipoProfilo);

  if (!codice) {
    throw new Error("Seleziona un tipo profilo.");
  }

  const supabaseAdmin = createAdminClient();

  const { data, error } = await supabaseAdmin
    .from("tipi_profili")
    .select("codice,attivo")
    .eq("codice", codice)
    .maybeSingle();

  if (error) {
    console.error("Errore verifica tipo profilo:", error);
    throw new Error("Non è stato possibile verificare il tipo profilo.");
  }

  if (!data) {
    throw new Error(
      `Il tipo profilo “${codice}” non è registrato in tipi_profili. ` +
        "Aggiungilo con lo script aggiungi-tipo-profilo.sql (aggiunge il " +
        "valore all'enum e la riga nell'anagrafica), poi riprova."
    );
  }

  if (data.attivo === false) {
    throw new Error(`Il tipo profilo “${codice}” è disattivato.`);
  }

  return codice;
}

/**
 * Con tipo_profilo_enum non è possibile aggiungere ruoli arbitrari
 * dall'applicazione. Per aggiungerne uno occorre prima una migrazione SQL:
 * ALTER TYPE public.tipo_profilo_enum ADD VALUE IF NOT EXISTS 'nuovo_ruolo';
 */
export async function creaTipoProfilo(
  input: CreaTipoProfiloInput
): Promise<ActionResult<TipoProfiloRecord>> {
  await getContestoAdmin();

  const codice = normalizzaCodiceTipoProfilo(input.codice || input.nome);

  throw new Error(
    `Per aggiungere il ruolo “${codice}” serve una migrazione SQL, perché ` +
      "profili.tipo_profilo usa tipo_profilo_enum e i valori di un enum non " +
      "si aggiungono dall'applicazione. Usa aggiungi-tipo-profilo.sql: " +
      "aggiunge il valore all'enum e la riga in tipi_profili, dopodiché il " +
      "ruolo compare qui senza altre modifiche al codice."
  );
}

/**
 * I valori dell'enum non possono essere eliminati in sicurezza dall'app.
 */
export async function eliminaTipoProfilo(
  tipoProfiloId: string
): Promise<ActionResult> {
  void tipoProfiloId;

  await getContestoAdmin();
  throw new Error(
    "I tipi profilo definiti nell'enum sono protetti e non possono essere eliminati dall'applicazione."
  );
}

export async function creaAccountUtente(input: CreaAccountUtenteInput) {
  const { clubId, squadraId, supabaseAdmin } = await getContestoAdmin();

  const email = normalizzaEmail(input.email);
  const nome = normalizzaTesto(input.nome);
  const cognome = normalizzaTesto(input.cognome);
  const telefono = normalizzaTesto(input.telefono) || null;
  const avatarUrl = normalizzaTesto(input.avatar_url) || null;
  const idAtleta = normalizzaTesto(input.id_atleta) || null;
  const tipoProfilo = await verificaTipoProfiloConfigurato(
    input.tipo_profilo
  );

  if (!nome) throw new Error("Inserisci il nome dell'utente.");
  if (!cognome) throw new Error("Inserisci il cognome dell'utente.");
  if (!email) throw new Error("Inserisci un indirizzo email.");
  if (!isEmailValida(email)) {
    throw new Error("L'indirizzo email non è valido.");
  }

  const squadraUtenteId =
    normalizzaTesto(input.squadra_id) || squadraId || null;

  const { data: profiloEsistente, error: controlloProfiloError } =
    await supabaseAdmin
      .from("profili")
      .select("id,email,auth_user_id,attivo")
      .ilike("email", email)
      .limit(1)
      .maybeSingle();

  if (controlloProfiloError) {
    console.error(
      "Errore durante il controllo del profilo:",
      controlloProfiloError
    );
    throw new Error("Errore durante il controllo dell'indirizzo email.");
  }

  if (profiloEsistente) {
    throw new Error(
      profiloEsistente.auth_user_id
        ? "Esiste già un account registrato con questo indirizzo email."
        : "Esiste già un profilo autorizzato con questo indirizzo email."
    );
  }

  const { data: profiloCreato, error: profiloError } = await supabaseAdmin
    .from("profili")
    .insert({
      id: crypto.randomUUID(),
      email,
      nome,
      cognome,
      telefono,
      avatar_url: avatarUrl,
      tipo_profilo: tipoProfilo,
      club_id: [clubId],
      last_club_id: clubId,
      last_squadra_id: squadraUtenteId,
      id_atleta: idAtleta,
      attivo: true,
      auth_user_id: null,
      updated_at: new Date().toISOString(),
    })
    .select(
      "id,auth_user_id,email,nome,cognome,telefono,avatar_url,tipo_profilo,club_id,last_club_id,last_squadra_id,id_atleta,attivo,created_at,updated_at"
    )
    .single();

  if (profiloError || !profiloCreato) {
    console.error("Errore creazione profilo preautorizzato:", profiloError);

    if (profiloError?.code === "23505") {
      throw new Error(
        "Esiste già un profilo associato a questo indirizzo email."
      );
    }

    if (profiloError?.code === "22P02") {
      throw new Error(
        `Il ruolo “${tipoProfilo}” non è presente in tipo_profilo_enum.`
      );
    }

    throw new Error(
      profiloError?.message || "Non è stato possibile creare il profilo."
    );
  }

  revalidatePath("/utenti-permessi");
  revalidatePath("/utenti");

  return {
    success: true,
    message:
      "Profilo autorizzato correttamente. L'utente può ora completare la registrazione.",
    utente: profiloCreato,
  };
}

export async function salvaPermessiPagineTipoProfilo(input: {
  tipoProfilo: string;
  pagine: PermessoPaginaInput[];
}) {
  const { supabaseAdmin, clubId } = await getContestoAdmin();
  const tipoProfilo = await verificaTipoProfiloConfigurato(
    input.tipoProfilo
  );

  if (tipoProfilo === "admin") {
    throw new Error(
      "Le pagine visibili dell'amministratore non sono modificabili."
    );
  }

  if (!Array.isArray(input.pagine)) {
    throw new Error("Elenco delle pagine non valido.");
  }

  const now = new Date().toISOString();
  const payload = input.pagine
    .filter(
      (pagina) =>
        typeof pagina.pagina_key === "string" &&
        pagina.pagina_key.trim().length > 0
    )
    .map((pagina) => ({
      club_id: clubId,
      tipo_profilo: tipoProfilo,
      pagina_key: pagina.pagina_key.trim(),
      can_view: Boolean(pagina.can_view),
      updated_at: now,
    }));

  if (payload.length === 0) return [];

  const { data, error } = await supabaseAdmin
    .from("permessi_pagine_tipo_profilo")
    .upsert(payload, {
      onConflict: "club_id,tipo_profilo,pagina_key",
    })
    .select(
      "id,club_id,tipo_profilo,pagina_key,can_view,created_at,updated_at"
    );

  if (error) {
    console.error("Errore Supabase salvataggio pagine visibili:", {
      code: error.code,
      message: error.message,
      details: error.details,
      hint: error.hint,
      clubId,
      tipoProfilo,
      payload,
    });
    throw new Error(
      error.message || "Errore durante il salvataggio delle pagine visibili."
    );
  }

  revalidatePath("/utenti-permessi");
  return data ?? [];
}


/*
 * Elimina un utente: prima l'account di accesso su Supabase Auth, poi il
 * profilo. In quest'ordine perche' un profilo orfano (senza login) e'
 * recuperabile, mentre un account Auth rimasto senza profilo riuscirebbe
 * ancora ad autenticarsi e finirebbe su un errore "Profilo utente non
 * trovato" a ogni pagina.
 *
 * Il record giocatore NON viene cancellato: si scollega soltanto. Cosi'
 * togliere l'accesso a un atleta non porta via con se' presenze,
 * misurazioni e statistiche di quel giocatore.
 */
export async function eliminaUtente(profiloId: string): Promise<ActionResult> {
  const { supabaseAdmin, clubId, profiloCorrenteId, authUserIdCorrente } =
    await getContestoAdmin();

  const id = normalizzaTesto(profiloId);

  if (!id) {
    throw new Error("Utente non valido.");
  }

  if (id === profiloCorrenteId) {
    throw new Error("Non puoi eliminare il tuo stesso account.");
  }

  const { data: utente, error: utenteError } = await supabaseAdmin
    .from("profili")
    .select("id,auth_user_id,email,nome,cognome,tipo_profilo,club_id")
    .eq("id", id)
    .maybeSingle();

  if (utenteError) {
    console.error("Errore recupero utente da eliminare:", utenteError);
    throw new Error("Non è stato possibile recuperare l'utente.");
  }

  if (!utente) {
    throw new Error("Utente non trovato.");
  }

  // club_id e' un array: l'utente va eliminato solo se appartiene al club
  // su cui l'admin sta operando.
  const clubUtente = Array.isArray(utente.club_id)
    ? utente.club_id
    : [utente.club_id].filter(Boolean);

  if (!clubUtente.includes(clubId)) {
    throw new Error("L'utente non appartiene al club attivo.");
  }

  if (utente.auth_user_id === authUserIdCorrente) {
    throw new Error("Non puoi eliminare il tuo stesso account.");
  }

  /*
   * Un club senza amministratori non sarebbe piu' gestibile da nessuno:
   * l'ultimo admin non si puo' eliminare.
   */
  if (String(utente.tipo_profilo || "").toLowerCase() === "admin") {
    const { count, error: contaError } = await supabaseAdmin
      .from("profili")
      .select("id", { count: "exact", head: true })
      .eq("tipo_profilo", "admin")
      .eq("attivo", true)
      .contains("club_id", [clubId]);

    if (contaError) {
      console.error("Errore conteggio amministratori:", contaError);
      throw new Error("Non è stato possibile verificare gli amministratori.");
    }

    if ((count ?? 0) <= 1) {
      throw new Error(
        "Questo è l'ultimo amministratore del club: assegna il ruolo admin a un altro utente prima di eliminarlo."
      );
    }
  }

  // Scollega l'eventuale scheda giocatore, senza cancellarla.
  const { error: scollegaError } = await supabaseAdmin
    .from("giocatori")
    .update({ id_atleta: null })
    .eq("id_atleta", id);

  if (scollegaError) {
    console.error("Errore scollegamento giocatore:", scollegaError);
    throw new Error(
      "Non è stato possibile scollegare la scheda giocatore associata."
    );
  }

  if (utente.auth_user_id) {
    const { error: authError } = await supabaseAdmin.auth.admin.deleteUser(
      utente.auth_user_id
    );

    /*
     * Se l'account su Auth non esiste piu' (cancellato a mano dal
     * pannello Supabase) proseguiamo: l'obiettivo e' comunque che alla
     * fine non resti nulla.
     */
    if (authError && !/not found/i.test(authError.message)) {
      console.error("Errore eliminazione account Auth:", authError);
      throw new Error(
        `Non è stato possibile eliminare l'account di accesso: ${authError.message}`
      );
    }
  }

  const { error: deleteError } = await supabaseAdmin
    .from("profili")
    .delete()
    .eq("id", id);

  if (deleteError) {
    console.error("Errore eliminazione profilo:", deleteError);
    throw new Error(
      `L'account di accesso è stato eliminato, ma il profilo no: ${deleteError.message}`
    );
  }

  revalidatePath("/utenti-permessi");
  revalidatePath("/utenti");

  const nome =
    [utente.nome, utente.cognome].filter(Boolean).join(" ") ||
    utente.email ||
    "Utente";

  return {
    success: true,
    message: `${nome} è stato eliminato, insieme al suo accesso.`,
  };
}
