"use client";

import Link from "next/link";
import Image from "next/image";
import {
  registraUtente,
  verificaProfiloRegistrazione,
} from "./actions";
import {
  FormEvent,
  ReactNode,
  useEffect,
  useMemo,
  useState,
} from "react";
import {
  AlertCircle,
  CheckCircle2,
  Eye,
  EyeOff,
  Flag,
  Loader2,
  Lock,
  Mail,
  ShieldCheck,
  Target,
  User,
  UserCheck,
  Users,
} from "lucide-react";

type VerificationStatus =
  | "idle"
  | "checking"
  | "authorized"
  | "unauthorized"
  | "error";

export default function RegisterPage() {
  const [nome, setNome] = useState("");
  const [cognome, setCognome] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confermaPassword, setConfermaPassword] = useState("");

  const [mostraPassword, setMostraPassword] = useState(false);
  const [mostraConfermaPassword, setMostraConfermaPassword] =
    useState(false);

  const [verificationStatus, setVerificationStatus] =
    useState<VerificationStatus>("idle");

  const [verificationMessage, setVerificationMessage] = useState("");
  const [submitMessage, setSubmitMessage] = useState("");
  const [submitSuccess, setSubmitSuccess] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const nomeCompletoCompilato =
    nome.trim().length > 0 &&
    cognome.trim().length > 0 &&
    email.trim().length > 0;

  const emailValida = useMemo(() => {
    return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim());
  }, [email]);

  const passwordValida = password.length >= 8;

  const passwordCoincidono =
    confermaPassword.length > 0 &&
    password === confermaPassword;

  const canSubmit =
    verificationStatus === "authorized" &&
    passwordValida &&
    passwordCoincidono &&
    !isSubmitting &&
    !submitSuccess;

  useEffect(() => {
    setVerificationStatus("idle");
    setVerificationMessage("");
    setSubmitMessage("");
    setSubmitSuccess(false);
  }, [nome, cognome, email]);

  useEffect(() => {
    if (!nomeCompletoCompilato || !emailValida) {
      return;
    }

    let requestCancelled = false;

    const timeoutId = window.setTimeout(async () => {
      setVerificationStatus("checking");
      setVerificationMessage("Verifica del profilo in corso...");

      try {
        const result = await verificaProfiloRegistrazione({
          nome: nome.trim(),
          cognome: cognome.trim(),
          email: email.trim().toLowerCase(),
        });

        if (requestCancelled) {
          return;
        }

        if (result.success) {
          setVerificationStatus("authorized");
          setVerificationMessage(result.message);
        } else {
          setVerificationStatus("unauthorized");
          setVerificationMessage(result.message);
        }
      } catch (error) {
        console.error(
          "Errore durante la verifica del profilo:",
          error
        );

        if (requestCancelled) {
          return;
        }

        setVerificationStatus("error");
        setVerificationMessage(
          "Si è verificato un errore durante la verifica del profilo."
        );
      }
    }, 600);

    return () => {
      requestCancelled = true;
      window.clearTimeout(timeoutId);
    };
  }, [
    nome,
    cognome,
    email,
    nomeCompletoCompilato,
    emailValida,
  ]);

  async function handleSubmit(
    event: FormEvent<HTMLFormElement>
  ) {
    event.preventDefault();

    if (!canSubmit) {
      return;
    }

    setIsSubmitting(true);
    setSubmitMessage("");
    setSubmitSuccess(false);

    try {
      const result = await registraUtente({
        nome: nome.trim(),
        cognome: cognome.trim(),
        email: email.trim().toLowerCase(),
        password,
        confermaPassword,
      });

      setSubmitMessage(result.message);
      setSubmitSuccess(result.success);

      if (result.success) {
        setPassword("");
        setConfermaPassword("");
      }
    } catch (error) {
      console.error(
        "Errore durante la registrazione:",
        error
      );

      setSubmitMessage(
        "Si è verificato un errore durante la registrazione."
      );
      setSubmitSuccess(false);
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <main className="relative min-h-screen overflow-hidden bg-[#050505] text-white">
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_left,#4289ff_0%,transparent_32%),radial-gradient(circle_at_right,#1f1f1f_0%,transparent_35%)]" />

      <div className="relative grid min-h-screen grid-cols-1 lg:grid-cols-[0.85fr_1.15fr]">
        {/* Pannello sinistro desktop */}
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
                  <span className="text-[#b8d3d9]">
                    RUGBY COACH
                  </span>
                </h1>
              </div>
            </div>
          </div>

          <div className="absolute bottom-0 left-0 h-[55%] w-full bg-gradient-to-t from-black via-[#b8d3d9]/35 to-transparent" />

          <div className="absolute bottom-10 left-14 z-10 flex flex-wrap gap-4 text-xs uppercase tracking-widest text-zinc-400">
            <span className="flex items-center gap-2">
              <ShieldCheck
                size={18}
                className="text-[#b8d3d9]"
              />
              Rispetto
            </span>

            <span className="flex items-center gap-2">
              <Users
                size={18}
                className="text-[#b8d3d9]"
              />
              Squadra
            </span>

            <span className="flex items-center gap-2">
              <Target
                size={18}
                className="text-[#b8d3d9]"
              />
              Determinazione
            </span>

            <span className="flex items-center gap-2">
              <Flag
                size={18}
                className="text-[#b8d3d9]"
              />
              Passione
            </span>
          </div>
        </section>

        {/* Pannello destro registrazione */}
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
              <span className="text-[#b8d3d9]">
                RUGBY COACH
              </span>
            </h1>
          </div>

          {/* Card registrazione */}
          <div className="relative w-full max-w-[620px] overflow-hidden rounded-[28px] border border-[#b8d3d9]/80 bg-[#171717]/85 p-5 shadow-2xl backdrop-blur-xl sm:p-7 lg:w-[58%] lg:max-w-[620px]">
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
                  Crea il tuo account
                </h2>

                <p className="mt-2 text-base text-zinc-400 sm:text-lg">
                  Registrati al gestionale Fabio Chiesa Rugby
                </p>

                <p className="mt-2 text-xs leading-5 text-zinc-500 sm:text-sm">
                  La registrazione è disponibile solo per gli
                  utenti già autorizzati dal club.
                </p>
              </div>

              <form
                onSubmit={handleSubmit}
                className="space-y-3"
              >
                <div className="grid grid-cols-1 gap-5 sm:grid-cols-2">
                  <Field
                    id="nome"
                    label="Nome"
                    value={nome}
                    onChange={setNome}
                    autoComplete="given-name"
                    placeholder="Inserisci il nome"
                    icon={
                      <User
                        className="shrink-0 text-zinc-400"
                        size={20}
                      />
                    }
                  />

                  <Field
                    id="cognome"
                    label="Cognome"
                    value={cognome}
                    onChange={setCognome}
                    autoComplete="family-name"
                    placeholder="Inserisci il cognome"
                    icon={
                      <User
                        className="shrink-0 text-zinc-400"
                        size={20}
                      />
                    }
                  />
                </div>

                <Field
                  id="email"
                  label="Email"
                  value={email}
                  onChange={setEmail}
                  type="email"
                  autoComplete="email"
                  placeholder="Inserisci la tua email"
                  icon={
                    <Mail
                      className="shrink-0 text-zinc-400"
                      size={20}
                    />
                  }
                />

                {nomeCompletoCompilato && !emailValida && (
                  <StatusMessage
                    type="error"
                    message="Inserisci un indirizzo email valido."
                  />
                )}

                {verificationStatus === "checking" && (
                  <StatusMessage
                    type="loading"
                    message={verificationMessage}
                  />
                )}

                {verificationStatus === "authorized" && (
                  <StatusMessage
                    type="success"
                    message={verificationMessage}
                  />
                )}

                {(verificationStatus === "unauthorized" ||
                  verificationStatus === "error") && (
                  <StatusMessage
                    type="error"
                    message={verificationMessage}
                  />
                )}

                <PasswordField
                  id="password"
                  label="Password"
                  value={password}
                  onChange={setPassword}
                  visible={mostraPassword}
                  onToggleVisibility={() =>
                    setMostraPassword(
                      (current) => !current
                    )
                  }
                  autoComplete="new-password"
                  placeholder="Inserisci la password"
                />

                {password.length > 0 &&
                  !passwordValida && (
                    <p className="text-xs font-medium text-red-400">
                      La password deve contenere almeno 8
                      caratteri.
                    </p>
                  )}

                <PasswordField
                  id="conferma-password"
                  label="Conferma password"
                  value={confermaPassword}
                  onChange={setConfermaPassword}
                  visible={mostraConfermaPassword}
                  onToggleVisibility={() =>
                    setMostraConfermaPassword(
                      (current) => !current
                    )
                  }
                  autoComplete="new-password"
                  placeholder="Conferma la password"
                />

                {confermaPassword.length > 0 &&
                  !passwordCoincidono && (
                    <p className="text-xs font-medium text-red-400">
                      Le password non coincidono.
                    </p>
                  )}

                {submitMessage && (
                  <StatusMessage
                    type={
                      submitSuccess
                        ? "success"
                        : "error"
                    }
                    message={submitMessage}
                  />
                )}

                <button
                  type="submit"
                  disabled={!canSubmit}
                  className={[
                    "flex w-full items-center justify-center gap-2 rounded-xl px-5 py-3 text-base font-bold transition sm:py-4 sm:text-lg",
                    canSubmit
                      ? "bg-[#b8d3d9] text-[#101010] hover:bg-[#b9151b] hover:text-white"
                      : "cursor-not-allowed bg-[#b8d3d9]/20 text-zinc-500",
                  ].join(" ")}
                >
                  {isSubmitting ? (
                    <>
                      <Loader2
                        className="animate-spin"
                        size={20}
                      />
                      Registrazione in corso...
                    </>
                  ) : (
                    <>
                      <UserCheck size={20} />
                      Registrati
                    </>
                  )}
                </button>

                {verificationStatus !== "authorized" && (
                  <p className="text-center text-xs leading-5 text-zinc-500">
                    Il pulsante sarà disponibile dopo la
                    verifica di nome, cognome ed email.
                  </p>
                )}

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
                    Hai già un account?
                  </p>

                  <Link
                    href="/login"
                    className="flex w-full items-center justify-center gap-2 rounded-xl border border-[#b8d3d9]/70 bg-[#b8d3d9]/10 px-5 py-3 text-base font-bold text-[#b8d3d9] transition hover:bg-[#b8d3d9] hover:text-[#101010] sm:py-4 sm:text-lg"
                  >
                    <UserCheck size={20} />
                    Accedi
                  </Link>
                </div>
              </form>
            </div>
          </div>

          <p className="mt-6 text-center text-xs text-zinc-600 sm:text-sm">
            © 2024 Fabio Chiesa Rugby Club | Sine metu
            usque ad metam
          </p>
        </section>
      </div>
    </main>
  );
}

type FieldProps = {
  id: string;
  label: string;
  value: string;
  onChange: (value: string) => void;
  type?: string;
  placeholder?: string;
  autoComplete?: string;
  icon: ReactNode;
};

function Field({
  id,
  label,
  value,
  onChange,
  type = "text",
  placeholder,
  autoComplete,
  icon,
}: FieldProps) {
  return (
    <div>
      <label
        htmlFor={id}
        className="mb-2 block text-sm font-medium sm:text-base"
      >
        {label}
      </label>

      <div className="flex items-center gap-3 rounded-xl border border-white/15 bg-black/20 px-4 py-3 transition focus-within:border-[#b8d3d9] sm:gap-4 sm:px-5 sm:py-4">
        {icon}

        <input
          id={id}
          name={id}
          type={type}
          value={value}
          onChange={(event) =>
            onChange(event.target.value)
          }
          placeholder={placeholder}
          autoComplete={autoComplete}
          required
          className="w-full min-w-0 bg-transparent text-base outline-none placeholder:text-zinc-500 sm:text-lg"
        />
      </div>
    </div>
  );
}

type PasswordFieldProps = {
  id: string;
  label: string;
  value: string;
  onChange: (value: string) => void;
  visible: boolean;
  onToggleVisibility: () => void;
  autoComplete?: string;
  placeholder?: string;
};

function PasswordField({
  id,
  label,
  value,
  onChange,
  visible,
  onToggleVisibility,
  autoComplete,
  placeholder,
}: PasswordFieldProps) {
  return (
    <div>
      <label
        htmlFor={id}
        className="mb-2 block text-sm font-medium sm:text-base"
      >
        {label}
      </label>

      <div className="flex items-center gap-3 rounded-xl border border-white/15 bg-black/20 px-4 py-3 transition focus-within:border-[#b8d3d9] sm:gap-4 sm:px-5 sm:py-4">
        <Lock
          className="shrink-0 text-zinc-400"
          size={20}
        />

        <input
          id={id}
          name={id}
          type={visible ? "text" : "password"}
          value={value}
          onChange={(event) =>
            onChange(event.target.value)
          }
          autoComplete={autoComplete}
          placeholder={placeholder}
          required
          minLength={8}
          className="w-full min-w-0 bg-transparent text-base outline-none placeholder:text-zinc-500 sm:text-lg"
        />

        <button
          type="button"
          onClick={onToggleVisibility}
          aria-label={
            visible
              ? "Nascondi password"
              : "Mostra password"
          }
          aria-pressed={visible}
          className="shrink-0 text-zinc-400 transition hover:text-white"
        >
          {visible ? (
            <EyeOff size={20} />
          ) : (
            <Eye size={20} />
          )}
        </button>
      </div>
    </div>
  );
}

type StatusMessageProps = {
  type: "success" | "error" | "loading";
  message: string;
};

function StatusMessage({
  type,
  message,
}: StatusMessageProps) {
  const config = {
    success: {
      icon: (
        <CheckCircle2 className="h-5 w-5 shrink-0" />
      ),
      className:
        "border-emerald-500/30 bg-emerald-500/10 text-emerald-300",
    },
    error: {
      icon: (
        <AlertCircle className="h-5 w-5 shrink-0" />
      ),
      className:
        "border-red-500/30 bg-red-500/10 text-red-300",
    },
    loading: {
      icon: (
        <Loader2 className="h-5 w-5 shrink-0 animate-spin" />
      ),
      className:
        "border-[#b8d3d9]/30 bg-[#b8d3d9]/10 text-[#b8d3d9]",
    },
  } as const;

  return (
    <div
      role={type === "error" ? "alert" : "status"}
      className={`flex items-start gap-3 rounded-xl border px-4 py-3 text-sm ${config[type].className}`}
    >
      {config[type].icon}

      <p className="leading-5">
        {message}
      </p>
    </div>
  );
}