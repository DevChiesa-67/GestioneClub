"use client";

import Image from "next/image";
import { useRouter } from "next/navigation";
import { useMemo, useRef, useState, useTransition } from "react";
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
  ExternalLink,
} from "lucide-react";
import { AppCard } from "@/components/ui/AppCard";
import {
  preparaUploadFile,
  registraFileVideo,
  eliminaVideoFile,
  aggiornaBloccoFile,
} from "@/app/(dashboard)/file/actions";
import { supabase } from "@/lib/supabase-client";
import { LIMITE_FILE_MB, tipoFileConsentito } from "@/lib/file-video";
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
  video_mime_type: string | null;
  video_size?: number | null;
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

function tipoEventoLabel(item: Video) {
  if (item.tipo_evento === "partita") return "Partita";
  if (item.tipo_evento === "allenamento") return "Allenamento";
  return item.eventi?.tipo_evento?.nome ?? "Evento";
}

function FilePopup({ file, onClose }: { file: Video; onClose: () => void }) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-4 backdrop-blur-sm" onClick={onClose}>
      <div role="dialog" aria-modal="true" aria-label={file.titolo} onClick={(event) => event.stopPropagation()} className="max-h-[92vh] w-full max-w-6xl overflow-auto rounded-3xl border border-zinc-700 bg-zinc-950 p-4 shadow-2xl sm:p-6">
        <div className="mb-4 flex items-start justify-between gap-4">
          <div>
            <h2 className="text-xl font-black text-white">{file.titolo}</h2>
            <span className="mt-2 inline-flex rounded-full border border-blue-400/30 bg-blue-400/10 px-3 py-1 text-xs font-black uppercase text-blue-300">{tipoEventoLabel(file)}</span>
          </div>
          <button type="button" onClick={onClose} className="rounded-full border border-zinc-700 p-2 text-zinc-300 hover:bg-zinc-800" aria-label="Chiudi"><X className="h-5 w-5" /></button>
        </div>

        {!file.signedUrl ? (
          <p className="rounded-2xl border border-amber-500/30 bg-amber-500/10 p-4 text-amber-200">Anteprima non disponibile. Verifica le policy di lettura del bucket.</p>
        ) : file.video_mime_type?.startsWith("video/") ? (
          <video src={file.signedUrl} controls autoPlay className="max-h-[72vh] w-full rounded-2xl bg-black" />
        ) : file.video_mime_type?.startsWith("image/") ? (
          <Image src={file.signedUrl} alt={file.titolo} width={1920} height={1080} unoptimized className="max-h-[72vh] w-full rounded-2xl object-contain" />
        ) : (
          <iframe src={file.signedUrl} title={file.titolo} className="h-[72vh] w-full rounded-2xl bg-white" />
        )}

        <div className="mt-4 flex flex-wrap items-center gap-3">
          {file.signedUrl && <a href={file.signedUrl} target="_blank" rel="noreferrer" className="inline-flex items-center gap-2 rounded-xl border border-zinc-700 px-4 py-2 text-sm font-bold text-white"><ExternalLink className="h-4 w-4" />Apri in una nuova scheda</a>}
          {file.note && <p className="text-sm text-zinc-300">{file.note}</p>}
        </div>
      </div>
    </div>
  );
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
      <label className="text-xs font-bold uppercase text-zinc-500">
        Tipo evento
      </label>

      <select
        name="tipo_evento_composito"
        value={valore}
        onChange={(e) => {
          if (e.target.value === "__nuovo__") {
            setMostraForm(true);
            return;
          }

          setMostraForm(false);
          onChange(e.target.value);
        }}
        className="mt-2 w-full rounded-2xl border border-zinc-800 bg-zinc-950 px-4 py-3 text-sm text-white outline-none focus:border-zinc-600"
      >
        <option value="partita">Partita</option>
        <option value="allenamento">Allenamento</option>
        {tipiEventi.map((tipo) => (
          <option key={tipo.id} value={componiValoreTipo("evento", tipo.id)}>
            {tipo.nome}
          </option>
        ))}
        <option value="__nuovo__">+ Nuova tipologia...</option>
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
          <button
            type="button"
            onClick={() => {
              setMostraForm(false);
              setNome("");
              setErrore(null);
            }}
            className="shrink-0 rounded-xl border border-zinc-700 px-3 py-2 text-xs font-bold text-zinc-400 hover:text-white"
          >
            Annulla
          </button>
        </div>
      )}

      {errore && <p className="mt-1 text-xs text-red-400">{errore}</p>}
    </div>
  );
}

function formattaDimensione(byte?: number | null) {
  if (!byte || byte <= 0) return "";

  const mega = byte / (1024 * 1024);

  if (mega >= 1) return `${mega.toFixed(1)} MB`;

  return `${Math.max(1, Math.round(byte / 1024))} KB`;
}

/**
 * Il nome originale del file non viene salvato: su Storage il percorso e'
 * `<club>/<squadra>/<uuid>.<estensione>`. Si mostra quindi l'estensione,
 * che e' l'unica cosa del nome che sopravvive, insieme al progressivo.
 */
function etichettaFile(item: Video, indice: number) {
  const estensione = item.video_path.split(".").pop()?.toUpperCase() ?? "FILE";

  return `File ${indice + 1} · ${estensione}`;
}

/*
 * MODIFICA DEL BLOCCO
 * ====================
 * Un blocco e' l'insieme dei file caricati insieme, che condividono il
 * titolo. Qui si modificano i dati comuni (titolo, evento, visibilita',
 * note) una volta sola per tutti, si cancella un singolo file e se ne
 * aggiungono di nuovi allo stesso blocco.
 *
 * I nuovi file ereditano i dati del blocco COME SONO SALVATI, non come
 * sono nel form: altrimenti, con modifiche non ancora salvate, i file
 * aggiunti finirebbero in un blocco diverso da quello da cui sono stati
 * caricati.
 */
function BloccoFileModal({
  items,
  partite,
  allenamenti,
  eventi,
  tipiEventi,
  onTipiEventiChange,
  persone,
  giocatori,
  onClose,
}: {
  items: Video[];
  partite: Partita[];
  allenamenti: Allenamento[];
  eventi: Evento[];
  tipiEventi: TipoEvento[];
  onTipiEventiChange: (tipi: TipoEvento[]) => void;
  persone: Persona[];
  giocatori: Giocatore[];
  onClose: () => void;
}) {
  const router = useRouter();
  const primo = items[0];

  const [tipoValore, setTipoValore] = useState<string>(
    primo.tipo_evento === "evento" && primo.eventi?.tipo_evento_id
      ? componiValoreTipo("evento", primo.eventi.tipo_evento_id)
      : primo.tipo_evento
  );
  const [visibilita, setVisibilita] = useState(primo.visibilita);
  const [errore, setErrore] = useState<string | null>(null);
  const [avanzamento, setAvanzamento] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  const inputFileRef = useRef<HTMLInputElement | null>(null);

  const { tipo: tipoEvento, tipoEventoId } = scomponiValoreTipo(tipoValore);

  const eventiAssociabili = useMemo(() => {
    if (tipoEvento === "partita") return partite;
    if (tipoEvento === "allenamento") return allenamenti;
    return eventi.filter((e) => e.tipo_evento_id === tipoEventoId);
  }, [tipoEvento, tipoEventoId, partite, allenamenti, eventi]);

  const giocatoriSelezionati = (primo.file_video_destinatari ?? [])
    .map((d) => d.giocatore_id)
    .filter((id): id is string => Boolean(id));

  function salvaBlocco(formData: FormData) {
    setErrore(null);

    startTransition(async () => {
      const esito = await aggiornaBloccoFile({
        videoIds: items.map((item) => item.id),
        titolo: String(formData.get("titolo") ?? ""),
        tipoEvento,
        eventoId: String(formData.get("evento_id") ?? ""),
        note: String(formData.get("note") ?? ""),
        visibilita,
        personaId: String(formData.get("persona_id") ?? ""),
        giocatoreIds: formData.getAll("giocatore_ids").map(String),
      });

      if (!esito.ok) {
        setErrore(esito.message);
        return;
      }

      onClose();
      router.refresh();
    });
  }

  function eliminaSingolo(item: Video, indice: number) {
    const ultimo = items.length === 1;

    const messaggio = ultimo
      ? "Questo e' l'ultimo file del blocco: eliminandolo sparisce anche il blocco. Procedere?"
      : `Eliminare il file ${indice + 1} di ${items.length}? L'operazione non e' reversibile.`;

    if (!window.confirm(messaggio)) return;

    setErrore(null);

    startTransition(async () => {
      try {
        await eliminaVideoFile(item.id, item.video_path);

        if (ultimo) onClose();

        router.refresh();
      } catch (error) {
        setErrore(
          error instanceof Error
            ? error.message
            : "Impossibile eliminare il file."
        );
      }
    });
  }

  function aggiungiFile(elenco: FileList | null) {
    const files = Array.from(elenco ?? []).filter((file) => file.size > 0);

    if (files.length === 0) return;

    const troppoGrande = files.find(
      (file) => file.size > LIMITE_FILE_MB * 1024 * 1024
    );

    if (troppoGrande) {
      setErrore(
        `"${troppoGrande.name}" supera il limite di ${LIMITE_FILE_MB} MB per file.`
      );
      return;
    }

    const nonValido = files.find((file) => !tipoFileConsentito(file.type));

    if (nonValido) {
      setErrore(
        `Formato non supportato per "${nonValido.name}". Carica video, immagini o PDF.`
      );
      return;
    }

    setErrore(null);

    startTransition(async () => {
      try {
        const caricati: {
          path: string;
          nome: string;
          tipoMime: string;
          dimensione: number;
        }[] = [];

        for (const [indice, file] of files.entries()) {
          setAvanzamento(
            `Caricamento ${indice + 1} di ${files.length}: ${file.name}...`
          );

          const preparazione = await preparaUploadFile({
            nome: file.name,
            tipoMime: file.type,
            dimensione: file.size,
          });

          if (!preparazione.ok) throw new Error(preparazione.message);

          const { error: uploadError } = await supabase.storage
            .from("file-video")
            .uploadToSignedUrl(preparazione.path, preparazione.token, file, {
              contentType: file.type,
            });

          if (uploadError) throw new Error(`${file.name}: ${uploadError.message}`);

          caricati.push({
            path: preparazione.path,
            nome: file.name,
            tipoMime: file.type,
            dimensione: file.size,
          });
        }

        setAvanzamento("Salvataggio in corso...");

        const salvataggio = await registraFileVideo({
          titolo: primo.titolo,
          tipoEvento: primo.tipo_evento,
          eventoId:
            primo.partita_id ?? primo.allenamento_id ?? primo.evento_id ?? "",
          note: primo.note ?? "",
          visibilita: primo.visibilita,
          personaId: primo.file_video_destinatari?.[0]?.profilo_id ?? "",
          giocatoreIds: giocatoriSelezionati,
          files: caricati,
        });

        if (!salvataggio.ok) throw new Error(salvataggio.message);

        if (inputFileRef.current) inputFileRef.current.value = "";

        router.refresh();
      } catch (error) {
        setErrore(
          error instanceof Error ? error.message : "Impossibile caricare i file."
        );
      } finally {
        setAvanzamento(null);
      }
    });
  }

  return (
    <div
      className="fixed inset-0 z-[60] flex items-center justify-center bg-black/80 p-3 backdrop-blur-sm sm:p-6"
      onClick={onClose}
    >
      <div
        onClick={(event) => event.stopPropagation()}
        className="scrollbar-gestionale max-h-[92vh] w-full max-w-3xl overflow-y-auto rounded-3xl border border-zinc-700 bg-zinc-900 p-5 shadow-2xl sm:p-7"
      >
        <div className="flex items-start justify-between gap-4">
          <div className="min-w-0">
            <p className="text-xs font-black uppercase tracking-widest text-zinc-500">
              Modifica blocco
            </p>
            <h2 className="mt-1 truncate text-xl font-black text-white">
              {primo.titolo}
            </h2>
            <p className="mt-1 text-xs text-zinc-500">
              {items.length} {items.length === 1 ? "file" : "file"} · caricato
              il{" "}
              {new Date(primo.created_at).toLocaleDateString("it-IT", {
                day: "2-digit",
                month: "long",
                year: "numeric",
              })}
            </p>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="rounded-full border border-zinc-700 p-2 text-zinc-300 hover:bg-zinc-800"
            aria-label="Chiudi modifica blocco"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {errore && (
          <p className="mt-4 rounded-2xl border border-red-500/40 bg-red-500/10 px-4 py-3 text-sm text-red-300">
            {errore}
          </p>
        )}

        {/* DATI COMUNI DEL BLOCCO */}
        <form action={salvaBlocco} className="mt-5 space-y-5">
          <div className="grid gap-4 md:grid-cols-2">
            <div>
              <label className="text-xs font-bold uppercase text-zinc-500">
                Titolo
              </label>
              <input
                name="titolo"
                defaultValue={primo.titolo}
                required
                className="mt-2 w-full rounded-2xl border border-zinc-800 bg-zinc-950 px-4 py-3 text-sm text-white outline-none focus:border-zinc-600"
              />
            </div>

            <div>
              <SelettoreTipoEvento
                valore={tipoValore}
                onChange={setTipoValore}
                tipiEventi={tipiEventi}
                onTipiEventiChange={onTipiEventiChange}
              />
            </div>

            <div>
              <label className="text-xs font-bold uppercase text-zinc-500">
                Evento associato (facoltativo)
              </label>
              <select
                name="evento_id"
                defaultValue={
                  primo.partita_id ??
                  primo.allenamento_id ??
                  primo.evento_id ??
                  ""
                }
                className="mt-2 w-full rounded-2xl border border-zinc-800 bg-zinc-950 px-4 py-3 text-sm text-white outline-none focus:border-zinc-600"
              >
                <option value="">Nessun evento associato</option>
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
              <label className="text-xs font-bold uppercase text-zinc-500">
                Visibilità
              </label>
              <select
                value={visibilita}
                onChange={(event) => setVisibilita(event.target.value)}
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
                <label className="text-xs font-bold uppercase text-zinc-500">
                  Persona
                </label>
                <select
                  name="persona_id"
                  defaultValue={
                    primo.file_video_destinatari?.[0]?.profilo_id ?? ""
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

            {visibilita === "giocatori" && (
              <GiocatoriMultiSelect
                giocatori={giocatori}
                defaultSelected={giocatoriSelezionati}
              />
            )}
          </div>

          <div>
            <label className="text-xs font-bold uppercase text-zinc-500">
              Note
            </label>
            <textarea
              name="note"
              defaultValue={primo.note ?? ""}
              rows={4}
              className="mt-2 w-full resize-none rounded-2xl border border-zinc-800 bg-zinc-950 px-4 py-3 text-sm text-white outline-none focus:border-zinc-600"
            />
          </div>

          <p className="text-xs text-zinc-500">
            Le modifiche valgono per tutti i {items.length} file del blocco.
          </p>

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
              onClick={onClose}
              className="inline-flex items-center gap-2 rounded-xl border border-zinc-700 px-4 py-2 text-sm font-bold text-zinc-300"
            >
              <X className="h-4 w-4" />
              Chiudi
            </button>
          </div>
        </form>

        {/* FILE DEL BLOCCO */}
        <div className="mt-7 border-t border-zinc-800 pt-5">
          <h3 className="text-xs font-black uppercase tracking-widest text-zinc-500">
            File importati ({items.length})
          </h3>

          <div className="mt-3 space-y-2">
            {items.map((item, indice) => (
              <div
                key={item.id}
                className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-zinc-800 bg-zinc-950 p-3"
              >
                <div className="flex min-w-0 items-center gap-3">
                  <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-zinc-800 bg-zinc-900 text-zinc-400">
                    <PlayCircle className="h-5 w-5" />
                  </span>

                  <div className="min-w-0">
                    <p className="truncate text-sm font-bold text-white">
                      {etichettaFile(item, indice)}
                    </p>
                    <p className="truncate text-xs text-zinc-500">
                      {[
                        item.video_mime_type ?? "tipo sconosciuto",
                        formattaDimensione(item.video_size),
                      ]
                        .filter(Boolean)
                        .join(" · ")}
                    </p>
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  {item.signedUrl && (
                    <a
                      href={item.signedUrl}
                      target="_blank"
                      rel="noreferrer"
                      className="inline-flex items-center gap-2 rounded-xl border border-zinc-700 px-3 py-2 text-xs font-bold text-zinc-200 hover:bg-zinc-800"
                    >
                      <ExternalLink className="h-4 w-4" />
                      Apri
                    </a>
                  )}

                  <button
                    type="button"
                    onClick={() => eliminaSingolo(item, indice)}
                    disabled={isPending}
                    className="inline-flex items-center gap-2 rounded-xl border border-red-500/30 px-3 py-2 text-xs font-bold text-red-400 hover:bg-red-500/10 disabled:opacity-50"
                  >
                    <Trash2 className="h-4 w-4" />
                    Elimina
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* AGGIUNTA DI NUOVI FILE */}
        <div className="mt-6 rounded-2xl border border-dashed border-zinc-700 bg-zinc-950 p-4">
          <h3 className="text-xs font-black uppercase tracking-widest text-zinc-500">
            Aggiungi file a questo blocco
          </h3>

          <p className="mt-1 text-xs text-zinc-500">
            I nuovi file ereditano titolo, evento, visibilità e note del
            blocco già salvati. Massimo {LIMITE_FILE_MB} MB per file.
          </p>

          <div className="mt-3 flex flex-wrap items-center gap-3">
            <input
              ref={inputFileRef}
              type="file"
              multiple
              accept="video/*,image/*,application/pdf"
              disabled={isPending}
              onChange={(event) => aggiungiFile(event.target.files)}
              className="w-full text-sm text-zinc-300 file:mr-3 file:rounded-xl file:border-0 file:bg-white file:px-4 file:py-2 file:text-sm file:font-black file:text-zinc-950 disabled:opacity-50 sm:w-auto"
            />

            {avanzamento && (
              <p className="inline-flex items-center gap-2 text-xs text-zinc-400">
                <Loader2 className="h-4 w-4 animate-spin" />
                {avanzamento}
              </p>
            )}
          </div>
        </div>
      </div>
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
  const router = useRouter();
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [openGroups, setOpenGroups] = useState<Record<string, boolean>>({});

  const [tipiEventiLista, setTipiEventiLista] = useState<TipoEvento[]>(
    tipiEventi
  );

  const [tipoValore, setTipoValore] = useState<string>("partita");
  const [visibilita, setVisibilita] = useState("tutti");

  const [fileAperto, setFileAperto] = useState<Video | null>(null);

  /*
   * Blocco aperto in modifica, identificato dalla chiave del gruppo (il
   * titolo). Si tiene la chiave e non l'elenco dei file: cosi' dopo
   * un'aggiunta o un'eliminazione il popup ripesca i file aggiornati dal
   * raggruppamento invece di mostrare una copia ormai vecchia.
   */
  const [bloccoInModifica, setBloccoInModifica] = useState<string | null>(null);

  const [isPending, startTransition] = useTransition();
  const [errore, setErrore] = useState<string | null>(null);
  const [avanzamento, setAvanzamento] = useState<string | null>(null);

  const { tipo: tipoEvento, tipoEventoId: tipoEventoIdSel } =
    scomponiValoreTipo(tipoValore);
  const eventiAssociabili = useMemo(() => {
    if (tipoEvento === "partita") return partite;
    if (tipoEvento === "allenamento") return allenamenti;
    return eventi.filter((e) => e.tipo_evento_id === tipoEventoIdSel);
  }, [tipoEvento, tipoEventoIdSel, partite, allenamenti, eventi]);

  const videoRaggruppati = useMemo(() => {
    return video.reduce<Record<string, Video[]>>((acc, item) => {
      const key = item.titolo.trim() || "Senza titolo";

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

  /*
   * Il file NON passa piu' dal server: il browser lo carica direttamente su
   * Supabase Storage con un "signed upload URL" chiesto alla Server Action.
   * Motivo: su Vercel ogni richiesta a una Server Action ha un limite rigido
   * di ~4,5 MB, quindi in produzione qualsiasi video piu' grande veniva
   * rifiutato (in locale invece passava, perche' li' vale solo il
   * serverActions.bodySizeLimit di next.config.ts). Al server restano solo i
   * percorsi dei file gia' caricati, cioe' poche decine di byte.
   */
  function onSubmit(formData: FormData) {
    setErrore(null);

    const files = formData
      .getAll("video")
      .filter((valore): valore is File => valore instanceof File && valore.size > 0);

    if (files.length === 0) {
      setErrore("Seleziona almeno un file.");
      return;
    }

    const fileTroppoGrande = files.find(
      (file) => file.size > LIMITE_FILE_MB * 1024 * 1024
    );
    if (fileTroppoGrande) {
      setErrore(
        `"${fileTroppoGrande.name}" pesa ${(
          fileTroppoGrande.size /
          (1024 * 1024)
        ).toFixed(0)} MB e supera il limite di ${LIMITE_FILE_MB} MB per file.`
      );
      return;
    }

    const fileNonValido = files.find((file) => !tipoFileConsentito(file.type));
    if (fileNonValido) {
      setErrore(
        `Formato non supportato per "${fileNonValido.name}". Carica video, immagini o PDF.`
      );
      return;
    }

    startTransition(async () => {
      try {
        const caricati: {
          path: string;
          nome: string;
          tipoMime: string;
          dimensione: number;
        }[] = [];

        for (const [indice, file] of files.entries()) {
          setAvanzamento(
            `Caricamento ${indice + 1} di ${files.length}: ${file.name}...`
          );

          const preparazione = await preparaUploadFile({
            nome: file.name,
            tipoMime: file.type,
            dimensione: file.size,
          });

          if (!preparazione.ok) throw new Error(preparazione.message);

          const { path, token } = preparazione;

          const { error: uploadError } = await supabase.storage
            .from("file-video")
            .uploadToSignedUrl(path, token, file, { contentType: file.type });

          if (uploadError) {
            throw new Error(`${file.name}: ${uploadError.message}`);
          }

          caricati.push({
            path,
            nome: file.name,
            tipoMime: file.type,
            dimensione: file.size,
          });
        }

        setAvanzamento("Salvataggio in corso...");

        const salvataggio = await registraFileVideo({
          titolo: String(formData.get("titolo") ?? ""),
          tipoEvento: String(formData.get("tipo_evento") ?? ""),
          eventoId: String(formData.get("evento_id") ?? ""),
          note: String(formData.get("note") ?? ""),
          visibilita: String(formData.get("visibilita") ?? ""),
          personaId: String(formData.get("persona_id") ?? ""),
          giocatoreIds: formData.getAll("giocatore_ids").map(String),
          files: caricati,
        });

        if (!salvataggio.ok) throw new Error(salvataggio.message);

        setShowCreateForm(false);
        router.refresh();
      } catch (error) {
        setErrore(
          error instanceof Error
            ? error.message
            : "Impossibile caricare il file. Verifica la configurazione del database."
        );
      } finally {
        setAvanzamento(null);
      }
    });
  }

  /*
   * Elimina l'intero blocco: e' la scorciatoia dall'elenco. La cancellazione
   * di un singolo file vive dentro il popup di modifica del blocco.
   */
  function eliminaBlocco(items: Video[]) {
    const messaggio =
      items.length === 1
        ? "Vuoi eliminare questo file?"
        : `Vuoi eliminare tutti i ${items.length} file di questo blocco? L'operazione non e' reversibile.`;

    if (!window.confirm(messaggio)) return;

    startTransition(async () => {
      for (const item of items) {
        await eliminaVideoFile(item.id, item.video_path);
      }

      router.refresh();
    });
  }

  const itemsBloccoInModifica = bloccoInModifica
    ? videoRaggruppati[bloccoInModifica] ?? []
    : [];

  return (
    <div className="space-y-5">
      {fileAperto && <FilePopup file={fileAperto} onClose={() => setFileAperto(null)} />}

      {isAdmin && bloccoInModifica && itemsBloccoInModifica.length > 0 && (
        <BloccoFileModal
          items={itemsBloccoInModifica}
          partite={partite}
          allenamenti={allenamenti}
          eventi={eventi}
          tipiEventi={tipiEventiLista}
          onTipiEventiChange={setTipiEventiLista}
          persone={persone}
          giocatori={giocatori}
          onClose={() => setBloccoInModifica(null)}
        />
      )}
      {isAdmin && (
        <div className="flex justify-end">
          <button
            type="button"
            onClick={() => setShowCreateForm((prev) => !prev)}
            className="inline-flex items-center justify-center gap-2 rounded-2xl bg-white px-5 py-3 text-sm font-black text-zinc-950"
          >
            {showCreateForm ? <X className="h-4 w-4" /> : <Plus className="h-4 w-4" />}
            {showCreateForm ? "Chiudi" : "Aggiungi file"}
          </button>
        </div>
      )}

      {isAdmin && showCreateForm && (
        <AppCard>
          {errore && (
            <p className="mb-4 rounded-2xl border border-red-500/30 bg-red-500/10 p-4 text-sm text-red-300">
              {errore}
            </p>
          )}
          <form action={onSubmit} className="space-y-5">
            <div>
              <h2 className="text-lg font-black text-white">Carica nuovo file</h2>
              <p className="mt-1 text-sm text-zinc-400">
                Puoi associarlo a un evento e scegliere chi può visualizzarlo.
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
                <label className="text-xs font-bold uppercase text-zinc-500">
                  File (video, immagine o PDF)
                </label>
                <input
                  name="video"
                  type="file"
                  accept="video/*,image/*,application/pdf"
                  multiple
                  required
                  className="mt-2 w-full rounded-2xl border border-zinc-800 bg-zinc-950 px-4 py-3 text-sm text-zinc-300 outline-none"
                />
                <p className="mt-2 text-xs text-zinc-500">
                  Puoi selezionare più file contemporaneamente. Massimo{" "}
                  {LIMITE_FILE_MB} MB per file.
                </p>
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
                <label className="text-xs font-bold uppercase text-zinc-500">
                  Evento associato (facoltativo)
                </label>
                <select
                  name="evento_id"
                  className="mt-2 w-full rounded-2xl border border-zinc-800 bg-zinc-950 px-4 py-3 text-sm text-white outline-none focus:border-zinc-600"
                >
                  <option value="">Nessun evento associato</option>
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

            <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
              <button
                type="submit"
                disabled={isPending}
                className="inline-flex w-full items-center justify-center gap-2 rounded-2xl bg-white px-5 py-3 text-sm font-black text-zinc-950 disabled:opacity-50 sm:w-auto"
              >
                {isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
                Salva file
              </button>

              {avanzamento && (
                <p className="text-xs text-zinc-400">{avanzamento}</p>
              )}
            </div>
          </form>
        </AppCard>
      )}

      <div className="w-full space-y-3">
        {video.length === 0 ? (
          <AppCard>
            <p className="text-sm text-zinc-400">Nessun file disponibile.</p>
          </AppCard>
        ) : (
          Object.entries(videoRaggruppati).map(([groupKey, items]) => {
            const isOpen = openGroups[groupKey] ?? true;

            return (
              <AppCard key={groupKey}>
                <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                  <button
                    type="button"
                    onClick={() => toggleGroup(groupKey)}
                    className="min-w-0 flex-1 text-left"
                  >
                    <h2 className="text-sm font-black uppercase tracking-wide text-white">
                      {groupKey}
                    </h2>
                    <p className="mt-1 text-xs text-zinc-500">
                      {items.length} {items.length === 1 ? "file" : "file"}
                    </p>
                  </button>

                  <div className="flex flex-wrap items-center gap-2 sm:justify-end">
                    {isAdmin && (
                      <>
                        {/*
                          Una sola "Modifica" per blocco: apre il popup da
                          cui si cambiano i dati comuni, si eliminano i
                          singoli file e se ne aggiungono di nuovi.
                        */}
                        <button
                          type="button"
                          onClick={() => setBloccoInModifica(groupKey)}
                          className="inline-flex items-center gap-2 rounded-xl border border-zinc-700 px-3 py-2 text-xs font-bold text-zinc-200 hover:bg-zinc-800"
                        >
                          <Pencil className="h-4 w-4" />
                          Modifica
                        </button>

                        <button
                          type="button"
                          onClick={() => eliminaBlocco(items)}
                          className="inline-flex items-center gap-2 rounded-xl border border-red-500/30 px-3 py-2 text-xs font-bold text-red-400 hover:bg-red-500/10"
                        >
                          <Trash2 className="h-4 w-4" />
                          Elimina blocco
                        </button>
                      </>
                    )}
                    <button
                      type="button"
                      onClick={() => toggleGroup(groupKey)}
                      className="rounded-full border border-zinc-800 bg-zinc-950 p-2 text-zinc-400"
                      aria-label={isOpen ? "Chiudi gruppo" : "Apri gruppo"}
                    >
                      {isOpen ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
                    </button>
                  </div>
                </div>

                {isOpen && (
                  <div className="mt-5 grid gap-4 sm:grid-cols-2 lg:grid-cols-4 2xl:grid-cols-5">
                    {items.map((item) => {
                      return (
                        <div
                          key={item.id}
                          role="button"
                          tabIndex={0}
                          onClick={() => setFileAperto(item)}
                          onKeyDown={(event) => {
                            if (event.key === "Enter" || event.key === " ") setFileAperto(item);
                          }}
                          className="cursor-pointer space-y-3 rounded-2xl border border-zinc-800 bg-zinc-950 p-3 transition hover:border-zinc-600"
                        >
                          <div className="flex flex-col gap-3">
                            <div>
                              <div className="flex items-center gap-2">
                                <PlayCircle className="h-5 w-5 text-zinc-400" />
                                <h3 className="truncate text-sm font-black text-white">{item.titolo}</h3>
                              </div>

                              <p className="mt-1 text-xs font-bold uppercase text-zinc-500">
                                Visibilità: {item.visibilita}
                              </p>
                              <span className="mt-2 inline-flex rounded-full border border-blue-400/30 bg-blue-400/10 px-2.5 py-1 text-[10px] font-black uppercase tracking-wide text-blue-300">
                                {tipoEventoLabel(item)}
                              </span>
                            </div>

                          </div>


                          {item.signedUrl && item.video_mime_type?.startsWith("video/") && (
                            <video
                              src={item.signedUrl}
                              muted
                              preload="metadata"
                              className="pointer-events-none aspect-video w-full rounded-xl border border-zinc-800 bg-black object-cover"
                            />
                          )}

                          {item.signedUrl && item.video_mime_type?.startsWith("image/") && (
                            <Image
                              src={item.signedUrl}
                              alt={item.titolo}
                              width={1600}
                              height={900}
                              unoptimized
                              className="pointer-events-none aspect-video w-full rounded-xl border border-zinc-800 object-cover"
                            />
                          )}

                          {item.signedUrl && item.video_mime_type === "application/pdf" && (
                            <div className="flex aspect-video items-center justify-center rounded-xl border border-zinc-800 bg-zinc-900 text-sm font-black text-zinc-400">
                              PDF
                            </div>
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
