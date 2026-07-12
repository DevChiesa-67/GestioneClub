"use server";

import { createClient as createSupabaseAdminClient } from "@supabase/supabase-js";

type VerificaProfiloInput = {
  nome: string;
  cognome: string;
  email: string;
};

type RegistrazioneInput = VerificaProfiloInput & {
  password: string;
  confermaPassword: string;
};

type ActionResult = {
  success: boolean;
  message: string;
};

function normalizeText(value: string) {
  return value.trim().replace(/\s+/g, " ");
}

function normalizeEmail(value: string) {
  return value.trim().toLowerCase();
}

function isValidEmail(email: string) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

function getAdminClient() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;

  const supabaseSecretKey =
    process.env.SUPABASE_SECRET_KEY ??
    process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!supabaseUrl) {
    throw new Error("NEXT_PUBLIC_SUPABASE_URL non configurata.");
  }

  if (!supabaseSecretKey) {
    throw new Error(
      "SUPABASE_SECRET_KEY o SUPABASE_SERVICE_ROLE_KEY non configurata."
    );
  }

  return createSupabaseAdminClient(supabaseUrl, supabaseSecretKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
      detectSessionInUrl: false,
    },
  });
}

export async function verificaProfiloRegistrazione(
  input: VerificaProfiloInput
): Promise<ActionResult> {
  try {
    const nome = normalizeText(input.nome);
    const cognome = normalizeText(input.cognome);
    const email = normalizeEmail(input.email);

    if (!nome || !cognome || !email) {
      return {
        success: false,
        message: "Inserisci nome, cognome ed email.",
      };
    }

    if (!isValidEmail(email)) {
      return {
        success: false,
        message: "Inserisci un indirizzo email valido.",
      };
    }

    const supabaseAdmin = getAdminClient();

    const { data: profilo, error } = await supabaseAdmin
      .from("profili")
      .select("id, nome, cognome, email, auth_user_id, attivo")
      .ilike("nome", nome)
      .ilike("cognome", cognome)
      .ilike("email", email)
      .maybeSingle();

    if (error) {
      console.error("Errore verifica profilo:", error);

      return {
        success: false,
        message: "Non è stato possibile verificare il profilo.",
      };
    }

    if (!profilo) {
      return {
        success: false,
        message:
          "I dati inseriti non corrispondono a nessun profilo autorizzato.",
      };
    }

    if (profilo.attivo === false) {
      return {
        success: false,
        message: "Questo profilo è stato disattivato.",
      };
    }

    if (profilo.auth_user_id) {
      return {
        success: false,
        message:
          "Questo profilo è già associato a un account. Accedi oppure recupera la password.",
      };
    }

    return {
      success: true,
      message: "Profilo riconosciuto. Puoi completare la registrazione.",
    };
  } catch (error) {
    console.error("Errore verifica registrazione:", error);

    return {
      success: false,
      message: "Si è verificato un errore durante la verifica.",
    };
  }
}

export async function registraUtente(
  input: RegistrazioneInput
): Promise<ActionResult> {
  let nuovoAuthUserId: string | null = null;

  try {
    const nome = normalizeText(input.nome);
    const cognome = normalizeText(input.cognome);
    const email = normalizeEmail(input.email);
    const password = input.password;
    const confermaPassword = input.confermaPassword;

    if (!nome || !cognome || !email) {
      return {
        success: false,
        message: "Nome, cognome ed email sono obbligatori.",
      };
    }

    if (!isValidEmail(email)) {
      return {
        success: false,
        message: "Inserisci un indirizzo email valido.",
      };
    }

    if (!password) {
      return {
        success: false,
        message: "Inserisci una password.",
      };
    }

    if (password.length < 8) {
      return {
        success: false,
        message: "La password deve contenere almeno 8 caratteri.",
      };
    }

    if (password !== confermaPassword) {
      return {
        success: false,
        message: "Le password non coincidono.",
      };
    }

    const supabaseAdmin = getAdminClient();

    /*
     * Recuperiamo nuovamente il profilo lato server.
     * Non ci fidiamo della verifica eseguita precedentemente dal client.
     */
    const { data: profilo, error: profiloError } = await supabaseAdmin
      .from("profili")
      .select(`
        id,
        nome,
        cognome,
        email,
        auth_user_id,
        attivo,
        tipo_profilo,
        last_club_id,
        last_squadra_id
      `)
      .ilike("nome", nome)
      .ilike("cognome", cognome)
      .ilike("email", email)
      .maybeSingle();

    if (profiloError) {
      console.error("Errore recupero profilo:", profiloError);

      return {
        success: false,
        message: "Non è stato possibile recuperare il profilo.",
      };
    }

    if (!profilo) {
      return {
        success: false,
        message:
          "I dati inseriti non corrispondono a nessun profilo autorizzato.",
      };
    }

    if (profilo.attivo === false) {
      return {
        success: false,
        message: "Questo profilo è stato disattivato.",
      };
    }

    if (profilo.auth_user_id) {
      return {
        success: false,
        message:
          "Questo profilo è già associato a un account. Prova ad accedere oppure recupera la password.",
      };
    }

    /*
     * Creazione dell'utente Auth con email già confermata.
     *
     * Essendo il profilo già stato autorizzato da un amministratore,
     * non è necessario inviare un'ulteriore conferma email.
     */
    const {
      data: authData,
      error: authError,
    } = await supabaseAdmin.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
      user_metadata: {
        nome,
        cognome,
        profilo_preautorizzato_id: profilo.id,
        tipo_profilo: profilo.tipo_profilo,
      },
    });

    if (authError) {
      console.error("Errore creazione utente Auth:", authError);

      const errorMessage = authError.message.toLowerCase();

      if (
        errorMessage.includes("already registered") ||
        errorMessage.includes("already exists") ||
        errorMessage.includes("already been registered") ||
        errorMessage.includes("user already registered")
      ) {
        return {
          success: false,
          message:
            "Esiste già un account associato a questo indirizzo email. Prova ad accedere oppure recupera la password.",
        };
      }

      return {
        success: false,
        message:
          authError.message || "Non è stato possibile creare l'account.",
      };
    }

    if (!authData.user) {
      return {
        success: false,
        message: "Supabase non ha restituito l'utente appena creato.",
      };
    }

    nuovoAuthUserId = authData.user.id;

    /*
     * Collega il profilo preautorizzato all'utente Auth.
     *
     * Il controllo .is("auth_user_id", null) impedisce che due richieste
     * contemporanee colleghino lo stesso profilo a utenti differenti.
     */
    const {
      data: profiloAggiornato,
      error: updateError,
    } = await supabaseAdmin
      .from("profili")
      .update({
        auth_user_id: nuovoAuthUserId,
        email,
        nome,
        cognome,
        updated_at: new Date().toISOString(),
      })
      .eq("id", profilo.id)
      .is("auth_user_id", null)
      .select("id, auth_user_id")
      .maybeSingle();

    if (updateError) {
      console.error("Errore collegamento profilo:", updateError);

      /*
       * Evita di lasciare un utente Auth orfano nel caso in cui
       * il collegamento del profilo non riesca.
       */
      const { error: deleteError } =
        await supabaseAdmin.auth.admin.deleteUser(nuovoAuthUserId);

      if (deleteError) {
        console.error(
          "Errore eliminazione utente Auth dopo rollback:",
          deleteError
        );
      }

      return {
        success: false,
        message:
          "Non è stato possibile collegare l'account al profilo. Riprova.",
      };
    }

    if (!profiloAggiornato) {
      const { error: deleteError } =
        await supabaseAdmin.auth.admin.deleteUser(nuovoAuthUserId);

      if (deleteError) {
        console.error(
          "Errore eliminazione utente Auth non collegato:",
          deleteError
        );
      }

      return {
        success: false,
        message:
          "Il profilo è già stato associato a un altro account. Prova ad accedere.",
      };
    }

    /*
     * Per i profili di tipo "giocatore", collega anche la riga
     * giocatori corrispondente (trovata tramite id_atleta = profilo.id)
     * al nuovo utente Auth: serve alle viste che filtrano i dati del
     * giocatore loggato tramite giocatori.user_id (es. misurazioni).
     */
    if (String(profilo.tipo_profilo || "").toLowerCase() === "giocatore") {
      const { error: collegamentoGiocatoreError } = await supabaseAdmin
        .from("giocatori")
        .update({
          user_id: nuovoAuthUserId,
          updated_at: new Date().toISOString(),
        })
        .eq("id_atleta", profilo.id);

      if (collegamentoGiocatoreError) {
        console.error(
          "Errore collegamento giocatore all'account registrato:",
          collegamentoGiocatoreError
        );
      }
    }

    return {
      success: true,
      message:
        "Registrazione completata. Ora puoi accedere con email e password.",
    };
  } catch (error) {
    console.error("Errore registrazione:", error);

    /*
     * Rollback di sicurezza nel caso in cui l'errore avvenga
     * dopo la creazione dell'utente Auth.
     */
    if (nuovoAuthUserId) {
      try {
        const supabaseAdmin = getAdminClient();

        const { error: deleteError } =
          await supabaseAdmin.auth.admin.deleteUser(nuovoAuthUserId);

        if (deleteError) {
          console.error(
            "Errore rollback utente Auth:",
            deleteError
          );
        }
      } catch (rollbackError) {
        console.error("Errore durante il rollback:", rollbackError);
      }
    }

    return {
      success: false,
      message: "Si è verificato un errore durante la registrazione.",
    };
  }
}