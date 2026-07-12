"use server";

import { revalidatePath } from "next/cache";
import { createClient as createSupabaseAdminClient } from "@supabase/supabase-js";
import { createClient } from "@/lib/supabase-server";

const TIPI_PROFILO = [
  "admin",
  "allenatore",
  "preparatore",
  "giocatore",
] as const;

type TipoProfilo = (typeof TIPI_PROFILO)[number];

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
  codice: TipoProfilo;
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
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceRoleKey =
    process.env.SUPABASE_SECRET_KEY ??
    process.env.SUPABASE_SERVICE_ROLE_KEY;

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

function isTipoProfilo(value: string): value is TipoProfilo {
  return TIPI_PROFILO.includes(value as TipoProfilo);
}

function validaTipoProfilo(value: string | null | undefined): TipoProfilo {
  const codice = normalizzaCodiceTipoProfilo(value);

  if (!isTipoProfilo(codice)) {
    throw new Error(
      `Tipo profilo non valido. Valori consentiti: ${TIPI_PROFILO.join(", ")}.`
    );
  }

  return codice;
}

async function getContestoAdmin() {
  const supabase = await createClient();
  const supabaseAdmin = createAdminClient();

  const {
    data: { user },
    error: userError,
  } = await supabase.auth.getUser();

  if (userError || !user) {
    throw new Error("Utente non autenticato.");
  }

  const emailUtente = normalizzaEmail(user.email);

  if (!emailUtente) {
    throw new Error("L'utente autenticato non possiede un indirizzo email.");
  }

  let profilo: {
    id: string;
    auth_user_id: string | null;
    email: string;
    last_club_id: string | null;
    last_squadra_id: string | null;
    tipo_profilo: TipoProfilo | null;
    attivo: boolean;
  } | null = null;

  const { data: profiloDaAuth, error: profiloDaAuthError } =
    await supabaseAdmin
      .from("profili")
      .select(
        "id,auth_user_id,email,last_club_id,last_squadra_id,tipo_profilo,attivo"
      )
      .eq("auth_user_id", user.id)
      .maybeSingle();

  if (profiloDaAuthError) {
    console.error(
      "Errore recupero profilo tramite auth_user_id:",
      profiloDaAuthError
    );
    throw new Error("Non è stato possibile recuperare il profilo.");
  }

  profilo = profiloDaAuth as typeof profilo;

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

    profilo = profiloDaEmail as typeof profilo;
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
          auth_user_id: user.id,
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

    profilo.auth_user_id = user.id;
  } else if (profilo.auth_user_id !== user.id) {
    throw new Error("Il profilo risulta già collegato a un altro account.");
  }

  return {
    supabaseAdmin,
    clubId: profilo.last_club_id,
    squadraId: profilo.last_squadra_id,
  };
}

async function verificaTipoProfiloConfigurato(
  codiceTipoProfilo: string
): Promise<TipoProfilo> {
  const codice = validaTipoProfilo(codiceTipoProfilo);
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

  // La tabella tipi_profili è opzionale come anagrafica UI.
  // Se il record esiste, deve essere attivo; l'enum resta la fonte di verità.
  if (data && data.attivo === false) {
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

  if (!isTipoProfilo(codice)) {
    throw new Error(
      "Non puoi creare un nuovo ruolo dall'applicazione perché " +
        "profili.tipo_profilo usa tipo_profilo_enum. " +
        `Ruoli disponibili: ${TIPI_PROFILO.join(", ")}.`
    );
  }

  throw new Error(`Il tipo profilo “${codice}” è già definito nell'enum.`);
}

/**
 * I valori dell'enum non possono essere eliminati in sicurezza dall'app.
 */
export async function eliminaTipoProfilo(
  _tipoProfiloId: string
): Promise<ActionResult> {
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