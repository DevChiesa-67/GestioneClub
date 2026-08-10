"use client";

import Image from "next/image";
import { useMemo, useState, useTransition } from "react";
import {
  Trash2,
  PlayCircle,
  Loader2,
  Pencil,
  X,
  Save,
  Plus,
  ChevronDown,
  ChevronRight,
} from "lucide-react";
import { AppCard } from "@/components/ui/AppCard";
import {
  creaVideoFile,
  eliminaVideoFile,
  aggiornaVideoFile,
} from "@/app/(dashboard)/file/actions";
import { creaTipoEvento } from "@/app/(dashboard)/eventi/actions";

type Partita = {
  id: string;
  avversario: string | null;
  data_partita: string | null;
};

type Allenamento = {
  id: string;
  titolo: string | null;
  data_allenamento: string | null;
};

type TipoEvento = {
  id: string;
  nome: string;
  colore: string | null;
};

type Evento = {
  id: string;
  titolo: string;
  data_inizio: string;
  tipo_evento_id: string;
  tipo_evento: { id: string; nome: string; colore: string | null } | null;
};

type Persona = {
  id: string;
  nome_completo: string | null;
  email: string | null;
  tipo_profilo: string | null;
};

type Giocatore = {
  id: string;
  nome: string | null;
  cognome: string | null;
  foto_url: string | null;
};

type Video = {
  id: string;
  titolo: string;
  video_path: string;
  signedUrl: string | null;
  tipo_evento: "partita" | "allenamento" | "evento";
  note: string | null;
  visibilita: string;
  created_at: string;
  partita_id: string | null;
  allenamento_id: string | null;
  evento_id: string | null;
  partite?: {
    avversario: string | null;
    data_partita: string | null;
  } | null;
  allenamenti?: {
    titolo: string | null;
    data_allenamento: string | null;
  } | null;
  eventi?: {
    titolo: string | null;
    data_inizio: string | null;
    tipo_evento_id?: string | null;
    tipo_evento: { nome: string | null } | null;
  } | null;
  file_video_destinatari?: {
    profilo_id: string | null;
    giocatore_id?: string | null;
  }[];
};

type Props = {
  isAdmin: boolean;
  video: Video[];
  partite: Partita[];
  allenamenti: Allenamento[];
  eventi: Evento[];
  tipiEventi: TipoEvento[];
  persone: Persona[];
  giocatori: Giocatore[];
};

function eventoLabel(item: Video) {
  if (item.tipo_evento === "partita") {
    return `Partita: ${item.partite?.data_partita ?? ""} ${
      item.partite?.avversario ?? "Evento partita"
    }`;
  }

  if (item.tipo_evento === "evento") {
    const nomeTipo = item.eventi?.tipo_evento?.nome ?? "Evento";
    return `${nomeTipo}: ${item.eventi?.data_inizio ?? ""} ${
      item.eventi?.titolo ?? nomeTipo
    }`;
  }

  return `Allenamento: ${item.allenamenti?.data_allenamento ?? ""} ${
    item.allenamenti?.titolo ?? "Evento allenamento"
  }`;
}

function GiocatoriMultiSelect({
  giocatori,
  defaultSelected = [],
}: {
  giocatori: Giocatore[];
  defaultSelected?: string[];
}) {
  return (
    <div className="md:col-span-2">
      <label className="text-xs font-bold uppercase text-zinc-500">
        Giocatori autorizzati
      </label>

      <div className="mt-2 grid max-h-80 gap-2 overflow-y-auto rounded-2xl border border-zinc-800 bg-zinc-950 p-3 sm:grid-cols-2 lg:grid-cols-3">
        {giocatori.map((giocatore) => {
          const nomeCompleto = `${giocatore.nome ?? ""} ${
            giocatore.cognome ?? ""
          }`.trim();

          return (
            <label
              key={giocatore.id}
              className="flex cursor-pointer items-center gap-3 rounded-2xl border border-zinc-800 bg-zinc-900/70 p-3 hover:border-zinc-600"
            >
              <input
                type="checkbox"
                name="giocatore_ids"
                value={giocatore.id}
                defaultChecked={defaultSelected.includes(giocatore.id)}
                className="h-4 w-4 accent-white"
              />

              <div className="relative h-11 w-11 overflow-hidden rounded-full bg-zinc-800">
                {giocatore.foto_url ? (
                  <Image
                    src={giocatore.foto_url}
                    alt={nomeCompleto || "Giocatore"}
                    fill
                    className="object-cover"
                  />
                ) : (
                  <div className="flex h-full w-full items-center justify-center text-xs font-black text-zinc-400">
                    {(giocatore.nome?.[0] ?? "G").toUpperCase()}
                  </div>
                )}
              </div>

              <p className="truncate text-sm font-bold text-white">
                {nomeCompleto || "Giocatore"}
              </p>
            </label>
          );
        })}
      </div>
    </div>
  );
}

// Valore composito del menu "Tipo evento": "partita" | "allenamento" oppure
// "evento:<tipo_evento_id>" per collegare il video a un torneo/raduno/team
// building di una tipologia specifica.
type TipoEventoValore = "partita" | "allenamento" | "evento";

function componiValoreTipo(tipo: TipoEventoValore, tipoEventoId: string) {
  return tipo === "evento" ? `evento:${tipoEventoId}` : tipo;
}

function scomponiValoreTipo(
  valore: string
): { tipo: TipoEventoValore; tipoEventoId: string } {
  if (valore === "partita" || valore === "allenamento") {
    return { tipo: valore, tipoEventoId: "" };
  }

  return { tipo: "evento", tipoEventoId: valore.replace(/^evento:/, "") };
}

function SelettoreTipoEvento({
  valore,
  onChange,
  tipiEventi,
  onTipiEventiChange,
}: {
  valore: string;
  onChange: (valore: string) => void;
  tipiEventi: TipoEvento[];
  onTipiEventiChange: (tipi: TipoEvento[]) => void;
}) {
  const [mostraForm, setMostraForm] = useState(false);
  const [nome, setNome] = useState("");
  const [colore, setColore] = useState("#f59e0b");
  const [salvando, setSalvando] = useState(false);
  const [errore, setErrore] = useState<string | null>(null);

  async function handleCrea() {
    if (!nome.trim()) return;

    setSalvando(true);
    setErrore(null);

    const formData = new FormData();
    formData.set("nome", nome.trim());
    formData.set("colore", colore);

    const risultato = await creaTipoEvento(formData);

    setSalvando(false);

    if (!risultato.success || !risultato.id) {
      setErrore(risultato.message);
      return;
    }

    const nuovaTipologia: TipoEvento = {
      id: risultato.id,
      nome: nome.trim(),
      colore,
    };

    onTipiEventiChange(
      [...tipiEventi, nuovaTipologia].sort((a, b) =>
        a.nome.localeCompare(b.nome)
      )
    );
    onChange(componiValoreTipo("evento", risultato.id));
    setNome("");
    setMostraForm(false);
  }

  return (
    <div>
      <div className="flex items-center justify-between">
        <label className="text-xs font-bold uppercase text-zinc-500">
          Tipo evento
        </label>

        <button
          type="button"
          onClick={() => setMostraForm((prev) => !prev)}
          className="text-xs font-bold text-zinc-400 hover:text-white"
        >
          {mostraForm ? "Annulla" : "+ Nuova tipologia"}
        </button>
      </div>

      <select
        name="tipo_evento_composito"
        value={valore}
        onChange={(e) => onChange(e.target.value)}
        className="mt-2 w-full rounded-2xl border border-zinc-800 bg-zinc-950 px-4 py-3 text-sm text-white outline-none focus:border-zinc-600"
      >
        <option value="partita">Partita</option>
        <option value="allenamento">Allenamento</option>
        {tipiEventi.length > 0 && (
          <optgroup label="Eventi">
            {tipiEventi.map((tipo) => (
              <option key={tipo.id} value={componiValoreTipo("evento", tipo.id)}>
                {tipo.nome}
              </option>
            ))}
          </optgroup>
        )}
      </select>

      {mostraForm && (
        <div className="mt-2 flex items-center gap-2 rounded-2xl border border-zinc-800 bg-zinc-950 p-3">
          <input
            value={nome}
            onChange={(e) => setNome(e.target.value)}
            placeholder="Es. Torneo, Raduno..."
            className="flex-1 rounded-xl border border-zinc-800 bg-zinc-900 px-3 py-2 text-sm text-white outline-none focus:border-zinc-600"
          />
          <input
            type="color"
            value={colore}
            onChange={(e) => setColore(e.target.value)}
            className="h-9 w-9 shrink-0 cursor-pointer rounded-lg border border-zinc-800 bg-zinc-900"
          />
          <button
            type="button"
            onClick={handleCrea}
            disabled={salvando || !nome.trim()}
            className="shrink-0 rounded-xl bg-white px-3 py-2 text-xs font-black text-zinc-950 disabled:opacity-50"
          >
            {salvando ? "..." : "Crea"}
          </button>
        </div>
      )}

      {errore && <p className="mt-1 text-xs text-red-400">{errore}</p>}
    </div>
  );
}

export default function FileVideoClient({
  isAdmin,
  video,
  partite,
  allenamenti,
  eventi,
  tipiEventi,
  persone,
  giocatori,
}: Props) {
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [openGroups, setOpenGroups] = useState<Record<string, boolean>>({});

  const [tipiEventiLista, setTipiEventiLista] = useState<TipoEvento[]>(
    tipiEventi
  );

  const [tipoValore, setTipoValore] = useState<string>("partita");
  const [visibilita, setVisibilita] = useState("tutti");

  const [editingId, setEditingId] = useState<string | null>(null);
  const [editTipoValore, setEditTipoValore] = useState<string>("partita");
  const [editVisibilita, setEditVisibilita] = useState("tutti");

  const [isPending, startTransition] = useTransition();

  const { tipo: tipoEvento, tipoEventoId: tipoEventoIdSel } =
    scomponiValoreTipo(tipoValore);
  const { tipo: editTipoEvento, tipoEventoId: editTipoEventoIdSel } =
    scomponiValoreTipo(editTipoValore);

  const eventiAssociabili = useMemo(() => {
    if (tipoEvento === "partita") return partite;
    if (tipoEvento === "allenamento") return allenamenti;
    return eventi.filter((e) => e.tipo_evento_id === tipoEventoIdSel);
  }, [tipoEvento, tipoEventoIdSel, partite, allenamenti, eventi]);

  const eventiAssociabiliEdit = useMemo(() => {
    if (editTipoEvento === "partita") return partite;
    if (editTipoEvento === "allenamento") return allenamenti;
    return eventi.filter((e) => e.tipo_evento_id === editTipoEventoIdSel);
  }, [editTipoEvento, editTipoEventoIdSel, partite, allenamenti, eventi]);

  const videoRaggruppati = useMemo(() => {
    return video.reduce<Record<string, Video[]>>((acc, item) => {
      const key = `${item.tipo_evento}-${
        item.partita_id ?? item.allenamento_id ?? item.evento_id ?? item.id
      }`;

      if (!acc[key]) acc[key] = [];
      acc[key].push(item);

      return acc;
    }, {});
  }, [video]);

  function toggleGroup(groupKey: string) {
    setOpenGroups((prev) => ({
      ...prev,
      [groupKey]: !prev[groupKey],
    }));
  }

  function onSubmit(formData: FormData) {
    startTransition(async () => {
      await creaVideoFile(formData);
      setShowCreateForm(false);
    });
  }

  function onDelete(id: string, path: string) {
    if (!window.confirm("Vuoi eliminare questo video?")) return;

    startTransition(async () => {
      await eliminaVideoFile(id, path);
    });
  }

  function startEditing(item: Video) {
    setEditingId(item.id);
    setEditTipoValore(
      item.tipo_evento === "evento" && item.eventi?.tipo_evento_id
        ? componiValoreTipo("evento", item.eventi.tipo_evento_id)
        : item.tipo_evento
    );
    setEditVisibilita(item.visibilita);
  }

  return (
    <div className="space-y-5">
      {isAdmin && (
        <div className="flex justify-end">
          <button
            type="button"
            onClick={() => setShowCreateForm((prev) => !prev)}
            className="inline-flex items-center justify-center gap-2 rounded-2xl bg-white px-5 py-3 text-sm font-black text-zinc-950"
          >
            {showCreateForm ? <X className="h-4 w-4" /> : <Plus className="h-4 w-4" />}
            {showCreateForm ? "Chiudi" : "Aggiungi Video"}
          </button>
        </div>
      )}

      {isAdmin && showCreateForm && (
        <AppCard>
          <form action={onSubmit} className="space-y-5">
            <div>
              <h2 className="text-lg font-black text-white">Carica nuovo video</h2>
              <p className="mt-1 text-sm text-zinc-400">
                Associa il video a una partita o a un allenamento e scegli chi può visualizzarlo.
              </p>
            </div>

            <div className="grid gap-4 md:grid-cols-2">
              <div>
                <label className="text-xs font-bold uppercase text-zinc-500">Titolo</label>
                <input
                  name="titolo"
                  required
                  placeholder="Es. Analisi partita vs..."
                  className="mt-2 w-full rounded-2xl border border-zinc-800 bg-zinc-950 px-4 py-3 text-sm text-white outline-none focus:border-zinc-600"
                />
              </div>

              <div>
                <label className="text-xs font-bold uppercase text-zinc-500">Video</label>
                <input
                  name="video"
                  type="file"
                  accept="video/*"
                  required
                  className="mt-2 w-full rounded-2xl border border-zinc-800 bg-zinc-950 px-4 py-3 text-sm text-zinc-300 outline-none"
                />
              </div>

              <div>
                <input type="hidden" name="tipo_evento" value={tipoEvento} />
                <SelettoreTipoEvento
                  valore={tipoValore}
                  onChange={setTipoValore}
                  tipiEventi={tipiEventiLista}
                  onTipiEventiChange={setTipiEventiLista}
                />
              </div>

              <div>
                <label className="text-xs font-bold uppercase text-zinc-500">Evento associato</label>
                <select
                  name="evento_id"
                  required
                  className="mt-2 w-full rounded-2xl border border-zinc-800 bg-zinc-950 px-4 py-3 text-sm text-white outline-none focus:border-zinc-600"
                >
                  <option value="">Seleziona evento</option>
                  {eventiAssociabili.map((evento) => (
                    <option key={evento.id} value={evento.id}>
                      {tipoEvento === "partita"
                        ? `${(evento as Partita).data_partita ?? ""} - ${
                            (evento as Partita).avversario ?? "Partita"
                          }`
                        : tipoEvento === "allenamento"
                          ? `${(evento as Allenamento).data_allenamento ?? ""} - ${
                              (evento as Allenamento).titolo ?? "Allenamento"
                            }`
                          : `${(evento as Evento).data_inizio ?? ""} - ${
                              (evento as Evento).titolo ?? "Evento"
                            }`}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="text-xs font-bold uppercase text-zinc-500">Visibilità</label>
                <select
                  name="visibilita"
                  value={visibilita}
                  onChange={(e) => setVisibilita(e.target.value)}
                  className="mt-2 w-full rounded-2xl border border-zinc-800 bg-zinc-950 px-4 py-3 text-sm text-white outline-none focus:border-zinc-600"
                >
                  <option value="tutti">Tutti</option>
                  <option value="allenatori">Allenatori</option>
                  <option value="preparatori">Preparatori</option>
                  <option value="giocatori">Giocatori selezionati</option>
                  <option value="persona">Persona specifica</option>
                </select>
              </div>

              {visibilita === "persona" && (
                <div>
                  <label className="text-xs font-bold uppercase text-zinc-500">Persona</label>
                  <select
                    name="persona_id"
                    required
                    className="mt-2 w-full rounded-2xl border border-zinc-800 bg-zinc-950 px-4 py-3 text-sm text-white outline-none focus:border-zinc-600"
                  >
                    <option value="">Seleziona persona</option>
                    {persone.map((persona) => (
                      <option key={persona.id} value={persona.id}>
                        {persona.nome_completo ?? persona.email}
                      </option>
                    ))}
                  </select>
                </div>
              )}

              {visibilita === "giocatori" && (
                <GiocatoriMultiSelect giocatori={giocatori} />
              )}
            </div>

            <div>
              <label className="text-xs font-bold uppercase text-zinc-500">Note</label>
              <textarea
                name="note"
                rows={4}
                placeholder="Note tecniche, punti da rivedere, indicazioni..."
                className="mt-2 w-full resize-none rounded-2xl border border-zinc-800 bg-zinc-950 px-4 py-3 text-sm text-white outline-none focus:border-zinc-600"
              />
            </div>

            <button
              type="submit"
              disabled={isPending}
              className="inline-flex w-full items-center justify-center gap-2 rounded-2xl bg-white px-5 py-3 text-sm font-black text-zinc-950 disabled:opacity-50 sm:w-auto"
            >
              {isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
              Salva video
            </button>
          </form>
        </AppCard>
      )}

      <div className="mx-auto w-full max-w-5xl space-y-3">
        {video.length === 0 ? (
          <AppCard>
            <p className="text-sm text-zinc-400">Nessun video disponibile.</p>
          </AppCard>
        ) : (
          Object.entries(videoRaggruppati).map(([groupKey, items]) => {
            const isOpen = openGroups[groupKey] ?? true;

            return (
              <AppCard key={groupKey}>
                <button
                  type="button"
                  onClick={() => toggleGroup(groupKey)}
                  className="flex w-full items-center justify-between gap-4 text-left"
                >
                  <div>
                    <h2 className="text-sm font-black uppercase tracking-wide text-white">
                      {eventoLabel(items[0])}
                    </h2>
                    <p className="mt-1 text-xs text-zinc-500">{items.length} video</p>
                  </div>

                  <div className="rounded-full border border-zinc-800 bg-zinc-950 p-2 text-zinc-400">
                    {isOpen ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
                  </div>
                </button>

                {isOpen && (
                  <div className="mt-5 grid gap-4">
                    {items.map((item) => {
                      const selectedGiocatori =
                        item.file_video_destinatari
                          ?.map((d) => d.giocatore_id)
                          .filter(Boolean) as string[] | undefined;

                      return (
                        <div
                          key={item.id}
                          className="space-y-4 rounded-2xl border border-zinc-800 bg-zinc-950 p-4"
                        >
                          <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
                            <div>
                              <div className="flex items-center gap-2">
                                <PlayCircle className="h-5 w-5 text-zinc-400" />
                                <h3 className="text-lg font-black text-white">{item.titolo}</h3>
                              </div>

                              <p className="mt-1 text-xs font-bold uppercase text-zinc-500">
                                Visibilità: {item.visibilita}
                              </p>
                            </div>

                            {isAdmin && (
                              <div className="flex flex-wrap gap-2">
                                <button
                                  type="button"
                                  onClick={() => startEditing(item)}
                                  className="inline-flex items-center justify-center gap-2 rounded-xl border border-zinc-700 px-3 py-2 text-xs font-bold text-zinc-300"
                                >
                                  <Pencil className="h-4 w-4" />
                                  Modifica
                                </button>

                                <button
                                  type="button"
                                  onClick={() => onDelete(item.id, item.video_path)}
                                  className="inline-flex items-center justify-center gap-2 rounded-xl border border-red-500/30 px-3 py-2 text-xs font-bold text-red-400"
                                >
                                  <Trash2 className="h-4 w-4" />
                                  Elimina
                                </button>
                              </div>
                            )}
                          </div>

                          {editingId === item.id && isAdmin && (
                            <form
                              action={(formData) => {
                                startTransition(async () => {
                                  await aggiornaVideoFile(formData);
                                  setEditingId(null);
                                });
                              }}
                              className="space-y-4 rounded-2xl border border-zinc-800 bg-zinc-900 p-4"
                            >
                              <input type="hidden" name="video_id" value={item.id} />

                              <div className="grid gap-4 md:grid-cols-2">
                                <div>
                                  <label className="text-xs font-bold uppercase text-zinc-500">
                                    Titolo
                                  </label>
                                  <input
                                    name="titolo"
                                    defaultValue={item.titolo}
                                    required
                                    className="mt-2 w-full rounded-2xl border border-zinc-800 bg-zinc-950 px-4 py-3 text-sm text-white outline-none focus:border-zinc-600"
                                  />
                                </div>

                                <div>
                                  <input
                                    type="hidden"
                                    name="tipo_evento"
                                    value={editTipoEvento}
                                  />
                                  <SelettoreTipoEvento
                                    valore={editTipoValore}
                                    onChange={setEditTipoValore}
                                    tipiEventi={tipiEventiLista}
                                    onTipiEventiChange={setTipiEventiLista}
                                  />
                                </div>

                                <div>
                                  <label className="text-xs font-bold uppercase text-zinc-500">
                                    Evento associato
                                  </label>
                                  <select
                                    name="evento_id"
                                    defaultValue={
                                      item.partita_id ??
                                      item.allenamento_id ??
                                      item.evento_id ??
                                      ""
                                    }
                                    required
                                    className="mt-2 w-full rounded-2xl border border-zinc-800 bg-zinc-950 px-4 py-3 text-sm text-white outline-none focus:border-zinc-600"
                                  >
                                    <option value="">Seleziona evento</option>
                                    {eventiAssociabiliEdit.map((evento) => (
                                      <option key={evento.id} value={evento.id}>
                                        {editTipoEvento === "partita"
                                          ? `${(evento as Partita).data_partita ?? ""} - ${
                                              (evento as Partita).avversario ?? "Partita"
                                            }`
                                          : editTipoEvento === "allenamento"
                                            ? `${(evento as Allenamento).data_allenamento ?? ""} - ${
                                                (evento as Allenamento).titolo ?? "Allenamento"
                                              }`
                                            : `${(evento as Evento).data_inizio ?? ""} - ${
                                                (evento as Evento).titolo ?? "Evento"
                                              }`}
                                      </option>
                                    ))}
                                  </select>
                                </div>

                                <div>
                                  <label className="text-xs font-bold uppercase text-zinc-500">
                                    Visibilità
                                  </label>
                                  <select
                                    name="visibilita"
                                    value={editVisibilita}
                                    onChange={(e) => setEditVisibilita(e.target.value)}
                                    className="mt-2 w-full rounded-2xl border border-zinc-800 bg-zinc-950 px-4 py-3 text-sm text-white outline-none focus:border-zinc-600"
                                  >
                                    <option value="tutti">Tutti</option>
                                    <option value="allenatori">Allenatori</option>
                                    <option value="preparatori">Preparatori</option>
                                    <option value="giocatori">Giocatori selezionati</option>
                                    <option value="persona">Persona specifica</option>
                                  </select>
                                </div>

                                {editVisibilita === "persona" && (
                                  <div>
                                    <label className="text-xs font-bold uppercase text-zinc-500">
                                      Persona
                                    </label>
                                    <select
                                      name="persona_id"
                                      defaultValue={
                                        item.file_video_destinatari?.[0]?.profilo_id ?? ""
                                      }
                                      required
                                      className="mt-2 w-full rounded-2xl border border-zinc-800 bg-zinc-950 px-4 py-3 text-sm text-white outline-none focus:border-zinc-600"
                                    >
                                      <option value="">Seleziona persona</option>
                                      {persone.map((persona) => (
                                        <option key={persona.id} value={persona.id}>
                                          {persona.nome_completo ?? persona.email}
                                        </option>
                                      ))}
                                    </select>
                                  </div>
                                )}

                                {editVisibilita === "giocatori" && (
                                  <GiocatoriMultiSelect
                                    giocatori={giocatori}
                                    defaultSelected={selectedGiocatori ?? []}
                                  />
                                )}
                              </div>

                              <div>
                                <label className="text-xs font-bold uppercase text-zinc-500">
                                  Note
                                </label>
                                <textarea
                                  name="note"
                                  defaultValue={item.note ?? ""}
                                  rows={4}
                                  className="mt-2 w-full resize-none rounded-2xl border border-zinc-800 bg-zinc-950 px-4 py-3 text-sm text-white outline-none focus:border-zinc-600"
                                />
                              </div>

                              <div className="flex flex-wrap gap-2">
                                <button
                                  type="submit"
                                  disabled={isPending}
                                  className="inline-flex items-center gap-2 rounded-xl bg-white px-4 py-2 text-sm font-black text-zinc-950 disabled:opacity-50"
                                >
                                  {isPending ? (
                                    <Loader2 className="h-4 w-4 animate-spin" />
                                  ) : (
                                    <Save className="h-4 w-4" />
                                  )}
                                  Salva modifiche
                                </button>

                                <button
                                  type="button"
                                  onClick={() => setEditingId(null)}
                                  className="inline-flex items-center gap-2 rounded-xl border border-zinc-700 px-4 py-2 text-sm font-bold text-zinc-300"
                                >
                                  <X className="h-4 w-4" />
                                  Annulla
                                </button>
                              </div>
                            </form>
                          )}

                          {item.signedUrl && (
                            <video
                              src={item.signedUrl}
                              controls
                              className="w-full rounded-2xl border border-zinc-800 bg-black"
                            />
                          )}

                          {item.note && (
                            <p className="rounded-2xl border border-zinc-800 bg-zinc-900 p-4 text-sm leading-6 text-zinc-300">
                              {item.note}
                            </p>
                          )}
                        </div>
                      );
                    })}
                  </div>
                )}
              </AppCard>
            );
          })
        )}
      </div>
    </div>
  );
}