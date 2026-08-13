"use client";

import Link from "next/link";
import { useState, useTransition } from "react";
import { ArrowLeft, ExternalLink, FileText, Loader2, Paperclip, Trash2 } from "lucide-react";
import { AppCard } from "@/components/ui/AppCard";
import { DateInput } from "@/components/ui/DateInput";
import { formatDataIT } from "@/lib/date";
import {
  aggiungiValutazioneFisioterapista,
  aggiungiValutazioneMedico,
  aggiungiValutazionePreparatore,
  aggiornaInfortunio,
  eliminaInfortunio,
  eliminaValutazioneInfortunio,
} from "@/app/(dashboard)/infortuni/actions";
import { useRouter } from "next/navigation";

type Infortunio = {
  id: string;
  data_infortunio: string;
  tipo_infortunio: string;
  data_rientro: string | null;
  stato: string;
  giocatori: {
    id: string;
    nome: string | null;
    cognome: string | null;
  } | null;
  squadre: {
    id: string;
    nome: string | null;
  } | null;
};

type Medico = {
  id: string;
  medico_nome: string | null;
  medico_data_valutazione: string;
  medico_terapia: string | null;
  medico_commento: string | null;
  medico_link_documentazione: { url: string; nome: string }[];
};

type Fisioterapista = {
  id: string;
  fisioterapista_nome: string | null;
  fisioterapista_data_visita: string;
  fisioterapista_commento: string | null;
};

type Preparatore = {
  id: string;
  preparatore_nome: string | null;
  preparatore_data_valutazione: string;
  preparatore_allenamento_recupero_infortunio: string | null;
  preparatore_commento: string | null;
};

type Props = {
  infortunio: Infortunio;
  medico: Medico[];
  fisioterapista: Fisioterapista[];
  preparatore: Preparatore[];
  isAdmin: boolean;
};

const tabs = ["Dettagli Infortunio", "Medico", "Fisioterapista", "Preparatore"];

export default function InfortunioDetailClient({
  infortunio,
  medico,
  fisioterapista,
  preparatore,
  isAdmin,
}: Props) {
  const router = useRouter();
  const [activeTab, setActiveTab] = useState(tabs[0]);
  const [isPending, startTransition] = useTransition();

  function handleDelete() {
    const conferma = window.confirm("Vuoi eliminare questo infortunio?");
    if (!conferma) return;

    startTransition(async () => {
      await eliminaInfortunio(infortunio.id);
      router.push("/infortuni");
    });
  }

  return (
    <div className="space-y-4 sm:space-y-6">
      <div className="flex flex-col justify-between gap-3 sm:gap-4 md:flex-row md:items-center">
        <div>
          <Link
            href="/infortuni"
            className="mb-2 inline-flex min-h-10 items-center gap-2 text-sm text-zinc-400 hover:text-white sm:mb-3"
          >
            <ArrowLeft className="h-4 w-4" />
            Torna agli infortuni
          </Link>

          <h1 className="break-words text-xl font-semibold leading-tight text-white sm:text-2xl">
            {infortunio.giocatori?.cognome} {infortunio.giocatori?.nome}
          </h1>

          <p className="mt-1 break-words text-xs leading-5 text-zinc-400 sm:text-sm">
            {infortunio.tipo_infortunio} · {infortunio.squadre?.nome ?? "-"}
          </p>
        </div>

        {isAdmin && (
          <button
            onClick={handleDelete}
            disabled={isPending}
            className="inline-flex min-h-11 w-full items-center justify-center gap-2 rounded-xl border border-red-500/30 px-4 py-2 text-sm font-semibold text-red-300 hover:bg-red-500/10 sm:w-auto"
          >
            <Trash2 className="h-4 w-4" />
            Elimina
          </button>
        )}
      </div>

      <div className="-mx-1 flex gap-2 overflow-x-auto px-1 pb-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden sm:mx-0 sm:flex-wrap sm:px-0 sm:pb-0">
        {tabs.map((tab) => (
          <button
            key={tab}
            onClick={() => setActiveTab(tab)}
            className={`min-h-10 shrink-0 whitespace-nowrap rounded-xl px-4 py-2 text-sm font-medium transition ${
              activeTab === tab
                ? "bg-white text-zinc-950"
                : "bg-zinc-900 text-zinc-400 hover:text-white"
            }`}
          >
            {tab}
          </button>
        ))}
      </div>

      {activeTab === "Dettagli Infortunio" && (
        <DettagliTab infortunio={infortunio} isAdmin={isAdmin} />
      )}

      {activeTab === "Medico" && (
        <MedicoTab
          infortunioId={infortunio.id}
          valutazioni={medico}
          isAdmin={isAdmin}
        />
      )}

      {activeTab === "Fisioterapista" && (
        <FisioterapistaTab
          infortunioId={infortunio.id}
          valutazioni={fisioterapista}
          isAdmin={isAdmin}
        />
      )}

      {activeTab === "Preparatore" && (
        <PreparatoreTab
          infortunioId={infortunio.id}
          valutazioni={preparatore}
          isAdmin={isAdmin}
        />
      )}
    </div>
  );
}

function DettagliTab({
  infortunio,
  isAdmin,
}: {
  infortunio: Infortunio;
  isAdmin: boolean;
}) {
  const [isPending, startTransition] = useTransition();

  function handleSubmit(formData: FormData) {
    startTransition(async () => {
      await aggiornaInfortunio(infortunio.id, formData);
    });
  }

  return (
    <AppCard>
      <form action={handleSubmit} className="grid gap-4 md:grid-cols-2">
        <div>
          <label className="mb-1 block text-sm text-zinc-300">
            Tipo infortunio
          </label>
          <input
            name="tipo_infortunio"
            defaultValue={infortunio.tipo_infortunio}
            disabled={!isAdmin}
            className="min-h-11 w-full rounded-xl border border-zinc-700 bg-zinc-950 px-3 py-2 text-base text-white disabled:cursor-not-allowed disabled:opacity-60 sm:text-sm"
          />
        </div>

        <div>
          <label className="mb-1 block text-sm text-zinc-300">Stato</label>
          <select
            name="stato"
            defaultValue={infortunio.stato}
            disabled={!isAdmin}
            className="min-h-11 w-full rounded-xl border border-zinc-700 bg-zinc-950 px-3 py-2 text-base text-white disabled:cursor-not-allowed disabled:opacity-60 sm:text-sm"
          >
            <option value="infortunato">Infortunato</option>
            <option value="in_valutazione">In valutazione</option>
            <option value="riabilitazione">Riabilitazione</option>
            <option value="recupero">Recupero</option>
            <option value="rientrato">Rientrato</option>
          </select>
        </div>

        <div>
          <DateInput
            label="Data infortunio"
            name="data_infortunio"
            defaultValue={infortunio.data_infortunio}
            disabled={!isAdmin}
            wrapperClassName="min-h-11 rounded-xl border-zinc-700 bg-zinc-950"
          />
        </div>

        <div>
          <DateInput
            label="Data rientro"
            name="data_rientro"
            defaultValue={infortunio.data_rientro ?? ""}
            disabled={!isAdmin}
            wrapperClassName="min-h-11 rounded-xl border-zinc-700 bg-zinc-950"
          />
        </div>

        {isAdmin && (
          <div className="flex justify-end md:col-span-2">
            <button
              disabled={isPending}
              className="inline-flex min-h-11 w-full items-center justify-center gap-2 rounded-xl bg-emerald-500 px-4 py-2 text-sm font-semibold text-white disabled:opacity-60 sm:w-auto"
            >
              {isPending && <Loader2 className="h-4 w-4 animate-spin" />}
              Aggiorna dettagli
            </button>
          </div>
        )}
      </form>
    </AppCard>
  );
}

function MedicoTab({
  infortunioId,
  valutazioni,
  isAdmin,
}: {
  infortunioId: string;
  valutazioni: Medico[];
  isAdmin: boolean;
}) {
  return (
    <LogTab
      title="Nuova valutazione medico"
      isAdmin={isAdmin}
      action={(formData) => aggiungiValutazioneMedico(infortunioId, formData)}
      onDelete={(id) =>
        eliminaValutazioneInfortunio(infortunioId, id, "medico")
      }
      fields={
        <>
          <input name="medico_nome" placeholder="Nome medico" className={input} />
          <DateInput name="medico_data_valutazione" required wrapperClassName={input} />
          <textarea name="medico_terapia" placeholder="Terapia" className={textarea} />
          <textarea name="medico_commento" placeholder="Commento" className={textarea} />
          <textarea
            name="medico_link_documentazione"
            placeholder="Link documentazione, uno per riga"
            className={textarea}
          />
          <label className="block rounded-xl border border-dashed border-zinc-700 bg-zinc-950 p-4 transition hover:border-zinc-500">
            <span className="flex items-center gap-2 text-sm font-semibold text-zinc-300">
              <Paperclip className="h-4 w-4" />
              Allega PDF, immagine o video
            </span>
            <input
              type="file"
              name="medico_allegato"
              accept="application/pdf,image/*,video/*"
              className="mt-3 block w-full text-sm text-zinc-400 file:mr-3 file:rounded-lg file:border-0 file:bg-zinc-800 file:px-3 file:py-2 file:font-semibold file:text-white hover:file:bg-zinc-700"
            />
            <span className="mt-2 block text-xs text-zinc-500">
              PDF, qualsiasi immagine o video · massimo 50 MB
            </span>
          </label>
        </>
      }
      items={valutazioni.map((v) => ({
        id: v.id,
        title: v.medico_nome ?? "Medico",
        date: v.medico_data_valutazione,
        body: v.medico_commento,
        extra: v.medico_terapia,
        links: v.medico_link_documentazione,
      }))}
    />
  );
}

function FisioterapistaTab({
  infortunioId,
  valutazioni,
  isAdmin,
}: {
  infortunioId: string;
  valutazioni: Fisioterapista[];
  isAdmin: boolean;
}) {
  return (
    <LogTab
      title="Nuova visita fisioterapista"
      isAdmin={isAdmin}
      action={(formData) =>
        aggiungiValutazioneFisioterapista(infortunioId, formData)
      }
      onDelete={(id) =>
        eliminaValutazioneInfortunio(infortunioId, id, "fisioterapista")
      }
      fields={
        <>
          <input
            name="fisioterapista_nome"
            placeholder="Nome fisioterapista"
            className={input}
          />
          <DateInput
            name="fisioterapista_data_visita"
            required
            wrapperClassName={input}
          />
          <textarea
            name="fisioterapista_commento"
            placeholder="Commento"
            className={textarea}
          />
        </>
      }
      items={valutazioni.map((v) => ({
        id: v.id,
        title: v.fisioterapista_nome ?? "Fisioterapista",
        date: v.fisioterapista_data_visita,
        body: v.fisioterapista_commento,
      }))}
    />
  );
}

function PreparatoreTab({
  infortunioId,
  valutazioni,
  isAdmin,
}: {
  infortunioId: string;
  valutazioni: Preparatore[];
  isAdmin: boolean;
}) {
  return (
    <LogTab
      title="Nuova valutazione preparatore"
      isAdmin={isAdmin}
      action={(formData) =>
        aggiungiValutazionePreparatore(infortunioId, formData)
      }
      onDelete={(id) =>
        eliminaValutazioneInfortunio(infortunioId, id, "preparatore")
      }
      fields={
        <>
          <input
            name="preparatore_nome"
            placeholder="Nome preparatore"
            className={input}
          />
          <DateInput
            name="preparatore_data_valutazione"
            required
            wrapperClassName={input}
          />
          <textarea
            name="preparatore_allenamento_recupero_infortunio"
            placeholder="Allenamento recupero infortunio"
            className={textarea}
          />
          <textarea
            name="preparatore_commento"
            placeholder="Commento"
            className={textarea}
          />
        </>
      }
      items={valutazioni.map((v) => ({
        id: v.id,
        title: v.preparatore_nome ?? "Preparatore",
        date: v.preparatore_data_valutazione,
        body: v.preparatore_commento,
        extra: v.preparatore_allenamento_recupero_infortunio,
      }))}
    />
  );
}

function LogTab({
  title,
  fields,
  items,
  action,
  onDelete,
  isAdmin,
}: {
  title: string;
  fields: React.ReactNode;
  items: {
    id: string;
    title: string;
    date: string;
    body?: string | null;
    extra?: string | null;
    links?: { url: string; nome: string }[];
  }[];
  action: (formData: FormData) => Promise<void>;
  onDelete: (id: string) => Promise<void>;
  isAdmin: boolean;
}) {
  const [isPending, startTransition] = useTransition();
  const [erroreInvio, setErroreInvio] = useState<string | null>(null);
  const [eliminazioneId, setEliminazioneId] = useState<string | null>(null);

  function handleSubmit(formData: FormData) {
    startTransition(async () => {
      setErroreInvio(null);
      try {
        await action(formData);
      } catch (error) {
        setErroreInvio(
          error instanceof Error
            ? error.message
            : "Impossibile salvare la valutazione. Riprova."
        );
      }
    });
  }

  function eliminaNota(id: string) {
    if (!window.confirm("Eliminare questa valutazione dallo storico?")) return;

    startTransition(async () => {
      setErroreInvio(null);
      setEliminazioneId(id);
      try {
        await onDelete(id);
      } catch (error) {
        setErroreInvio(
          error instanceof Error
            ? error.message
            : "Impossibile eliminare la valutazione."
        );
      } finally {
        setEliminazioneId(null);
      }
    });
  }

  return (
    <div
      className={`grid gap-4 sm:gap-6 ${
        isAdmin ? "lg:grid-cols-[420px_1fr]" : ""
      }`}
    >
      {isAdmin && (
        <AppCard>
          <h2 className="mb-4 text-base font-semibold text-white sm:text-lg">{title}</h2>

          <form action={handleSubmit} className="space-y-3">
            {fields}

            {erroreInvio && (
              <p className="rounded-xl border border-red-500/30 bg-red-500/10 px-3 py-2 text-sm text-red-300">
                {erroreInvio}
              </p>
            )}

            <button
              disabled={isPending}
              className="inline-flex min-h-11 w-full items-center justify-center gap-2 rounded-xl bg-emerald-500 px-4 py-2 text-sm font-semibold text-white disabled:opacity-60"
            >
              {isPending && <Loader2 className="h-4 w-4 animate-spin" />}
              Aggiungi valutazione
            </button>
          </form>
        </AppCard>
      )}

      <AppCard>
        <h2 className="mb-4 text-base font-semibold text-white sm:text-lg">
          Storico valutazioni
        </h2>

        <div className="space-y-4">
          {items.map((item) => (
            <div
              key={item.id}
              className="rounded-xl border border-zinc-800 bg-zinc-950 p-3 sm:p-4"
            >
              <div className="mb-2 flex flex-col gap-1 sm:flex-row sm:items-start sm:justify-between sm:gap-4">
                <h3 className="break-words font-semibold text-white">{item.title}</h3>
                <div className="flex shrink-0 items-center gap-2">
                  <span className="text-xs text-zinc-500 sm:text-sm">
                    {formatDataIT(item.date)}
                  </span>
                  {isAdmin && (
                    <button
                      type="button"
                      onClick={() => eliminaNota(item.id)}
                      disabled={isPending || eliminazioneId === item.id}
                      title="Elimina valutazione"
                      className="flex h-8 w-8 items-center justify-center rounded-lg text-zinc-500 transition hover:bg-red-500/15 hover:text-red-400 disabled:opacity-50"
                    >
                      {eliminazioneId === item.id ? (
                        <Loader2 className="h-4 w-4 animate-spin" />
                      ) : (
                        <Trash2 className="h-4 w-4" />
                      )}
                    </button>
                  )}
                </div>
              </div>

              {item.extra && (
                <p className="mb-2 whitespace-pre-wrap text-sm text-zinc-300">
                  {item.extra}
                </p>
              )}

              {item.body && (
                <p className="whitespace-pre-wrap text-sm text-zinc-400">
                  {item.body}
                </p>
              )}

              {item.links && item.links.length > 0 && (
                <div className="mt-3 space-y-1">
                  {item.links.map((link) => (
                    <a
                      key={`${link.url}-${link.nome}`}
                      href={link.url}
                      target="_blank"
                      rel="noreferrer"
                      className="flex items-center gap-2 rounded-lg border border-zinc-800 bg-zinc-900 px-3 py-2 text-sm text-emerald-400 transition hover:border-emerald-500/40 hover:text-emerald-300"
                    >
                      <FileText className="h-4 w-4 shrink-0" />
                      <span className="min-w-0 flex-1 truncate">{link.nome}</span>
                      <ExternalLink className="h-3.5 w-3.5 shrink-0" />
                    </a>
                  ))}
                </div>
              )}
            </div>
          ))}

          {items.length === 0 && (
            <p className="rounded-xl border border-dashed border-zinc-800 p-6 text-center text-sm text-zinc-500">
              Nessuna valutazione registrata.
            </p>
          )}
        </div>
      </AppCard>
    </div>
  );
}

const input =
  "min-h-11 w-full rounded-xl border border-zinc-700 bg-zinc-950 px-3 py-2 text-base text-white placeholder:text-zinc-500 sm:text-sm";

const textarea =
  "min-h-28 w-full resize-y rounded-xl border border-zinc-700 bg-zinc-950 px-3 py-2 text-base text-white placeholder:text-zinc-500 sm:min-h-24 sm:text-sm";
