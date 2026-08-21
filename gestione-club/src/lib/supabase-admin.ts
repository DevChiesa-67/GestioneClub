import "server-only";

import { createClient, type SupabaseClient } from "@supabase/supabase-js";

// Rimuove QUALSIASI spazio/a-capo, non solo iniziale/finale: se il valore è
// stato incollato da un pannello di hosting o da un terminale che ha
// "spezzato" la riga, può contenere un a-capo interno che .trim() da solo
// non toglierebbe (agisce solo sui bordi). Un valore "sporco" qui produce
// header Authorization/apikey non validi: in fase di build fa fallire la
// build stessa con un poco chiaro "Headers.append: ... is an invalid
// header value"; a runtime produce query che falliscono lato client.
const rimuoviSpazi = (valore: string | undefined) =>
  valore?.replace(/\s+/g, "");

/*
 * Le variabili si leggono a ogni chiamata, non una sola volta all'import.
 *
 * Prima questo modulo lanciava un errore a livello di modulo quando la
 * chiave service role mancava. In un Server Component quell'errore
 * scatta durante il RENDER della pagina che lo importa, e in produzione
 * Next lo nasconde dietro un generico "An error occurred in the Server
 * Components render": pagine intere morivano senza dire perche', anche
 * se il client admin serviva per una sola query secondaria.
 *
 * Ora il client viene creato alla prima vera chiamata e l'errore, se
 * arriva, nomina la variabile mancante e riguarda solo l'operazione che
 * ne aveva bisogno.
 *
 * Accetta SUPABASE_SECRET_KEY oltre a SUPABASE_SERVICE_ROLE_KEY: sono i
 * due nomi usati da Supabase (il primo e' quello nuovo, "Secret keys"),
 * e la variante opzionale qui sotto li accettava gia' entrambi. Averne
 * uno solo configurato faceva funzionare una meta' dell'applicazione e
 * fallire l'altra.
 */
function leggiConfigurazioneAdmin() {
  return {
    url: rimuoviSpazi(process.env.NEXT_PUBLIC_SUPABASE_URL),
    key: rimuoviSpazi(
      process.env.SUPABASE_SECRET_KEY ?? process.env.SUPABASE_SERVICE_ROLE_KEY
    ),
  };
}

/*
 * SupabaseClient con i suoi parametri di default (Database = any), che e'
 * esattamente il tipo che TypeScript inferiva prima da
 * createClient(url, key). NON usare ReturnType<typeof createClient>: quello
 * istanzia i generici a "unknown" invece che ai default, e le query
 * finiscono per restituire "never" — il che rompe la compilazione nei punti
 * che leggono le colonne del risultato.
 */
type ClientAdmin = SupabaseClient;

let istanzaAdmin: ClientAdmin | null = null;

function creaClientAdmin(): ClientAdmin {
  if (istanzaAdmin) return istanzaAdmin;

  const { url, key } = leggiConfigurazioneAdmin();

  if (!url) {
    throw new Error(
      "NEXT_PUBLIC_SUPABASE_URL non configurata: impostala tra le variabili d'ambiente del progetto."
    );
  }

  if (!key) {
    throw new Error(
      "Chiave service role non configurata: imposta SUPABASE_SECRET_KEY " +
        "(o SUPABASE_SERVICE_ROLE_KEY) tra le variabili d'ambiente del " +
        "progetto, anche in produzione."
    );
  }

  istanzaAdmin = createClient(url, key, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
      detectSessionInUrl: false,
    },
    // Il client admin (service role) non usa mai una sessione utente: gli
    // header di autenticazione vengono fissati qui esplicitamente invece di
    // lasciarli calcolare dinamicamente a ogni richiesta. Oltre a essere
    // coerente con persistSession/autoRefreshToken=false, evita che una
    // race condition nella risoluzione interna del token di sessione di
    // supabase-js produca un header Authorization/apikey corrotto (visto
    // in pratica come "Headers.set: ... is an invalid header value").
    global: {
      headers: {
        apikey: key,
        Authorization: `Bearer ${key}`,
      },
    },
  });

  return istanzaAdmin;
}

/*
 * Mantiene la stessa forma d'uso di prima (supabaseAdmin.from(...),
 * supabaseAdmin.auth.admin..., supabaseAdmin.storage...) senza toccare i
 * sei punti che lo usano: il client vero nasce al primo accesso.
 */
export const supabaseAdmin = new Proxy({} as ClientAdmin, {
  get(_bersaglio, proprieta) {
    const client = creaClientAdmin();
    const valore = (client as unknown as Record<string | symbol, unknown>)[
      proprieta
    ];

    return typeof valore === "function"
      ? (valore as (...argomenti: unknown[]) => unknown).bind(client)
      : valore;
  },
});

let contatoreAvvisiAdminOpzionale = 0;

/**
 * Come supabaseAdmin, ma non lancia se le variabili d'ambiente mancano:
 * ritorna null e chi chiama può ripiegare sul client legato alla sessione
 * dell'utente. Pensato per letture non sensibili (es. signed URL dei loghi
 * squadra) dentro pagine/servizi sempre renderizzati, dove un errore di
 * configurazione non deve far cadere l'intera pagina.
 */
export function creaSupabaseAdminOpzionale() {
  const { url, key } = leggiConfigurazioneAdmin();

  if (!url || !key) {
    if (contatoreAvvisiAdminOpzionale < 1) {
      contatoreAvvisiAdminOpzionale += 1;
      console.warn(
        "creaSupabaseAdminOpzionale: variabili service role non configurate, uso il client utente come fallback."
      );
    }

    return null;
  }

  return createClient(url, key, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
      detectSessionInUrl: false,
    },
    global: {
      headers: {
        apikey: key,
        Authorization: `Bearer ${key}`,
      },
    },
  });
}