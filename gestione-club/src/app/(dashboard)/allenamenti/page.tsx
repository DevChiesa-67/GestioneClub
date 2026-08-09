"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import {
  BookOpen,
  ChevronDown,
  ClipboardCheck,
  FileDown,
  FileUp,
  Info,
  Loader2,
  Pencil,
  Plus,
  Search,
  Users,
} from "lucide-react";

import { AppCard } from "@/components/ui/AppCard";
import { DateInput } from "@/components/ui/DateInput";
import { supabase } from "@/lib/supabase-client";
import NuovoAllenamentoModal from "@/components/allenamenti/NuovoAllenamentoModal";
import RegistraPresenzeModal from "@/components/allenamenti/RegistraPresenzeModal";
import ImportaAllenamentiModal from "@/components/allenamenti/ImportaAllenamentiModal";
import PdfPreviewModal from "@/components/allenamenti/PdfPreviewModal";
import DettaglioLavoroModal from "@/components/allenamenti/DettaglioLavoroModal";
import { generaPdfAllenamento, scaricaPdfAllenamento } from "@/lib/pdf-allenamento";

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

type Presenza = {
  id: string;
  allenamento_id: string;
  giocatore_id: string;
  club_id: string;
  squadra_id: string | null;
  stato: StatoPresenzaDb;
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
  | "drillbank";

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
  PP: "bg-yellow-400 border-yellow-300 text-black",
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

function PieChart({ items }: { items: { label: string; value: number }[] }) {
  const totale = items.reduce((sum, item) => sum + item.value, 0);

  if (totale <= 0) {
    return (
      <div className="flex h-44 items-center justify-center rounded-2xl border border-zinc-800 bg-zinc-950 text-sm text-zinc-500">
        Nessun minutaggio
      </div>
    );
  }

  const colori = [
    "#ef4444",
    "#f97316",
    "#eab308",
    "#22c55e",
    "#06b6d4",
    "#6366f1",
    "#a855f7",
    "#ec4899",
  ];

  const gradient = items
    .map((item, index) => {
      const start = items
        .slice(0, index)
        .reduce((sum, current) => sum + (current.value / totale) * 100, 0);

      const end = start + (item.value / totale) * 100;

      return `${colori[index % colori.length]} ${start}% ${end}%`;
    })
    .join(", ");

  return (
    <div className="space-y-4">
      <div
        className="mx-auto h-44 w-44 rounded-full"
        style={{ background: `conic-gradient(${gradient})` }}
      />

      <div className="space-y-2">
        {items.map((item) => (
          <div
            key={item.label}
            className="flex items-center justify-between gap-3 text-sm"
          >
            <span className="truncate text-zinc-400">{item.label}</span>
            <span className="font-medium text-white">{item.value} min</span>
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

  const [loading, setLoading] = useState(true);
  const [openId, setOpenId] = useState<string | null>(null);
  const [openNuovoAllenamento, setOpenNuovoAllenamento] = useState(false);
  const [openRegistraPresenze, setOpenRegistraPresenze] = useState(false);
  const [openImportaExcel, setOpenImportaExcel] = useState(false);
  const [pdfInAnteprima, setPdfInAnteprima] = useState<{
    doc: Awaited<ReturnType<typeof generaPdfAllenamento>>["doc"];
    blobUrl: string;
    nomeFile: string;
  } | null>(null);
  const [generandoPdfId, setGenerandoPdfId] = useState<string | null>(null);

  const [dataDa, setDataDa] = useState(inizioSettimanaISO());
  const [dataA, setDataA] = useState(fineSettimanaISO());

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
      .order("data_allenamento", { ascending: false });

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
          .from("presenze_allenamenti")
          .select("*")
          .in("allenamento_id", idsAllenamenti),
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
  ) {
    if (!isAdmin) return;
    if (!profilo?.last_club_id || !userId) return;

    const statoDb = STATI_PRESENZA.find((s) => s.sigla === stato)?.db;

    if (!statoDb) return;

    const payload = {
      allenamento_id: allenamento.id,
      giocatore_id: giocatoreId,
      club_id: profilo.last_club_id,
      squadra_id: profilo.last_squadra_id || allenamento.squadra_id,
      stato: statoDb,
      registrato_da: userId,
      updated_at: new Date().toISOString(),
    };

    const { data, error } = await supabase
      .from("presenze_allenamenti")
      .upsert(payload, {
        onConflict: "allenamento_id,giocatore_id",
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
            presenza.allenamento_id === allenamento.id &&
            presenza.giocatore_id === giocatoreId
          ),
      );

      return [...senzaVecchia, data as Presenza];
    });
  }

  async function eliminaPresenza(allenamentoId: string, giocatoreId: string) {
    if (!isAdmin) return;

    const { error } = await supabase
      .from("presenze_allenamenti")
      .delete()
      .eq("allenamento_id", allenamentoId)
      .eq("giocatore_id", giocatoreId);

    if (error) {
      console.error("Errore eliminazione presenza:", error);
      return;
    }

    setPresenze((current) =>
      current.filter(
        (presenza) =>
          !(
            presenza.allenamento_id === allenamentoId &&
            presenza.giocatore_id === giocatoreId
          ),
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

  const allenamentiSettimana = useMemo(() => {
    const inizio = inizioSettimanaISO();
    const fine = fineSettimanaISO();

    return allenamenti.filter(
      (allenamento) =>
        allenamento.data_allenamento >= inizio &&
        allenamento.data_allenamento <= fine,
    );
  }, [allenamenti]);

  const allenamentiIntervallo = useMemo(() => {
    return allenamenti.filter(
      (allenamento) =>
        allenamento.data_allenamento >= dataDa &&
        allenamento.data_allenamento <= dataA,
    );
  }, [allenamenti, dataDa, dataA]);

  const allenamentiDaMostrare =
    vista === "riepilogo" ? allenamentiSettimana : allenamentiIntervallo;

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
        sedute: allenamenti
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
  }, [settimaneFlat, allenamenti]);

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
            <table className="min-w-[1100px] w-full border-collapse text-sm">
              <thead className="bg-zinc-900">
                <tr className="text-left text-zinc-400">
                  <th className="px-3 py-2 font-semibold">Orario</th>
                  <th className="px-3 py-2 font-semibold">Tipo</th>
                  <th className="px-3 py-2 font-semibold">Stazione</th>
                  <th className="px-3 py-2 font-semibold">Drill</th>
                  <th className="px-3 py-2 font-semibold">Consegna e organizzazione</th>
                  <th className="px-3 py-2 font-semibold">Punti chiave di coaching</th>
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

  const statoGiocatore = (
    allenamentoId: string,
    giocatoreId: string,
  ): StatoPresenza | undefined => {
    const statoDb = presenze.find(
      (presenza) =>
        presenza.allenamento_id === allenamentoId &&
        presenza.giocatore_id === giocatoreId,
    )?.stato;

    return STATI_PRESENZA.find((stato) => stato.db === statoDb)?.sigla;
  };

  const presentiAllenamento = (allenamentoId: string) => {
    return presenze.filter((presenza) => {
      if (presenza.allenamento_id !== allenamentoId) return false;

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

  const totaleAllenamenti = allenamenti.length;

  const minutaggioTotale = sommaTempoTotaleDeduplicato(lavori);
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

    const inRange = [...allenamenti]
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
  }, [allenamenti]);
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
              <table className="min-w-[820px] w-full border-collapse text-sm">
                <thead style={{ backgroundColor: themeColor }}>
                  <tr className="text-left text-white">
                    <th className="px-3 py-3">Sezione</th>
                    <th className="px-3 py-3">Descrizione</th>
                    <th className="px-3 py-3">Obiettivo</th>
                    <th className="px-3 py-3 text-right">Tempo lavoro</th>
                    <th className="px-3 py-3 text-right">Rip.</th>
                    <th className="px-3 py-3 text-right">Rec.</th>
                    <th className="px-3 py-3 text-right">Totale</th>
                  </tr>
                </thead>

                <tbody>
                  {lavoriPerAllenamento(allenamentoOdiernoOProssimo.id)
                    .sort((a, b) => (a.ordine ?? 0) - (b.ordine ?? 0))
                    .map((lavoro) => (
                      <tr
                        key={lavoro.id}
                        className="border-t border-zinc-800 bg-zinc-950/70 text-zinc-200"
                      >
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
                          {lavoro.tempo_lavoro ?? "—"}
                        </td>
                        <td className="px-3 py-3 text-right">
                          {lavoro.ripetizione ?? "—"}
                        </td>
                        <td className="px-3 py-3 text-right">
                          {lavoro.tempo_recupero ?? "—"}
                        </td>
                        <td className="px-3 py-3 text-right font-bold">
                          {lavoro.tempo_totale ?? "—"}
                        </td>
                      </tr>
                    ))}
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

        {!loading &&
          vista !== "resoconto" &&
          vista !== "odierno" &&
          vista !== "drillbank" && (
          <div className="space-y-4">
            {allenamentiDaMostrare.map((allenamento) => {
              const aperto = openId === allenamento.id;
              const listaLavori = lavoriPerAllenamento(allenamento.id);
              const minuti = minutiAllenamento(allenamento.id);
              const presenti = presentiAllenamento(allenamento.id);

              return (
                <AppCard key={allenamento.id}>
                  <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
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
                      <div className="space-y-4">
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
                          vistaElencoLavori === "tabella" && (
                            <div className="overflow-x-auto rounded-xl border border-zinc-700">
                              <table className="w-full min-w-[820px] border-collapse text-sm">
                                <thead style={{ backgroundColor: themeColor }}>
                                  <tr className="text-left text-white">
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

                                    return (
                                      <tr
                                        key={lavoro.id}
                                        className={
                                          index % 2 === 0
                                            ? "bg-zinc-950"
                                            : "bg-zinc-900/40"
                                        }
                                      >
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
                          )}

                        {vistaElencoLavori === "card" && (() => {
                          const gruppiRenderizzati = new Set<string>();

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

                              <p
                                className="pr-8 text-sm font-semibold"
                                style={{ color: themeColor }}
                              >
                                {lavoro.sezione}
                              </p>

                              <p className="mt-2 text-white">
                                {lavoro.descrizione || "Senza descrizione"}
                              </p>

                              <div className="mt-3 flex flex-wrap gap-3 text-sm text-zinc-400">
                                {lavoro.tempo_lavoro !== null && (
                                  <span>
                                    Lavoro: {lavoro.tempo_lavoro} min
                                  </span>
                                )}

                                {lavoro.ripetizione !== null && (
                                  <span>
                                    Ripetizioni: {lavoro.ripetizione}
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

      {openRegistraPresenze && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4">
          <RegistraPresenzeModal
            allenamenti={allenamenti}
            giocatori={giocatori}
            isAdmin={isAdmin}
            themeColor={themeColor}
            formattaData={formattaData}
            statiPresenza={STATI_PRESENZA}
            coloreStato={COLORE_STATO}
            statoGiocatore={statoGiocatore}
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