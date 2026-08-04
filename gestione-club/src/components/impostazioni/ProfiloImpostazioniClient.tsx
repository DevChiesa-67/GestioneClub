"use client";

import { useMemo, useState } from "react";
import Image from "next/image";
import { User, Mail, Shield, Save, Loader2, LayoutGrid } from "lucide-react";
import {
  aggiornaProfiloPersonale,
  aggiornaPreferenzaVistaLavori,
} from "@/app/(dashboard)/impostazioni/actions";
import { AppCard } from "@/components/ui/AppCard";

type Profilo = {
  id: string;
  nome: string | null;
  cognome: string | null;
  email: string;
  tipo_profilo: string | null;
  club_id: string | null;
};

type Club = {
  id: string | null;
  nome: string;
  logo_url: string | null;
  colore: string;
  preferenzaVistaLavori: "card" | "tabella";
};

type Props = {
  profilo: Profilo;
  club: Club;
};

export default function ProfiloImpostazioniClient({ profilo, club }: Props) {
  const [nome, setNome] = useState(profilo.nome ?? "");
  const [cognome, setCognome] = useState(profilo.cognome ?? "");
  const [loading, setLoading] = useState(false);
  const [messaggio, setMessaggio] = useState<string | null>(null);
  const [errore, setErrore] = useState<string | null>(null);

  const isAdmin = String(profilo.tipo_profilo || "").toLowerCase() === "admin";

  const [preferenzaVista, setPreferenzaVista] = useState<"card" | "tabella">(
    club.preferenzaVistaLavori
  );
  const [salvandoPreferenza, setSalvandoPreferenza] = useState(false);
  const [messaggioPreferenza, setMessaggioPreferenza] = useState<string | null>(
    null
  );
  const [erroreVista, setErroreVista] = useState<string | null>(null);

  async function salvaPreferenzaVista(valore: "card" | "tabella") {
    if (!club.id) {
      setErroreVista("Nessun club associato al profilo.");
      return;
    }

    const precedente = preferenzaVista;
    setPreferenzaVista(valore);
    setSalvandoPreferenza(true);
    setMessaggioPreferenza(null);
    setErroreVista(null);

    const result = await aggiornaPreferenzaVistaLavori(club.id, valore);

    setSalvandoPreferenza(false);

    if (!result.success) {
      setPreferenzaVista(precedente);
      setErroreVista(result.message);
      return;
    }

    setMessaggioPreferenza("Preferenza aggiornata correttamente.");
  }

  const iniziali = useMemo(() => {
    const inizialeNome = nome.trim()?.[0] ?? "";
    const inizialeCognome = cognome.trim()?.[0] ?? "";

    if (inizialeNome || inizialeCognome) {
      return `${inizialeNome}${inizialeCognome}`.toUpperCase();
    }

    return profilo.email?.slice(0, 2).toUpperCase() ?? "U";
  }, [nome, cognome, profilo.email]);

  const nomeVisualizzato = useMemo(() => {
    return `${nome} ${cognome}`.trim() || "Profilo utente";
  }, [nome, cognome]);

  async function salvaProfilo() {
  setLoading(true);
  setMessaggio(null);
  setErrore(null);

  const result = await aggiornaProfiloPersonale({
    nome,
    cognome,
  });

  setLoading(false);

  if (!result.success) {
    setErrore(result.message);
    return;
  }

  setMessaggio("Profilo aggiornato correttamente.");
}

  return (
    <div className="grid gap-6">
    <div className="grid gap-6 lg:grid-cols-[1fr_360px]">
      <AppCard>
        <div className="mb-6 flex items-center gap-3">
          <div
            className="flex h-11 w-11 items-center justify-center rounded-2xl text-white shadow-lg"
            style={{ backgroundColor: club.colore }}
          >
            <User size={22} />
          </div>

          <div>
            <h2 className="text-lg font-semibold text-zinc-100">
              Profilo personale
            </h2>
            <p className="text-sm text-zinc-400">
              Modifica le informazioni associate al tuo account.
            </p>
          </div>
        </div>

        <div className="grid gap-5">
          <div>
            <label className="mb-2 block text-sm font-medium text-zinc-300">
              Nome
            </label>
            <input
              value={nome}
              onChange={(e) => setNome(e.target.value)}
              className="w-full rounded-xl border border-zinc-800 bg-zinc-950 px-4 py-3 text-sm text-zinc-100 outline-none transition focus:border-zinc-500"
              placeholder={profilo.nome || "Inserisci il tuo nome"}
            />
          </div>

          <div>
            <label className="mb-2 block text-sm font-medium text-zinc-300">
              Cognome
            </label>
            <input
              value={cognome}
              onChange={(e) => setCognome(e.target.value)}
              className="w-full rounded-xl border border-zinc-800 bg-zinc-950 px-4 py-3 text-sm text-zinc-100 outline-none transition focus:border-zinc-500"
              placeholder={profilo.cognome || "Inserisci il tuo cognome"}
            />
          </div>

          <div>
            <label className="mb-2 block text-sm font-medium text-zinc-300">
              Email
            </label>
            <div className="flex items-center gap-3 rounded-xl border border-zinc-800 bg-zinc-950 px-4 py-3 text-sm text-zinc-400">
              <Mail size={18} />
              <span>{profilo.email}</span>
            </div>
            <p className="mt-2 text-xs text-zinc-500">
              L’email è collegata all’account Supabase e non viene modificata da
              questa pagina.
            </p>
          </div>

          <div>
            <label className="mb-2 block text-sm font-medium text-zinc-300">
              Ruolo
            </label>
            <div className="flex items-center gap-3 rounded-xl border border-zinc-800 bg-zinc-950 px-4 py-3 text-sm text-zinc-400">
              <Shield size={18} />
              <span>{profilo.tipo_profilo || "Ruolo non assegnato"}</span>
            </div>
          </div>

          {errore && (
            <div className="rounded-xl border border-red-900/60 bg-red-950/30 px-4 py-3 text-sm text-red-300">
              {errore}
            </div>
          )}

          {messaggio && (
            <div className="rounded-xl border border-emerald-900/60 bg-emerald-950/30 px-4 py-3 text-sm text-emerald-300">
              {messaggio}
            </div>
          )}

          <div className="flex justify-end">
            <button
              type="button"
              onClick={salvaProfilo}
              disabled={loading}
              className="inline-flex items-center gap-2 rounded-xl px-5 py-3 text-sm font-semibold text-white shadow-lg transition disabled:cursor-not-allowed disabled:opacity-60"
              style={{ backgroundColor: club.colore }}
            >
              {loading ? (
                <Loader2 size={18} className="animate-spin" />
              ) : (
                <Save size={18} />
              )}
              Salva modifiche
            </button>
          </div>
        </div>
      </AppCard>

      <AppCard>
        <div className="flex flex-col items-center text-center">
          <div
            className="mb-4 flex h-24 w-24 items-center justify-center overflow-hidden rounded-3xl text-2xl font-bold text-white shadow-xl"
            style={{ backgroundColor: club.colore }}
          >
            {club.logo_url ? (
              <Image
                src={club.logo_url}
                alt={club.nome}
                width={96}
                height={96}
                className="h-full w-full object-cover"
              />
            ) : (
              iniziali
            )}
          </div>

          <h3 className="text-lg font-semibold text-zinc-100">
            {nomeVisualizzato}
          </h3>

          <p className="mt-1 text-sm text-zinc-400">{profilo.email}</p>

          <div className="mt-5 w-full rounded-2xl border border-zinc-800 bg-zinc-950 p-4">
            <p className="text-xs uppercase tracking-wide text-zinc-500">
              Club corrente
            </p>
            <p className="mt-1 text-sm font-medium text-zinc-200">
              {club.nome}
            </p>
          </div>

          <div className="mt-3 w-full rounded-2xl border border-zinc-800 bg-zinc-950 p-4">
            <p className="text-xs uppercase tracking-wide text-zinc-500">
              Profilo
            </p>
            <p className="mt-1 text-sm font-medium text-zinc-200">
              {profilo.tipo_profilo || "Non assegnato"}
            </p>
          </div>
        </div>
      </AppCard>
    </div>

      {isAdmin && (
        <AppCard>
          <div className="mb-5 flex items-center gap-3">
            <div
              className="flex h-11 w-11 items-center justify-center rounded-2xl text-white shadow-lg"
              style={{ backgroundColor: club.colore }}
            >
              <LayoutGrid size={22} />
            </div>

            <div>
              <h2 className="text-lg font-semibold text-zinc-100">
                Creazione seduta di allenamento
              </h2>
              <p className="text-sm text-zinc-400">
                Vista predefinita usata da tutti gli utenti del club quando
                creano una seduta.
              </p>
            </div>
          </div>

          <div className="grid gap-4 md:grid-cols-2">
            <label
              className={`flex cursor-pointer items-center gap-4 rounded-2xl border p-4 transition ${
                preferenzaVista === "card"
                  ? "border-zinc-400 bg-zinc-800/60"
                  : "border-zinc-800 bg-zinc-950 hover:border-zinc-600"
              }`}
            >
              <input
                type="radio"
                name="preferenza_vista_lavori"
                value="card"
                checked={preferenzaVista === "card"}
                onChange={() => salvaPreferenzaVista("card")}
                disabled={salvandoPreferenza}
                className="h-4 w-4 accent-zinc-200"
              />

              <span>
                <span className="block font-semibold text-zinc-100">
                  Vista card
                </span>
                <span className="mt-1 block text-sm text-zinc-400">
                  Un lavoro alla volta, con tutti i campi visibili.
                </span>
              </span>
            </label>

            <label
              className={`flex cursor-pointer items-center gap-4 rounded-2xl border p-4 transition ${
                preferenzaVista === "tabella"
                  ? "border-zinc-400 bg-zinc-800/60"
                  : "border-zinc-800 bg-zinc-950 hover:border-zinc-600"
              }`}
            >
              <input
                type="radio"
                name="preferenza_vista_lavori"
                value="tabella"
                checked={preferenzaVista === "tabella"}
                onChange={() => salvaPreferenzaVista("tabella")}
                disabled={salvandoPreferenza}
                className="h-4 w-4 accent-zinc-200"
              />

              <span>
                <span className="block font-semibold text-zinc-100">
                  Vista tabella
                </span>
                <span className="mt-1 block text-sm text-zinc-400">
                  Griglia con orario calcolato, per compilare più lavori di
                  fila.
                </span>
              </span>
            </label>
          </div>

          {erroreVista && (
            <div className="mt-4 rounded-xl border border-red-900/60 bg-red-950/30 px-4 py-3 text-sm text-red-300">
              {erroreVista}
            </div>
          )}

          {messaggioPreferenza && !erroreVista && (
            <div className="mt-4 rounded-xl border border-emerald-900/60 bg-emerald-950/30 px-4 py-3 text-sm text-emerald-300">
              {messaggioPreferenza}
            </div>
          )}
        </AppCard>
      )}
    </div>
  );
}