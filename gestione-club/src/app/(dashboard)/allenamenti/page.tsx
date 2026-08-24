"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import {
  BookOpen,
  ChevronDown,
  ClipboardCheck,
  Dumbbell,
  FileDown,
  FileUp,
  Info,
  ListChecks,
  Loader2,
  Pencil,
  Plus,
  Search,
  Trash2,
  Users,
  X,
} from "lucide-react";

import { AppCard } from "@/components/ui/AppCard";
import { DateInput } from "@/components/ui/DateInput";
import { supabase } from "@/lib/supabase-client";
import NuovoAllenamentoModal from "@/components/allenamenti/NuovoAllenamentoModal";
import RegistraPresenzeModal from "@/components/allenamenti/RegistraPresenzeModal";
import ImportaAllenamentiModal from "@/components/allenamenti/ImportaAllenamentiModal";
import ScaricaTemplateAllenamentiModal from "@/components/allenamenti/ScaricaTemplateAllenamentiModal";
import PdfPreviewModal from "@/components/allenamenti/PdfPreviewModal";
import DettaglioLavoroModal from "@/components/allenamenti/DettaglioLavoroModal";
import { generaPdfAllenamento, scaricaPdfAllenamento } from "@/lib/pdf-allenamento";
import { eliminaAllenamentiInBlocco } from "@/app/(dashboard)/allenamenti/[id]/actions";
import {
  leggiFiltriAllenamenti,
  salvaFiltriAllenamenti,
} from "@/lib/allenamenti/filtri-sezione";

type StatoPresenza = "PM" | "PP" | "P" | "I" | "AG" | "AI";

type StatoPresenzaDb =
  | "presente_mattina"
  | "presente_pomeriggio"
  | "presente_entrambe"
  | "infortunato"
  | "assenza_giustificata"
  | "assenza_ingiustificata";

type Allenamento = {
  id: string;
  club_id: string;
  squadra_id: string | null;
  titolo: string | null;
  tipo_allenamento: string | null;
  data_allenamento: string;
  ora_inizio: string | null;
  ora_fine: string | null;
  luogo: string | null;
  obiettivo: string | null;
  note: string | null;
  durata_minuti: number | null;
  stato: string;
  created_at: string;
  ciclo_dal?: string | null;
  ciclo_al?: string | null;
};

type Lavoro = {
  id: string;
  allenamento_id: string;
  sezione: string;
  titolo: string | null;
  descrizione: string | null;
  obbiettivo: string | null;
  rango?: string | null;
  tempo_lavoro: number | null;
  ripetizione: number | null;
  tempo_recupero: number | null;
  tempo_totale: number | null;
  contemporaneo?: boolean | null;
  gruppo_contemporaneo?: string | null;
  ordine: number | null;
  immagine_lavoro?: string | null;
  codice?: string | null;
  spazio?: string | null;
  materiale?: string | null;
  punti_chiave_coaching?: string | null;
  progressione?: string | null;
  riferimento_gps?: string | null;
  perche_serve?: string | null;
  serie?: number | null;
  ripetizioni?: string | null;
  rpe?: number | null;
  carico?: string | null;
};

type CicloPalestra = {
  chiave: string;
  dal: string;
  al: string;
  sedute: Allenamento[];
};

type DrillBankRow = {
  id: string;
  club_id: string;
  nome: string;
  sezione: string | null;
  descrizione: string | null;
  obbiettivo: string | null;
  tempo_lavoro: number | null;
  ripetizione: number | null;
  tempo_recupero: number | null;
  tempo_totale: number | null;
  codice: string | null;
  spazio: string | null;
  materiale: string | null;
  punti_chiave_coaching: string | null;
  progressione: string | null;
  riferimento_gps: string | null;
  perche_serve: string | null;
};

type Giocatore = {
  id: string;
  nome: string;
  cognome: string;
  foto_url: string | null;
};

/*
 * Una presenza appartiene alla GIORNATA, non alla singola seduta: se in
 * un giorno ci sono seduta mattutina e serale la riga resta una sola, e
 * lo stato ("presente_mattina", "presente_entrambe"...) dice a quali
 * sedute il giocatore ha partecipato. E' cosi' che si evita il doppio
 * conteggio nelle statistiche.
 */
type Presenza = {
  id: string;
  giocatore_id: string;
  club_id: string;
  squadra_id: string | null;
  data: string;
  stato: StatoPresenzaDb;
  /** Motivo dell'assenza, valorizzato solo con stato assenza_giustificata. */
  giustificazione: string | null;
};

type Profilo = {
  tipo_profilo: string | null;
  last_club_id: string | null;
  last_squadra_id: string | null;
};

type Vista =
  | "odierno"
  | "resoconto"
  | "riepilogo"
  | "elenco"
  | "microcicli"
  | "palestra"
  | "drillbank";

/*
 * Elenco delle viste valide, usato per validare il valore ripristinato
 * dalla memoria di sessione. Un semplice cast "as Vista" non basterebbe:
 * il valore salvato puo' venire da una versione precedente dell'app
 * rimasta aperta in un'altra scheda, e una vista inesistente lascerebbe
 * la pagina senza nessun contenuto da mostrare.
 */
const VISTE: readonly Vista[] = [
  "odierno",
  "resoconto",
  "riepilogo",
  "elenco",
  "microcicli",
  "palestra",
  "drillbank",
];

function isVista(valore: string): valore is Vista {
  return (VISTE as readonly string[]).includes(valore);
}

// Settimane (microcicli) e fasi (macrocicli) vengono lette dalla
// Programmazione già esistente: ogni allenamento viene abbinato alla
// settimana/fase la cui data_inizio/data_fine lo contiene.
type SettimanaProgrammazione = {
  id: string;
  numero_settimana: number;
  data_inizio: string;
  data_fine: string;
  focus_settimana: string | null;
};

type FaseProgrammazione = {
  id: string;
  nome: string;
  colore: string | null;
  data_inizio: string;
  data_fine: string;
  obiettivo: string | null;
  ordine: number | null;
  programmazione_settimane: SettimanaProgrammazione[];
};

type Programmazione = {
  id: string;
  titolo: string;
  data_inizio: string;
  data_fine: string;
  programmazione_fasi: FaseProgrammazione[];
};

const STATI_PRESENZA: {
  sigla: StatoPresenza;
  label: string;
  db: StatoPresenzaDb;
}[] = [
  { sigla: "PM", label: "Presente Mattina", db: "presente_mattina" },
  { sigla: "PP", label: "Presente Pomeriggio", db: "presente_pomeriggio" },
  { sigla: "P", label: "Presente", db: "presente_entrambe" },
  { sigla: "I", label: "Infortunio", db: "infortunato" },
  { sigla: "AG", label: "Assente Giustificato", db: "assenza_giustificata" },
  { sigla: "AI", label: "Assente Ingiustificato", db: "assenza_ingiustificata" },
];

const COLORE_STATO: Record<StatoPresenza, string> = {
  P: "bg-green-600 border-green-500 text-white",
  PM: "bg-yellow-400 border-yellow-300 text-black",
  PP: "bg-orange-500 border-orange-400 text-white",
  I: "bg-sky-500 border-sky-400 text-white",
  AG: "bg-red-400 border-red-300 text-white",
  AI: "bg-red-800 border-red-700 text-white",
};

const COLORE_H2O = "#38bdf8";

function coloreSezione(sezione: string, themeColor: string) {
  return sezione.trim().toUpperCase() === "H2O" ? COLORE_H2O : themeColor;
}

function oggiISO() {
  return new Date().toISOString().slice(0, 10);
}

function inizioSettimanaISO() {
  const oggi = new Date();
  const giorno = oggi.getDay();
  const diff = giorno === 0 ? -6 : 1 - giorno;

  oggi.setDate(oggi.getDate() + diff);
  oggi.setHours(0, 0, 0, 0);

  return oggi.toISOString().slice(0, 10);
}

function fineSettimanaISO() {
  const inizio = new Date(inizioSettimanaISO());
  inizio.setDate(inizio.getDate() + 6);

  return inizio.toISOString().slice(0, 10);
}

function formattaData(data: string) {
  return new Intl.DateTimeFormat("it-IT", {
    weekday: "long",
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  }).format(new Date(`${data}T00:00:00`));
}

// Versione breve (es. "18/08/2026"), usata per gli intervalli di date di
// settimane/fasi nelle tab Microcicli/Macrocicli.
function formatDataITBreve(data: string) {
  return new Intl.DateTimeFormat("it-IT", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  }).format(new Date(`${data}T00:00:00`));
}

// Palette fissa: ogni sezione (MEETING, PALESTRA, SKILLS, ecc.) viene
// sempre associata allo stesso colore in ogni allenamento, calcolando un
// indice deterministico dal nome invece che dalla sua posizione nella
// lista (che cambia seduta per seduta a seconda di quali sezioni ci sono).
const COLORI_SEZIONI = [
  "#ef4444",
  "#f97316",
  "#eab308",
  "#22c55e",
  "#06b6d4",
  "#6366f1",
  "#a855f7",
  "#ec4899",
  "#14b8a6",
  "#84cc16",
];

function coloreSezionePalette(nome: string): string {
  const normalizzato = nome.trim().toUpperCase();

  let hash = 0;
  for (let i = 0; i < normalizzato.length; i += 1) {
    hash = (hash * 31 + normalizzato.charCodeAt(i)) % 997;
  }

  return COLORI_SEZIONI[hash % COLORI_SEZIONI.length];
}

// Ritorna un punto (in percentuale) sulla circonferenza del grafico a
// torta, partendo dalle ore 12 e proseguendo in senso orario, come fa
// di default il conic-gradient usato per disegnarlo.
function puntoSuCerchio(angoloGradi: number): string {
  const rad = (angoloGradi * Math.PI) / 180;
  const x = 50 + 50 * Math.sin(rad);
  const y = 50 - 50 * Math.cos(rad);
  return `${x}% ${y}%`;
}

// Costruisce la forma (clip-path) di un singolo spicchio, da usare come
// area invisibile "hoverabile" per mostrare il tooltip con i minuti.
function costruisciClipSpicchio(startPercent: number, endPercent: number): string {
  const startDeg = (startPercent / 100) * 360;
  const endDeg = (endPercent / 100) * 360;
  const passo = 6;

  const punti: string[] = ["50% 50%"];
  for (let deg = startDeg; deg < endDeg; deg += passo) {
    punti.push(puntoSuCerchio(deg));
  }
  punti.push(puntoSuCerchio(endDeg));

  return `polygon(${punti.join(", ")})`;
}

function PieChart({ items }: { items: { label: string; value: number }[] }) {
  const totale = items.reduce((sum, item) => sum + item.value, 0);

  if (totale <= 0) {
    return (
      <div className="flex h-44 items-center justify-center rounded-2xl border border-zinc-800 bg-zinc-950 text-sm text-zinc-500">
        Nessun minutaggio
      </div>
    );
  }

  const segmenti = items.map((item, index) => {
    const start = items
      .slice(0, index)
      .reduce((sum, current) => sum + (current.value / totale) * 100, 0);

    const end = start + (item.value / totale) * 100;

    return { ...item, start, end, colore: coloreSezionePalette(item.label) };
  });

  const gradient = segmenti
    .map((segmento) => `${segmento.colore} ${segmento.start}% ${segmento.end}%`)
    .join(", ");

  return (
    <div className="space-y-4">
      <div
        className="relative mx-auto h-44 w-44 rounded-full"
        style={{ background: `conic-gradient(${gradient})` }}
      >
        {segmenti.map((segmento) => (
          <div
            key={segmento.label}
            title={`${segmento.label}: ${segmento.value} min`}
            className="absolute inset-0 rounded-full"
            style={{ clipPath: costruisciClipSpicchio(segmento.start, segmento.end) }}
          />
        ))}
      </div>

      <div className="space-y-2">
        {segmenti.map((segmento) => (
          <div
            key={segmento.label}
            title={`${segmento.label}: ${segmento.value} min`}
            className="flex items-center justify-between gap-3 text-sm"
          >
            <span className="flex min-w-0 items-center gap-2 truncate text-zinc-400">
              <span
                className="h-2.5 w-2.5 shrink-0 rounded-full"
                style={{ backgroundColor: segmento.colore }}
              />
              <span className="truncate">{segmento.label}</span>
            </span>
            <span className="shrink-0 font-medium text-white">
              {segmento.value} min
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}


function InfoBox({
  label,
  value,
}: {
  label: string;
  value: string;
}) {
  return (
    <div className="rounded-2xl border border-zinc-800 bg-zinc-900/70 p-4">
      <p className="text-xs font-medium uppercase tracking-wide text-zinc-500">
        {label}
      </p>
      <p className="mt-2 font-semibold text-white">{value}</p>
    </div>
  );
}

function etichettaDayPalestra(allenamento: Allenamento) {
  const titolo = allenamento.titolo?.trim();
  if (!titolo) return "Day";
  return titolo.replace(/^palestra\s*[—-]\s*/i, "") || "Day";
}

function TabellaLavoriPalestra({
  righe,
  mostraDay = false,
}: {
  righe: { lavoro: Lavoro; day: string }[];
  mostraDay?: boolean;
}) {
  return (
    <div className="overflow-x-auto">
      <table className="w-full min-w-[760px] border-collapse text-sm">
        <thead className="bg-white/5 text-left text-xs uppercase tracking-wide text-zinc-500">
          <tr>
            {mostraDay && <th className="px-3 py-2.5">Day</th>}
            <th className="px-3 py-2.5">Esercizio</th>
            <th className="px-3 py-2.5 text-right">Serie</th>
            <th className="px-3 py-2.5 text-right">Rep</th>
            <th className="px-3 py-2.5 text-right">RPE</th>
            <th className="px-3 py-2.5 text-right">Carico</th>
            <th className="px-3 py-2.5 text-right">Recupero</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-zinc-900">
          {righe.map(({ lavoro, day }) => (
            <tr key={`${day}-${lavoro.id}`} className="text-zinc-300">
              {mostraDay && (
                <td className="whitespace-nowrap px-3 py-3 font-bold text-white">
                  {day}
                </td>
              )}
              <td className="px-3 py-3">
                <p className="font-semibold text-white">
                  {lavoro.titolo || lavoro.descrizione || "—"}
                </p>
                {lavoro.punti_chiave_coaching && (
                  <p className="mt-1 text-xs text-zinc-500">
                    {lavoro.punti_chiave_coaching}
                  </p>
                )}
              </td>
              <td className="px-3 py-3 text-right">{lavoro.serie ?? "—"}</td>
              <td className="px-3 py-3 text-right">
                {lavoro.ripetizioni ?? lavoro.ripetizione ?? "—"}
              </td>
              <td className="px-3 py-3 text-right">{lavoro.rpe ?? "—"}</td>
              <td className="px-3 py-3 text-right">{lavoro.carico ?? "—"}</td>
              <td className="px-3 py-3 text-right">
                {lavoro.tempo_recupero !== null
                  ? `${lavoro.tempo_recupero} min`
                  : "—"}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export default function Page() {
  const [vista, setVista] = useState<Vista>("riepilogo");
  const [allenamenti, setAllenamenti] = useState<Allenamento[]>([]);
  const [lavori, setLavori] = useState<Lavoro[]>([]);
  const [drillBank, setDrillBank] = useState<DrillBankRow[]>([]);
  const [ricercaDrillBank, setRicercaDrillBank] = useState("");
  const [lavoroDrillBankAperto, setLavoroDrillBankAperto] =
    useState<Lavoro | null>(null);
  const [programmazioni, setProgrammazioni] = useState<Programmazione[]>([]);
  const [giocatori, setGiocatori] = useState<Giocatore[]>([]);
  const [presenze, setPresenze] = useState<Presenza[]>([]);
  const [profilo, setProfilo] = useState<Profilo | null>(null);
  const [userId, setUserId] = useState<string | null>(null);
  const [themeColor, setThemeColor] = useState("#d71920");
  const [clubLogoUrl, setClubLogoUrl] = useState<string | null>(null);
  const [preferenzaVistaLavori, setPreferenzaVistaLavori] = useState<
    "card" | "tabella"
  >("card");
  const [vistaElencoLavori, setVistaElencoLavori] = useState<
    "card" | "tabella"
  >("tabella");
  const [vistaPalestra, setVistaPalestra] = useState<"day" | "gruppo">(
    "day"
  );
  const [cicloPalestraAperto, setCicloPalestraAperto] = useState<
    string | null
  >(null);
  const [cicloPalestraDaEliminare, setCicloPalestraDaEliminare] = useState<
    CicloPalestra | null
  >(null);
  const [eliminandoCicloPalestra, setEliminandoCicloPalestra] = useState(false);
  const [erroreEliminazioneCiclo, setErroreEliminazioneCiclo] = useState<
    string | null
  >(null);

  const [loading, setLoading] = useState(true);
  const [openId, setOpenId] = useState<string | null>(null);
  const [openNuovoAllenamento, setOpenNuovoAllenamento] = useState(false);
  const [openRegistraPresenze, setOpenRegistraPresenze] = useState(false);
  const [openImportaExcel, setOpenImportaExcel] = useState(false);
  const [openScaricaTemplate, setOpenScaricaTemplate] = useState(false);
  const [pdfInAnteprima, setPdfInAnteprima] = useState<{
    doc: Awaited<ReturnType<typeof generaPdfAllenamento>>["doc"];
    blobUrl: string;
    nomeFile: string;
  } | null>(null);
  const [generandoPdfId, setGenerandoPdfId] = useState<string | null>(null);

  const [dataDa, setDataDa] = useState(inizioSettimanaISO());
  const [dataA, setDataA] = useState(fineSettimanaISO());

  /*
   * Ripristino dei filtri al rientro da una seduta.
   *
   * Il valore NON si legge nell'inizializzatore di useState: questa
   * pagina, pur essendo "use client", viene comunque renderizzata sul
   * server, dove sessionStorage non esiste. Leggerlo li' produrrebbe un
   * HTML diverso da quello del client e un errore di idratazione.
   *
   * Il flag serve a non salvare prima di aver ripristinato: senza, il
   * primo render scriverebbe i valori di default sopra quelli salvati,
   * cancellandoli proprio nell'istante in cui servono.
   */
  const [filtriRipristinati, setFiltriRipristinati] = useState(false);

  useEffect(() => {
    const salvati = leggiFiltriAllenamenti();

    if (salvati) {
      if (isVista(salvati.vista)) {
        setVista(salvati.vista);
      }

      setDataDa(salvati.dataDa);
      setDataA(salvati.dataA);
    }

    setFiltriRipristinati(true);
  }, []);

  useEffect(() => {
    if (!filtriRipristinati) return;

    salvaFiltriAllenamenti({ vista, dataDa, dataA });
  }, [filtriRipristinati, vista, dataDa, dataA]);

  /*
   * Eliminazione in blocco delle sedute.
   *
   * La selezione e' un Set di id e non un campo dentro Allenamento:
   * cosi' non va tenuta in sincronia con i dati ricaricati da
   * caricaDati(), e sopravvive a un refresh dell'elenco senza doverla
   * ricostruire. Viene comunque potata (vedi useEffect piu' sotto)
   * quando cambiano i filtri, altrimenti si potrebbero eliminare sedute
   * selezionate in un periodo e non piu' visibili in quello corrente.
   */
  const [modalitaSelezione, setModalitaSelezione] = useState(false);
  const [selezionati, setSelezionati] = useState<Set<string>>(new Set());
  const [confermaEliminazione, setConfermaEliminazione] = useState(false);
  const [eliminandoBlocco, setEliminandoBlocco] = useState(false);
  const [esitoEliminazione, setEsitoEliminazione] = useState<{
    tipo: "ok" | "errore";
    testo: string;
  } | null>(null);

  const isAdmin =
    String(profilo?.tipo_profilo ?? "").toLowerCase() === "admin";

  async function caricaDati() {
    setLoading(true);

    const {
      data: { user },
      error: userError,
    } = await supabase.auth.getUser();

    if (userError || !user) {
      console.error(userError);
      setLoading(false);
      return;
    }

    setUserId(user.id);

    const { data: profiloData, error: profiloError } = await supabase
      .from("profili")
      .select("tipo_profilo, last_club_id, last_squadra_id")
      .eq("auth_user_id", user.id)
      .single();

    if (profiloError || !profiloData?.last_club_id) {
      console.error(profiloError);
      setLoading(false);
      return;
    }

    setProfilo(profiloData);

    let allenamentiQuery = supabase
      .from("allenamenti")
      .select("*")
      .eq("club_id", profiloData.last_club_id)
      .order("data_allenamento", { ascending: true });

    if (profiloData.last_squadra_id) {
      allenamentiQuery = allenamentiQuery.eq(
        "squadra_id",
        profiloData.last_squadra_id,
      );
    }

    let giocatoriQuery = supabase
      .from("giocatori")
      .select("id, nome, cognome, foto_url")
      .eq("club_id", profiloData.last_club_id)
      .eq("attivo", true)
      .order("cognome", { ascending: true });

    if (profiloData.last_squadra_id) {
      giocatoriQuery = giocatoriQuery.eq(
        "squadra_id",
        profiloData.last_squadra_id,
      );
    }

    // Fasi (macrocicli) e settimane (microcicli) già create in
    // "Programmazione": servono per le tab Microcicli/Macrocicli, che
    // abbinano ogni seduta alla settimana/fase la cui data la contiene.
    let programmazioniQuery = supabase
      .from("programmazioni")
      .select(
        `
        id,
        titolo,
        data_inizio,
        data_fine,
        programmazione_fasi (
          id,
          nome,
          colore,
          data_inizio,
          data_fine,
          obiettivo,
          ordine,
          programmazione_settimane (
            id,
            numero_settimana,
            data_inizio,
            data_fine,
            focus_settimana
          )
        )
      `,
      )
      .eq("club_id", profiloData.last_club_id)
      .order("data_inizio", { ascending: false });

    if (profiloData.last_squadra_id) {
      // Come in ProgrammazioneClient: mostriamo sia le programmazioni della
      // squadra attiva sia quelle create senza squadra specifica.
      programmazioniQuery = programmazioniQuery.or(
        `squadra_id.eq.${profiloData.last_squadra_id},squadra_id.is.null`,
      );
    }

    // Club, allenamenti, giocatori e programmazioni non dipendono l'uno
    // dall'altro: richiesti in parallelo per ridurre il tempo di caricamento.
    const [
      { data: clubData },
      { data: allenamentiData, error: allenamentiError },
      { data: giocatoriData, error: giocatoriError },
      { data: programmazioniData, error: programmazioniError },
      { data: drillBankData, error: drillBankError },
    ] = await Promise.all([
      supabase
        .from("club")
        .select("colore_flag,logo_url,preferenza_vista_lavori")
        .eq("id", profiloData.last_club_id)
        .single(),
      allenamentiQuery,
      giocatoriQuery,
      programmazioniQuery,
      supabase
        .from("drill_bank")
        .select("*")
        .eq("club_id", profiloData.last_club_id)
        .order("codice", { ascending: true }),
    ]);

    if (drillBankError) {
      console.error(drillBankError);
    } else {
      setDrillBank(drillBankData || []);
    }

    setThemeColor(clubData?.colore_flag || "#d71920");
    setClubLogoUrl(clubData?.logo_url || null);
    setPreferenzaVistaLavori(
      clubData?.preferenza_vista_lavori === "tabella" ? "tabella" : "card",
    );

    if (allenamentiError) {
      console.error(allenamentiError);
      setLoading(false);
      return;
    }

    if (giocatoriError) {
      console.error(giocatoriError);
    }

    if (programmazioniError) {
      console.error(programmazioniError);
    } else {
      setProgrammazioni(
        (programmazioniData as unknown as Programmazione[]) || [],
      );
    }

    const idsAllenamenti = allenamentiData?.map((a) => a.id) || [];

    // Le presenze si caricano per giornata: le sedute servono solo a
    // sapere quali giorni interessano.
    const giorniAllenamenti = Array.from(
      new Set(
        (allenamentiData || [])
          .map((a) => a.data_allenamento)
          .filter((data): data is string => Boolean(data)),
      ),
    );

    let lavoriData: Lavoro[] = [];
    let presenzeData: Presenza[] = [];

    if (idsAllenamenti.length > 0) {
      const [
        { data: lavoriResult, error: lavoriError },
        { data: presenzeResult, error: presenzeError },
      ] = await Promise.all([
        supabase
          .from("lavori_allenamento")
          .select("*")
          .in("allenamento_id", idsAllenamenti)
          .order("ordine", { ascending: true }),
        supabase
          .from("presenze_giornaliere")
          .select("*")
          .in("data", giorniAllenamenti),
      ]);

      if (lavoriError) {
        console.error(lavoriError);
      } else {
        lavoriData = lavoriResult || [];
      }

      if (presenzeError) {
        console.error(presenzeError);
      } else {
        presenzeData = presenzeResult || [];
      }
    }

    setAllenamenti(allenamentiData || []);
    setGiocatori(giocatoriData || []);
    setLavori(lavoriData);
    setPresenze(presenzeData);
    setLoading(false);
  }

 useEffect(() => {
  let mounted = true;

  async function init() {
    if (!mounted) return;
    await caricaDati();
  }

  void init();

  return () => {
    mounted = false;
  };

}, []);

  async function salvaPresenza(
    allenamento: Allenamento,
    giocatoreId: string,
    stato: StatoPresenza,
    giustificazione?: string | null,
  ) {
    if (!isAdmin) return;
    if (!profilo?.last_club_id || !userId) return;

    const statoDb = STATI_PRESENZA.find((s) => s.sigla === stato)?.db;

    if (!statoDb) return;

    const payload = {
      giocatore_id: giocatoreId,
      club_id: profilo.last_club_id,
      squadra_id: profilo.last_squadra_id || allenamento.squadra_id,
      data: allenamento.data_allenamento,
      stato: statoDb,
      /*
       * Il motivo appartiene all'assenza giustificata: passando a un
       * altro stato va azzerato, altrimenti resterebbe appiccicato alla
       * giornata e finirebbe nel PDF su una riga che non e' piu' un'AG.
       */
      giustificazione:
        statoDb === "assenza_giustificata" ? (giustificazione ?? null) : null,
      registrato_da: userId,
      updated_at: new Date().toISOString(),
    };

    const { data, error } = await supabase
      .from("presenze_giornaliere")
      .upsert(payload, {
        onConflict: "club_id,giocatore_id,data",
      })
      .select("*")
      .single();

    if (error) {
      console.error("Errore salvataggio presenza:", error);
      return;
    }

    setPresenze((current) => {
      const senzaVecchia = current.filter(
        (presenza) =>
          !(
            presenza.data === allenamento.data_allenamento &&
            presenza.giocatore_id === giocatoreId
          ),
      );

      return [...senzaVecchia, data as Presenza];
    });
  }

  async function eliminaPresenza(allenamentoId: string, giocatoreId: string) {
    if (!isAdmin) return;

    const data = dataDiAllenamento(allenamentoId);

    if (!data) return;

    const { error } = await supabase
      .from("presenze_giornaliere")
      .delete()
      .eq("data", data)
      .eq("giocatore_id", giocatoreId);

    if (error) {
      console.error("Errore eliminazione presenza:", error);
      return;
    }

    setPresenze((current) =>
      current.filter(
        (presenza) =>
          !(presenza.data === data && presenza.giocatore_id === giocatoreId),
      ),
    );
  }

  async function apriAnteprimaPdf(allenamento: Allenamento) {
    setGenerandoPdfId(allenamento.id);

    try {
      const { doc, nomeFile } = await generaPdfAllenamento(
        allenamento,
        lavoriPerAllenamento(allenamento.id),
        { logo_url: clubLogoUrl },
      );

      const blobUrl = URL.createObjectURL(doc.output("blob"));
      setPdfInAnteprima({ doc, blobUrl, nomeFile });
    } catch (error) {
      console.error("Errore generazione PDF:", error);
    } finally {
      setGenerandoPdfId(null);
    }
  }

  function chiudiAnteprimaPdf() {
    if (pdfInAnteprima) URL.revokeObjectURL(pdfInAnteprima.blobUrl);
    setPdfInAnteprima(null);
  }

  const allenamentiPalestra = useMemo(
    () =>
      allenamenti.filter(
        (allenamento) =>
          allenamento.tipo_allenamento?.trim().toLowerCase() === "palestra"
      ),
    [allenamenti]
  );

  const allenamentiOrdinari = useMemo(
    () =>
      allenamenti.filter(
        (allenamento) =>
          allenamento.tipo_allenamento?.trim().toLowerCase() !== "palestra"
      ),
    [allenamenti]
  );

  const cicliPalestra = useMemo(() => {
    const gruppi = new Map<string, Allenamento[]>();

    for (const seduta of allenamentiPalestra) {
      // Le importazioni precedenti alla migrazione non hanno il periodo:
      // confluiscono in un ciclo storico ricavato dalle date dei Day.
      const chiave =
        seduta.ciclo_dal && seduta.ciclo_al
          ? `${seduta.ciclo_dal}|${seduta.ciclo_al}`
          : "senza-periodo";
      gruppi.set(chiave, [...(gruppi.get(chiave) ?? []), seduta]);
    }

    return Array.from(gruppi.entries())
      .map(([chiave, sedute]) => {
        const ordinate = [...sedute].sort((a, b) =>
          a.data_allenamento.localeCompare(b.data_allenamento)
        );
        return {
          chiave,
          dal: ordinate[0]?.ciclo_dal ?? ordinate[0]?.data_allenamento ?? "",
          al:
            ordinate[0]?.ciclo_al ??
            ordinate[ordinate.length - 1]?.data_allenamento ??
            "",
          sedute: ordinate,
        };
      })
      .sort((a, b) => b.dal.localeCompare(a.dal));
  }, [allenamentiPalestra]);

  const allenamentiSettimana = useMemo(() => {
    const inizio = inizioSettimanaISO();
    const fine = fineSettimanaISO();

    return allenamentiOrdinari.filter(
      (allenamento) =>
        allenamento.data_allenamento >= inizio &&
        allenamento.data_allenamento <= fine,
    );
  }, [allenamentiOrdinari]);

  const allenamentiIntervallo = useMemo(() => {
    return allenamentiOrdinari.filter(
      (allenamento) =>
        allenamento.data_allenamento >= dataDa &&
        allenamento.data_allenamento <= dataA,
    );
  }, [allenamentiOrdinari, dataDa, dataA]);

  /*
   * Memoizzato perche' e' la dipendenza dell'useEffect qui sotto: come
   * semplice espressione sarebbe un array nuovo a ogni render e
   * l'effetto girerebbe di continuo. Le due liste da cui deriva sono
   * gia' memoizzate, quindi il riferimento cambia solo quando cambiano
   * davvero i dati o la vista.
   */
  const allenamentiDaMostrare = useMemo(
    () => (vista === "riepilogo" ? allenamentiSettimana : allenamentiIntervallo),
    [vista, allenamentiSettimana, allenamentiIntervallo]
  );

  /*
   * Pota la selezione tenendo solo le sedute ancora visibili. Senza,
   * cambiando l'intervallo di date (o eliminando qualcosa) resterebbero
   * selezionati id fuori schermo: il contatore direbbe "7 selezionate"
   * mentre a video se ne vedono 2, e la conferma cancellerebbe anche
   * quelle che l'utente non ha davanti.
   */
  useEffect(() => {
    setSelezionati((precedente) => {
      if (precedente.size === 0) return precedente;

      const visibili = new Set(
        allenamentiDaMostrare.map((allenamento) => allenamento.id)
      );

      const potata = new Set(
        Array.from(precedente).filter((id) => visibili.has(id))
      );

      // Stessa dimensione = nessuna rimozione: si restituisce il Set
      // originale per non innescare un render inutile.
      return potata.size === precedente.size ? precedente : potata;
    });
  }, [allenamentiDaMostrare]);

  const selezionatiVisibili = allenamentiDaMostrare.filter((allenamento) =>
    selezionati.has(allenamento.id)
  );

  const tuttiSelezionati =
    allenamentiDaMostrare.length > 0 &&
    selezionatiVisibili.length === allenamentiDaMostrare.length;

  /*
   * Uscire dalla modalita' azzera anche la selezione: lasciare delle
   * sedute spuntate ma invisibili significherebbe che riaccendendo la
   * modalita' ci si ritrova una selezione fatta chissa' quando, con il
   * pulsante Elimina gia' attivo.
   */
  function alternaModalitaSelezione() {
    setModalitaSelezione((precedente) => {
      if (precedente) {
        setSelezionati(new Set());
        setEsitoEliminazione(null);
      }

      return !precedente;
    });
  }

  /*
   * Il pulsante "Seleziona" vive nella barra dei filtri, che compare
   * solo nella vista Elenco. Cambiando vista sparirebbe lasciando le
   * checkbox accese e nessun modo per spegnerle: la modalita' si chiude
   * insieme alla vista che la comanda.
   */
  useEffect(() => {
    if (vista !== "elenco" && modalitaSelezione) {
      setModalitaSelezione(false);
      setSelezionati(new Set());
      setEsitoEliminazione(null);
    }
  }, [vista, modalitaSelezione]);

  function alternaSelezione(allenamentoId: string) {
    setEsitoEliminazione(null);

    setSelezionati((precedente) => {
      const successivo = new Set(precedente);

      if (successivo.has(allenamentoId)) {
        successivo.delete(allenamentoId);
      } else {
        successivo.add(allenamentoId);
      }

      return successivo;
    });
  }

  function alternaSelezioneTutti() {
    setEsitoEliminazione(null);

    setSelezionati(
      tuttiSelezionati
        ? new Set()
        : new Set(allenamentiDaMostrare.map((allenamento) => allenamento.id))
    );
  }

  async function eliminaSelezionate() {
    if (selezionatiVisibili.length === 0) return;

    setEliminandoBlocco(true);
    setEsitoEliminazione(null);

    try {
      const esito = await eliminaAllenamentiInBlocco(
        selezionatiVisibili.map((allenamento) => allenamento.id)
      );

      setEsitoEliminazione({
        tipo: esito.success ? "ok" : "errore",
        testo: esito.message,
      });

      if (esito.success) {
        setSelezionati(new Set());
        setConfermaEliminazione(false);
        setOpenId(null);
        await caricaDati();
      }
    } catch (error) {
      setEsitoEliminazione({
        tipo: "errore",
        testo:
          error instanceof Error
            ? error.message
            : "Errore durante l'eliminazione.",
      });
    } finally {
      setEliminandoBlocco(false);
    }
  }

  async function eliminaCicloPalestra() {
    if (!cicloPalestraDaEliminare || !isAdmin) return;

    setEliminandoCicloPalestra(true);
    setErroreEliminazioneCiclo(null);

    try {
      const esito = await eliminaAllenamentiInBlocco(
        cicloPalestraDaEliminare.sedute.map((seduta) => seduta.id)
      );

      if (!esito.success) {
        setErroreEliminazioneCiclo(esito.message);
        return;
      }

      setCicloPalestraAperto(null);
      setCicloPalestraDaEliminare(null);
      await caricaDati();
    } catch (error) {
      setErroreEliminazioneCiclo(
        error instanceof Error
          ? error.message
          : "Errore durante l'eliminazione del ciclo."
      );
    } finally {
      setEliminandoCicloPalestra(false);
    }
  }

  const lavoriPerAllenamento = (allenamentoId: string) => {
    return lavori.filter((lavoro) => lavoro.allenamento_id === allenamentoId);
  };

  // Orario di inizio/fine di ogni lavoro, calcolato accumulando i tempo_totale
  // a partire dall'ora_inizio della seduta. I lavori "in contemporanea"
  // condividono lo stesso slot orario (non avanzano il cursore due volte).
  function orarioAMinuti(orario: string) {
    const [ore, minuti] = orario.split(":").map((parte) => Number(parte) || 0);
    return ore * 60 + minuti;
  }

  function minutiAOrario(minuti: number) {
    const oreEffettive = Math.floor(minuti / 60) % 24;
    const minutiEffettivi = ((minuti % 60) + 60) % 60;

    return `${String(oreEffettive).padStart(2, "0")}:${String(
      minutiEffettivi,
    ).padStart(2, "0")}`;
  }

  function orariLavori(
    oraInizio: string | null,
    lavoriOrdinati: Lavoro[],
  ): Map<string, { inizio: string; fine: string }> {
    const risultato = new Map<string, { inizio: string; fine: string }>();

    if (!oraInizio) return risultato;

    let cursore = orarioAMinuti(oraInizio);
    const gruppiVisti = new Map<string, { inizio: string; fine: string }>();

    for (const lavoro of lavoriOrdinati) {
      if (lavoro.gruppo_contemporaneo) {
        const rangeGruppo = gruppiVisti.get(lavoro.gruppo_contemporaneo);

        if (rangeGruppo) {
          risultato.set(lavoro.id, rangeGruppo);
          continue;
        }
      }

      const inizio = cursore;
      const fine = cursore + (lavoro.tempo_totale || 0);
      const range = { inizio: minutiAOrario(inizio), fine: minutiAOrario(fine) };

      risultato.set(lavoro.id, range);

      if (lavoro.gruppo_contemporaneo) {
        gruppiVisti.set(lavoro.gruppo_contemporaneo, range);
      }

      cursore = fine;
    }

    return risultato;
  }

  // Fasi (macrocicli) e settimane (microcicli), lette dalla Programmazione,
  // appiattite in un'unica lista ciascuna per poterle scorrere facilmente.
  const fasiFlat = useMemo(() => {
    return programmazioni
      .flatMap((programmazione) => programmazione.programmazione_fasi ?? [])
      .sort((a, b) => a.data_inizio.localeCompare(b.data_inizio));
  }, [programmazioni]);

  const settimaneFlat = useMemo(() => {
    return fasiFlat
      .flatMap((fase) =>
        (fase.programmazione_settimane ?? []).map((settimana) => ({
          ...settimana,
          faseNome: fase.nome,
          faseColore: fase.colore,
        })),
      )
      .sort((a, b) => a.data_inizio.localeCompare(b.data_inizio));
  }, [fasiFlat]);

  // Per ogni settimana/fase, le sedute la cui data cade nel suo intervallo.
  // Vengono mostrate solo settimane/fasi con almeno una seduta, per non
  // riempire la vista di gruppi vuoti.
  const microcicli = useMemo(() => {
    return settimaneFlat
      .map((settimana) => ({
        settimana,
        sedute: allenamentiOrdinari
          .filter(
            (allenamento) =>
              allenamento.data_allenamento >= settimana.data_inizio &&
              allenamento.data_allenamento <= settimana.data_fine,
          )
          .sort(
            (a, b) =>
              a.data_allenamento.localeCompare(b.data_allenamento) ||
              (a.ora_inizio ?? "").localeCompare(b.ora_inizio ?? ""),
          ),
      }))
      .filter((gruppo) => gruppo.sedute.length > 0);
  }, [settimaneFlat, allenamentiOrdinari]);

  // Blocco riepilogativo di una singola seduta per la vista Microcicli:
  // intestazione (giorno, tipo, orario) + tabella dei lavori
  // con Orario calcolato, riadattando i campi già esistenti di un lavoro
  // (Tipo=Sezione, Drill=Descrizione, Consegna=Obiettivo).
  function riepilogoSeduta(allenamento: Allenamento) {
    const lavoriSeduta = lavoriPerAllenamento(allenamento.id).sort(
      (a, b) => (a.ordine ?? 0) - (b.ordine ?? 0),
    );
    const orari = orariLavori(allenamento.ora_inizio, lavoriSeduta);
    const partecipanti = presentiAllenamento(allenamento.id);

    return (
      <div key={allenamento.id} className="overflow-hidden rounded-2xl border border-zinc-800">
        <div
          className="flex flex-wrap items-center justify-between gap-2 px-4 py-2.5 text-sm font-bold text-white"
          style={{ backgroundColor: themeColor }}
        >
          <span>
            {formattaData(allenamento.data_allenamento)}
            {allenamento.tipo_allenamento ? ` — ${allenamento.tipo_allenamento}` : ""}
            {allenamento.titolo ? ` — ${allenamento.titolo}` : ""}
          </span>
          <span className="font-semibold text-white/85">
            Tutti ({partecipanti})
            {allenamento.ora_inizio
              ? ` · ${allenamento.ora_inizio.slice(0, 5)}${
                  allenamento.ora_fine ? `–${allenamento.ora_fine.slice(0, 5)}` : ""
                }`
              : ""}
          </span>
        </div>

        {lavoriSeduta.length === 0 ? (
          <p className="px-4 py-3 text-sm text-zinc-500">Nessun lavoro inserito.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-[1350px] w-full border-collapse text-sm">
              <thead className="bg-zinc-900">
                <tr className="text-left text-zinc-400">
                  <th className="px-3 py-2 font-semibold">Orario</th>
                  <th className="px-3 py-2 font-semibold">Tipo</th>
                  <th className="px-3 py-2 font-semibold">Stazione</th>
                  <th className="px-3 py-2 font-semibold">Drill</th>
                  <th className="px-3 py-2 font-semibold">Consegna e organizzazione</th>
                  <th className="px-3 py-2 font-semibold">Punti chiave di coaching</th>
                  <th className="px-3 py-2 text-right font-semibold">Rip.</th>
                  <th className="px-3 py-2 text-right font-semibold">Tempo lavoro</th>
                  <th className="px-3 py-2 text-right font-semibold">Rec.</th>
                  <th className="px-3 py-2 text-right font-semibold">Totale</th>
                </tr>
              </thead>

              <tbody>
                {lavoriSeduta.map((lavoro) => {
                  const range = orari.get(lavoro.id);

                  return (
                    <tr key={lavoro.id} className="border-t border-zinc-800 bg-zinc-950/70 text-zinc-200 align-top">
                      <td className="whitespace-nowrap px-3 py-2 text-zinc-400">
                        {range ? `${range.inizio}–${range.fine}` : "—"}
                      </td>
                      <td className="px-3 py-2 font-semibold text-white">{lavoro.sezione}</td>
                      <td className="px-3 py-2 text-zinc-300">{lavoro.rango || "—"}</td>
                      <td className="px-3 py-2">{lavoro.descrizione || "—"}</td>
                      <td className="px-3 py-2">{lavoro.obbiettivo || "—"}</td>
                      <td className="px-3 py-2">{lavoro.punti_chiave_coaching || "—"}</td>
                      <td className="whitespace-nowrap px-3 py-2 text-right text-zinc-400">
                        {lavoro.ripetizione ?? "—"}
                      </td>
                      <td className="whitespace-nowrap px-3 py-2 text-right text-zinc-400">
                        {lavoro.tempo_lavoro ?? "—"}
                      </td>
                      <td className="whitespace-nowrap px-3 py-2 text-right text-zinc-400">
                        {lavoro.tempo_recupero ?? "—"}
                      </td>
                      <td className="whitespace-nowrap px-3 py-2 text-right font-bold">
                        {lavoro.tempo_totale ?? "—"}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    );
  }

  // I lavori "in contemporanea" condividono lo stesso gruppo_contemporaneo:
  // vanno sommati una sola volta (il tempo è lo stesso intervallo, non due
  // intervalli distinti), altrimenti il minutaggio totale risulterebbe
  // raddoppiato.
  const sommaTempoTotaleDeduplicato = (listaLavori: Lavoro[]) => {
    const gruppiContati = new Set<string>();

    return listaLavori.reduce((totale, lavoro) => {
      if (lavoro.gruppo_contemporaneo) {
        if (gruppiContati.has(lavoro.gruppo_contemporaneo)) return totale;
        gruppiContati.add(lavoro.gruppo_contemporaneo);
      }

      return totale + (lavoro.tempo_totale || 0);
    }, 0);
  };

  const minutiAllenamento = (allenamentoId: string) => {
    return sommaTempoTotaleDeduplicato(lavoriPerAllenamento(allenamentoId));
  };

  /*
   * Le presenze sono per giornata: dalla seduta si risale alla sua data e
   * si cerca la riga di quel giorno. Due sedute nello stesso giorno
   * mostrano quindi la stessa presenza, che e' il comportamento voluto.
   */
  // Dichiarata come function (non const) perche' eliminaPresenza, definita
  // piu' in alto nel componente, la usa: le function declaration sono
  // hoistate, una const resterebbe in temporal dead zone.
  function dataDiAllenamento(allenamentoId: string): string | null {
    return (
      allenamentiOrdinari.find((a) => a.id === allenamentoId)
        ?.data_allenamento ?? null
    );
  }

  const statoGiocatore = (
    allenamentoId: string,
    giocatoreId: string,
  ): StatoPresenza | undefined => {
    const data = dataDiAllenamento(allenamentoId);

    if (!data) return undefined;

    const statoDb = presenze.find(
      (presenza) =>
        presenza.data === data && presenza.giocatore_id === giocatoreId,
    )?.stato;

    return STATI_PRESENZA.find((stato) => stato.db === statoDb)?.sigla;
  };

  const giustificazioneGiocatore = (
    allenamentoId: string,
    giocatoreId: string,
  ): string | null => {
    const data = dataDiAllenamento(allenamentoId);

    if (!data) return null;

    return (
      presenze.find(
        (presenza) =>
          presenza.data === data && presenza.giocatore_id === giocatoreId,
      )?.giustificazione ?? null
    );
  };

  const presentiAllenamento = (allenamentoId: string) => {
    const data = dataDiAllenamento(allenamentoId);

    if (!data) return 0;

    return presenze.filter((presenza) => {
      if (presenza.data !== data) return false;

      return [
        "presente_mattina",
        "presente_pomeriggio",
        "presente_entrambe",
      ].includes(presenza.stato);
    }).length;
  };

  const datiGrafico = (allenamentoId: string) => {
    const gruppiContati = new Set<string>();

    const grouped = lavoriPerAllenamento(allenamentoId).reduce<
      Record<string, number>
    >((acc, lavoro) => {
      const sezione = lavoro.sezione || "Altro";
      let minuti = lavoro.tempo_totale || 0;

      if (lavoro.gruppo_contemporaneo) {
        if (gruppiContati.has(lavoro.gruppo_contemporaneo)) {
          minuti = 0;
        } else {
          gruppiContati.add(lavoro.gruppo_contemporaneo);
        }
      }

      acc[sezione] = (acc[sezione] || 0) + minuti;
      return acc;
    }, {});

    return Object.entries(grouped).map(([label, value]) => ({
      label,
      value,
    }));
  };

  const totaleAllenamenti = allenamentiOrdinari.length;

  const idsAllenamentiOrdinari = new Set(
    allenamentiOrdinari.map((allenamento) => allenamento.id)
  );
  const minutaggioTotale = sommaTempoTotaleDeduplicato(
    lavori.filter((lavoro) => idsAllenamentiOrdinari.has(lavoro.allenamento_id))
  );
  // Un giorno può avere più sedute (es. mattina + sera): non prendiamo solo
  // la prima in ordine di data, ma TUTTE quelle che cadono nel giorno più
  // vicino (oggi, o il prossimo giorno con almeno una seduta programmata).
  const allenamentiOdierniOProssimi = useMemo(() => {
    const oggi = new Date();
    oggi.setHours(0, 0, 0, 0);

    const fineSettimana = new Date(oggi);
    const giorno = oggi.getDay();

    fineSettimana.setDate(
      oggi.getDate() + (giorno === 0 ? 0 : 7 - giorno)
    );
    fineSettimana.setHours(23, 59, 59, 999);

    const inRange = [...allenamentiOrdinari]
      .map((allenamento) => ({
        ...allenamento,
        data: new Date(`${allenamento.data_allenamento}T00:00:00`),
      }))
      .filter(
        (allenamento) =>
          allenamento.data >= oggi &&
          allenamento.data <= fineSettimana
      )
      .sort((a, b) => a.data.getTime() - b.data.getTime());

    const primaData = inRange[0]?.data_allenamento;
    if (!primaData) return [];

    return inRange
      .filter((allenamento) => allenamento.data_allenamento === primaData)
      .sort((a, b) =>
        (a.ora_inizio ?? "").localeCompare(b.ora_inizio ?? "")
      );
  }, [allenamentiOrdinari]);
  const tabButtonStyle = (tab: Vista) =>
    vista === tab
      ? {
          backgroundColor: themeColor,
          color: "#ffffff",
          boxShadow: `0 12px 30px ${themeColor}33`,
        }
      : undefined;

  return (
    <>
      <div className="space-y-5 pb-8 sm:space-y-6">
        <AppCard>
  <div className="flex w-full flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
    <div className="min-w-0">
      <p className="text-xs font-bold uppercase tracking-[0.22em] text-zinc-500">
        Allenamenti
      </p>

      <h1 className="mt-1 text-2xl font-black tracking-tight text-white sm:text-3xl">
        Planning sedute
      </h1>

      <p className="mt-1 text-sm text-zinc-400">
        Gestisci lavori, presenze e riepiloghi della squadra.
      </p>
    </div>

    {/* PULSANTI CREA SEDUTA / REGISTRA PRESENZE / IMPORTA EXCEL - SOLO DESKTOP */}
    {isAdmin && (
    <div className="hidden items-center gap-3 lg:flex">
      <button
        type="button"
        onClick={() => setOpenRegistraPresenze(true)}
        className="inline-flex items-center justify-center gap-2 rounded-2xl border px-4 py-3 text-sm font-black text-white transition hover:bg-white/5 active:scale-[0.98]"
        style={{ borderColor: `${themeColor}55` }}
      >
        <ClipboardCheck className="h-4 w-4" />
        Registra presenze
      </button>

      <button
        type="button"
        onClick={() => setOpenImportaExcel(true)}
        className="inline-flex items-center justify-center gap-2 rounded-2xl border px-4 py-3 text-sm font-black text-white transition hover:bg-white/5 active:scale-[0.98]"
        style={{ borderColor: `${themeColor}55` }}
      >
        <FileUp className="h-4 w-4" />
        Importa Excel
      </button>

      <button
        type="button"
        onClick={() => setOpenScaricaTemplate(true)}
        className="inline-flex items-center justify-center gap-2 rounded-2xl border px-4 py-3 text-sm font-black text-white transition hover:bg-white/5 active:scale-[0.98]"
        style={{ borderColor: `${themeColor}55` }}
      >
        <FileDown className="h-4 w-4" />
        Scarica template
      </button>

      <button
        type="button"
        onClick={() => setOpenNuovoAllenamento(true)}
        className="inline-flex items-center justify-center gap-2 rounded-2xl px-4 py-3 text-sm font-black text-white transition hover:brightness-110 active:scale-[0.98]"
        style={{
          backgroundColor: themeColor,
          boxShadow: `0 16px 36px ${themeColor}38`,
        }}
      >
        <Plus className="h-4 w-4" />
        Crea seduta
      </button>
    </div>
    )}
  </div>

  {/* TAB SCROLLABILI ORIZZONTALMENTE */}
  <div className="mt-5 -mx-4 overflow-x-auto px-4 sm:mx-0 sm:px-0">
    <div className="flex min-w-max items-center gap-2 rounded-2xl border border-zinc-800 bg-zinc-950/80 p-1 shadow-inner shadow-black/30">
      
      <button
        type="button"
        onClick={() => setVista("odierno")}
        className={`shrink-0 rounded-2xl px-4 py-2.5 text-sm font-bold transition ${
          vista === "odierno"
            ? ""
            : "text-zinc-400 hover:bg-zinc-900 hover:text-white"
        }`}
        style={tabButtonStyle("odierno")}
      >
        Odierno
      </button>

      <button
        type="button"
        onClick={() => setVista("riepilogo")}
        className={`shrink-0 rounded-2xl px-4 py-2.5 text-sm font-bold transition ${
          vista === "riepilogo"
            ? ""
            : "text-zinc-400 hover:bg-zinc-900 hover:text-white"
        }`}
        style={tabButtonStyle("riepilogo")}
      >
        Riepilogo Pianificazione
      </button>

      <button
        type="button"
        onClick={() => setVista("elenco")}
        className={`shrink-0 rounded-2xl px-4 py-2.5 text-sm font-bold transition ${
          vista === "elenco"
            ? ""
            : "text-zinc-400 hover:bg-zinc-900 hover:text-white"
        }`}
        style={tabButtonStyle("elenco")}
      >
        Elenco Lavori
      </button>

      <button
        type="button"
        onClick={() => setVista("microcicli")}
        className={`shrink-0 rounded-2xl px-4 py-2.5 text-sm font-bold transition ${
          vista === "microcicli"
            ? ""
            : "text-zinc-400 hover:bg-zinc-900 hover:text-white"
        }`}
        style={tabButtonStyle("microcicli")}
      >
        Microcicli
      </button>

      <button
        type="button"
        onClick={() => setVista("palestra")}
        className={`shrink-0 flex items-center gap-1.5 rounded-2xl px-4 py-2.5 text-sm font-bold transition ${
          vista === "palestra"
            ? ""
            : "text-zinc-400 hover:bg-zinc-900 hover:text-white"
        }`}
        style={tabButtonStyle("palestra")}
      >
        <Dumbbell className="h-4 w-4" />
        Palestra
      </button>

      <button
        type="button"
        onClick={() => setVista("resoconto")}
        className={`shrink-0 rounded-2xl px-4 py-2.5 text-sm font-bold transition ${
          vista === "resoconto"
            ? ""
            : "text-zinc-400 hover:bg-zinc-900 hover:text-white"
        }`}
        style={tabButtonStyle("resoconto")}
      >
        Resoconto generale
      </button>

      <button
        type="button"
        onClick={() => setVista("drillbank")}
        className={`shrink-0 flex items-center gap-1.5 rounded-2xl px-4 py-2.5 text-sm font-bold transition ${
          vista === "drillbank"
            ? ""
            : "text-zinc-400 hover:bg-zinc-900 hover:text-white"
        }`}
        style={tabButtonStyle("drillbank")}
      >
        <BookOpen className="h-4 w-4" />
        Drill Bank
      </button>

      {/* ULTIME TAB - SOLO MOBILE/TABLET */}
      {isAdmin && (
      <button
        type="button"
        onClick={() => setOpenRegistraPresenze(true)}
        className="inline-flex shrink-0 items-center justify-center gap-2 rounded-2xl border px-4 py-2.5 text-sm font-black text-white transition hover:bg-white/5 active:scale-[0.98] lg:hidden"
        style={{ borderColor: `${themeColor}55` }}
      >
        <ClipboardCheck className="h-4 w-4" />
        Registra presenze
      </button>
      )}

      {isAdmin && (
      <button
        type="button"
        onClick={() => setOpenImportaExcel(true)}
        className="inline-flex shrink-0 items-center justify-center gap-2 rounded-2xl border px-4 py-2.5 text-sm font-black text-white transition hover:bg-white/5 active:scale-[0.98] lg:hidden"
        style={{ borderColor: `${themeColor}55` }}
      >
        <FileUp className="h-4 w-4" />
        Importa Excel
      </button>
      )}

      {isAdmin && (
      <button
        type="button"
        onClick={() => setOpenScaricaTemplate(true)}
        className="inline-flex shrink-0 items-center justify-center gap-2 rounded-2xl border px-4 py-2.5 text-sm font-black text-white transition hover:bg-white/5 active:scale-[0.98] lg:hidden"
        style={{ borderColor: `${themeColor}55` }}
      >
        <FileDown className="h-4 w-4" />
        Scarica template
      </button>
      )}

      {isAdmin && (
      <button
        type="button"
        onClick={() => setOpenNuovoAllenamento(true)}
        className="inline-flex shrink-0 items-center justify-center gap-2 rounded-2xl px-4 py-2.5 text-sm font-black text-white transition hover:brightness-110 active:scale-[0.98] lg:hidden"
        style={{
          backgroundColor: themeColor,
          boxShadow: `0 10px 24px ${themeColor}33`,
        }}
      >
        <Plus className="h-4 w-4" />
        Crea seduta
      </button>
      )}
    </div>
  </div>
</AppCard>

        {loading && (
          <AppCard>
            <p className="text-zinc-400">Caricamento allenamenti...</p>
          </AppCard>
        )}
          {vista === "odierno" && (
  <div className="space-y-5">
    {allenamentiOdierniOProssimi.length > 0 ? (
      allenamentiOdierniOProssimi.map((allenamentoOdiernoOProssimo) => (
        <AppCard key={allenamentoOdiernoOProssimo.id}>
          <div className="space-y-5">
            <div className="flex flex-wrap items-start justify-between gap-4">
              <div>
                <p
                  className="inline-flex rounded-full px-3 py-1 text-xs font-bold text-white"
                  style={{ backgroundColor: themeColor }}
                >
                  {allenamentoOdiernoOProssimo.data.toDateString() ===
                  new Date().toDateString()
                    ? "Allenamento di oggi"
                    : "Prossimo allenamento"}
                </p>

                <h2 className="mt-3 text-2xl font-bold text-white">
                  {allenamentoOdiernoOProssimo.titolo}
                </h2>

                <p className="mt-1 text-sm text-zinc-400">
                  {allenamentoOdiernoOProssimo.data.toLocaleDateString("it-IT", {
                    weekday: "long",
                    day: "2-digit",
                    month: "long",
                    year: "numeric",
                  })}
                  {allenamentoOdiernoOProssimo.ora_inizio
                    ? ` · ${allenamentoOdiernoOProssimo.ora_inizio.slice(0, 5)}`
                    : ""}
                  {allenamentoOdiernoOProssimo.ora_fine
                    ? ` - ${allenamentoOdiernoOProssimo.ora_fine.slice(0, 5)}`
                    : ""}
                </p>
              </div>
            </div>

            <div className="grid gap-3 md:grid-cols-4">
              <InfoBox label="Luogo" value={allenamentoOdiernoOProssimo.luogo ?? "—"} />
              <InfoBox label="Tipo" value={allenamentoOdiernoOProssimo.tipo_allenamento ?? "—"} />
              <InfoBox label="Durata" value={allenamentoOdiernoOProssimo.durata_minuti ? `${allenamentoOdiernoOProssimo.durata_minuti} min` : "—"} />
              <InfoBox label="Stato" value={allenamentoOdiernoOProssimo.stato} />
            </div>

            {allenamentoOdiernoOProssimo.obiettivo && (
              <div
                className="rounded-2xl border p-4"
                style={{
                  borderColor: `${themeColor}55`,
                  backgroundColor: `${themeColor}12`,
                }}
              >
                <p
                  className="text-xs font-bold uppercase tracking-wide"
                  style={{ color: themeColor }}
                >
                  Obiettivo allenamento
                </p>
                <p className="mt-2 text-sm text-zinc-200">
                  {allenamentoOdiernoOProssimo.obiettivo}
                </p>
              </div>
            )}

            <div className="overflow-x-auto rounded-2xl border border-zinc-800">
              <table className="min-w-[960px] w-full border-collapse text-sm">
                <thead style={{ backgroundColor: themeColor }}>
                  <tr className="text-left text-white">
                    <th className="px-3 py-3">Orario</th>
                    <th className="px-3 py-3">Sezione</th>
                    <th className="px-3 py-3">Descrizione</th>
                    <th className="px-3 py-3">Obiettivo</th>
                    <th className="px-3 py-3 text-right">Rip.</th>
                    <th className="px-3 py-3 text-right">Tempo lavoro</th>
                    <th className="px-3 py-3 text-right">Rec.</th>
                    <th className="px-3 py-3 text-right">Totale</th>
                  </tr>
                </thead>

                <tbody>
                  {(() => {
                    const lavoriOdierno = lavoriPerAllenamento(
                      allenamentoOdiernoOProssimo.id,
                    ).sort((a, b) => (a.ordine ?? 0) - (b.ordine ?? 0));
                    const orariOdierno = orariLavori(
                      allenamentoOdiernoOProssimo.ora_inizio,
                      lavoriOdierno,
                    );

                    return lavoriOdierno.map((lavoro) => {
                      const range = orariOdierno.get(lavoro.id);

                      return (
                        <tr
                          key={lavoro.id}
                          className="border-t border-zinc-800 bg-zinc-950/70 text-zinc-200"
                        >
                          <td className="whitespace-nowrap px-3 py-3 text-zinc-400">
                            {range ? `${range.inizio}–${range.fine}` : "—"}
                          </td>
                          <td className="px-3 py-3 font-semibold text-white">
                            {lavoro.sezione}
                          </td>
                          <td className="px-3 py-3">
                            {lavoro.titolo || lavoro.descrizione || "—"}
                          </td>
                          <td className="px-3 py-3">
                            {lavoro.obbiettivo ?? "—"}
                          </td>
                          <td className="px-3 py-3 text-right">
                            {lavoro.ripetizione ?? "—"}
                          </td>
                          <td className="px-3 py-3 text-right">
                            {lavoro.tempo_lavoro ?? "—"}
                          </td>
                          <td className="px-3 py-3 text-right">
                            {lavoro.tempo_recupero ?? "—"}
                          </td>
                          <td className="px-3 py-3 text-right font-bold">
                            {lavoro.tempo_totale ?? "—"}
                          </td>
                        </tr>
                      );
                    });
                  })()}
                </tbody>
              </table>
            </div>
          </div>
        </AppCard>
      ))
    ) : (
      <AppCard>
        <div className="flex min-h-[220px] flex-col items-center justify-center text-center">
          <h3 className="text-lg font-bold text-white">
            Nessun allenamento previsto questa settimana
          </h3>
          <p className="mt-2 text-sm text-zinc-400">
            Non ci sono allenamenti da oggi fino alla fine della settimana corrente.
          </p>
        </div>
      </AppCard>
    )}
  </div>
)}
        {!loading && vista === "palestra" && (
          <div className="space-y-5">
            <AppCard>
              <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                <div>
                  <h2 className="text-lg font-black text-white">
                    Cicli palestra
                  </h2>
                  <p className="mt-1 text-sm text-zinc-400">
                    Programmi completi separati dagli allenamenti sul campo.
                  </p>
                </div>
                <div className="inline-flex self-start rounded-xl border border-zinc-800 bg-zinc-950 p-1">
                  {([
                    ["day", "Per Day"],
                    ["gruppo", "Per gruppo"],
                  ] as const).map(([valore, etichetta]) => (
                    <button
                      key={valore}
                      type="button"
                      onClick={() => setVistaPalestra(valore)}
                      className={`rounded-lg px-3 py-2 text-xs font-bold transition ${
                        vistaPalestra === valore
                          ? "bg-white text-black"
                          : "text-zinc-400 hover:text-white"
                      }`}
                    >
                      {etichetta}
                    </button>
                  ))}
                </div>
              </div>
            </AppCard>

            {cicliPalestra.length === 0 ? (
              <AppCard>
                <div className="flex min-h-[180px] flex-col items-center justify-center text-center">
                  <Dumbbell className="h-8 w-8 text-zinc-600" />
                  <h3 className="mt-3 font-bold text-white">
                    Nessun ciclo palestra
                  </h3>
                  <p className="mt-1 text-sm text-zinc-500">
                    Importa un file palestra per visualizzarlo qui.
                  </p>
                </div>
              </AppCard>
            ) : (
              cicliPalestra.map((ciclo) => {
                const righeCiclo = ciclo.sedute.flatMap((seduta) =>
                  lavoriPerAllenamento(seduta.id).map((lavoro) => ({
                    lavoro,
                    day: etichettaDayPalestra(seduta),
                  }))
                );

                const gruppi = new Map<string, typeof righeCiclo>();
                for (const riga of righeCiclo) {
                  const sezione =
                    riga.lavoro.sezione.trim().toLowerCase() ===
                    "core and wellness"
                      ? "Circuiti"
                      : riga.lavoro.sezione || "Senza gruppo";
                  gruppi.set(sezione, [...(gruppi.get(sezione) ?? []), riga]);
                }

                return (
                  <AppCard key={ciclo.chiave}>
                    <button
                      type="button"
                      onClick={() =>
                        setCicloPalestraAperto((precedente) =>
                          precedente === ciclo.chiave ? null : ciclo.chiave
                        )
                      }
                      aria-expanded={cicloPalestraAperto === ciclo.chiave}
                      className={`flex w-full flex-wrap items-center justify-between gap-3 text-left ${
                        cicloPalestraAperto === ciclo.chiave
                          ? "border-b border-zinc-800 pb-4"
                          : ""
                      }`}
                    >
                      <div>
                        <p
                          className="text-xs font-bold uppercase tracking-[0.18em]"
                          style={{ color: themeColor }}
                        >
                          Ciclo palestra
                        </p>
                        <h3 className="mt-1 text-xl font-black text-white">
                          {formatDataITBreve(ciclo.dal)} –{" "}
                          {formatDataITBreve(ciclo.al)}
                        </h3>
                      </div>
                      <span className="flex items-center gap-2">
                        <span className="rounded-full border border-zinc-800 bg-zinc-950 px-3 py-1.5 text-xs font-bold text-zinc-400">
                          {ciclo.sedute.length} Day
                        </span>
                        <ChevronDown
                          className={`h-5 w-5 text-zinc-500 transition-transform ${
                            cicloPalestraAperto === ciclo.chiave
                              ? "rotate-180"
                              : ""
                          }`}
                        />
                      </span>
                    </button>

                    {isAdmin && cicloPalestraAperto === ciclo.chiave && (
                      <div className="mt-4 flex justify-end">
                        <button
                          type="button"
                          onClick={() => {
                            setErroreEliminazioneCiclo(null);
                            setCicloPalestraDaEliminare(ciclo);
                          }}
                          className="inline-flex items-center gap-2 rounded-xl border border-red-500/40 bg-red-500/10 px-3 py-2 text-xs font-bold text-red-300 transition hover:bg-red-500/20"
                        >
                          <Trash2 className="h-4 w-4" />
                          Elimina ciclo
                        </button>
                      </div>
                    )}

                    {cicloPalestraAperto === ciclo.chiave &&
                    (vistaPalestra === "day" ? (
                      <div className="mt-5 space-y-4">
                        {ciclo.sedute.map((seduta) => {
                          const righe = lavoriPerAllenamento(seduta.id).map(
                            (lavoro) => ({
                              lavoro,
                              day: etichettaDayPalestra(seduta),
                            })
                          );
                          const righePerGruppo = new Map<
                            string,
                            typeof righe
                          >();

                          for (const riga of righe) {
                            const gruppo =
                              riga.lavoro.sezione.trim().toLowerCase() ===
                              "core and wellness"
                                ? "Circuiti"
                                : riga.lavoro.sezione || "Senza gruppo";
                            righePerGruppo.set(gruppo, [
                              ...(righePerGruppo.get(gruppo) ?? []),
                              riga,
                            ]);
                          }

                          return (
                            <section
                              key={seduta.id}
                              className="rounded-2xl border border-zinc-800 bg-zinc-950 p-4"
                            >
                              <div className="flex flex-wrap items-center justify-between gap-2">
                                <h4 className="font-black text-white">
                                  {etichettaDayPalestra(seduta)}
                                </h4>
                                <span className="text-xs text-zinc-500">
                                  {righe.length} esercizi
                                </span>
                              </div>

                              <div className="mt-4 space-y-3">
                                {Array.from(righePerGruppo.entries()).map(
                                  ([gruppo, righeGruppo]) => (
                                    <div
                                      key={gruppo}
                                      className="overflow-hidden rounded-xl border border-zinc-800 bg-black"
                                    >
                                      <div className="flex items-center justify-between gap-2 border-b border-zinc-800 bg-white/[0.04] px-4 py-3">
                                        <p
                                          className="text-sm font-black"
                                          style={{ color: themeColor }}
                                        >
                                          {gruppo}
                                        </p>
                                        <span className="text-xs text-zinc-500">
                                          {righeGruppo.length}{" "}
                                          {righeGruppo.length === 1
                                            ? "lavoro"
                                            : "lavori"}
                                        </span>
                                      </div>
                                      <TabellaLavoriPalestra
                                        righe={righeGruppo}
                                      />
                                    </div>
                                  )
                                )}
                              </div>
                            </section>
                          );
                        })}
                      </div>
                    ) : (
                      <div className="mt-5 space-y-4">
                        {Array.from(gruppi.entries()).map(([gruppo, righe]) => (
                          <section
                            key={gruppo}
                            className="rounded-2xl border border-zinc-800 bg-zinc-950 p-4"
                          >
                            <div className="flex flex-wrap items-center justify-between gap-2">
                              <h4 className="font-black text-white">{gruppo}</h4>
                              <span className="text-xs text-zinc-500">
                                {righe.length} esercizi
                              </span>
                            </div>

                            <div className="mt-4 space-y-3">
                              {Array.from(
                                righe.reduce((perDay, riga) => {
                                  perDay.set(riga.day, [
                                    ...(perDay.get(riga.day) ?? []),
                                    riga,
                                  ]);
                                  return perDay;
                                }, new Map<string, typeof righe>())
                              ).map(([day, righeDay]) => (
                                <div
                                  key={day}
                                  className="overflow-hidden rounded-xl border border-zinc-800 bg-black"
                                >
                                  <div className="flex items-center justify-between gap-2 border-b border-zinc-800 bg-white/[0.04] px-4 py-3">
                                    <p
                                      className="text-sm font-black"
                                      style={{ color: themeColor }}
                                    >
                                      {day}
                                    </p>
                                    <span className="text-xs text-zinc-500">
                                      {righeDay.length}{" "}
                                      {righeDay.length === 1
                                        ? "lavoro"
                                        : "lavori"}
                                    </span>
                                  </div>
                                  <TabellaLavoriPalestra righe={righeDay} />
                                </div>
                              ))}
                            </div>
                          </section>
                        ))}
                      </div>
                    ))}
                  </AppCard>
                );
              })
            )}
          </div>
        )}

        {!loading && vista === "microcicli" && (
          <div className="space-y-5">
            {microcicli.length === 0 ? (
              <AppCard>
                <div className="flex min-h-[160px] flex-col items-center justify-center text-center">
                  <h3 className="text-lg font-bold text-white">
                    Nessun microciclo con sedute
                  </h3>
                  <p className="mt-2 text-sm text-zinc-400">
                    Crea una Programmazione con delle settimane e collega delle
                    sedute alle relative date per vederle qui raggruppate.
                  </p>
                </div>
              </AppCard>
            ) : (
              microcicli.map(({ settimana, sedute }) => (
                <AppCard key={settimana.id}>
                  <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
                    <div>
                      <p
                        className="text-xs font-bold uppercase tracking-wide"
                        style={{ color: settimana.faseColore || themeColor }}
                      >
                        {settimana.faseNome} · Settimana {settimana.numero_settimana}
                      </p>
                      <h3 className="mt-1 text-lg font-bold text-white">
                        {settimana.focus_settimana || "Microciclo"}
                      </h3>
                      <p className="mt-1 text-sm text-zinc-400">
                        {formatDataITBreve(settimana.data_inizio)} –{" "}
                        {formatDataITBreve(settimana.data_fine)}
                      </p>
                    </div>
                  </div>

                  <div className="space-y-4">
                    {sedute.map((allenamento) => riepilogoSeduta(allenamento))}
                  </div>
                </AppCard>
              ))
            )}
          </div>
        )}

        {!loading && vista === "resoconto" && (
          <div className="grid gap-4 md:grid-cols-3">
            <AppCard>
              <p className="text-sm text-zinc-400">Allenamenti totali</p>
              <p className="mt-2 text-3xl font-bold text-white">
                {totaleAllenamenti}
              </p>
            </AppCard>

            <AppCard>
              <p className="text-sm text-zinc-400">Minutaggio totale</p>
              <p className="mt-2 text-3xl font-bold text-white">
                {minutaggioTotale} min
              </p>
            </AppCard>

            <AppCard>
              <p className="text-sm text-zinc-400">Ore totali</p>
              <p className="mt-2 text-3xl font-bold text-white">
                {(minutaggioTotale / 60).toFixed(1)} h
              </p>
            </AppCard>
          </div>
        )}

        {!loading && vista === "elenco" && (
          <AppCard>
            <div className="grid gap-3 sm:grid-cols-2 lg:flex lg:flex-wrap lg:items-end">
              <div>
                <DateInput
                  label="Data da"
                  value={dataDa}
                  onChange={setDataDa}
                  wrapperClassName="mt-1 rounded-2xl border-zinc-800 bg-zinc-950"
                  wrapperStyle={{ borderColor: `${themeColor}33` }}
                />
              </div>

              <div>
                <DateInput
                  label="Data a"
                  value={dataA}
                  onChange={setDataA}
                  wrapperClassName="mt-1 rounded-2xl border-zinc-800 bg-zinc-950"
                  wrapperStyle={{ borderColor: `${themeColor}33` }}
                />
              </div>

              <button
                onClick={() => {
                  setDataDa(oggiISO());
                  setDataA(oggiISO());
                }}
                className="rounded-xl bg-zinc-900 px-4 py-2 text-sm font-medium text-zinc-300 hover:text-white"
              >
                Oggi
              </button>

              <button
                onClick={() => {
                  setDataDa(inizioSettimanaISO());
                  setDataA(fineSettimanaISO());
                }}
                className="rounded-xl bg-zinc-900 px-4 py-2 text-sm font-medium text-zinc-300 hover:text-white"
              >
                Settimana corrente
              </button>

              {/*
                * Interruttore della selezione multipla, in fondo alla riga
                * dei filtri (lg:ml-auto lo spinge a destra da tablet in su,
                * mentre su mobile resta in colonna con gli altri). Finche'
                * e' spento le sedute non mostrano nessuna checkbox: la
                * lista resta quella di sempre e l'eliminazione non e'
                * raggiungibile per sbaglio.
                */}
              {isAdmin && (
                <button
                  onClick={alternaModalitaSelezione}
                  aria-pressed={modalitaSelezione}
                  className={`inline-flex items-center justify-center gap-2 rounded-xl px-4 py-2 text-sm font-medium lg:ml-auto ${
                    modalitaSelezione
                      ? "bg-zinc-800 text-white"
                      : "bg-zinc-900 text-zinc-300 hover:text-white"
                  }`}
                >
                  <ListChecks className="h-4 w-4" />
                  {modalitaSelezione ? "Annulla selezione" : "Seleziona"}
                </button>
              )}
            </div>
          </AppCard>
        )}

        {!loading && vista === "drillbank" && (
          <AppCard>
            <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <h3 className="text-lg font-bold text-white">
                  Libreria Drill Bank
                </h3>
                <p className="mt-1 text-sm text-zinc-400">
                  Esercizi salvati per il club, riutilizzabili tra i cicli di
                  sedute (import Excel o creazione manuale seduta).
                </p>
              </div>

              <div className="relative w-full sm:w-64">
                <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-zinc-500" />
                <input
                  type="text"
                  value={ricercaDrillBank}
                  onChange={(e) => setRicercaDrillBank(e.target.value)}
                  placeholder="Cerca per codice, nome, sezione..."
                  className="w-full rounded-xl border border-zinc-800 bg-zinc-950 py-2 pl-9 pr-3 text-sm text-white placeholder:text-zinc-600 focus:border-zinc-600 focus:outline-none"
                />
              </div>
            </div>

            {(() => {
              const query = ricercaDrillBank.trim().toLowerCase();
              const drillFiltrati = drillBank.filter((drill) => {
                if (!query) return true;
                return [drill.codice, drill.nome, drill.sezione]
                  .filter(Boolean)
                  .some((campo) => campo!.toLowerCase().includes(query));
              });

              if (drillFiltrati.length === 0) {
                return (
                  <div className="flex min-h-[160px] flex-col items-center justify-center rounded-xl border border-dashed border-zinc-800 text-center">
                    <p className="text-sm text-zinc-500">
                      {drillBank.length === 0
                        ? "Nessun drill salvato per questo club. Importa una seduta da Excel con la tab Drill bank, oppure salvane uno da una seduta."
                        : "Nessun drill trovato per la ricerca."}
                    </p>
                  </div>
                );
              }

              return (
                <div className="overflow-x-auto rounded-xl border border-zinc-800">
                  <table className="w-full min-w-[1100px] border-collapse text-sm">
                    <thead style={{ backgroundColor: themeColor }}>
                      <tr className="text-left text-white">
                        <th className="border border-black/10 px-3 py-2 font-semibold">
                          Codice
                        </th>
                        <th className="border border-black/10 px-3 py-2 font-semibold">
                          Sezione
                        </th>
                        <th className="border border-black/10 px-3 py-2 font-semibold">
                          Nome
                        </th>
                        <th className="border border-black/10 px-3 py-2 text-right font-semibold">
                          Durata
                        </th>
                        <th className="border border-black/10 px-3 py-2 font-semibold">
                          Spazio
                        </th>
                        <th className="border border-black/10 px-3 py-2 font-semibold">
                          Materiale
                        </th>
                        <th className="border border-black/10 px-3 py-2 font-semibold">
                          Punti chiave
                        </th>
                        <th className="border border-black/10 px-3 py-2 font-semibold">
                          Progressione
                        </th>
                        <th className="border border-black/10 px-3 py-2 font-semibold">
                          Rif. GPS
                        </th>
                        <th className="border border-black/10 px-3 py-2 font-semibold">
                          Perché serve
                        </th>
                      </tr>
                    </thead>

                    <tbody>
                      {drillFiltrati.map((drill, index) => (
                        <tr
                          key={drill.id}
                          className={
                            index % 2 === 0
                              ? "bg-zinc-950"
                              : "bg-zinc-900/40"
                          }
                        >
                          <td className="border border-zinc-800 bg-zinc-800/60 px-3 py-2 font-bold text-zinc-200">
                            {drill.codice || "—"}
                          </td>
                          <td
                            className="border border-zinc-800 px-3 py-2 font-semibold"
                            style={{ color: themeColor }}
                          >
                            {drill.sezione || "—"}
                          </td>
                          <td className="border border-zinc-800 px-3 py-2 text-zinc-200">
                            {drill.nome}
                          </td>
                          <td className="border border-zinc-800 px-3 py-2 text-right text-zinc-400">
                            {drill.tempo_totale !== null
                              ? `${drill.tempo_totale} min`
                              : "—"}
                          </td>
                          <td className="border border-zinc-800 px-3 py-2 text-zinc-400">
                            {drill.spazio || "—"}
                          </td>
                          <td className="border border-zinc-800 px-3 py-2 text-zinc-400">
                            {drill.materiale || "—"}
                          </td>
                          <td className="border border-zinc-800 px-3 py-2 text-zinc-400">
                            {drill.punti_chiave_coaching || "—"}
                          </td>
                          <td className="border border-zinc-800 px-3 py-2 text-zinc-400">
                            {drill.progressione || "—"}
                          </td>
                          <td className="border border-zinc-800 px-3 py-2 text-zinc-400">
                            {drill.riferimento_gps || "—"}
                          </td>
                          <td className="border border-zinc-800 px-3 py-2 text-zinc-400">
                            {drill.perche_serve || "—"}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              );
            })()}
          </AppCard>
        )}

        {!loading && (vista === "riepilogo" || vista === "elenco") && (
          <div className="space-y-4">
            {/*
              * Barra di selezione multipla: compare solo dopo aver premuto
              * "Seleziona" fra i filtri. Sta sopra l'elenco cosi' il
              * contatore resta in vista mentre si spuntano le card piu' in
              * basso.
              *
              * Resta montata anche con l'elenco vuoto se c'e' un esito da
              * mostrare: altrimenti eliminando l'ultima seduta rimasta la
              * barra sparirebbe portandosi via il messaggio di conferma,
              * proprio nel momento in cui serve leggerlo.
              */}
            {isAdmin &&
              modalitaSelezione &&
              (allenamentiDaMostrare.length > 0 || esitoEliminazione) && (
              <AppCard>
                {allenamentiDaMostrare.length > 0 && (
                <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                  <label className="flex cursor-pointer items-center gap-3 text-sm text-zinc-300">
                    <input
                      type="checkbox"
                      checked={tuttiSelezionati}
                      onChange={alternaSelezioneTutti}
                      className="h-4 w-4 shrink-0 cursor-pointer accent-red-500"
                    />

                    <span>
                      {selezionatiVisibili.length === 0
                        ? "Seleziona tutte le sedute"
                        : `${selezionatiVisibili.length} di ${allenamentiDaMostrare.length} selezionate`}
                    </span>
                  </label>

                  <div className="flex flex-wrap items-center justify-end gap-2">
                    {selezionatiVisibili.length > 0 && (
                      <button
                        onClick={() => {
                          setSelezionati(new Set());
                          setEsitoEliminazione(null);
                        }}
                        className="rounded-xl bg-zinc-900 px-4 py-2 text-sm font-medium text-zinc-300 hover:text-white"
                      >
                        {/*
                          * "Deseleziona tutte" e non "Annulla selezione":
                          * quest'ultima etichetta e' gia' sul pulsante fra
                          * i filtri, che pero' fa un'altra cosa (esce dalla
                          * modalita'). Due pulsanti con lo stesso testo e
                          * due effetti diversi sono un invito a sbagliare.
                          */}
                        Deseleziona tutte
                      </button>
                    )}

                    <button
                      onClick={() => setConfermaEliminazione(true)}
                      disabled={selezionatiVisibili.length === 0}
                      className="
                        inline-flex items-center gap-2 rounded-xl
                        border border-red-500/40 bg-red-500/10
                        px-4 py-2 text-sm font-semibold text-red-300
                        hover:bg-red-500/20 hover:text-red-200
                        disabled:cursor-not-allowed disabled:opacity-40
                        disabled:hover:bg-red-500/10
                      "
                    >
                      <Trash2 className="h-4 w-4" />
                      Elimina
                      {selezionatiVisibili.length > 0 &&
                        ` (${selezionatiVisibili.length})`}
                    </button>
                  </div>
                </div>
                )}

                {esitoEliminazione && (
                  <p
                    className={`text-sm ${
                      allenamentiDaMostrare.length > 0 ? "mt-3" : ""
                    } ${
                      esitoEliminazione.tipo === "ok"
                        ? "text-emerald-400"
                        : "text-red-400"
                    }`}
                  >
                    {esitoEliminazione.testo}
                  </p>
                )}
              </AppCard>
            )}

            {allenamentiDaMostrare.map((allenamento) => {
              const aperto = openId === allenamento.id;
              const listaLavori = lavoriPerAllenamento(allenamento.id);
              const minuti = minutiAllenamento(allenamento.id);
              const presenti = presentiAllenamento(allenamento.id);

              return (
                <AppCard key={allenamento.id}>
                  <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                    {/*
                      * La checkbox sta FUORI dal button che apre/chiude la
                      * seduta: annidare un input dentro un button non e'
                      * HTML valido e il click verrebbe intercettato dal
                      * button, aprendo la card invece di selezionarla.
                      */}
                    {isAdmin && modalitaSelezione && (
                      <input
                        type="checkbox"
                        checked={selezionati.has(allenamento.id)}
                        onChange={() => alternaSelezione(allenamento.id)}
                        aria-label={`Seleziona ${
                          allenamento.titolo || "allenamento"
                        } del ${formattaData(allenamento.data_allenamento)}`}
                        className="mt-1 h-4 w-4 shrink-0 cursor-pointer self-start accent-red-500 sm:mt-0 sm:self-center"
                      />
                    )}

                    <button
                      onClick={() => setOpenId(aperto ? null : allenamento.id)}
                      className="flex flex-1 items-start justify-between gap-3 rounded-2xl text-left"
                    >
                      <div>
                        <h2 className="text-lg font-semibold text-white">
                          {allenamento.titolo || "Allenamento"}
                        </h2>

                        <p className="text-sm capitalize text-zinc-400">
                          {formattaData(allenamento.data_allenamento)}
                          {allenamento.ora_inizio &&
                            ` · ${allenamento.ora_inizio.slice(0, 5)}`}
                          {allenamento.luogo && ` · ${allenamento.luogo}`}
                        </p>
                      </div>

                      <div className="hidden text-right md:block">
                        <p className="text-sm text-zinc-400">
                          {allenamento.tipo_allenamento || "Seduta"}
                        </p>
                        <p className="text-sm font-medium text-white">
                          {minuti} min · {presenti} presenti
                        </p>
                      </div>

                      <ChevronDown
                        className={`h-5 w-5 text-zinc-500 transition ${
                          aperto ? "rotate-180" : ""
                        }`}
                      />
                    </button>

                    <div className="flex items-center justify-end gap-2 sm:justify-start">
                      {isAdmin && (
                        <Link
                          href={`/allenamenti/${allenamento.id}/modifica`}
                          className="rounded-xl border bg-zinc-950 p-2 text-zinc-300 hover:text-white"
                          style={{ borderColor: `${themeColor}33` }}
                          title="Modifica allenamento"
                        >
                          <Pencil className="h-4 w-4" />
                        </Link>
                      )}

                      <button
                        onClick={() => apriAnteprimaPdf(allenamento)}
                        disabled={generandoPdfId === allenamento.id}
                        className="rounded-xl border bg-zinc-950 p-2 text-zinc-300 hover:text-white disabled:opacity-50"
                        style={{ borderColor: `${themeColor}33` }}
                        title="Anteprima PDF"
                      >
                        {generandoPdfId === allenamento.id ? (
                          <Loader2 className="h-4 w-4 animate-spin" />
                        ) : (
                          <FileDown className="h-4 w-4" />
                        )}
                      </button>
                    </div>
                  </div>

                  {aperto && (
                    <div className="mt-5 grid gap-5 border-t border-zinc-800 pt-5 lg:grid-cols-[1.4fr_0.8fr]">
                      <div className="min-w-0 space-y-4">
                        {allenamento.obiettivo && (
                          <div>
                            <p className="text-sm text-zinc-500">Obiettivo</p>
                            <p className="text-zinc-300">
                              {allenamento.obiettivo}
                            </p>
                          </div>
                        )}

                        {listaLavori.length === 0 && (
                          <p className="text-sm text-zinc-500">
                            Nessun lavoro inserito.
                          </p>
                        )}

                        {listaLavori.length > 0 && (
                          <div className="flex justify-end gap-1 rounded-xl border border-zinc-800 bg-zinc-950 p-1">
                            <button
                              type="button"
                              onClick={() => setVistaElencoLavori("card")}
                              className={`rounded-lg px-3 py-1.5 text-xs font-bold transition ${
                                vistaElencoLavori === "card"
                                  ? "text-white"
                                  : "text-zinc-500 hover:text-white"
                              }`}
                              style={
                                vistaElencoLavori === "card"
                                  ? { backgroundColor: themeColor }
                                  : undefined
                              }
                            >
                              Card
                            </button>

                            <button
                              type="button"
                              onClick={() => setVistaElencoLavori("tabella")}
                              className={`rounded-lg px-3 py-1.5 text-xs font-bold transition ${
                                vistaElencoLavori === "tabella"
                                  ? "text-white"
                                  : "text-zinc-500 hover:text-white"
                              }`}
                              style={
                                vistaElencoLavori === "tabella"
                                  ? { backgroundColor: themeColor }
                                  : undefined
                              }
                            >
                              Tabella
                            </button>
                          </div>
                        )}

                        {listaLavori.length > 0 &&
                          vistaElencoLavori === "tabella" && (() => {
                            const orariElenco = orariLavori(
                              allenamento.ora_inizio,
                              listaLavori,
                            );

                            return (
                            <div className="overflow-x-auto rounded-xl border border-zinc-700">
                              <table className="w-full min-w-[920px] border-collapse text-sm">
                                <thead style={{ backgroundColor: themeColor }}>
                                  <tr className="text-left text-white">
                                    <th className="border border-black/10 px-3 py-2 font-semibold">
                                      Orario
                                    </th>
                                    <th className="border border-black/10 px-3 py-2 font-semibold">
                                      Sezione
                                    </th>
                                    <th className="border border-black/10 px-3 py-2 font-semibold">
                                      Descrizione
                                    </th>
                                    <th className="border border-black/10 px-3 py-2 text-right font-semibold">
                                      Rip.
                                    </th>
                                    <th className="border border-black/10 px-3 py-2 text-right font-semibold">
                                      Tempo
                                    </th>
                                    <th className="border border-black/10 px-3 py-2 text-right font-semibold">
                                      Rec.
                                    </th>
                                    <th className="border border-black/10 px-3 py-2 text-right font-semibold">
                                      Totale
                                    </th>
                                    <th className="border border-black/10 px-3 py-2 text-center font-semibold">
                                      Drill
                                    </th>
                                  </tr>
                                </thead>

                                <tbody>
                                  {listaLavori.map((lavoro, index) => {
                                    const h2oRiga =
                                      lavoro.sezione.trim().toUpperCase() ===
                                      "H2O";
                                    const haDettagli =
                                      !h2oRiga &&
                                      Boolean(
                                        lavoro.codice ||
                                          lavoro.spazio ||
                                          lavoro.materiale ||
                                          lavoro.punti_chiave_coaching ||
                                          lavoro.progressione ||
                                          lavoro.riferimento_gps ||
                                          lavoro.perche_serve,
                                      );
                                    const rangeElenco = orariElenco.get(lavoro.id);

                                    return (
                                      <tr
                                        key={lavoro.id}
                                        className={
                                          index % 2 === 0
                                            ? "bg-zinc-950"
                                            : "bg-zinc-900/40"
                                        }
                                      >
                                        <td className="whitespace-nowrap border border-zinc-800 px-3 py-2 text-zinc-400">
                                          {rangeElenco
                                            ? `${rangeElenco.inizio}–${rangeElenco.fine}`
                                            : "—"}
                                        </td>

                                        <td
                                          className="border border-zinc-800 bg-zinc-800/60 px-3 py-2 font-bold"
                                          style={{
                                            color: coloreSezione(
                                              lavoro.sezione,
                                              themeColor,
                                            ),
                                          }}
                                        >
                                          {lavoro.sezione}
                                          {lavoro.contemporaneo && (
                                            <span className="ml-1 text-[10px] font-normal text-zinc-400">
                                              (parallelo)
                                            </span>
                                          )}
                                        </td>

                                        <td className="border border-zinc-800 px-3 py-2 text-zinc-300">
                                          {h2oRiga
                                            ? "Pausa acqua"
                                            : lavoro.descrizione || "—"}
                                        </td>

                                        <td className="border border-zinc-800 px-3 py-2 text-right text-zinc-400">
                                          {h2oRiga
                                            ? "—"
                                            : (lavoro.ripetizione ?? "—")}
                                        </td>

                                        <td className="border border-zinc-800 px-3 py-2 text-right text-zinc-400">
                                          {h2oRiga
                                            ? "—"
                                            : (lavoro.tempo_lavoro ?? "—")}
                                        </td>

                                        <td className="border border-zinc-800 px-3 py-2 text-right text-zinc-400">
                                          {h2oRiga
                                            ? "—"
                                            : (lavoro.tempo_recupero ?? "—")}
                                        </td>

                                        <td className="border border-zinc-800 bg-sky-900/30 px-3 py-2 text-right font-bold text-sky-200">
                                          {lavoro.tempo_totale ?? 0} min
                                        </td>

                                        <td className="border border-zinc-800 px-3 py-2 text-center">
                                          {haDettagli && (
                                            <button
                                              type="button"
                                              onClick={() =>
                                                setLavoroDrillBankAperto(
                                                  lavoro,
                                                )
                                              }
                                              className="rounded-lg p-1.5 text-zinc-400 hover:bg-zinc-800 hover:text-white"
                                              title="Dettagli drill bank"
                                            >
                                              <Info className="h-4 w-4" />
                                            </button>
                                          )}
                                        </td>
                                      </tr>
                                    );
                                  })}
                                </tbody>
                              </table>
                            </div>
                            );
                          })()}

                        {vistaElencoLavori === "card" && (() => {
                          const gruppiRenderizzati = new Set<string>();
                          const orariCard = orariLavori(
                            allenamento.ora_inizio,
                            listaLavori,
                          );

                          const cardLavoro = (
                            lavoro: Lavoro,
                            dentroGruppo: boolean,
                          ) => {
                            const haDettagli = Boolean(
                              lavoro.codice ||
                                lavoro.spazio ||
                                lavoro.materiale ||
                                lavoro.punti_chiave_coaching ||
                                lavoro.progressione ||
                                lavoro.riferimento_gps ||
                                lavoro.perche_serve,
                            );
                            const rangeCard = orariCard.get(lavoro.id);

                            return (
                            <div
                              key={lavoro.id}
                              className={
                                dentroGruppo
                                  ? "relative rounded-xl border border-zinc-800 bg-zinc-900 p-4"
                                  : "relative rounded-xl border border-zinc-800 bg-zinc-950 p-4"
                              }
                            >
                              {haDettagli && (
                                <button
                                  type="button"
                                  onClick={() =>
                                    setLavoroDrillBankAperto(lavoro)
                                  }
                                  className="absolute right-3 top-3 rounded-lg p-1.5 text-zinc-500 hover:bg-zinc-800 hover:text-white"
                                  title="Dettagli drill bank"
                                >
                                  <Info className="h-4 w-4" />
                                </button>
                              )}

                              <div className="flex flex-wrap items-center gap-2 pr-8">
                                <p
                                  className="text-sm font-semibold"
                                  style={{ color: themeColor }}
                                >
                                  {lavoro.sezione}
                                </p>

                                {rangeCard && (
                                  <span className="rounded-full border border-zinc-700 bg-zinc-900 px-2 py-0.5 text-xs font-medium text-zinc-400">
                                    {rangeCard.inizio}–{rangeCard.fine}
                                  </span>
                                )}
                              </div>

                              <p className="mt-2 text-white">
                                {lavoro.descrizione || "Senza descrizione"}
                              </p>

                              <div className="mt-3 flex flex-wrap gap-3 text-sm text-zinc-400">
                                {lavoro.ripetizione !== null && (
                                  <span>
                                    Ripetizioni: {lavoro.ripetizione}
                                  </span>
                                )}

                                {lavoro.tempo_lavoro !== null && (
                                  <span>
                                    Lavoro: {lavoro.tempo_lavoro} min
                                  </span>
                                )}

                                {lavoro.tempo_recupero !== null && (
                                  <span>
                                    Recupero: {lavoro.tempo_recupero} min
                                  </span>
                                )}

                                {lavoro.tempo_totale !== null && (
                                  <span>
                                    Totale: {lavoro.tempo_totale} min
                                  </span>
                                )}
                              </div>
                            </div>
                            );
                          };

                          return listaLavori.map((lavoro) => {
                            if (lavoro.gruppo_contemporaneo) {
                              if (
                                gruppiRenderizzati.has(
                                  lavoro.gruppo_contemporaneo,
                                )
                              ) {
                                return null;
                              }

                              gruppiRenderizzati.add(
                                lavoro.gruppo_contemporaneo,
                              );

                              const membriGruppo = listaLavori.filter(
                                (l) =>
                                  l.gruppo_contemporaneo ===
                                  lavoro.gruppo_contemporaneo,
                              );

                              return (
                                <div
                                  key={lavoro.gruppo_contemporaneo}
                                  className="rounded-xl border-2 border-dashed p-3"
                                  style={{ borderColor: `${themeColor}55` }}
                                >
                                  <div
                                    className="mb-3 flex items-center gap-1.5 text-xs font-bold uppercase tracking-wide"
                                    style={{ color: themeColor }}
                                  >
                                    <Users className="h-3.5 w-3.5" />
                                    In contemporanea
                                  </div>

                                  <div className="grid gap-3 sm:grid-cols-2">
                                    {membriGruppo.map((membro) =>
                                      cardLavoro(membro, true),
                                    )}
                                  </div>
                                </div>
                              );
                            }

                            return cardLavoro(lavoro, false);
                          });
                        })()}
                      </div>

                      <div className="rounded-2xl border border-zinc-800 bg-zinc-950 p-5">
                        <div className="mb-5 grid grid-cols-2 gap-3">
                          <div className="rounded-xl bg-zinc-900 p-3">
                            <p className="text-xs text-zinc-500">Minuti</p>
                            <p className="text-2xl font-bold text-white">
                              {minuti}
                            </p>
                          </div>

                          <div className="rounded-xl bg-zinc-900 p-3">
                            <p className="text-xs text-zinc-500">Presenti</p>
                            <p className="text-2xl font-bold text-white">
                              {presenti}
                            </p>
                          </div>
                        </div>

                        <PieChart items={datiGrafico(allenamento.id)} />
                      </div>
                    </div>
                  )}
                </AppCard>
              );
            })}

            {allenamentiDaMostrare.length === 0 && (
              <AppCard>
                <p className="text-zinc-400">
                  Nessun allenamento trovato per il periodo selezionato.
                </p>
              </AppCard>
            )}
          </div>
        )}
      </div>

      {cicloPalestraDaEliminare && (
        <div className="fixed inset-0 z-[9999] flex items-center justify-center overflow-y-auto bg-black/80 px-3 py-4 backdrop-blur-sm sm:px-6">
          <div className="w-full max-w-lg rounded-3xl border border-red-500/40 bg-[#090909] p-5 shadow-2xl sm:p-6">
            <div className="flex items-start justify-between gap-3">
              <div>
                <h3 className="text-lg font-black text-white">
                  Eliminare il ciclo palestra?
                </h3>
                <p className="mt-2 text-sm text-zinc-400">
                  Ciclo dal {formatDataITBreve(cicloPalestraDaEliminare.dal)} al{" "}
                  {formatDataITBreve(cicloPalestraDaEliminare.al)}: verranno
                  eliminate {cicloPalestraDaEliminare.sedute.length} sedute e
                  tutti i lavori collegati.
                </p>
              </div>
              <button
                type="button"
                onClick={() => setCicloPalestraDaEliminare(null)}
                disabled={eliminandoCicloPalestra}
                className="rounded-xl p-1 text-zinc-500 hover:text-white disabled:opacity-40"
                aria-label="Chiudi"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <p className="mt-3 text-sm font-semibold text-red-400">
              L&apos;operazione non è annullabile.
            </p>

            {erroreEliminazioneCiclo && (
              <p className="mt-3 rounded-xl border border-red-500/30 bg-red-500/10 p-3 text-sm text-red-300">
                {erroreEliminazioneCiclo}
              </p>
            )}

            <div className="mt-5 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
              <button
                type="button"
                onClick={() => setCicloPalestraDaEliminare(null)}
                disabled={eliminandoCicloPalestra}
                className="rounded-xl bg-zinc-900 px-4 py-2 text-sm font-bold text-zinc-300 hover:text-white disabled:opacity-40"
              >
                Annulla
              </button>
              <button
                type="button"
                onClick={() => void eliminaCicloPalestra()}
                disabled={eliminandoCicloPalestra}
                className="inline-flex items-center justify-center gap-2 rounded-xl bg-red-600 px-4 py-2 text-sm font-black text-white hover:bg-red-500 disabled:opacity-60"
              >
                {eliminandoCicloPalestra ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Trash2 className="h-4 w-4" />
                )}
                {eliminandoCicloPalestra
                  ? "Eliminazione…"
                  : "Elimina definitivamente"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/*
        * Conferma esplicita prima di eliminare: l'operazione non e'
        * annullabile e cancella anche tutti i lavori delle sedute. Il
        * modale elenca le sedute per data cosi' si vede cosa sta per
        * sparire, invece di doversi fidare di un contatore.
        */}
      {confermaEliminazione && selezionatiVisibili.length > 0 && (
        <div className="fixed inset-0 z-[9999] flex items-center justify-center overflow-y-auto bg-black/80 px-3 py-4 backdrop-blur-sm sm:px-6">
          <div
            className="w-full max-w-lg rounded-3xl border bg-[#090909] p-5 shadow-2xl sm:p-6"
            style={{ borderColor: "#ef444455" }}
          >
            <div className="flex items-start justify-between gap-3">
              <h3 className="text-lg font-bold text-white">
                {selezionatiVisibili.length === 1
                  ? "Eliminare la seduta selezionata?"
                  : `Eliminare ${selezionatiVisibili.length} sedute?`}
              </h3>

              <button
                onClick={() => setConfermaEliminazione(false)}
                disabled={eliminandoBlocco}
                className="rounded-xl p-1 text-zinc-500 hover:text-white disabled:opacity-40"
                aria-label="Chiudi"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <p className="mt-3 text-sm text-zinc-400">
              Verranno eliminati anche tutti i lavori collegati. Le presenze
              già registrate restano: appartengono alla giornata, non alla
              singola seduta.
            </p>

            <p className="mt-1 text-sm font-medium text-red-400">
              L&apos;operazione non è annullabile.
            </p>

            <ul className="mt-4 max-h-52 space-y-1 overflow-y-auto rounded-2xl border border-zinc-800 bg-zinc-950 p-3">
              {selezionatiVisibili.map((allenamento) => (
                <li key={allenamento.id} className="text-sm text-zinc-300">
                  <span className="capitalize">
                    {formattaData(allenamento.data_allenamento)}
                  </span>
                  {" · "}
                  {allenamento.titolo || "Allenamento"}
                </li>
              ))}
            </ul>

            {esitoEliminazione?.tipo === "errore" && (
              <p className="mt-3 text-sm text-red-400">
                {esitoEliminazione.testo}
              </p>
            )}

            <div className="mt-5 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
              <button
                onClick={() => setConfermaEliminazione(false)}
                disabled={eliminandoBlocco}
                className="rounded-xl bg-zinc-900 px-4 py-2 text-sm font-medium text-zinc-300 hover:text-white disabled:opacity-40"
              >
                Annulla
              </button>

              <button
                onClick={eliminaSelezionate}
                disabled={eliminandoBlocco}
                className="
                  inline-flex items-center justify-center gap-2 rounded-xl
                  bg-red-600 px-4 py-2 text-sm font-semibold text-white
                  hover:bg-red-500 disabled:opacity-60
                "
              >
                {eliminandoBlocco ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin" />
                    Eliminazione…
                  </>
                ) : (
                  <>
                    <Trash2 className="h-4 w-4" />
                    Elimina definitivamente
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      {openNuovoAllenamento && (
        <div className="fixed inset-0 z-[9999] overflow-y-auto bg-black/80 px-3 py-4 backdrop-blur-sm sm:px-6 sm:py-8">
          <div
            className="mx-auto max-w-7xl min-w-0 overflow-x-hidden rounded-3xl border bg-[#090909] p-4 shadow-2xl sm:p-6"
            style={{
              borderColor: `${themeColor}55`,
              boxShadow: `0 30px 80px ${themeColor}22`,
            }}
          >
            <NuovoAllenamentoModal
              themeColor={themeColor}
              isAdmin={isAdmin}
              vistaLavoriPredefinita={preferenzaVistaLavori}
              onClose={() => setOpenNuovoAllenamento(false)}
              onSaved={async () => {
                setOpenNuovoAllenamento(false);
                await caricaDati();
              }}
            />
          </div>
        </div>
      )}

      {openImportaExcel && (
        <div className="fixed inset-0 z-[9999] overflow-y-auto bg-black/80 px-3 py-4 backdrop-blur-sm sm:px-6 sm:py-8">
          <div
            className="mx-auto max-w-7xl min-w-0 overflow-x-hidden rounded-3xl border bg-[#090909] p-4 shadow-2xl sm:p-6"
            style={{
              borderColor: `${themeColor}55`,
              boxShadow: `0 30px 80px ${themeColor}22`,
            }}
          >
            <ImportaAllenamentiModal
              themeColor={themeColor}
              isAdmin={isAdmin}
              onClose={() => setOpenImportaExcel(false)}
              onSaved={async () => {
                setOpenImportaExcel(false);
                await caricaDati();
              }}
            />
          </div>
        </div>
      )}

      {openScaricaTemplate && (
        <ScaricaTemplateAllenamentiModal
          themeColor={themeColor}
          onClose={() => setOpenScaricaTemplate(false)}
        />
      )}

      {openRegistraPresenze && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4">
          <RegistraPresenzeModal
            allenamenti={allenamentiOrdinari}
            giocatori={giocatori}
            isAdmin={isAdmin}
            themeColor={themeColor}
            formattaData={formattaData}
            statiPresenza={STATI_PRESENZA}
            coloreStato={COLORE_STATO}
            statoGiocatore={statoGiocatore}
            giustificazioneGiocatore={giustificazioneGiocatore}
            salvaPresenza={salvaPresenza}
            eliminaPresenza={eliminaPresenza}
            onClose={() => setOpenRegistraPresenze(false)}
          />
        </div>
      )}

      {pdfInAnteprima && (
        <div className="fixed inset-0 z-[9999] overflow-y-auto bg-black/80 px-3 py-4 backdrop-blur-sm sm:px-6 sm:py-8">
          <div
            className="mx-auto max-w-4xl min-w-0 overflow-x-hidden rounded-3xl border bg-[#090909] p-4 shadow-2xl sm:p-6"
            style={{
              borderColor: `${themeColor}55`,
              boxShadow: `0 30px 80px ${themeColor}22`,
            }}
          >
            <PdfPreviewModal
              blobUrl={pdfInAnteprima.blobUrl}
              nomeFile={pdfInAnteprima.nomeFile}
              themeColor={themeColor}
              onDownload={() =>
                scaricaPdfAllenamento({
                  doc: pdfInAnteprima.doc,
                  nomeFile: pdfInAnteprima.nomeFile,
                })
              }
              onClose={chiudiAnteprimaPdf}
            />
          </div>
        </div>
      )}

      {lavoroDrillBankAperto && (
        <DettaglioLavoroModal
          lavoro={lavoroDrillBankAperto}
          themeColor={themeColor}
          onClose={() => setLavoroDrillBankAperto(null)}
        />
      )}
    </>
  );
}
