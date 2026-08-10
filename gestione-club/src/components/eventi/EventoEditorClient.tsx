"use client";

import Image from "next/image";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useMemo, useState } from "react";
import {
  ArrowLeft,
  CalendarDays,
  Check,
  Clock,
  Loader2,
  MapPin,
  Pencil,
  Search,
  Sparkles,
  Trash2,
  UserRound,
  Users,
  X,
} from "lucide-react";

import { useToast } from "@/components/ui/Toast";
import { DateInput } from "@/components/ui/DateInput";
import {
  aggiornaEvento,
  eliminaEvento,
  impostaConvocazioneEvento,
} from "@/app/(dashboard)/eventi/actions";
import type {
  ConvocazioneEvento,
  EventoDettaglio,
  GiocatoreEvento,
  TipoEventoOption,
} from "@/app/(dashboard)/eventi/[id]/page";

type Props = {
  evento: EventoDettaglio;
  giocatori: GiocatoreEvento[];
  convocazioni: ConvocazioneEvento[];
  tipiEventi: TipoEventoOption[];
  coloreClub: string;
  isAdmin: boolean;
};

function formatData(data: string) {
  return new Intl.DateTimeFormat("it-IT", {
    weekday: "long",
    day: "2-digit",
    month: "long",
    year: "numeric",
  }).format(new Date(`${data}T12:00:00`));
}

function formatRangeDate(evento: EventoDettaglio) {
  if (!evento.data_fine || evento.data_fine === evento.data_inizio) {
    return formatData(evento.data_inizio);
  }

  const inizio = new Intl.DateTimeFormat("it-IT", {
    day: "2-digit",
    month: "short",
  }).format(new Date(`${evento.data_inizio}T12:00:00`));

  const fine = new Intl.DateTimeFormat("it-IT", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  }).format(new Date(`${evento.data_fine}T12:00:00`));

  return `${inizio} — ${fine}`;
}

function GiocatoreAvatar({
  giocatore,
}: {
  giocatore: GiocatoreEvento;
}) {
  const iniziali =
    `${giocatore.nome.charAt(0)}${giocatore.cognome.charAt(0)}`.toUpperCase();

  if (giocatore.foto_url) {
    return (
      <div className="relative h-10 w-10 shrink-0 overflow-hidden rounded-full border border-zinc-700 bg-zinc-900">
        <Image
          src={giocatore.foto_url}
          alt={`${giocatore.nome} ${giocatore.cognome}`}
          fill
          sizes="40px"
          className="object-cover"
        />
      </div>
    );
  }

  return (
    <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full border border-zinc-700 bg-zinc-900 text-xs font-bold text-zinc-300">
      {iniziali}
    </div>
  );
}

export default function EventoEditorClient({
  evento,
  giocatori,
  convocazioni,
  tipiEventi,
  coloreClub,
  isAdmin,
}: Props) {
  const router = useRouter();
  const { showToast } = useToast();

  const [convocazioniMap, setConvocazioniMap] = useState<
    Record<string, boolean>
  >(() => {
    const mappa: Record<string, boolean> = {};
    for (const c of convocazioni) {
      mappa[c.giocatore_id] = c.convocato;
    }
    return mappa;
  });

  const [salvandoId, setSalvandoId] = useState<string | null>(null);
  const [ricerca, setRicerca] = useState("");
  const [eliminando, setEliminando] = useState(false);

  const [modalModificaAperto, setModalModificaAperto] = useState(false);
  const [salvandoModifica, setSalvandoModifica] = useState(false);
  const [erroreModifica, setErroreModifica] = useState<string | null>(null);
  const [titoloModifica, setTitoloModifica] = useState(evento.titolo);
  const [tipoModifica, setTipoModifica] = useState(evento.tipo_evento_id);
  const [dataInizioModifica, setDataInizioModifica] = useState(
    evento.data_inizio
  );
  const [dataFineModifica, setDataFineModifica] = useState(
    evento.data_fine ?? ""
  );
  const [oraModifica, setOraModifica] = useState(evento.ora_inizio ?? "");
  const [luogoModifica, setLuogoModifica] = useState(evento.luogo ?? "");
  const [noteModifica, setNoteModifica] = useState(evento.note ?? "");

  const coloreTipo = evento.tipo_evento?.colore || coloreClub;

  const giocatoriFiltrati = useMemo(() => {
    const termine = ricerca.trim().toLowerCase();
    if (!termine) return giocatori;

    return giocatori.filter((g) =>
      `${g.nome} ${g.cognome}`.toLowerCase().includes(termine)
    );
  }, [giocatori, ricerca]);

  const totaleConvocati = useMemo(
    () => Object.values(convocazioniMap).filter(Boolean).length,
    [convocazioniMap]
  );

  async function toggleConvocazione(giocatoreId: string) {
    if (!isAdmin) return;

    const nuovoStato = !convocazioniMap[giocatoreId];

    setConvocazioniMap((prev) => ({ ...prev, [giocatoreId]: nuovoStato }));
    setSalvandoId(giocatoreId);

    const result = await impostaConvocazioneEvento(
      evento.id,
      giocatoreId,
      nuovoStato
    );

    setSalvandoId(null);

    if (!result.success) {
      setConvocazioniMap((prev) => ({ ...prev, [giocatoreId]: !nuovoStato }));
      showToast({ type: "error", message: result.message });
    }
  }

  async function handleElimina() {
    const confermato = window.confirm(
      `Eliminare l'evento "${evento.titolo}"? L'operazione non è reversibile.`
    );

    if (!confermato) return;

    setEliminando(true);
    const result = await eliminaEvento(evento.id);
    setEliminando(false);

    if (!result.success) {
      showToast({ type: "error", message: result.message });
      return;
    }

    showToast({ type: "success", message: result.message });
    router.push("/partite");
  }

  async function handleSalvaModifica(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();

    if (!titoloModifica.trim()) {
      setErroreModifica("Inserisci il titolo dell'evento.");
      return;
    }

    if (!dataInizioModifica) {
      setErroreModifica("Indica la data di inizio.");
      return;
    }

    setSalvandoModifica(true);
    setErroreModifica(null);

    const formData = new FormData();
    formData.set("id", evento.id);
    formData.set("titolo", titoloModifica.trim());
    formData.set("tipo_evento_id", tipoModifica);
    formData.set("data_inizio", dataInizioModifica);
    formData.set("data_fine", dataFineModifica);
    formData.set("ora_inizio", oraModifica);
    formData.set("luogo", luogoModifica.trim());
    formData.set("note", noteModifica.trim());

    const result = await aggiornaEvento(formData);

    setSalvandoModifica(false);

    if (!result.success) {
      setErroreModifica(result.message);
      return;
    }

    showToast({ type: "success", message: result.message });
    setModalModificaAperto(false);
    router.refresh();
  }

  return (
    <div className="space-y-5">
      <Link
        href="/partite"
        className="inline-flex items-center gap-2 text-sm font-semibold text-zinc-400 transition hover:text-white"
      >
        <ArrowLeft className="h-4 w-4" />
        Torna a Partite
      </Link>

      <div
        className="overflow-hidden rounded-3xl border border-zinc-800 bg-zinc-950 shadow-xl"
        style={{ boxShadow: `0 0 32px ${coloreTipo}12` }}
      >
        <div className="flex flex-col gap-4 border-b border-zinc-800 bg-zinc-900 px-5 py-5 sm:flex-row sm:items-start sm:justify-between">
          <div className="min-w-0">
            <span
              className="mb-3 inline-flex items-center gap-1.5 rounded-full border px-3 py-1 text-xs font-black uppercase tracking-wider"
              style={{
                borderColor: `${coloreTipo}55`,
                backgroundColor: `${coloreTipo}18`,
                color: coloreTipo,
              }}
            >
              <Sparkles className="h-3.5 w-3.5" />
              {evento.tipo_evento?.nome || "Evento"}
            </span>

            <h1 className="text-2xl font-black text-white sm:text-3xl">
              {evento.titolo}
            </h1>

            <div className="mt-3 flex flex-wrap items-center gap-x-5 gap-y-2 text-sm text-zinc-300">
              <span className="flex items-center gap-2">
                <CalendarDays
                  className="h-4 w-4"
                  style={{ color: coloreTipo }}
                />
                {formatRangeDate(evento)}
              </span>

              {evento.ora_inizio && (
                <span className="flex items-center gap-2">
                  <Clock className="h-4 w-4" style={{ color: coloreTipo }} />
                  {evento.ora_inizio.slice(0, 5)}
                </span>
              )}

              <span className="flex items-center gap-2">
                <MapPin className="h-4 w-4" style={{ color: coloreTipo }} />
                {evento.luogo || "Luogo da definire"}
              </span>
            </div>

            {evento.note && (
              <p className="mt-3 max-w-2xl text-sm leading-6 text-zinc-400">
                {evento.note}
              </p>
            )}
          </div>

          {isAdmin && (
            <div className="flex shrink-0 items-center gap-2">
              <button
                type="button"
                onClick={() => {
                  setErroreModifica(null);
                  setModalModificaAperto(true);
                }}
                className="flex h-10 items-center gap-2 rounded-xl border border-zinc-800 bg-zinc-950 px-3 text-sm font-semibold text-zinc-300 transition hover:border-zinc-600 hover:text-white"
              >
                <Pencil className="h-4 w-4" />
                Modifica
              </button>

              <button
                type="button"
                onClick={handleElimina}
                disabled={eliminando}
                className="flex h-10 items-center gap-2 rounded-xl border border-zinc-800 bg-zinc-950 px-3 text-sm font-semibold text-zinc-300 transition hover:border-red-500/40 hover:text-red-400 disabled:cursor-not-allowed disabled:opacity-50"
              >
                {eliminando ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Trash2 className="h-4 w-4" />
                )}
                Elimina
              </button>
            </div>
          )}
        </div>
      </div>

      <div className="overflow-hidden rounded-3xl border border-zinc-800 bg-zinc-950">
        <div className="flex flex-col gap-4 border-b border-zinc-800 p-4 sm:flex-row sm:items-center sm:justify-between sm:p-5">
          <div className="flex items-center gap-3">
            <div
              className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border"
              style={{
                borderColor: `${coloreTipo}44`,
                backgroundColor: `${coloreTipo}16`,
              }}
            >
              <Users className="h-5 w-5" style={{ color: coloreTipo }} />
            </div>

            <div>
              <h2 className="text-base font-black text-white sm:text-lg">
                Convocazioni
              </h2>

              <p className="text-xs text-zinc-500 sm:text-sm">
                {totaleConvocati} / {giocatori.length} convocati
              </p>
            </div>
          </div>

          <label className="relative block sm:w-64">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-zinc-500" />

            <input
              value={ricerca}
              onChange={(e) => setRicerca(e.target.value)}
              placeholder="Cerca giocatore..."
              className="min-h-10 w-full rounded-xl border border-zinc-800 bg-zinc-900 pl-9 pr-3 text-sm text-white outline-none transition placeholder:text-zinc-600 focus:border-zinc-600"
            />
          </label>
        </div>

        {giocatoriFiltrati.length === 0 ? (
          <div className="flex flex-col items-center justify-center px-4 py-14 text-center">
            <UserRound className="mb-3 h-10 w-10 text-zinc-700" />
            <h3 className="font-semibold text-white">
              Nessun giocatore trovato
            </h3>
          </div>
        ) : (
          <div className="divide-y divide-zinc-900">
            {giocatoriFiltrati.map((giocatore) => {
              const convocato = Boolean(convocazioniMap[giocatore.id]);
              const salvando = salvandoId === giocatore.id;

              return (
                <div
                  key={giocatore.id}
                  className="flex items-center justify-between gap-3 px-4 py-3 sm:px-5"
                >
                  <div className="flex min-w-0 items-center gap-3">
                    <GiocatoreAvatar giocatore={giocatore} />

                    <p className="truncate text-sm font-semibold text-white">
                      {giocatore.nome} {giocatore.cognome}
                    </p>
                  </div>

                  {isAdmin ? (
                    <button
                      type="button"
                      onClick={() => toggleConvocazione(giocatore.id)}
                      disabled={salvando}
                      className="flex h-9 min-w-24 shrink-0 items-center justify-center gap-1.5 rounded-xl px-3 text-xs font-bold transition disabled:cursor-not-allowed disabled:opacity-60"
                      style={
                        convocato
                          ? { backgroundColor: coloreTipo, color: "#fff" }
                          : {
                              backgroundColor: "#18181b",
                              color: "#a1a1aa",
                              border: "1px solid #27272a",
                            }
                      }
                    >
                      {salvando ? (
                        <Loader2 className="h-3.5 w-3.5 animate-spin" />
                      ) : convocato ? (
                        <Check className="h-3.5 w-3.5" />
                      ) : null}
                      {convocato ? "Convocato" : "Non convocato"}
                    </button>
                  ) : (
                    <span
                      className="shrink-0 rounded-xl px-3 py-1.5 text-xs font-bold"
                      style={
                        convocato
                          ? { backgroundColor: `${coloreTipo}18`, color: coloreTipo }
                          : { backgroundColor: "#18181b", color: "#71717a" }
                      }
                    >
                      {convocato ? "Convocato" : "Non convocato"}
                    </span>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>

      {modalModificaAperto && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 p-4 backdrop-blur-sm">
          <div
            className="relative max-h-[90vh] w-full max-w-2xl overflow-y-auto rounded-3xl border bg-zinc-950 p-4 shadow-2xl sm:p-6"
            style={{ borderColor: `${coloreClub}80` }}
          >
            <div className="mb-6 flex items-start justify-between gap-4">
              <h2 className="text-xl font-black text-white">
                Modifica evento
              </h2>

              <button
                type="button"
                onClick={() => setModalModificaAperto(false)}
                className="rounded-xl p-2 text-zinc-400 transition hover:bg-zinc-900 hover:text-white"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <form onSubmit={handleSalvaModifica} className="grid gap-5">
              <input
                value={titoloModifica}
                onChange={(e) => setTitoloModifica(e.target.value)}
                placeholder="Titolo evento"
                className="rounded-xl border bg-zinc-900 px-3 py-2 text-sm text-white outline-none"
                style={{ borderColor: `${coloreClub}45` }}
              />

              <div>
                <label className="mb-1 block text-sm font-medium text-zinc-300">
                  Tipologia
                </label>

                <div className="flex flex-wrap gap-2">
                  {tipiEventi.map((tipo) => {
                    const active = tipoModifica === tipo.id;

                    return (
                      <button
                        key={tipo.id}
                        type="button"
                        onClick={() => setTipoModifica(tipo.id)}
                        className="rounded-xl border px-3 py-2 text-sm font-bold transition hover:opacity-90"
                        style={{
                          borderColor: active
                            ? tipo.colore || coloreClub
                            : `${tipo.colore || coloreClub}35`,
                          backgroundColor: active
                            ? tipo.colore || coloreClub
                            : `${tipo.colore || coloreClub}12`,
                          color: "#ffffff",
                        }}
                      >
                        {tipo.nome}
                      </button>
                    );
                  })}
                </div>
              </div>

              <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
                <DateInput
                  label="Data inizio"
                  value={dataInizioModifica}
                  onChange={setDataInizioModifica}
                  required
                  wrapperClassName="bg-zinc-900"
                  wrapperStyle={{ borderColor: `${coloreClub}45` }}
                />

                <DateInput
                  label="Data fine (facoltativa)"
                  value={dataFineModifica}
                  onChange={setDataFineModifica}
                  wrapperClassName="bg-zinc-900"
                  wrapperStyle={{ borderColor: `${coloreClub}45` }}
                />

                <div>
                  <label className="mb-1 block text-sm font-medium text-zinc-300">
                    Ora inizio
                  </label>

                  <input
                    type="time"
                    value={oraModifica}
                    onChange={(e) => setOraModifica(e.target.value)}
                    className="w-full rounded-xl border bg-zinc-900 px-3 py-2 text-sm text-white outline-none transition"
                    style={{ borderColor: `${coloreClub}45` }}
                  />
                </div>
              </div>

              <input
                value={luogoModifica}
                onChange={(e) => setLuogoModifica(e.target.value)}
                placeholder="Luogo"
                className="rounded-xl border bg-zinc-900 px-3 py-2 text-sm text-white outline-none"
                style={{ borderColor: `${coloreClub}45` }}
              />

              <textarea
                value={noteModifica}
                onChange={(e) => setNoteModifica(e.target.value)}
                placeholder="Note (facoltative)"
                rows={3}
                className="resize-none rounded-xl border bg-zinc-900 px-3 py-2 text-sm text-white outline-none"
                style={{ borderColor: `${coloreClub}45` }}
              />

              {erroreModifica && (
                <p className="rounded-xl border border-red-500/30 bg-red-500/10 px-3 py-2 text-sm text-red-400">
                  {erroreModifica}
                </p>
              )}

              <div className="flex justify-end gap-3">
                <button
                  type="button"
                  onClick={() => setModalModificaAperto(false)}
                  className="rounded-xl border px-4 py-2 text-sm font-medium text-zinc-300 transition hover:text-white"
                  style={{ borderColor: `${coloreClub}45` }}
                >
                  Annulla
                </button>

                <button
                  type="submit"
                  disabled={salvandoModifica}
                  className="rounded-xl px-4 py-2 text-sm font-semibold text-white transition hover:scale-[1.02] hover:opacity-90 disabled:opacity-60"
                  style={{
                    background: `linear-gradient(135deg, ${coloreClub}, ${coloreClub}cc)`,
                    boxShadow: `0 0 20px ${coloreClub}45`,
                  }}
                >
                  {salvandoModifica ? "Salvataggio..." : "Salva modifiche"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
