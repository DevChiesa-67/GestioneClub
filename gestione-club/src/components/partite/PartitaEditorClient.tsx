"use client";

import {
  useEffect,
  useMemo,
  useRef,
  useState,
  useTransition,
} from "react";
import { useRouter } from "next/navigation";
import { createPortal } from "react-dom";
import Image from "next/image";
import {
  AlertTriangle,
  ChevronDown,
  CircleDot,
  Eye,
  Layers,
  Megaphone,
  Pencil,
  Repeat,
  RefreshCw,
  Save,
  Shield,
  ShieldCheck,
  Shirt,
  Target,
  Trash2,
  Trophy,
  UserRound,
  Users,
  X,
} from "lucide-react";
import type { ComponentType, CSSProperties, ReactNode } from "react";

import {
  eliminaPartita,
  salvaConvocazioniPartita,
  salvaStatistichePartita,
} from "@/app/(dashboard)/partite/[id]/actions";
import ModificaDettagliPartitaModal, {
  type SquadraPartitaOption,
} from "@/components/partite/ModificaDettagliPartitaModal";
import { supabase } from "@/lib/supabase-client";
import { useToast } from "@/components/ui/Toast";

type PosizioneRugby =
  | "pilone_sx"
  | "tallonatore"
  | "pilone_dx"
  | "seconda_linea_sx"
  | "seconda_linea_dx"
  | "terza_linea_sx"
  | "terza_linea_dx"
  | "numero_8"
  | "mediano_mischia"
  | "mediano_apertura"
  | "ala_sx"
  | "primo_centro"
  | "secondo_centro"
  | "ala_dx"
  | "estremo"
  | "panchina";

type SquadraPartitaRel = {
  id: string;
  nome: string;
  abbreviazione: string | null;
  logo_path: string | null;
};

type Partita = {
  id: string;
  club_id: string;
  squadra_id: string | null;
  avversario: string;
  data_partita: string;
  ora_partita: string | null;
  luogo: string | null;
  casa_fuori: "casa" | "fuori" | null;
  risultato: string | null;
  tipo_partita: string | null;
  note: string | null;
  stato_partita?: string | null;
  punti_fatti?: number | null;
  punti_subiti?: number | null;
  squadra_casa_id: string | null;
  squadra_fuori_id: string | null;
  squadre: { nome: string } | { nome: string }[] | null;
  squadra_casa: SquadraPartitaRel | SquadraPartitaRel[] | null;
  squadra_fuori: SquadraPartitaRel | SquadraPartitaRel[] | null;
};

type Statistiche = {
  punti_fatti: number;
  punti_subiti: number;
  mete_fatte: number;
  mete_subite: number;
  calci_fatti: number;
  calci_subiti: number;
  ammonizioni: number;
  espulsioni: number;
  punti_incontro_vinti: number;
  punti_incontro_persi: number;
  touche_vinte: number;
  touche_perse: number;
  mischie_vinte: number;
  mischie_perse: number;
  placcaggi_efficaci: number;
  placcaggi_non_efficaci: number;
  note: string | null;
} | null;

type Giocatore = {
  id: string;
  nome: string | null;
  cognome: string | null;
  ruolo_1: string | null;
  ruolo_2: string | null;
  reparto: string | null;
  foto_url?: string | null;
  numero_maglia?: number | null;
  attivo: boolean;
};

type ConvocazioneDb = {
  id: string;
  partita_id: string;
  giocatore_id: string;
  convocato: boolean;
  titolare: boolean;
  capitano: boolean;
  vicecapitano: boolean;
  posizione: PosizioneRugby;
  numero_maglia: number | null;
  ordine: number | null;
  ruolo_panchina: string | null;
  note: string | null;
};

type ConvocazioneState = {
  giocatore_id: string;
  convocato: boolean;
  titolare: boolean;
  capitano: boolean;
  vicecapitano: boolean;
  posizione: PosizioneRugby;
  numero_maglia: number | null;
  ordine: number | null;
  ruolo_panchina: string | null;
  note: string | null;
};

function ruoliDisponibili(giocatore?: Giocatore | null) {
  if (!giocatore) return [];

  return Array.from(
    new Set(
      [giocatore.ruolo_1, giocatore.ruolo_2].filter(
        (ruolo): ruolo is string => Boolean(ruolo && ruolo.trim())
      )
    )
  );
}

type Props = {
  partita: Partita;
  statistiche: Statistiche;
  giocatori: Giocatore[];
  convocazioni: ConvocazioneDb[];
  squadreDisponibili: SquadraPartitaOption[];
  coloreClub: string;
  isAdmin: boolean;
};

const formazione: {
  posizione: PosizioneRugby;
  label: string;
  numero: number;
}[] = [
  { posizione: "pilone_sx", label: "Pilone SX", numero: 1 },
  { posizione: "tallonatore", label: "Tallonatore", numero: 2 },
  { posizione: "pilone_dx", label: "Pilone DX", numero: 3 },
  { posizione: "seconda_linea_sx", label: "2ª Linea SX", numero: 4 },
  { posizione: "seconda_linea_dx", label: "2ª Linea DX", numero: 5 },
  { posizione: "terza_linea_sx", label: "3ª Linea SX", numero: 6 },
  { posizione: "terza_linea_dx", label: "3ª Linea DX", numero: 7 },
  { posizione: "numero_8", label: "Numero 8", numero: 8 },
  { posizione: "mediano_mischia", label: "Mediano Mischia", numero: 9 },
  { posizione: "mediano_apertura", label: "Mediano Apertura", numero: 10 },
  { posizione: "ala_sx", label: "Ala SX", numero: 11 },
  { posizione: "primo_centro", label: "Primo Centro", numero: 12 },
  { posizione: "secondo_centro", label: "Secondo Centro", numero: 13 },
  { posizione: "ala_dx", label: "Ala DX", numero: 14 },
  { posizione: "estremo", label: "Estremo", numero: 15 },
];

/**
 * Posizioni desktop sul campo.
 *
 * Campo verticale:
 * - parte alta = pacchetto di mischia
 * - centro = mediani
 * - parte bassa = trequarti / estremo
 */
const fieldPosition: Record<number, string> = {
  // Pacchetto di mischia (1-10) spostato più a sinistra rispetto al
  // centro campo. Il 6 resta clampato più vicino al centro rispetto
  // agli altri per evitare che la card esca dal bordo del campo.
  1: "left-[20%] top-[7%]",
  2: "left-[38%] top-[7%]",
  3: "left-[56%] top-[7%]",

  4: "left-[29%] top-[17%]",
  5: "left-[47%] top-[17%]",

  6: "left-[14%] top-[26%]",
  7: "left-[68%] top-[26%]",
  8: "left-[38%] top-[31%]",

  9: "left-[38%] top-[42%]",
  10: "left-[38%] top-[54%]",

  11: "left-[12%] top-[75%]",
  // 12 posizionato spazialmente a metà strada tra il 10 e il 13, sulla
  // linea diagonale che li collega.
  12: "left-[52%] top-[60%]",
  13: "left-[66%] top-[66%]",
  14: "left-[88%] top-[75%]",

  15: "left-[50%] top-[90%]",
};

function nomeGiocatore(giocatore?: Giocatore | null) {
  if (!giocatore) return "Non assegnato";

  return `${giocatore.nome ?? ""} ${giocatore.cognome ?? ""}`.trim();
}

function AvatarGiocatore({
  giocatore,
  size = 24,
}: {
  giocatore: Giocatore;
  size?: number;
}) {
  if (giocatore.foto_url) {
    return (
      <Image
        src={giocatore.foto_url}
        alt={nomeGiocatore(giocatore)}
        width={size}
        height={size}
        unoptimized
        className="shrink-0 rounded-full object-cover ring-1 ring-white/10"
        style={{ height: size, width: size }}
      />
    );
  }

  return (
    <span
      className="flex shrink-0 items-center justify-center rounded-full bg-zinc-800 text-zinc-500 ring-1 ring-white/10"
      style={{ height: size, width: size }}
    >
      <UserRound size={Math.round(size * 0.6)} />
    </span>
  );
}

/**
 * Scheda giocatore (foto + nome e cognome) mostrata come tooltip dopo
 * un secondo di hover. Renderizzata in un portal su document.body: gli
 * elementi da cui parte l'hover vivono spesso dentro contenitori con
 * `transform` (le card sul campo usano -translate-x-1/2), che creerebbe
 * un containing block diverso dal viewport per un semplice
 * `position: fixed` interno, spostando il tooltip nel posto sbagliato.
 */
function GiocatoreTooltip({
  giocatore,
  x,
  y,
}: {
  giocatore: Giocatore;
  x: number;
  y: number;
}) {
  if (typeof document === "undefined") return null;

  return createPortal(
    <div
      className="pointer-events-none fixed z-[70] flex items-center gap-3 rounded-2xl border border-zinc-700 bg-zinc-950 px-3 py-2.5 shadow-2xl"
      style={{ left: x, top: y }}
    >
      <AvatarGiocatore giocatore={giocatore} size={44} />

      <span className="whitespace-nowrap text-sm font-bold text-white">
        {nomeGiocatore(giocatore)}
      </span>
    </div>,
    document.body
  );
}

/**
 * Selettore giocatore con foto + nome e cognome, usato al posto di un
 * <select> nativo ovunque si debba scegliere un giocatore (titolare o
 * da aggiungere in panchina): un <option> nativo non può mostrare una
 * foto in modo affidabile cross-browser.
 *
 * L'apertura è controllata dal genitore (openId/onOpenChange) invece di
 * uno stato interno: sul campo ci sono 15 di questi selettori vicinissimi
 * tra loro, e se ognuno gestisse il proprio "aperto/chiuso" in modo
 * indipendente si potevano aprire più elenchi contemporaneamente,
 * sovrapponendosi in un groviglio illeggibile. Con lo stato in comune,
 * aprirne uno chiude sempre automaticamente quello aperto in precedenza.
 */
function GiocatoreSelect({
  id,
  giocatori,
  value,
  onChange,
  openId,
  onOpenChange,
  placeholder = "Seleziona giocatore",
  compact = false,
}: {
  id: string;
  giocatori: Giocatore[];
  value: string;
  onChange: (giocatoreId: string) => void;
  openId: string | null;
  onOpenChange: (id: string | null) => void;
  placeholder?: string;
  compact?: boolean;
}) {
  const open = openId === id;

  const selezionato = giocatori.find((g) => g.id === value) ?? null;

  const hoverTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const [tooltip, setTooltip] = useState<{
    giocatore: Giocatore;
    x: number;
    y: number;
  } | null>(null);

  useEffect(() => {
    return () => {
      if (hoverTimerRef.current) {
        clearTimeout(hoverTimerRef.current);
      }
    };
  }, []);

  function annullaTimerTooltip() {
    if (hoverTimerRef.current) {
      clearTimeout(hoverTimerRef.current);
      hoverTimerRef.current = null;
    }
  }

  function programmaTooltip(
    giocatore: Giocatore,
    target: HTMLElement
  ) {
    annullaTimerTooltip();

    hoverTimerRef.current = setTimeout(() => {
      const rect = target.getBoundingClientRect();

      setTooltip({
        giocatore,
        x: rect.left,
        y: rect.bottom + 6,
      });
    }, 1000);
  }

  function nascondiTooltip() {
    annullaTimerTooltip();
    setTooltip(null);
  }

  return (
    <div className="relative min-w-0">
      <button
        type="button"
        onClick={() => onOpenChange(open ? null : id)}
        onMouseEnter={(event) =>
          selezionato &&
          programmaTooltip(selezionato, event.currentTarget)
        }
        onMouseLeave={nascondiTooltip}
        className={`flex w-full min-w-0 items-center gap-1.5 rounded-lg border border-zinc-800 bg-zinc-900 text-left text-white outline-none transition hover:border-zinc-600 ${
          compact
            ? "px-1.5 py-1.5 text-[10px]"
            : "px-2 py-2 text-xs sm:px-3 sm:py-2.5 sm:text-sm"
        }`}
      >
        {selezionato ? (
          <span className="min-w-0 flex-1 truncate font-semibold">
            {nomeGiocatore(selezionato)}
          </span>
        ) : (
          <span className="min-w-0 flex-1 truncate text-zinc-500">
            {placeholder}
          </span>
        )}

        <ChevronDown
          size={compact ? 12 : 14}
          className={`shrink-0 text-zinc-500 transition-transform ${
            open ? "rotate-180" : ""
          }`}
        />
      </button>

      {open && (
        <>
          <button
            type="button"
            className="fixed inset-0 z-40 cursor-default"
            onClick={() => onOpenChange(null)}
            aria-label="Chiudi selezione giocatore"
          />

          <div className="absolute left-0 z-50 mt-1 max-h-64 w-max min-w-full max-w-[240px] overflow-y-auto rounded-xl border border-zinc-800 bg-zinc-950 p-1.5 shadow-2xl">
            <button
              type="button"
              onClick={() => {
                onChange("");
                onOpenChange(null);
                nascondiTooltip();
              }}
              className="flex w-full items-center gap-2 rounded-lg px-2 py-2 text-left text-xs font-semibold text-zinc-500 transition hover:bg-white/5"
            >
              {placeholder}
            </button>

            {giocatori.map((giocatore) => (
              <button
                key={giocatore.id}
                type="button"
                onClick={() => {
                  onChange(giocatore.id);
                  onOpenChange(null);
                  nascondiTooltip();
                }}
                onMouseEnter={(event) =>
                  programmaTooltip(giocatore, event.currentTarget)
                }
                onMouseLeave={nascondiTooltip}
                className={`flex w-full items-center gap-2 rounded-lg px-2 py-2 text-left text-xs font-semibold transition hover:bg-white/5 ${
                  giocatore.id === value
                    ? "text-white"
                    : "text-zinc-300"
                }`}
              >
                <span className="min-w-0 flex-1 truncate">
                  {nomeGiocatore(giocatore)}
                </span>
              </button>
            ))}

            {giocatori.length === 0 && (
              <p className="px-2 py-3 text-center text-xs text-zinc-600">
                Nessun giocatore disponibile
              </p>
            )}
          </div>
        </>
      )}

      {tooltip && (
        <GiocatoreTooltip
          giocatore={tooltip.giocatore}
          x={tooltip.x}
          y={tooltip.y}
        />
      )}
    </div>
  );
}

function normalizeRel<T>(rel: T | T[] | null): T | null {
  if (Array.isArray(rel)) {
    return rel[0] ?? null;
  }

  return rel;
}

function toNumber(value: string) {
  const parsed = Number(value);

  return Number.isFinite(parsed) && parsed >= 0 ? parsed : 0;
}

const TONE_CLASSES = {
  positivo:
    "border-emerald-900/50 bg-emerald-950/20 focus-within:border-emerald-500/70 focus-within:bg-emerald-950/30",
  negativo:
    "border-rose-900/50 bg-rose-950/20 focus-within:border-rose-500/70 focus-within:bg-rose-950/30",
  neutro:
    "border-zinc-800 bg-zinc-900 focus-within:border-zinc-600",
} as const;

const TONE_LABEL_CLASSES = {
  positivo: "text-emerald-400/80",
  negativo: "text-rose-400/80",
  neutro: "text-zinc-500",
} as const;

function StatInput({
  label,
  value,
  onChange,
  tone = "neutro",
}: {
  label: string;
  value: number;
  onChange: (value: number) => void;
  tone?: keyof typeof TONE_CLASSES;
}) {
  return (
    <label
      className={`block min-w-0 rounded-xl border px-3 py-2 transition ${TONE_CLASSES[tone]}`}
    >
      <span
        className={`block truncate text-[11px] font-bold uppercase tracking-wide ${TONE_LABEL_CLASSES[tone]}`}
      >
        {label}
      </span>

      <input
        type="number"
        min={0}
        inputMode="numeric"
        value={value}
        onChange={(event) => onChange(toNumber(event.target.value))}
        className="mt-0.5 w-full min-w-0 bg-transparent text-lg font-black text-white outline-none"
      />
    </label>
  );
}

function GruppoStatistiche({
  icon: Icon,
  titolo,
  coloreClub,
  children,
}: {
  icon: ComponentType<{ className?: string; style?: CSSProperties }>;
  titolo: string;
  coloreClub: string;
  children: ReactNode;
}) {
  return (
    <div className="min-w-0 rounded-2xl border border-zinc-800/80 bg-black/20 p-3 sm:p-4">
      <div className="mb-3 flex items-center gap-2">
        <Icon className="h-4 w-4 shrink-0" style={{ color: coloreClub }} />

        <h3 className="truncate text-xs font-bold uppercase tracking-wide text-zinc-400 sm:text-sm">
          {titolo}
        </h3>
      </div>

      <div className="grid grid-cols-2 gap-2.5">{children}</div>
    </div>
  );
}

export default function PartitaEditorClient({
  partita,
  statistiche,
  giocatori,
  convocazioni,
  squadreDisponibili,
  coloreClub,
  isAdmin,
}: Props) {
  const router = useRouter();
  const { showToast } = useToast();

  const [showAnteprima, setShowAnteprima] = useState(false);
  const [inviandoComunicazione, setInviandoComunicazione] = useState(false);

  const [tab, setTab] = useState<"risultato" | "convocazioni">(
    "risultato"
  );

  const [isPending, startTransition] = useTransition();
  const [isDeleting, startDeleteTransition] = useTransition();
  const [openModificaDettagli, setOpenModificaDettagli] = useState(false);

  const [message, setMessage] = useState<string | null>(null);

  // Un solo id alla volta: garantisce che aprire un GiocatoreSelect
  // chiuda automaticamente quello eventualmente già aperto altrove
  // nella pagina (es. sul campo, dove le 15 card sono molto vicine).
  const [openGiocatoreSelectId, setOpenGiocatoreSelectId] = useState<
    string | null
  >(null);

  function handleEliminaPartita() {
    const conferma = window.confirm(
      "Eliminare definitivamente questa partita? Verranno eliminate anche statistiche e convocazioni collegate. L'operazione non è reversibile."
    );

    if (!conferma) return;

    startDeleteTransition(async () => {
      try {
        await eliminaPartita(partita.id);
        router.push("/partite");
      } catch (error) {
        setMessage(
          error instanceof Error
            ? error.message
            : "Errore durante l'eliminazione della partita."
        );
      }
    });
  }

  const [stats, setStats] = useState({
    punti_fatti:
      statistiche?.punti_fatti ??
      partita.punti_fatti ??
      0,

    punti_subiti:
      statistiche?.punti_subiti ??
      partita.punti_subiti ??
      0,

    mete_fatte:
      statistiche?.mete_fatte ??
      0,

    mete_subite:
      statistiche?.mete_subite ??
      0,

    calci_fatti:
      statistiche?.calci_fatti ??
      0,

    calci_subiti:
      statistiche?.calci_subiti ??
      0,

    ammonizioni:
      statistiche?.ammonizioni ??
      0,

    espulsioni:
      statistiche?.espulsioni ??
      0,

    punti_incontro_vinti:
      statistiche?.punti_incontro_vinti ??
      0,

    punti_incontro_persi:
      statistiche?.punti_incontro_persi ??
      0,

    touche_vinte:
      statistiche?.touche_vinte ??
      0,

    touche_perse:
      statistiche?.touche_perse ??
      0,

    mischie_vinte:
      statistiche?.mischie_vinte ??
      0,

    mischie_perse:
      statistiche?.mischie_perse ??
      0,

    placcaggi_efficaci:
      statistiche?.placcaggi_efficaci ??
      0,

    placcaggi_non_efficaci:
      statistiche?.placcaggi_non_efficaci ??
      0,

    note:
      statistiche?.note ??
      "",
  });

  const convocazioniIniziali = useMemo<ConvocazioneState[]>(() => {
  const convocazioniMap = new Map(
    convocazioni.map((convocazione) => [
      convocazione.giocatore_id,
      convocazione,
    ])
  );

  return giocatori.map((giocatore) => {
    const convocazione = convocazioniMap.get(giocatore.id);

    if (convocazione) {
      return {
        giocatore_id: convocazione.giocatore_id,
        convocato: convocazione.convocato,
        titolare: convocazione.titolare,
        capitano: convocazione.capitano,
        vicecapitano: convocazione.vicecapitano ?? false,
        posizione: convocazione.posizione,
        numero_maglia: convocazione.numero_maglia,
        ordine: convocazione.ordine,
        ruolo_panchina: convocazione.ruolo_panchina ?? null,
        note: convocazione.note,
      };
    }

    return {
      giocatore_id: giocatore.id,
      convocato: false,
      titolare: false,
      capitano: false,
      vicecapitano: false,
      posizione: "panchina",
      numero_maglia: giocatore.numero_maglia ?? null,
      ordine: null,
      ruolo_panchina: null,
      note: null,
    };
  });
}, [convocazioni, giocatori]);

  const [convocazioniState, setConvocazioniState] =
    useState<ConvocazioneState[]>(
      convocazioniIniziali
    );

  const giocatoriMap = useMemo(() => {
    return new Map(
      giocatori.map((giocatore) => [
        giocatore.id,
        giocatore,
      ])
    );
  }, [giocatori]);

  function assegnaGiocatore(
    posizione: PosizioneRugby,
    giocatoreId: string,
    numero: number
  ) {
    setConvocazioniState((prev) =>
      prev.map((item) => {
        if (item.giocatore_id === giocatoreId) {
          return {
            ...item,
            convocato: true,
            titolare: posizione !== "panchina",
            posizione,
            numero_maglia:
              posizione === "panchina"
                ? item.numero_maglia
                : numero,
            ordine:
              posizione === "panchina"
                ? item.ordine
                : numero,
          };
        }

        if (
          item.posizione === posizione &&
          posizione !== "panchina"
        ) {
          return {
            ...item,
            titolare: false,
            posizione: "panchina",
            ordine: null,
          };
        }

        return item;
      })
    );
  }

  function aggiornaConvocazione(
    giocatoreId: string,
    patch: Partial<ConvocazioneState>
  ) {
    setConvocazioniState((prev) =>
      prev.map((item) =>
        item.giocatore_id === giocatoreId
          ? {
              ...item,
              ...patch,
            }
          : item
      )
    );
  }

  /**
   * Ciclo capitano/vicecapitano su un giocatore: nessun flag -> Capitano
   * -> Vicecapitano -> nessun flag. Assegnare un ruolo lo toglie a chi
   * lo aveva prima (un solo capitano e un solo vicecapitano per volta).
   */
  function ciclaCapitano(giocatoreId: string) {
    setConvocazioniState((prev) => {
      const corrente = prev.find(
        (item) => item.giocatore_id === giocatoreId
      );

      if (!corrente) return prev;

      const prossimo: "nessuno" | "capitano" | "vicecapitano" =
        corrente.capitano
          ? "vicecapitano"
          : corrente.vicecapitano
          ? "nessuno"
          : "capitano";

      return prev.map((item) => {
        if (item.giocatore_id === giocatoreId) {
          return {
            ...item,
            capitano: prossimo === "capitano",
            vicecapitano: prossimo === "vicecapitano",
          };
        }

        return {
          ...item,
          capitano:
            prossimo === "capitano" ? false : item.capitano,
          vicecapitano:
            prossimo === "vicecapitano"
              ? false
              : item.vicecapitano,
        };
      });
    });
  }

  function aggiungiInPanchina(
    giocatoreId: string
  ) {
    if (!giocatoreId) return;

    const convocazioneEsistente =
      convocazioniState.find(
        (item) =>
          item.giocatore_id === giocatoreId
      );

    aggiornaConvocazione(
      giocatoreId,
      {
        convocato: true,
        titolare: false,
        posizione: "panchina",
        numero_maglia:
          convocazioneEsistente?.numero_maglia ??
          null,
        ordine:
          convocazioneEsistente?.ordine ??
          null,
        ruolo_panchina:
          convocazioneEsistente?.ruolo_panchina ??
          null,
      }
    );
  }
  function normalizzaRuolo(value: string | null | undefined) {
  const normalizzato = value
    ?.toLowerCase()
    .trim()
    .replace(/°/g, "")
    .replace(/\s+/g, "_");

  // "N° 8" normalizza in "n_8": è un alias di "numero_8".
  if (normalizzato === "n_8" || normalizzato === "no_8") {
    return "numero_8";
  }

  return normalizzato;
}

const ruoliCompatibili: Record<PosizioneRugby, string[]> = {
  // 1
  pilone_sx: [
    "pilone_sx",
  ],

  // 2
  tallonatore: [
    "tallonatore",
  ],

  // 3
  pilone_dx: [
    "pilone_dx",
  ],

  // 4 e 5
  seconda_linea_sx: [
    "seconda_linea",
  ],

  seconda_linea_dx: [
    "seconda_linea",
  ],

  // 6
  terza_linea_sx: [
    "flanker_blind_side",
    "flanker_open_side",
  ],

  // 7
  terza_linea_dx: [
    "flanker_open_side",
    "flanker_blind_side",
  ],

  // 8
  numero_8: [
    "numero_8",
    "flanker_blind_side",
    "flanker_open_side",
  ],

  // 9
  mediano_mischia: [
    "mediano_mischia",
  ],

  // 10
  mediano_apertura: [
    "mediano_apertura",
  ],

  // 11
  ala_sx: [
    "ala",
  ],

  // 12
  primo_centro: [
    "primo_centro",
  ],

  // 13
  secondo_centro: [
    "secondo_centro",
    "primo_centro",
  ],

  // 14
  ala_dx: [
    "ala",
  ],

  // 15
  estremo: [
    "estremo",
  ],

  panchina: [],
};

function giocatoriPerPosizione(
  giocatori: Giocatore[],
  posizione: PosizioneRugby
) {
  const compatibili =
    ruoliCompatibili[posizione] ?? [];

  return giocatori.filter((giocatore) => {
    const ruolo1 = normalizzaRuolo(
      giocatore.ruolo_1
    );

    const ruolo2 = normalizzaRuolo(
      giocatore.ruolo_2
    );

    // Un giocatore senza ruolo impostato non va nascosto: non potendo
    // sapere se è compatibile, lo mostriamo in ogni posizione.
    if (!ruolo1 && !ruolo2) {
      return true;
    }

    return (
      compatibili.includes(ruolo1 ?? "") ||
      compatibili.includes(ruolo2 ?? "")
    );
  });
}
  function rimuoviDallaPanchina(
    giocatoreId: string
  ) {
    aggiornaConvocazione(
      giocatoreId,
      {
        convocato: false,
        titolare: false,
        capitano: false,
        posizione: "panchina",
        ordine: null,
      }
    );
  }

  function salvaStats() {
    setMessage(null);

    startTransition(async () => {
      try {
        await salvaStatistichePartita({
          partita_id: partita.id,
          ...stats,
          note: stats.note,
        });

        setMessage(
          "Statistiche salvate correttamente."
        );
      } catch (error) {
        setMessage(
          error instanceof Error
            ? error.message
            : "Errore durante il salvataggio."
        );
      }
    });
  }

  function salvaConvocazioni() {
    setMessage(null);

    startTransition(async () => {
      try {
        await salvaConvocazioniPartita(
          partita.id,
          convocazioniState.filter(
            (item) => item.convocato
          )
        );

        setMessage(
          "Convocazioni salvate correttamente."
        );
      } catch (error) {
        setMessage(
          error instanceof Error
            ? error.message
            : "Errore durante il salvataggio."
        );
      }
    });
  }

  const squadraCasa =
    normalizeRel(partita.squadra_casa);

  const squadraFuori =
    normalizeRel(partita.squadra_fuori);

  const nomeSquadraCasa =
    squadraCasa?.nome ??
    "Squadra casa";

  const nomeSquadraFuori =
    squadraFuori?.nome ??
    "Squadra fuori";

  const titolari = formazione.map((slot) => {
  const convocazione = convocazioniState.find(
    (item) => item.posizione === slot.posizione
  );

  return {
    ...slot,
    convocazione,
    giocatore: convocazione
      ? giocatoriMap.get(convocazione.giocatore_id)
      : null,
  };
});

  const giocatoriPanchina = giocatori.filter(
    (giocatore) => {
      const convocazione =
        convocazioniState.find(
          (item) =>
            item.giocatore_id === giocatore.id
        );

      return (
        convocazione?.convocato &&
        convocazione.posizione === "panchina"
      );
    }
  );

  const giocatoriDisponibiliPanchina = giocatori.filter((giocatore) => {
  const convocazione = convocazioniState.find(
    (item) => item.giocatore_id === giocatore.id
  );

  return !convocazione?.convocato;
});

  /*
   * ANTEPRIMA CONVOCAZIONI + COMUNICAZIONE FORMAZIONE
   * ==================================================
   * Panchina ordinata per numero di maglia (i giocatori senza
   * numero finiscono in coda), usata sia nell'anteprima sia nel
   * testo generato per la comunicazione.
   */
  const panchinaOrdinata = [...giocatoriPanchina].sort((a, b) => {
    const convA = convocazioniState.find(
      (item) => item.giocatore_id === a.id
    );
    const convB = convocazioniState.find(
      (item) => item.giocatore_id === b.id
    );

    const numA = convA?.numero_maglia ?? 999;
    const numB = convB?.numero_maglia ?? 999;

    return numA - numB;
  });

  const titoloComunicazioneFormazione = `Formazione per partita ${nomeSquadraCasa} vs ${nomeSquadraFuori}`;

  function testoFormazione() {
    const righeTitolari = titolari
      .map((slot) => {
        const nome = slot.giocatore
          ? nomeGiocatore(slot.giocatore)
          : "Non assegnato";

        const badge = slot.convocazione?.capitano
          ? " (C)"
          : slot.convocazione?.vicecapitano
          ? " (VC)"
          : "";

        return `${slot.numero}. ${slot.label} - ${nome}${badge}`;
      })
      .join("\n");

    const righePanchina = panchinaOrdinata
      .map((giocatore) => {
        const convocazione = convocazioniState.find(
          (item) => item.giocatore_id === giocatore.id
        );

        const numero = convocazione?.numero_maglia
          ? `${convocazione.numero_maglia}. `
          : "";

        return `${numero}${nomeGiocatore(giocatore)}`;
      })
      .join(", ");

    const dataFormattata = partita.data_partita
      ? new Date(partita.data_partita).toLocaleDateString("it-IT", {
          weekday: "long",
          day: "numeric",
          month: "long",
        })
      : "";

    const rigaData = [dataFormattata, partita.ora_partita, partita.luogo]
      .filter(Boolean)
      .join(" - ");

    return [
      `${nomeSquadraCasa} vs ${nomeSquadraFuori}`,
      rigaData,
      "",
      "Formazione titolare:",
      righeTitolari,
      righePanchina ? `\nPanchina: ${righePanchina}` : "",
    ]
      .filter((riga) => riga !== "")
      .join("\n");
  }

  async function inviaComunicazioneFormazione() {
    if (inviandoComunicazione) return;

    setInviandoComunicazione(true);

    try {
      const {
        data: { user },
      } = await supabase.auth.getUser();

      if (!user) {
        showToast({
          type: "error",
          title: "Non autenticato",
          message: "Effettua di nuovo l'accesso e riprova.",
        });

        return;
      }

      const { data: profilo, error: profiloError } = await supabase
        .from("profili")
        .select("id")
        .eq("auth_user_id", user.id)
        .single();

      if (profiloError || !profilo) {
        showToast({
          type: "error",
          title: "Profilo non trovato",
          message: "Impossibile creare la comunicazione.",
        });

        return;
      }

      const { data: creata, error } = await supabase
        .from("comunicazioni")
        .insert({
          club_id: partita.club_id,
          titolo: titoloComunicazioneFormazione,
          descrizione: testoFormazione(),
          destinatari_tipo: ["tutti"],
          destinatari_profili: [],
          destinatari_giocatori: [],
          created_by: profilo.id,
          updated_at: new Date().toISOString(),
        })
        .select("id")
        .single();

      if (error || !creata?.id) {
        showToast({
          type: "error",
          title: "Comunicazione non creata",
          message:
            error?.message ||
            "Errore durante la creazione della comunicazione.",
        });

        return;
      }

      setShowAnteprima(false);

      const response = await fetch("/api/push/send", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ comunicazione_id: creata.id }),
      });

      const result = await response.json().catch(() => null);

      if (!response.ok || !result?.success) {
        showToast({
          type: "error",
          title: "Comunicazione creata, notifiche push non inviate",
          message:
            result?.message ||
            "Errore durante l'invio delle notifiche push.",
        });

        return;
      }

      const {
        destinatari = 0,
        dispositivi = 0,
        sent = 0,
        failed = 0,
      } = result;

      if (dispositivi === 0) {
        showToast({
          type: "info",
          title: "Formazione pubblicata",
          message: `Notifica in-app creata per ${destinatari} destinatari. Nessun dispositivo con notifiche push attive.`,
        });

        return;
      }

      showToast({
        type: failed > 0 ? "error" : "success",
        title: "Formazione pubblicata",
        message: `Push inviata a ${sent} dispositivi su ${dispositivi}${
          failed > 0 ? ` (${failed} falliti)` : ""
        }.`,
      });
    } catch (err) {
      console.error("Errore invio comunicazione formazione:", err);

      showToast({
        type: "error",
        title: "Errore",
        message:
          err instanceof Error
            ? err.message
            : "Errore imprevisto durante l'invio della comunicazione.",
      });
    } finally {
      setInviandoComunicazione(false);
    }
  }

  return (
    <div className="min-w-0 space-y-4 sm:space-y-6">
      {/* =====================================================
          HEADER
      ====================================================== */}
      <div
        className="
          overflow-hidden
          rounded-2xl
          border border-zinc-800
          bg-zinc-950
          p-4
          sm:rounded-3xl
          sm:p-6
        "
        style={{
          boxShadow: `0 0 40px ${coloreClub}18`,
        }}
      >
        <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
          <div className="min-w-0">
            <div
              className="
                mb-3
                inline-flex
                items-center
                gap-2
                rounded-full
                border
                px-3
                py-1
                text-[10px]
                font-bold
                uppercase
                tracking-[0.18em]
                sm:text-xs
                sm:tracking-[0.25em]
              "
              style={{
                borderColor: `${coloreClub}55`,
                backgroundColor: `${coloreClub}18`,
                color: coloreClub,
              }}
            >
              <Trophy className="h-3.5 w-3.5 shrink-0" />

              Gestione Partita
            </div>

            <h1 className="break-words text-2xl font-black leading-tight text-white sm:text-3xl">
              {nomeSquadraCasa}

              <span className="mx-2 text-zinc-600">
                vs
              </span>

              {nomeSquadraFuori}
            </h1>

            <p className="mt-2 text-sm leading-6 text-zinc-400">
              Modifica punteggio, statistiche e
              convocazioni della partita.
            </p>

            {isAdmin && (
              <div className="mt-4 flex flex-wrap items-center gap-2">
                <button
                  type="button"
                  onClick={() => setOpenModificaDettagli(true)}
                  className="
                    inline-flex
                    items-center
                    gap-2
                    rounded-xl
                    border
                    px-3
                    py-2
                    text-xs
                    font-bold
                    uppercase
                    tracking-wider
                    transition
                  "
                  style={{
                    borderColor: `${coloreClub}45`,
                    backgroundColor: `${coloreClub}12`,
                    color: coloreClub,
                  }}
                >
                  <Pencil className="h-3.5 w-3.5" />
                  Modifica dettagli
                </button>

                <button
                  type="button"
                  onClick={handleEliminaPartita}
                  disabled={isDeleting}
                  className="
                    inline-flex
                    items-center
                    gap-2
                    rounded-xl
                    border
                    border-red-500/30
                    bg-red-500/10
                    px-3
                    py-2
                    text-xs
                    font-bold
                    uppercase
                    tracking-wider
                    text-red-300
                    transition
                    hover:bg-red-500/20
                    disabled:cursor-not-allowed
                    disabled:opacity-50
                  "
                >
                  <Trash2 className="h-3.5 w-3.5" />
                  {isDeleting ? "Eliminazione..." : "Elimina partita"}
                </button>
              </div>
            )}
          </div>

          <div
            className="
              flex
              shrink-0
              items-center
              justify-between
              gap-5
              rounded-2xl
              border
              px-4
              py-3
              md:block
              md:px-5
              md:text-center
            "
            style={{
              borderColor: `${coloreClub}44`,
              backgroundColor: `${coloreClub}12`,
            }}
          >
            <p className="text-[10px] uppercase tracking-widest text-zinc-400 sm:text-xs">
              Risultato
            </p>

            <p className="text-2xl font-black text-white sm:text-3xl">
              {stats.punti_fatti}

              <span className="mx-2 text-zinc-600">
                -
              </span>

              {stats.punti_subiti}
            </p>
          </div>
        </div>
      </div>

      {/* =====================================================
          TAB
      ====================================================== */}
      <div className="min-w-0 overflow-hidden rounded-2xl border border-zinc-800 bg-zinc-950 p-2">
        <div
          className="
            flex
            w-full
            gap-2
            overflow-x-auto
            overscroll-x-contain
            pb-1
            [-ms-overflow-style:none]
            [scrollbar-width:none]
            [&::-webkit-scrollbar]:hidden
          "
        >
          <button
            type="button"
            onClick={() => setTab("risultato")}
            className="
              inline-flex
              shrink-0
              items-center
              gap-2
              whitespace-nowrap
              rounded-xl
              px-4
              py-3
              text-sm
              font-bold
              transition
            "
            style={
              tab === "risultato"
                ? {
                    color: coloreClub,
                    backgroundColor: `${coloreClub}20`,
                    border: `1px solid ${coloreClub}55`,
                  }
                : {
                    color: "#a1a1aa",
                    border:
                      "1px solid transparent",
                  }
            }
          >
            <CircleDot className="h-4 w-4 shrink-0" />

            <span className="sm:hidden">
              Statistiche
            </span>

            <span className="hidden sm:inline">
              Punteggio e statistiche
            </span>
          </button>

          <button
            type="button"
            onClick={() => setTab("convocazioni")}
            className="
              inline-flex
              shrink-0
              items-center
              gap-2
              whitespace-nowrap
              rounded-xl
              px-4
              py-3
              text-sm
              font-bold
              transition
            "
            style={
              tab === "convocazioni"
                ? {
                    color: coloreClub,
                    backgroundColor: `${coloreClub}20`,
                    border: `1px solid ${coloreClub}55`,
                  }
                : {
                    color: "#a1a1aa",
                    border:
                      "1px solid transparent",
                  }
            }
          >
            <Users className="h-4 w-4 shrink-0" />

            Convocazioni
          </button>
        </div>
      </div>

      {/* =====================================================
          MESSAGGIO
      ====================================================== */}
      {message && (
        <div className="rounded-2xl border border-zinc-800 bg-zinc-950 px-4 py-3 text-sm text-zinc-300">
          {message}
        </div>
      )}

      {/* =====================================================
          TAB RISULTATO
      ====================================================== */}
      {tab === "risultato" && (
        <div className="rounded-2xl border border-zinc-800 bg-zinc-950 p-4 sm:rounded-3xl sm:p-5">
          <div className="mb-5 flex items-center gap-3">
            <Shield
              className="h-5 w-5 shrink-0"
              style={{
                color: coloreClub,
              }}
            />

            <h2 className="text-lg font-black text-white sm:text-xl">
              Punteggio e statistiche
            </h2>
          </div>

          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 sm:gap-4 xl:grid-cols-4">
            <GruppoStatistiche icon={Trophy} titolo="Punteggio" coloreClub={coloreClub}>
              <StatInput
                label="Fatti"
                tone="positivo"
                value={stats.punti_fatti}
                onChange={(v) => setStats((prev) => ({ ...prev, punti_fatti: v }))}
              />
              <StatInput
                label="Subiti"
                tone="negativo"
                value={stats.punti_subiti}
                onChange={(v) => setStats((prev) => ({ ...prev, punti_subiti: v }))}
              />
            </GruppoStatistiche>

            <GruppoStatistiche icon={CircleDot} titolo="Mete" coloreClub={coloreClub}>
              <StatInput
                label="Fatte"
                tone="positivo"
                value={stats.mete_fatte}
                onChange={(v) => setStats((prev) => ({ ...prev, mete_fatte: v }))}
              />
              <StatInput
                label="Subite"
                tone="negativo"
                value={stats.mete_subite}
                onChange={(v) => setStats((prev) => ({ ...prev, mete_subite: v }))}
              />
            </GruppoStatistiche>

            <GruppoStatistiche icon={Target} titolo="Calci piazzati" coloreClub={coloreClub}>
              <StatInput
                label="Fatti"
                tone="positivo"
                value={stats.calci_fatti}
                onChange={(v) => setStats((prev) => ({ ...prev, calci_fatti: v }))}
              />
              <StatInput
                label="Subiti"
                tone="negativo"
                value={stats.calci_subiti}
                onChange={(v) => setStats((prev) => ({ ...prev, calci_subiti: v }))}
              />
            </GruppoStatistiche>

            <GruppoStatistiche icon={AlertTriangle} titolo="Disciplina" coloreClub={coloreClub}>
              <StatInput
                label="Ammonizioni"
                tone="neutro"
                value={stats.ammonizioni}
                onChange={(v) => setStats((prev) => ({ ...prev, ammonizioni: v }))}
              />
              <StatInput
                label="Espulsioni"
                tone="negativo"
                value={stats.espulsioni}
                onChange={(v) => setStats((prev) => ({ ...prev, espulsioni: v }))}
              />
            </GruppoStatistiche>

            <GruppoStatistiche icon={Layers} titolo="Punti di incontro" coloreClub={coloreClub}>
              <StatInput
                label="Vinti"
                tone="positivo"
                value={stats.punti_incontro_vinti}
                onChange={(v) => setStats((prev) => ({ ...prev, punti_incontro_vinti: v }))}
              />
              <StatInput
                label="Persi"
                tone="negativo"
                value={stats.punti_incontro_persi}
                onChange={(v) => setStats((prev) => ({ ...prev, punti_incontro_persi: v }))}
              />
            </GruppoStatistiche>

            <GruppoStatistiche icon={RefreshCw} titolo="Touche" coloreClub={coloreClub}>
              <StatInput
                label="Vinte"
                tone="positivo"
                value={stats.touche_vinte}
                onChange={(v) => setStats((prev) => ({ ...prev, touche_vinte: v }))}
              />
              <StatInput
                label="Perse"
                tone="negativo"
                value={stats.touche_perse}
                onChange={(v) => setStats((prev) => ({ ...prev, touche_perse: v }))}
              />
            </GruppoStatistiche>

            <GruppoStatistiche icon={Repeat} titolo="Mischie" coloreClub={coloreClub}>
              <StatInput
                label="Vinte"
                tone="positivo"
                value={stats.mischie_vinte}
                onChange={(v) => setStats((prev) => ({ ...prev, mischie_vinte: v }))}
              />
              <StatInput
                label="Perse"
                tone="negativo"
                value={stats.mischie_perse}
                onChange={(v) => setStats((prev) => ({ ...prev, mischie_perse: v }))}
              />
            </GruppoStatistiche>

            <GruppoStatistiche icon={ShieldCheck} titolo="Placcaggi" coloreClub={coloreClub}>
              <StatInput
                label="Efficaci"
                tone="positivo"
                value={stats.placcaggi_efficaci}
                onChange={(v) => setStats((prev) => ({ ...prev, placcaggi_efficaci: v }))}
              />
              <StatInput
                label="Non efficaci"
                tone="negativo"
                value={stats.placcaggi_non_efficaci}
                onChange={(v) => setStats((prev) => ({ ...prev, placcaggi_non_efficaci: v }))}
              />
            </GruppoStatistiche>
          </div>

          <label className="mt-4 block space-y-2">
            <span className="text-sm font-semibold text-zinc-300">
              Note
            </span>

            <textarea
              value={stats.note}
              onChange={(event) =>
                setStats((prev) => ({
                  ...prev,
                  note: event.target.value,
                }))
              }
              rows={4}
              className="
                w-full
                resize-none
                rounded-xl
                border border-zinc-800
                bg-zinc-900
                px-4
                py-3
                text-base
                text-white
                outline-none
                transition
              "
            />
          </label>

          {isAdmin && (
          <button
            type="button"
            onClick={salvaStats}
            disabled={isPending}
            className="
              mt-5
              inline-flex
              w-full
              items-center
              justify-center
              gap-2
              rounded-xl
              px-5
              py-3
              text-sm
              font-bold
              text-zinc-950
              disabled:opacity-60
              sm:w-auto
            "
            style={{
              backgroundColor: coloreClub,
            }}
          >
            <Save className="h-4 w-4" />

            {isPending
              ? "Salvataggio..."
              : "Salva statistiche"}
          </button>
          )}
        </div>
      )}

      {/* =====================================================
          TAB CONVOCAZIONI
      ====================================================== */}
      {tab === "convocazioni" && (
        <div className="space-y-4 sm:space-y-6">
          <div
            className="
              rounded-2xl
              border border-zinc-800
              bg-zinc-950
              p-4
              sm:rounded-3xl
              sm:p-5
            "
            style={{
              boxShadow: `0 0 32px ${coloreClub}12`,
            }}
          >
            {/* HEADER CONVOCAZIONI */}
            <div className="mb-5 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
              <div className="min-w-0">
                <h2 className="text-lg font-black text-white sm:text-xl">
                  Formazione titolare
                </h2>

                <p className="mt-1 text-sm leading-6 text-zinc-400">
                  Desktop: panchina a sinistra e
                  campo rugby. Mobile: elenco
                  ordinato da 1 a 15.
                </p>
              </div>

              <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
                <button
                  type="button"
                  onClick={() => setShowAnteprima(true)}
                  className="
                    inline-flex
                    w-full
                    shrink-0
                    items-center
                    justify-center
                    gap-2
                    rounded-xl
                    border border-zinc-800
                    px-5
                    py-3
                    text-sm
                    font-bold
                    text-zinc-200
                    transition
                    hover:bg-white/5
                    sm:w-auto
                  "
                >
                  <Eye className="h-4 w-4" />
                  Anteprima
                </button>

                {isAdmin && (
                <button
                  type="button"
                  onClick={salvaConvocazioni}
                  disabled={isPending}
                  className="
                    inline-flex
                    w-full
                    shrink-0
                    items-center
                    justify-center
                    gap-2
                    rounded-xl
                    px-5
                    py-3
                    text-sm
                    font-bold
                    text-zinc-950
                    disabled:opacity-60
                    sm:w-auto
                  "
                  style={{
                    backgroundColor: coloreClub,
                  }}
                >
                  <Save className="h-4 w-4" />

                  {isPending
                    ? "Salvataggio..."
                    : "Salva convocazioni"}
                </button>
                )}
              </div>
            </div>

            {/* =================================================
                MOBILE/TABLET: TITOLARI 1-15
                (elenco impilato: usato finché lo spazio
                orizzontale non basta a mostrare il campo
                senza sovrapporre le card dei giocatori)
            ================================================== */}
            <div className="space-y-3 xl:hidden">
              {titolari.map((slot) => (
                <div
                  key={slot.posizione}
                  className="
                    rounded-2xl
                    border border-zinc-800
                    bg-zinc-900
                    p-3
                  "
                >
                  <div className="mb-3 flex items-center justify-between gap-3">
                    <div className="min-w-0">
                      <p
                        className="text-lg font-black"
                        style={{
                          color: coloreClub,
                        }}
                      >
                        #{slot.numero}
                      </p>

                      <p className="truncate text-xs font-bold uppercase text-zinc-400">
                        {slot.label}
                      </p>
                    </div>

                    <button
                      type="button"
                      disabled={!slot.giocatore}
                      onClick={() =>
                        slot.convocazione &&
                        ciclaCapitano(
                          slot.convocazione
                            .giocatore_id
                        )
                      }
                      title={
                        slot.convocazione?.capitano
                          ? "Capitano (clicca per Vicecapitano)"
                          : slot.convocazione
                              ?.vicecapitano
                          ? "Vicecapitano (clicca per rimuovere)"
                          : "Imposta capitano"
                      }
                      className="
                        relative
                        flex
                        h-11
                        w-11
                        shrink-0
                        items-center
                        justify-center
                        rounded-xl
                        disabled:cursor-not-allowed
                        disabled:opacity-40
                      "
                    >
                      <Shirt
                        className="h-7 w-7"
                        style={{
                          color: slot.convocazione
                            ?.capitano
                            ? "#facc15"
                            : slot.convocazione
                                ?.vicecapitano
                            ? "#a1a1aa"
                            : "#71717a",
                        }}
                        fill={
                          slot.convocazione
                            ?.capitano ||
                          slot.convocazione
                            ?.vicecapitano
                            ? "currentColor"
                            : "none"
                        }
                      />

                      {(slot.convocazione
                        ?.capitano ||
                        slot.convocazione
                          ?.vicecapitano) && (
                        <span className="pointer-events-none absolute inset-0 flex items-center justify-center text-[8px] font-black text-zinc-950">
                          {slot.convocazione
                            ?.capitano
                            ? "C"
                            : "VC"}
                        </span>
                      )}
                    </button>
                  </div>

                  <GiocatoreSelect
                    id={`titolare-mobile-${slot.posizione}`}
                    openId={openGiocatoreSelectId}
                    onOpenChange={setOpenGiocatoreSelectId}
                    giocatori={giocatoriPerPosizione(
                      giocatori,
                      slot.posizione
                    )}
                    value={
                      slot.convocazione
                        ?.giocatore_id ?? ""
                    }
                    onChange={(giocatoreId) => {
                      if (!giocatoreId) {
                        return;
                      }

                      assegnaGiocatore(
                        slot.posizione,
                        giocatoreId,
                        slot.numero
                      );
                    }}
                  />
                </div>
              ))}
            </div>

            {/* =================================================
                DESKTOP (xl+):
                CAMPO SOPRA (largo a piena larghezza) +
                PANCHINA SOTTO.
                Sotto xl lo spazio non basta a mostrare il
                campo senza sovrapporre le card: si usa
                l'elenco impilato sopra.
            ================================================== */}
            <div
              className="
                hidden
                xl:flex
                xl:flex-col
                xl:gap-5
                2xl:gap-6
              "
            >
              {/* ===============================================
                  PANCHINA DESKTOP (ordinata dopo il campo)
              ================================================ */}
              <aside className="order-2 min-w-0">
                <div
                  className="
                    rounded-3xl
                    border border-zinc-800
                    bg-zinc-950
                    p-4
                  "
                >
                  <div className="mb-4">
                    <div className="flex items-center gap-2">
                      <Users
                        className="h-5 w-5"
                        style={{
                          color: coloreClub,
                        }}
                      />

                      <h3 className="text-lg font-black text-white">
                        Panchina
                      </h3>
                    </div>

                    <p className="mt-2 text-sm leading-6 text-zinc-400">
                      Aggiungi i giocatori
                      convocati dalla panchina.
                    </p>
                  </div>

                  {/* AGGIUNGI */}
                  <div
                    className="
                      rounded-2xl
                      border
                      border-dashed
                      p-3
                    "
                    style={{
                      borderColor: `${coloreClub}55`,
                      backgroundColor: `${coloreClub}0D`,
                    }}
                  >
                    <p
                      className="
                        mb-2
                        text-xs
                        font-black
                        uppercase
                        tracking-widest
                      "
                      style={{
                        color: coloreClub,
                      }}
                    >
                      Aggiungi giocatore
                    </p>

                    <GiocatoreSelect
                      id="panchina-aggiungi-desktop"
                      openId={openGiocatoreSelectId}
                      onOpenChange={setOpenGiocatoreSelectId}
                      giocatori={giocatoriDisponibiliPanchina}
                      value=""
                      onChange={(giocatoreId) => {
                        if (!giocatoreId) {
                          return;
                        }

                        aggiungiInPanchina(
                          giocatoreId
                        );
                      }}
                    />
                  </div>

                  {/* ELENCO PANCHINA */}
                  <div
                    className="
                      mt-4
                      max-h-[700px]
                      space-y-3
                      overflow-y-auto
                      pr-1
                      [-ms-overflow-style:none]
                      [scrollbar-width:thin]
                    "
                  >
                    {giocatoriPanchina.map(
                      (giocatore) => {
                        const convocazione =
                          convocazioniState.find(
                            (item) =>
                              item.giocatore_id ===
                              giocatore.id
                          );

                        if (!convocazione) {
                          return null;
                        }

                        return (
                          <div
                            key={giocatore.id}
                            className="
                              rounded-2xl
                              border border-zinc-800
                              bg-zinc-900
                              p-3
                            "
                          >
                            <div className="flex items-start justify-between gap-3">
                              <div className="min-w-0">
                                <p className="truncate text-sm font-black text-white">
                                  {nomeGiocatore(
                                    giocatore
                                  )}
                                </p>

                                <p className="mt-1 truncate text-xs text-zinc-500">
                                  {giocatore.ruolo_1 ||
                                    giocatore.reparto ||
                                    "Ruolo non indicato"}
                                </p>
                              </div>

                              <button
                                type="button"
                                onClick={() =>
                                  rimuoviDallaPanchina(
                                    giocatore.id
                                  )
                                }
                                className="
                                  shrink-0
                                  rounded-lg
                                  border border-zinc-700
                                  px-2
                                  py-1
                                  text-[10px]
                                  font-bold
                                  text-zinc-300
                                  transition
                                  hover:border-zinc-500
                                  hover:text-white
                                "
                              >
                                Rimuovi
                              </button>
                            </div>

                            <div className="mt-3 grid grid-cols-[0.7fr_1.3fr] gap-2">
                              <label className="min-w-0">
                                <span className="mb-1 block text-[10px] font-bold uppercase text-zinc-500">
                                  Numero
                                </span>

                                <input
                                  type="number"
                                  min={16}
                                  max={99}
                                  inputMode="numeric"
                                  value={
                                    convocazione.numero_maglia ??
                                    ""
                                  }
                                  onChange={(event) =>
                                    aggiornaConvocazione(
                                      giocatore.id,
                                      {
                                        numero_maglia:
                                          event.target
                                            .value
                                            ? Number(
                                                event
                                                  .target
                                                  .value
                                              )
                                            : null,
                                      }
                                    )
                                  }
                                  className="
                                    w-full
                                    min-w-0
                                    rounded-xl
                                    border border-zinc-800
                                    bg-zinc-950
                                    px-3
                                    py-2
                                    text-sm
                                    font-bold
                                    text-white
                                    outline-none
                                  "
                                />
                              </label>

                              <label className="min-w-0">
                                <span className="mb-1 block text-[10px] font-bold uppercase text-zinc-500">
                                  Ruolo
                                </span>

                                <select
                                  value={
                                    convocazione.ruolo_panchina ??
                                    ""
                                  }
                                  onChange={(event) =>
                                    aggiornaConvocazione(
                                      giocatore.id,
                                      {
                                        ruolo_panchina:
                                          event.target
                                            .value ||
                                          null,
                                      }
                                    )
                                  }
                                  className="
                                    w-full
                                    min-w-0
                                    rounded-xl
                                    border border-zinc-800
                                    bg-zinc-950
                                    px-3
                                    py-2
                                    text-sm
                                    font-bold
                                    text-white
                                    outline-none
                                  "
                                >
                                  <option value="">
                                    Seleziona ruolo
                                  </option>

                                  {ruoliDisponibili(
                                    giocatore
                                  ).map((ruolo) => (
                                    <option
                                      key={ruolo}
                                      value={ruolo}
                                    >
                                      {ruolo}
                                    </option>
                                  ))}
                                </select>
                              </label>
                            </div>
                          </div>
                        );
                      }
                    )}

                    {giocatoriPanchina.length ===
                      0 && (
                      <div
                        className="
                          rounded-2xl
                          border
                          border-dashed
                          border-zinc-800
                          px-4
                          py-8
                          text-center
                        "
                      >
                        <Users className="mx-auto h-6 w-6 text-zinc-600" />

                        <p className="mt-2 text-sm font-bold text-zinc-500">
                          Nessun giocatore
                        </p>

                        <p className="mt-1 text-xs leading-5 text-zinc-600">
                          Usa il menu sopra per
                          aggiungere la panchina.
                        </p>
                      </div>
                    )}
                  </div>
                </div>
              </aside>

              {/* ===============================================
                  CAMPO DESKTOP (ordinato prima della panchina,
                  a piena larghezza del contenitore)
              ================================================ */}
              <div className="order-1 min-w-0 xl:w-full">
                <div
                  className="
                    @container
                    relative
                    h-[760px]
                    w-full
                    overflow-hidden
                    rounded-[2rem]
                    border border-white/20
                    bg-[#68a51b]
                    shadow-2xl
                    2xl:h-[900px]
                  "
                >
                  {/* LINEE CAMPO */}
                  <div className="pointer-events-none absolute inset-0">
                    {/* LINEA META ALTA */}
                    <div className="absolute inset-x-0 top-[7%] border-t-4 border-white/80" />

                    {/* 5 METRI ALTA */}
                    <div className="absolute inset-x-0 top-[13%] border-t-2 border-dashed border-white/70" />

                    {/* 22 METRI ALTA */}
                    <div className="absolute inset-x-0 top-[27%] border-t-2 border-white/70" />

                    {/* 10 METRI ALTA */}
                    <div className="absolute inset-x-0 top-[40%] border-t-2 border-dashed border-white/70" />

                    {/* CENTRO */}
                    <div className="absolute inset-x-0 top-[50%] border-t-4 border-white/80" />

                    {/* 10 METRI BASSA */}
                    <div className="absolute inset-x-0 bottom-[40%] border-t-2 border-dashed border-white/70" />

                    {/* 22 METRI BASSA */}
                    <div className="absolute inset-x-0 bottom-[27%] border-t-2 border-white/70" />

                    {/* 5 METRI BASSA */}
                    <div className="absolute inset-x-0 bottom-[13%] border-t-2 border-dashed border-white/80" />

                    {/* LINEA META BASSA */}
                    <div className="absolute inset-x-0 bottom-[7%] border-t-4 border-white/80" />

                    {/* LINEE LATERALI */}
                    <div className="absolute inset-y-0 left-[6%] border-l-2 border-dashed border-white/70" />

                    <div className="absolute inset-y-0 right-[6%] border-l-2 border-dashed border-white/70" />

                    {/* PALI ALTI */}
                    <div
                      className="
                        absolute
                        left-1/2
                        top-0
                        h-[72px]
                        w-[130px]
                        -translate-x-1/2
                        border-x-4
                        border-b-4
                        border-white/90
                      "
                    />

                    {/* PALI BASSI */}
                    <div
                      className="
                        absolute
                        bottom-0
                        left-1/2
                        h-[72px]
                        w-[130px]
                        -translate-x-1/2
                        border-x-4
                        border-t-4
                        border-white/90
                      "
                    />
                  </div>

                  {/* GIOCATORI */}
                  <div className="relative z-10 h-full w-full">
                    {titolari.map((slot) => (
                      <div
                        key={slot.posizione}
                        className={`
                          absolute
                          z-0
                          w-[104px]
                          -translate-x-1/2
                          focus-within:z-50
                          @xs:w-[116px]
                          @sm:w-[128px]
                          @md:w-[140px]
                          @lg:w-[150px]
                          @2xl:w-[162px]
                          @4xl:w-[180px]
                          ${fieldPosition[slot.numero]}
                        `}
                      >
                        <div
                          className="
                            rounded-2xl
                            border border-white/25
                            bg-zinc-950/90
                            p-1.5
                            shadow-2xl
                            backdrop-blur
                            @sm:p-2
                          "
                        >
                          <div className="mb-1.5 flex items-center justify-between gap-1.5 @sm:mb-2 @sm:gap-2">
                            <div className="min-w-0">
                              <p
                                className="text-sm font-black leading-none @sm:text-base @lg:text-lg @2xl:text-xl"
                                style={{
                                  color:
                                    coloreClub,
                                }}
                              >
                                <span
                                    className="shrink-0 font-black"
                                    style={{ color: coloreClub }}
                                  >
                                    #{slot.numero}
                                  </span>
                                 <span className="mt-1 hidden truncate text-[10px] font-bold uppercase text-zinc-400 @md:inline">
                                   - {slot.label}
                              </span>
                              </p>


                            </div>

                            <button
                              type="button"
                              disabled={!slot.giocatore}
                              onClick={() =>
                                slot.convocazione &&
                                ciclaCapitano(
                                  slot.convocazione
                                    .giocatore_id
                                )
                              }
                              title={
                                slot.convocazione
                                  ?.capitano
                                  ? "Capitano (clicca per Vicecapitano)"
                                  : slot.convocazione
                                      ?.vicecapitano
                                  ? "Vicecapitano (clicca per rimuovere)"
                                  : "Imposta capitano"
                              }
                              className="
                                relative
                                shrink-0
                                disabled:cursor-not-allowed
                                disabled:opacity-40
                              "
                            >
                              <Shirt
                                className="h-4 w-4 @sm:h-5 @sm:w-5 @lg:h-6 @lg:w-6"
                                style={{
                                  color: slot
                                    .convocazione
                                    ?.capitano
                                    ? "#facc15"
                                    : slot
                                        .convocazione
                                        ?.vicecapitano
                                    ? "#a1a1aa"
                                    : "#71717a",
                                }}
                                fill={
                                  slot.convocazione
                                    ?.capitano ||
                                  slot.convocazione
                                    ?.vicecapitano
                                    ? "currentColor"
                                    : "none"
                                }
                              />

                              {(slot.convocazione
                                ?.capitano ||
                                slot.convocazione
                                  ?.vicecapitano) && (
                                <span className="pointer-events-none absolute inset-0 flex items-center justify-center text-[6px] font-black text-zinc-950 @lg:text-[7px]">
                                  {slot.convocazione
                                    ?.capitano
                                    ? "C"
                                    : "VC"}
                                </span>
                              )}
                            </button>
                          </div>

                          <GiocatoreSelect
                            id={`titolare-campo-${slot.posizione}`}
                            openId={openGiocatoreSelectId}
                            onOpenChange={setOpenGiocatoreSelectId}
                            giocatori={giocatoriPerPosizione(
                              giocatori,
                              slot.posizione
                            )}
                            value={
                              slot.convocazione
                                ?.giocatore_id ??
                              ""
                            }
                            onChange={(giocatoreId) => {
                              if (!giocatoreId) {
                                return;
                              }

                              assegnaGiocatore(
                                slot.posizione,
                                giocatoreId,
                                slot.numero
                              );
                            }}
                            placeholder="Giocatore"
                            compact
                          />
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </div>

            {/* =================================================
                MOBILE/TABLET: PANCHINA
            ================================================== */}
            <div className="mt-4 xl:hidden">
              <div className="rounded-2xl border border-zinc-800 bg-zinc-950 p-4">
                <div className="mb-4">
                  <div className="flex items-center gap-2">
                    <Users
                      className="h-5 w-5"
                      style={{
                        color: coloreClub,
                      }}
                    />

                    <h2 className="text-lg font-black text-white">
                      Panchina
                    </h2>
                  </div>

                  <p className="mt-1 text-sm leading-6 text-zinc-400">
                    Aggiungi solo i giocatori che
                    vuoi convocare in panchina.
                  </p>
                </div>

                {/* AGGIUNGI MOBILE */}
                <div
                  className="
                    rounded-2xl
                    border
                    border-dashed
                    p-3
                  "
                  style={{
                    borderColor: `${coloreClub}55`,
                    backgroundColor: `${coloreClub}0D`,
                  }}
                >
                  <p
                    className="
                      mb-2
                      text-xs
                      font-black
                      uppercase
                      tracking-widest
                    "
                    style={{
                      color: coloreClub,
                    }}
                  >
                    Aggiungi giocatore
                  </p>

                  <GiocatoreSelect
                    id="panchina-aggiungi-mobile"
                    openId={openGiocatoreSelectId}
                    onOpenChange={setOpenGiocatoreSelectId}
                    giocatori={giocatoriDisponibiliPanchina}
                    value=""
                    onChange={(giocatoreId) => {
                      if (!giocatoreId) {
                        return;
                      }

                      aggiungiInPanchina(
                        giocatoreId
                      );
                    }}
                    placeholder="Seleziona giocatore da aggiungere"
                  />
                </div>

                {/* LISTA MOBILE */}
                <div className="mt-4 space-y-3">
                  {giocatoriPanchina.map(
                    (giocatore) => {
                      const convocazione =
                        convocazioniState.find(
                          (item) =>
                            item.giocatore_id ===
                            giocatore.id
                        );

                      if (!convocazione) {
                        return null;
                      }

                      return (
                        <div
                          key={giocatore.id}
                          className="
                            rounded-2xl
                            border border-zinc-800
                            bg-zinc-900
                            p-4
                          "
                        >
                          <div className="flex items-start justify-between gap-3">
                            <div className="min-w-0">
                              <p className="truncate font-black text-white">
                                {nomeGiocatore(
                                  giocatore
                                )}
                              </p>

                              <p className="mt-1 truncate text-xs text-zinc-400">
                                {giocatore.ruolo_1 ||
                                  giocatore.reparto ||
                                  "Ruolo non indicato"}
                              </p>
                            </div>

                            <button
                              type="button"
                              onClick={() =>
                                rimuoviDallaPanchina(
                                  giocatore.id
                                )
                              }
                              className="
                                flex
                                h-9
                                shrink-0
                                items-center
                                justify-center
                                rounded-lg
                                border border-zinc-700
                                px-3
                                text-xs
                                font-bold
                                text-zinc-300
                              "
                            >
                              Rimuovi
                            </button>
                          </div>

                          <div className="mt-4 grid grid-cols-[0.7fr_1.3fr] gap-2">
                            <label className="min-w-0">
                              <span className="mb-1 block text-xs text-zinc-400">
                                Numero
                              </span>

                              <input
                                type="number"
                                min={16}
                                max={99}
                                inputMode="numeric"
                                value={
                                  convocazione.numero_maglia ??
                                  ""
                                }
                                onChange={(event) =>
                                  aggiornaConvocazione(
                                    giocatore.id,
                                    {
                                      numero_maglia:
                                        event
                                          .target
                                          .value
                                          ? Number(
                                              event
                                                .target
                                                .value
                                            )
                                          : null,
                                    }
                                  )
                                }
                                className="
                                  w-full
                                  rounded-xl
                                  border border-zinc-800
                                  bg-zinc-950
                                  px-3
                                  py-2
                                  text-white
                                  outline-none
                                "
                              />
                            </label>

                            <label className="min-w-0">
                              <span className="mb-1 block text-xs text-zinc-400">
                                Ruolo
                              </span>

                              <select
                                value={
                                  convocazione.ruolo_panchina ??
                                  ""
                                }
                                onChange={(event) =>
                                  aggiornaConvocazione(
                                    giocatore.id,
                                    {
                                      ruolo_panchina:
                                        event
                                          .target
                                          .value ||
                                        null,
                                    }
                                  )
                                }
                                className="
                                  w-full
                                  rounded-xl
                                  border border-zinc-800
                                  bg-zinc-950
                                  px-3
                                  py-2
                                  text-white
                                  outline-none
                                "
                              >
                                <option value="">
                                  Seleziona ruolo
                                </option>

                                {ruoliDisponibili(
                                  giocatore
                                ).map((ruolo) => (
                                  <option
                                    key={ruolo}
                                    value={ruolo}
                                  >
                                    {ruolo}
                                  </option>
                                ))}
                              </select>
                            </label>
                          </div>
                        </div>
                      );
                    }
                  )}

                  {giocatoriPanchina.length ===
                    0 && (
                    <div className="rounded-2xl border border-dashed border-zinc-800 px-4 py-8 text-center">
                      <Users className="mx-auto h-6 w-6 text-zinc-600" />

                      <p className="mt-2 text-sm font-bold text-zinc-500">
                        Nessun giocatore in
                        panchina
                      </p>
                    </div>
                  )}
                </div>

                {/* SALVA MOBILE */}
                {isAdmin && (
                <button
                  type="button"
                  onClick={salvaConvocazioni}
                  disabled={isPending}
                  className="
                    mt-5
                    inline-flex
                    w-full
                    items-center
                    justify-center
                    gap-2
                    rounded-xl
                    px-5
                    py-3
                    text-sm
                    font-bold
                    text-zinc-950
                    disabled:opacity-60
                  "
                  style={{
                    backgroundColor: coloreClub,
                  }}
                >
                  <Save className="h-4 w-4" />

                  {isPending
                    ? "Salvataggio..."
                    : "Salva convocazioni"}
                </button>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {isAdmin && (
        <ModificaDettagliPartitaModal
          open={openModificaDettagli}
          onClose={() => setOpenModificaDettagli(false)}
          onSaved={() => router.refresh()}
          brand={coloreClub}
          partitaId={partita.id}
          squadre={squadreDisponibili}
          valoriIniziali={{
            squadra_casa_id: partita.squadra_casa_id ?? "",
            squadra_fuori_id: partita.squadra_fuori_id ?? "",
            data_partita: partita.data_partita ?? "",
            ora_partita: partita.ora_partita ?? "",
            luogo: partita.luogo ?? "",
            tipo_partita: partita.tipo_partita ?? "campionato",
            note: partita.note ?? "",
          }}
        />
      )}

      {/* =====================================================
          ANTEPRIMA CONVOCAZIONI
      ====================================================== */}
      {showAnteprima && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/55 p-4 backdrop-blur-[2px]">
          <div className="flex max-h-[85vh] w-full max-w-lg flex-col overflow-hidden rounded-2xl border border-zinc-800 bg-zinc-950 shadow-2xl sm:rounded-3xl">
            {/* HEADER */}
            <div className="flex items-center justify-between gap-3 border-b border-zinc-800 px-4 py-4 sm:px-6">
              <div className="min-w-0">
                <h3 className="truncate text-lg font-black text-white">
                  Anteprima convocazioni
                </h3>

                <p className="truncate text-sm text-zinc-400">
                  {nomeSquadraCasa} vs {nomeSquadraFuori}
                </p>
              </div>

              <button
                type="button"
                onClick={() => setShowAnteprima(false)}
                className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl border border-zinc-800 text-zinc-400 transition hover:bg-white/5 hover:text-white"
                aria-label="Chiudi anteprima"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            {/* CONTENUTO */}
            <div className="flex-1 overflow-y-auto px-4 py-4 sm:px-6">
              <h4 className="mb-3 flex items-center gap-2 text-xs font-black uppercase tracking-[0.18em] text-zinc-500">
                <Shirt className="h-3.5 w-3.5" style={{ color: coloreClub }} />
                Formazione titolare
              </h4>

              <div className="space-y-2">
                {titolari.map((slot) => (
                  <div
                    key={slot.posizione}
                    className="flex items-center justify-between gap-3 rounded-xl border border-zinc-800 bg-zinc-900 px-3 py-2.5"
                  >
                    <div className="flex min-w-0 items-center gap-3">
                      <span
                        className="w-6 shrink-0 text-right text-base font-black"
                        style={{ color: coloreClub }}
                      >
                        {slot.numero}
                      </span>

                      <div className="min-w-0">
                        <p className="truncate text-sm font-bold text-white">
                          {slot.giocatore
                            ? nomeGiocatore(slot.giocatore)
                            : "Non assegnato"}
                        </p>

                        <p className="truncate text-[11px] uppercase tracking-wide text-zinc-500">
                          {slot.label}
                        </p>
                      </div>
                    </div>

                    {(slot.convocazione?.capitano ||
                      slot.convocazione?.vicecapitano) && (
                      <span
                        className="shrink-0 rounded-full px-2 py-0.5 text-[10px] font-black"
                        style={{
                          backgroundColor: `${coloreClub}22`,
                          color: coloreClub,
                        }}
                      >
                        {slot.convocazione?.capitano ? "C" : "VC"}
                      </span>
                    )}
                  </div>
                ))}
              </div>

              <h4 className="mb-3 mt-6 flex items-center gap-2 text-xs font-black uppercase tracking-[0.18em] text-zinc-500">
                <Users className="h-3.5 w-3.5" style={{ color: coloreClub }} />
                Panchina
              </h4>

              {panchinaOrdinata.length === 0 ? (
                <p className="text-sm text-zinc-500">
                  Nessun giocatore in panchina.
                </p>
              ) : (
                <div className="flex flex-wrap gap-2">
                  {panchinaOrdinata.map((giocatore) => {
                    const convocazione = convocazioniState.find(
                      (item) => item.giocatore_id === giocatore.id
                    );

                    return (
                      <span
                        key={giocatore.id}
                        className="rounded-full border border-zinc-800 bg-zinc-900 px-3 py-1.5 text-xs font-semibold text-zinc-300"
                      >
                        {convocazione?.numero_maglia
                          ? `${convocazione.numero_maglia}. `
                          : ""}
                        {nomeGiocatore(giocatore)}
                      </span>
                    );
                  })}
                </div>
              )}
            </div>

            {/* FOOTER */}
            <div className="flex flex-col gap-2 border-t border-zinc-800 px-4 py-4 sm:flex-row sm:justify-end sm:px-6">
              <button
                type="button"
                onClick={() => setShowAnteprima(false)}
                className="inline-flex items-center justify-center gap-2 rounded-xl border border-zinc-800 px-5 py-3 text-sm font-bold text-zinc-300 transition hover:bg-white/5 sm:order-1"
              >
                Chiudi
              </button>

              {isAdmin && (
                <button
                  type="button"
                  onClick={inviaComunicazioneFormazione}
                  disabled={inviandoComunicazione}
                  className="inline-flex items-center justify-center gap-2 rounded-xl px-5 py-3 text-sm font-bold text-zinc-950 disabled:opacity-60 sm:order-2"
                  style={{ backgroundColor: coloreClub }}
                  title={titoloComunicazioneFormazione}
                >
                  {inviandoComunicazione ? (
                    <>
                      <RefreshCw className="h-4 w-4 animate-spin" />
                      Invio in corso...
                    </>
                  ) : (
                    <>
                      <Megaphone className="h-4 w-4" />
                      Invia comunicazione a tutti
                    </>
                  )}
                </button>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}