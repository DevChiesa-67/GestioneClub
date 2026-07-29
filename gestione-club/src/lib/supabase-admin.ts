import "server-only";

import { createClient } from "@supabase/supabase-js";

// .trim() protegge da variabili d'ambiente con spazi/a-capo accidentali
// in coda (es. incollate da un pannello di hosting): un valore "sporco"
// qui produce header Authorization/apikey non validi e query che falliscono
// con un errore poco chiaro lato client.
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL?.trim();
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY?.trim();

if (!supabaseUrl) {
  throw new Error("NEXT_PUBLIC_SUPABASE_URL non configurata");
}

if (!serviceRoleKey) {
  throw new Error("SUPABASE_SERVICE_ROLE_KEY non configurata");
}

export const supabaseAdmin = createClient(
  supabaseUrl,
  serviceRoleKey,
  {
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
        apikey: serviceRoleKey,
        Authorization: `Bearer ${serviceRoleKey}`,
      },
    },
  },
);