import "server-only";

import { createClient } from "@supabase/supabase-js";

// Rimuove QUALSIASI spazio/a-capo, non solo iniziale/finale: se il valore è
// stato incollato da un pannello di hosting o da un terminale che ha
// "spezzato" la riga, può contenere un a-capo interno che .trim() da solo
// non toglierebbe (agisce solo sui bordi). Un valore "sporco" qui produce
// header Authorization/apikey non validi: in fase di build fa fallire la
// build stessa con un poco chiaro "Headers.append: ... is an invalid
// header value"; a runtime produce query che falliscono lato client.
const rimuoviSpazi = (valore: string | undefined) =>
  valore?.replace(/\s+/g, "");

const supabaseUrl = rimuoviSpazi(process.env.NEXT_PUBLIC_SUPABASE_URL);
const serviceRoleKey = rimuoviSpazi(process.env.SUPABASE_SERVICE_ROLE_KEY);

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