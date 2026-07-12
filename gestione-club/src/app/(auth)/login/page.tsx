"use client";

import { FormEvent, useState } from "react";
import {
  Eye,
  EyeOff,
  Lock,
  ShieldCheck,
  Target,
  UserPlus,
  Users,
  User,
  Flag,
} from "lucide-react";
import { supabase } from "@/lib/supabase-client";
import Image from "next/image";
import Link from "next/link";

export default function LoginPage() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [loginError, setLoginError] = useState<string | null>(null);

  async function handleLogin(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (isLoading) {
      return;
    }

    setIsLoading(true);
    setLoginError(null);

    try {
      const { error } = await supabase.auth.signInWithPassword({
        email: email.trim(),
        password,
      });

      if (error) {
        setLoginError(error.message);
        return;
      }

      window.location.href = "/dashboard";
    } catch (error) {
      console.error("Errore durante il login:", error);

      setLoginError(
        "Si è verificato un errore durante l'accesso. Riprova."
      );
    } finally {
      setIsLoading(false);
    }
  }

  return (
    <main className="relative min-h-screen overflow-hidden bg-[#050505] text-white">
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_left,#4289ff_0%,transparent_32%),radial-gradient(circle_at_right,#1f1f1f_0%,transparent_35%)]" />

      <div className="relative grid min-h-screen grid-cols-1 lg:grid-cols-[0.85fr_1.15fr]">
        {/* ── Pannello sinistro: solo desktop ── */}
        <section className="relative hidden overflow-hidden lg:block">
          <div className="absolute inset-0 bg-gradient-to-r from-black/20 via-black/10 to-[#050505]" />

          <div className="relative z-10 p-16">
            <div className="flex items-center gap-5">
              <div className="flex h-32 w-32 items-center justify-center">
                <Image
                  src="/images/fabio-chiesa.com.png"
                  alt="Fabio Chiesa Rugby logo"
                  width={120}
                  height={120}
                  priority
                  className="object-contain"
                />
              </div>

              <div>
                <h1 className="text-4xl font-black leading-none">
                  FABIO CHIESA
                  <br />
                  <span className="text-[#b8d3d9]">RUGBY COACH</span>
                </h1>
              </div>
            </div>
          </div>

          <div className="absolute bottom-0 left-0 h-[55%] w-full bg-gradient-to-t from-black via-[#b8d3d9]/35 to-transparent" />

          <div className="absolute bottom-10 left-14 z-10 flex flex-wrap gap-4 text-xs uppercase tracking-widest text-zinc-400">
            <span className="flex items-center gap-2">
              <ShieldCheck size={18} className="text-[#b8d3d9]" />
              Rispetto
            </span>

            <span className="flex items-center gap-2">
              <Users size={18} className="text-[#b8d3d9]" />
              Squadra
            </span>

            <span className="flex items-center gap-2">
              <Target size={18} className="text-[#b8d3d9]" />
              Determinazione
            </span>

            <span className="flex items-center gap-2">
              <Flag size={18} className="text-[#b8d3d9]" />
              Passione
            </span>
          </div>
        </section>

        {/* ── Pannello destro: form ── */}
        <section className="relative flex flex-col items-center justify-center px-4 py-10 sm:px-6 sm:py-12">
          <div className="absolute right-[-120px] top-1/2 hidden h-[520px] w-[520px] -translate-y-1/2" />

          <div className="pointer-events-none absolute right-0 top-0 opacity-[0.4]">
            <Image
              src="/images/fabio-chiesa-half.png"
              alt=""
              aria-hidden="true"
              width={900}
              height={900}
              className="object-contain"
            />
          </div>

          {/* Logo mobile */}
          <div className="mb-8 flex flex-col items-center gap-4 lg:hidden">
            <div className="flex h-20 w-20 items-center justify-center">
              <Image
                src="/images/fabio-chiesa.com.png"
                alt="Fabio Chiesa Rugby logo"
                width={80}
                height={80}
                priority
                className="object-contain"
              />
            </div>

            <h1 className="text-center text-2xl font-black leading-tight">
              FABIO CHIESA{" "}
              <span className="text-[#b8d3d9]">RUGBY COACH</span>
            </h1>
          </div>

          {/* Card form */}
          <div className="relative w-full max-w-lg overflow-hidden rounded-[28px] border border-[#b8d3d9]/80 bg-[#171717]/85 p-6 shadow-2xl backdrop-blur-xl sm:p-10 md:p-12 lg:w-[50%] lg:max-w-2xl">
            <div className="relative z-10">
              <div className="mb-8 text-center">
                <div className="mx-auto mb-5 hidden h-24 w-24 items-center justify-center overflow-hidden lg:flex">
                  <Image
                    src="/images/fabio-chiesa.com.png"
                    alt="Fabio Chiesa Rugby logo"
                    width={108}
                    height={108}
                    className="object-contain"
                  />
                </div>

                <h2 className="text-3xl font-black sm:text-4xl">
                  Bentornato!
                </h2>

                <p className="mt-2 text-base text-zinc-400 sm:text-lg">
                  Accedi al gestionale Fabio Chiesa Rugby
                </p>
              </div>

              <form onSubmit={handleLogin} className="space-y-5">
                <div>
                  <label
                    htmlFor="login-email"
                    className="mb-2 block text-sm font-medium sm:text-base"
                  >
                    Email o nome utente
                  </label>

                  <div className="flex items-center gap-3 rounded-xl border border-white/15 bg-black/20 px-4 py-3 transition focus-within:border-[#b8d3d9] sm:gap-4 sm:px-5 sm:py-4">
                    <User
                      className="shrink-0 text-zinc-400"
                      size={20}
                    />

                    <input
                      id="login-email"
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

                <div>
                  <label
                    htmlFor="login-password"
                    className="mb-2 block text-sm font-medium sm:text-base"
                  >
                    Password
                  </label>

                  <div className="flex items-center gap-3 rounded-xl border border-white/15 bg-black/20 px-4 py-3 transition focus-within:border-[#b8d3d9] sm:gap-4 sm:px-5 sm:py-4">
                    <Lock
                      className="shrink-0 text-zinc-400"
                      size={20}
                    />

                    <input
                      id="login-password"
                      name="password"
                      type={showPassword ? "text" : "password"}
                      required
                      autoComplete="current-password"
                      placeholder="Inserisci la tua password"
                      value={password}
                      onChange={(event) => setPassword(event.target.value)}
                      className="w-full bg-transparent text-base outline-none placeholder:text-zinc-500 sm:text-lg"
                    />

                    <button
                      type="button"
                      onClick={() => setShowPassword((current) => !current)}
                      className="shrink-0 text-zinc-400 transition hover:text-white"
                      aria-label={
                        showPassword
                          ? "Nascondi password"
                          : "Mostra password"
                      }
                      aria-pressed={showPassword}
                    >
                      {showPassword ? (
                        <EyeOff size={20} />
                      ) : (
                        <Eye size={20} />
                      )}
                    </button>
                  </div>
                </div>

                <div className="flex items-center justify-between text-xs text-zinc-400 sm:text-sm">
                  <label className="flex cursor-pointer items-center gap-2">
                    <input
                      type="checkbox"
                      className="h-4 w-4 accent-[#b8d3d9] sm:h-5 sm:w-5"
                    />
                    Ricordami
                  </label>

                  <Link
                    href="/forgot-password"
                    className="text-[#ff2630] hover:underline"
                  >
                    Password dimenticata?
                  </Link>
                </div>

                {loginError && (
                  <div
                    role="alert"
                    className="rounded-xl border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-300"
                  >
                    {loginError}
                  </div>
                )}

                <button
                  type="submit"
                  disabled={isLoading}
                  className="w-full rounded-xl bg-[#b8d3d9] px-5 py-3 text-base font-bold text-[#101010] transition hover:bg-[#b9151b] hover:text-white disabled:cursor-not-allowed disabled:opacity-60 sm:py-4 sm:text-lg"
                >
                  {isLoading ? "Accesso in corso..." : "Accedi"}
                </button>

                <div className="relative py-2">
                  <div className="absolute inset-0 flex items-center">
                    <div className="w-full border-t border-white/10" />
                  </div>

                  <div className="relative flex justify-center">
                    <span className="bg-[#171717] px-4 text-xs uppercase tracking-wider text-zinc-500">
                      oppure
                    </span>
                  </div>
                </div>

                <div className="text-center">
                  <p className="mb-3 text-sm text-zinc-400 sm:text-base">
                    Non hai ancora un account?
                  </p>

                  <Link
                    href="/register"
                    className="flex w-full items-center justify-center gap-2 rounded-xl border border-[#b8d3d9]/70 bg-[#b8d3d9]/10 px-5 py-3 text-base font-bold text-[#b8d3d9] transition hover:bg-[#b8d3d9] hover:text-[#101010] sm:py-4 sm:text-lg"
                  >
                    <UserPlus size={20} />
                    Registrati
                  </Link>

                  <p className="mt-3 text-xs leading-5 text-zinc-500">
                    Puoi registrarti solo se il tuo profilo è già stato
                    inserito da un amministratore.
                  </p>
                </div>
              </form>
            </div>
          </div>

          <p className="mt-6 text-center text-xs text-zinc-600 sm:text-sm">
            © 2024 Fabio Chiesa Rugby Club | Sine metu usque ad metam
          </p>
        </section>
      </div>
    </main>
  );
}