"use client";

import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import {
  CircleDot,
  Pencil,
  Save,
  Shield,
  Shirt,
  Trash2,
  Trophy,
  Users,
} from "lucide-react";

import {
  eliminaPartita,
  salvaConvocazioniPartita,
  salvaStatistichePartita,
} from "@/app/(dashboard)/partite/[id]/actions";
import ModificaDettagliPartitaModal, {
  type SquadraPartitaOption,
} from "@/components/partite/ModificaDettagliPartitaModal";

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
  note: string | null;
} | null;

type Giocatore = {
  id: string;
  nome: string | null;
  cognome: string | null;
  ruolo_1: string | null;
  ruolo_2: string | null;
  reparto: string | null;
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
  1: "left-[18%] top-[10%]",
  2: "left-[36%] top-[10%]",
  3: "left-[54%] top-[10%]",

  4: "left-[29%] top-[22%]",
  5: "left-[47%] top-[22%]",

  6: "left-[12%] top-[28%]",
  7: "left-[64%] top-[28%]",
  8: "left-[38%] top-[35%]",

  9: "left-[38%] top-[46%]",
  10: "left-[48%] top-[58%]",

  11: "left-[12%] top-[80%]",
  12: "left-[64%] top-[64%]",
  13: "left-[82%] top-[70%]",
  14: "left-[88%] top-[80%]",

  15: "left-[48%] top-[86%]",
};

function nomeGiocatore(giocatore?: Giocatore | null) {
  if (!giocatore) return "Non assegnato";

  return `${giocatore.nome ?? ""} ${giocatore.cognome ?? ""}`.trim();
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

  const [tab, setTab] = useState<"risultato" | "convocazioni">(
    "risultato"
  );

  const [isPending, startTransition] = useTransition();
  const [isDeleting, startDeleteTransition] = useTransition();
  const [openModificaDettagli, setOpenModificaDettagli] = useState(false);

  const [message, setMessage] = useState<string | null>(null);

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

          <div className="grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-4">
            {[
              ["punti_fatti", "Punti fatti"],
              ["punti_subiti", "Punti subiti"],
              ["mete_fatte", "Mete fatte"],
              ["mete_subite", "Mete subite"],
              ["calci_fatti", "Calci fatti"],
              ["calci_subiti", "Calci subiti"],
              ["ammonizioni", "Ammonizioni"],
              ["espulsioni", "Espulsioni"],
            ].map(([key, label]) => (
              <label
                key={key}
                className="min-w-0 space-y-2"
              >
                <span className="block truncate text-xs font-semibold text-zinc-300 sm:text-sm">
                  {label}
                </span>

                <input
                  type="number"
                  min={0}
                  inputMode="numeric"
                  value={
                    stats[
                      key as keyof typeof stats
                    ] as number
                  }
                  onChange={(event) =>
                    setStats((prev) => ({
                      ...prev,
                      [key]: toNumber(
                        event.target.value
                      ),
                    }))
                  }
                  className="
                    w-full
                    min-w-0
                    rounded-xl
                    border border-zinc-800
                    bg-zinc-900
                    px-3
                    py-3
                    text-base
                    font-bold
                    text-white
                    outline-none
                    transition
                    sm:px-4
                  "
                />
              </label>
            ))}
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

            {/* =================================================
                MOBILE: TITOLARI 1-15
            ================================================== */}
            <div className="space-y-3 sm:hidden">
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
                        shrink-0
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

                  <select
                    value={
                      slot.convocazione
                        ?.giocatore_id ?? ""
                    }
                    onChange={(event) => {
                      if (!event.target.value) {
                        return;
                      }

                      assegnaGiocatore(
                        slot.posizione,
                        event.target.value,
                        slot.numero
                      );
                    }}
                    className="
                      w-full
                      rounded-xl
                      border border-zinc-800
                      bg-zinc-950
                      px-3
                      py-3
                      text-sm
                      text-white
                      outline-none
                    "
                  >
                    <option value="">
                      Seleziona giocatore
                    </option>

                    {giocatoriPerPosizione(
                      giocatori,
                      slot.posizione
                    ).map((giocatore) => (
                        <option
                          key={giocatore.id}
                          value={giocatore.id}
                        >
                          {nomeGiocatore(
                            giocatore
                          )}
                        </option>
                      )
                    )}
                  </select>
                </div>
              ))}
            </div>

            {/* =================================================
                DESKTOP:
                PANCHINA SINISTRA + CAMPO DESTRA
            ================================================== */}
            <div
              className="
                hidden
                sm:grid
                sm:grid-cols-[280px_minmax(0,1fr)]
                sm:gap-4
                lg:grid-cols-[300px_minmax(0,1fr)]
                lg:gap-5
                xl:grid-cols-[340px_minmax(0,1fr)]
              "
            >
              {/* ===============================================
                  PANCHINA DESKTOP
              ================================================ */}
              <aside className="min-w-0">
                <div
                  className="
                    sticky
                    top-4
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

                    <select
                      defaultValue=""
                      onChange={(event) => {
                        const giocatoreId =
                          event.target.value;

                        if (!giocatoreId) {
                          return;
                        }

                        aggiungiInPanchina(
                          giocatoreId
                        );

                        event.currentTarget.value =
                          "";
                      }}
                      className="
                        w-full
                        rounded-xl
                        border border-zinc-800
                        bg-zinc-950
                        px-3
                        py-3
                        text-sm
                        text-white
                        outline-none
                      "
                    >
                      <option value="">
                        Seleziona giocatore
                      </option>

                      {giocatoriDisponibiliPanchina.map(
                        (giocatore) => (
                          <option
                            key={giocatore.id}
                            value={giocatore.id}
                          >
                            {nomeGiocatore(
                              giocatore
                            )}
                          </option>
                        )
                      )}
                    </select>
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
                  CAMPO DESKTOP
              ================================================ */}
              <div className="min-w-0">
                <div
                  className="
                    relative
                    h-[900px]
                    w-full
                    overflow-hidden
                    rounded-[2rem]
                    border border-white/20
                    bg-[#68a51b]
                    shadow-2xl
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
                          w-[180px]
                          -translate-x-1/2
                          ${fieldPosition[slot.numero]}
                        `}
                      >
                        <div
                          className="
                            rounded-2xl
                            border border-white/25
                            bg-zinc-950/90
                            p-2
                            shadow-2xl
                            backdrop-blur
                          "
                        >
                          <div className="mb-2 flex items-center justify-between gap-2">
                            <div className="min-w-0">
                              <p
                                className="text-xl font-black leading-none"
                                style={{
                                  color:
                                    coloreClub,
                                }}
                              >
                                <span
                                    className="shrink-0 text-xl font-black"
                                    style={{ color: coloreClub }}
                                  >
                                    #{slot.numero}
                                  </span>
                                 <span className="mt-1 truncate text-[10px] font-bold uppercase text-zinc-400">
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
                                className="h-6 w-6"
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
                                <span className="pointer-events-none absolute inset-0 flex items-center justify-center text-[7px] font-black text-zinc-950">
                                  {slot.convocazione
                                    ?.capitano
                                    ? "C"
                                    : "VC"}
                                </span>
                              )}
                            </button>
                          </div>

                          <select
                            value={
                              slot.convocazione
                                ?.giocatore_id ??
                              ""
                            }
                            onChange={(event) => {
                              if (
                                !event.target.value
                              ) {
                                return;
                              }

                              assegnaGiocatore(
                                slot.posizione,
                                event.target.value,
                                slot.numero
                              );
                            }}
                            className="
                              w-full
                              rounded-xl
                              border border-zinc-800
                              bg-zinc-900
                              px-2
                              py-2
                              text-xs
                              text-white
                              outline-none
                            "
                          >
                            <option value="">
                              Giocatore
                            </option>

                            {giocatoriPerPosizione(
                              giocatori,
                              slot.posizione
                            ).map((giocatore) => (
                                <option
                                  key={
                                    giocatore.id
                                  }
                                  value={
                                    giocatore.id
                                  }
                                >
                                  {nomeGiocatore(
                                    giocatore
                                  )}
                                </option>
                              )
                            )}
                          </select>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </div>

            {/* =================================================
                MOBILE: PANCHINA
            ================================================== */}
            <div className="mt-4 sm:hidden">
              <div className="rounded-2xl border border-zinc-800 bg-zinc-950">
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

                  <select
                    defaultValue=""
                    onChange={(event) => {
                      const giocatoreId =
                        event.target.value;

                      if (!giocatoreId) {
                        return;
                      }

                      aggiungiInPanchina(
                        giocatoreId
                      );

                      event.currentTarget.value =
                        "";
                    }}
                    className="
                      w-full
                      rounded-xl
                      border border-zinc-800
                      bg-zinc-950
                      px-3
                      py-3
                      text-sm
                      text-white
                      outline-none
                    "
                  >
                    <option value="">
                      Seleziona giocatore da
                      aggiungere
                    </option>

                    {giocatoriDisponibiliPanchina.map(
                      (giocatore) => (
                        <option
                          key={giocatore.id}
                          value={giocatore.id}
                        >
                          {nomeGiocatore(
                            giocatore
                          )}
                        </option>
                      )
                    )}
                  </select>
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
                                shrink-0
                                rounded-lg
                                border border-zinc-700
                                px-2
                                py-1
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
    </div>
  );
}