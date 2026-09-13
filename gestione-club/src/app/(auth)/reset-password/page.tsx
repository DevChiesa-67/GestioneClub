"use client";

import { FormEvent, useEffect, useState } from "react";
import { ArrowLeft, Eye, EyeOff, Lock, ShieldCheck } from "lucide-react";
import Image from "next/image";
import Link from "next/link";

import { supabase } from "@/lib/supabase-client";

type Stato = "verifica" | "pronto" | "link-non-valido" | "fatto";

const LUNGHEZZA_MINIMA = 8;

/**
 * RECUPERO PASSWORD - NUOVA PASSWORD
 * ===================================
 * Atterraggio del link ricevuto via email.
 *
 * Il client del browser e' `createBrowserClient` di @supabase/ssr, che
 * usa il flusso PKCE e ha `detectSessionInUrl` attivo: quando la pagina
 * si apre con `?code=...` la sessione di recupero viene creata da sola,
 * in modo asincrono. Per questo NON si guarda subito `getSession()` e
 * basta: ci si mette in ascolto di `onAuthStateChange` (l'evento utile
 * e' PASSWORD_RECOVERY, ma SIGNED_IN e INITIAL_SESSION coprono i casi
 * in cui l'evento arriva prima che il componente sia montato) e in
 * parallelo si controlla la sessione gia' presente.
 *
 * Due limiti da conoscere prima di dare la colpa al codice:
 * - il link va aperto nello STESSO browser da cui e' partita la
 *   richiesta, perche' il code_verifier del PKCE vive li';
 * - il link scade (un'ora con le impostazioni di default) e vale una
 *   volta sola. In entrambi i casi si finisce in "link-non-valido", che
 *   rimanda a /forgot-password invece di lasciare l'utente su un form
 *   che fallirebbe al salvataggio.
 */
export default function ResetPasswordPage() {
  const [stato, setStato] = useState<Stato>("verifica");
  const [password, setPassword] = useState("");
  const [conferma, setConferma] = useState("");
  const [mostraPassword, setMostraPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [errore, setErrore] = useState<string | null>(null);

  useEffect(() => {
    let attivo = true;

    /*
     * Supabase rimanda indietro gli errori (link scaduto, gia' usato)
     * come parametri, nella query con il PKCE e nel frammento con il
     * flusso implicito: si guardano entrambi.
     */
    const query = new URLSearchParams(window.location.search);
    const hash = new URLSearchParams(
      window.location.hash.replace(/^#/, "")
    );

    if (query.get("error") || hash.get("error")) {
      setStato("link-non-valido");

      return;
    }

    const { data: listener } = supabase.auth.onAuthStateChange(
      (evento, sessione) => {
        if (!attivo) return;

        if (
          sessione &&
          (evento === "PASSWORD_RECOVERY" ||
            evento === "SIGNED_IN" ||
            evento === "INITIAL_SESSION")
        ) {
          setStato("pronto");
        }
      }
    );

    supabase.auth.getSession().then(({ data }) => {
      if (!attivo) return;

      if (data.session) {
        setStato("pronto");

        return;
      }

      /*
       * Nessuna sessione e nessun evento: se non c'e' nemmeno un codice
       * da scambiare nell'URL, la pagina e' stata aperta a mano.
       * Altrimenti si lascia qualche secondo allo scambio del codice
       * prima di dichiarare il link non valido.
       */
      const haCodice =
        Boolean(query.get("code")) || Boolean(hash.get("access_token"));

      if (!haCodice) {
        setStato("link-non-valido");

        return;
      }

      window.setTimeout(() => {
        if (!attivo) return;

        setStato((corrente) =>
          corrente === "verifica" ? "link-non-valido" : corrente
        );
      }, 4000);
    });

    return () => {
      attivo = false;
      listener.subscription.unsubscribe();
    };
  }, []);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (isLoading) {
      return;
    }

    if (password.length < LUNGHEZZA_MINIMA) {
      setErrore(
        `La password deve avere almeno ${LUNGHEZZA_MINIMA} caratteri.`
      );

      return;
    }

    if (password !== conferma) {
      setErrore("Le due password non coincidono.");

      return;
    }

    setIsLoading(true);
    setErrore(null);

    try {
      const { error } = await supabase.auth.updateUser({ password });

      if (error) {
        setErrore(
          error.message.toLowerCase().includes("should be different")
            ? "La nuova password deve essere diversa da quella attuale."
            : "Non e' stato possibile aggiornare la password. Riprova."
        );

        return;
      }

      setStato("fatto");
    } catch (error) {
      console.error("Errore durante il cambio password:", error);

      setErrore("Si e' verificato un errore. Riprova.");
    } finally {
      setIsLoading(false);
    }
  }

  return (
    <main className="relative flex min-h-screen items-center justify-center overflow-hidden bg-[#050505] px-4 py-10 text-white">
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_left,#4289ff_0%,transparent_32%),radial-gradient(circle_at_right,#1f1f1f_0%,transparent_35%)]" />

      <div className="relative w-full max-w-lg overflow-hidden rounded-[28px] border border-[#b8d3d9]/80 bg-[#171717]/85 p-6 shadow-2xl backdrop-blur-xl sm:p-10">
        <div className="mb-8 text-center">
          <div className="mx-auto mb-5 flex h-20 w-20 items-center justify-center">
            <Image
              src="/images/fabio-chiesa.com.png"
              alt="Fabio Chiesa Rugby logo"
              width={80}
              height={80}
              priority
              className="object-contain"
            />
          </div>

          <h1 className="text-3xl font-black sm:text-4xl">
            Nuova password
          </h1>

          <p className="mt-2 text-base text-zinc-400">
            Scegli una password di almeno {LUNGHEZZA_MINIMA} caratteri.
          </p>
        </div>

        {stato === "verifica" && (
          <p className="rounded-xl border border-white/10 bg-black/20 px-4 py-4 text-center text-sm text-zinc-400">
            Verifica del link in corso...
          </p>
        )}

        {stato === "link-non-valido" && (
          <div className="space-y-5">
            <div
              role="alert"
              className="rounded-xl border border-red-500/30 bg-red-500/10 px-4 py-4 text-sm leading-6 text-red-300"
            >
              Il link non e&apos; piu&apos; valido: e&apos; scaduto, e&apos;
              gia&apos; stato usato oppure e&apos; stato aperto in un
              browser diverso da quello da cui hai fatto la richiesta.
              Richiedine uno nuovo.
            </div>

            <Link
              href="/forgot-password"
              className="flex w-full items-center justify-center gap-2 rounded-xl bg-[#b8d3d9] px-5 py-3 text-base font-bold text-[#101010] transition hover:bg-[#b9151b] hover:text-white sm:py-4"
            >
              Richiedi un nuovo link
            </Link>
          </div>
        )}

        {stato === "fatto" && (
          <div className="space-y-5">
            <div
              role="status"
              className="flex items-start gap-3 rounded-xl border border-[#b8d3d9]/40 bg-[#b8d3d9]/10 px-4 py-4 text-sm leading-6 text-[#b8d3d9]"
            >
              <ShieldCheck size={20} className="mt-0.5 shrink-0" />
              Password aggiornata. Da adesso accedi con quella nuova.
            </div>

            <button
              type="button"
              onClick={() => {
                window.location.href = "/dashboard";
              }}
              className="w-full rounded-xl bg-[#b8d3d9] px-5 py-3 text-base font-bold text-[#101010] transition hover:bg-[#b9151b] hover:text-white sm:py-4 sm:text-lg"
            >
              Vai al gestionale
            </button>
          </div>
        )}

        {stato === "pronto" && (
          <form onSubmit={handleSubmit} className="space-y-5">
            <div>
              <label
                htmlFor="reset-password"
                className="mb-2 block text-sm font-medium sm:text-base"
              >
                Nuova password
              </label>

              <div className="flex items-center gap-3 rounded-xl border border-white/15 bg-black/20 px-4 py-3 transition focus-within:border-[#b8d3d9] sm:gap-4 sm:px-5 sm:py-4">
                <Lock className="shrink-0 text-zinc-400" size={20} />

                <input
                  id="reset-password"
                  name="password"
                  type={mostraPassword ? "text" : "password"}
                  required
                  minLength={LUNGHEZZA_MINIMA}
                  autoComplete="new-password"
                  placeholder="Inserisci la nuova password"
                  value={password}
                  onChange={(event) => setPassword(event.target.value)}
                  className="w-full bg-transparent text-base outline-none placeholder:text-zinc-500 sm:text-lg"
                />

                <button
                  type="button"
                  onClick={() =>
                    setMostraPassword((corrente) => !corrente)
                  }
                  className="shrink-0 text-zinc-400 transition hover:text-white"
                  aria-label={
                    mostraPassword
                      ? "Nascondi password"
                      : "Mostra password"
                  }
                  aria-pressed={mostraPassword}
                >
                  {mostraPassword ? (
                    <EyeOff size={20} />
                  ) : (
                    <Eye size={20} />
                  )}
                </button>
              </div>
            </div>

            <div>
              <label
                htmlFor="reset-password-conferma"
                className="mb-2 block text-sm font-medium sm:text-base"
              >
                Conferma password
              </label>

              <div className="flex items-center gap-3 rounded-xl border border-white/15 bg-black/20 px-4 py-3 transition focus-within:border-[#b8d3d9] sm:gap-4 sm:px-5 sm:py-4">
                <Lock className="shrink-0 text-zinc-400" size={20} />

                <input
                  id="reset-password-conferma"
                  name="password-conferma"
                  type={mostraPassword ? "text" : "password"}
                  required
                  minLength={LUNGHEZZA_MINIMA}
                  autoComplete="new-password"
                  placeholder="Ripeti la nuova password"
                  value={conferma}
                  onChange={(event) => setConferma(event.target.value)}
                  className="w-full bg-transparent text-base outline-none placeholder:text-zinc-500 sm:text-lg"
                />
              </div>
            </div>

            {errore && (
              <div
                role="alert"
                className="rounded-xl border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-300"
              >
                {errore}
              </div>
            )}

            <button
              type="submit"
              disabled={isLoading}
              className="w-full rounded-xl bg-[#b8d3d9] px-5 py-3 text-base font-bold text-[#101010] transition hover:bg-[#b9151b] hover:text-white disabled:cursor-not-allowed disabled:opacity-60 sm:py-4 sm:text-lg"
            >
              {isLoading ? "Salvataggio..." : "Salva la password"}
            </button>
          </form>
        )}

        <div className="mt-8 text-center">
          <Link
            href="/login"
            className="inline-flex items-center gap-2 text-sm font-semibold text-zinc-400 transition hover:text-white"
          >
            <ArrowLeft size={16} />
            Torna al login
          </Link>
        </div>
      </div>
    </main>
  );
}
