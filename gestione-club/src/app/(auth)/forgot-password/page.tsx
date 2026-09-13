"use client";

import { FormEvent, useState } from "react";
import { ArrowLeft, Mail, Send } from "lucide-react";
import Image from "next/image";
import Link from "next/link";

import { supabase } from "@/lib/supabase-client";

/**
 * RECUPERO PASSWORD - RICHIESTA
 * ==============================
 * La pagina di login linka /forgot-password da sempre, ma la route non
 * esisteva: il link portava a un 404.
 *
 * `resetPasswordForEmail` manda la mail di recupero e riporta l'utente
 * su /reset-password. `redirectTo` si costruisce da
 * `window.location.origin` invece che da una variabile d'ambiente cosi'
 * funziona identico in locale, in preview e in produzione; l'unica cosa
 * da fare e' inserire gli URL corrispondenti fra i Redirect URL del
 * progetto Supabase (Authentication -> URL Configuration).
 *
 * Il messaggio di esito e' sempre lo stesso, anche quando l'email non
 * appartiene a nessun account: dire "questa email non esiste"
 * trasformerebbe la pagina in un modo per scoprire chi e' registrato.
 */
export default function ForgotPasswordPage() {
  const [email, setEmail] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [inviata, setInviata] = useState(false);
  const [errore, setErrore] = useState<string | null>(null);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (isLoading) {
      return;
    }

    setIsLoading(true);
    setErrore(null);

    try {
      const { error } = await supabase.auth.resetPasswordForEmail(
        email.trim(),
        {
          redirectTo: `${window.location.origin}/reset-password`,
        }
      );

      /*
       * Un errore qui non e' "email sconosciuta" (Supabase risponde ok
       * anche in quel caso) ma un problema vero: rate limit o SMTP.
       */
      if (error) {
        setErrore(
          error.status === 429
            ? "Troppi tentativi ravvicinati. Riprova fra qualche minuto."
            : "Non e' stato possibile inviare l'email. Riprova."
        );

        return;
      }

      setInviata(true);
    } catch (error) {
      console.error("Errore durante il recupero password:", error);

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
            Password dimenticata
          </h1>

          <p className="mt-2 text-base text-zinc-400">
            Inserisci la tua email: ti mandiamo un link per
            impostare una nuova password.
          </p>
        </div>

        {inviata ? (
          <div className="space-y-5">
            <div
              role="status"
              className="rounded-xl border border-[#b8d3d9]/40 bg-[#b8d3d9]/10 px-4 py-4 text-sm leading-6 text-[#b8d3d9]"
            >
              Se l&apos;indirizzo <strong>{email.trim()}</strong> e&apos;
              associato a un account, riceverai a breve un&apos;email con
              il link per reimpostare la password. Controlla anche la
              cartella spam: il link vale un&apos;ora sola.
            </div>

            <button
              type="button"
              onClick={() => {
                setInviata(false);
                setErrore(null);
              }}
              className="w-full rounded-xl border border-white/15 px-5 py-3 text-sm font-bold text-zinc-300 transition hover:bg-white/5"
            >
              Invia di nuovo
            </button>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-5">
            <div>
              <label
                htmlFor="forgot-email"
                className="mb-2 block text-sm font-medium sm:text-base"
              >
                Email
              </label>

              <div className="flex items-center gap-3 rounded-xl border border-white/15 bg-black/20 px-4 py-3 transition focus-within:border-[#b8d3d9] sm:gap-4 sm:px-5 sm:py-4">
                <Mail className="shrink-0 text-zinc-400" size={20} />

                <input
                  id="forgot-email"
                  name="email"
                  type="email"
                  required
                  autoComplete="email"
                  placeholder="Inserisci la tua email"
                  value={email}
                  onChange={(event) => setEmail(event.target.value)}
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
              className="flex w-full items-center justify-center gap-2 rounded-xl bg-[#b8d3d9] px-5 py-3 text-base font-bold text-[#101010] transition hover:bg-[#b9151b] hover:text-white disabled:cursor-not-allowed disabled:opacity-60 sm:py-4 sm:text-lg"
            >
              <Send size={20} />
              {isLoading ? "Invio in corso..." : "Invia il link"}
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
