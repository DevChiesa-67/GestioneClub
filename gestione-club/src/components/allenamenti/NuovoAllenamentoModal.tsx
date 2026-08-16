"use client";

import { useEffect, useId, useMemo, useState } from "react";
import { X, Plus, Trash2, Save, Droplets, Users, ChevronDown } from "lucide-react";
import { AppCard } from "@/components/ui/AppCard";
import { supabase } from "@/lib/supabase-client";
import { useToast } from "@/components/ui/Toast";
import { DateInput } from "@/components/ui/DateInput";
import { formatDataIT } from "@/lib/date";
import { AnteprimaMediaLavoro } from "@/components/allenamenti/AnteprimaMediaLavoro";

type TipoAllenamento = "Seduta Mattutina" | "Seduta Serale";

type AllenamentoPrecedente = {
  id: string;
  titolo: string;
  data_allenamento: string;
  tipo_allenamento: string | null;
};
type SettimanaProgrammataRow = {
  focus_tecnico: string | null;
  intensita: string | null;
  rpe_target: string | null;
  focus_avanti: string | null;
  focus_trequarti: string | null;
  fase_id: string;
};

type FaseProgrammazioneRow = {
  nome: string;
  colore: string | null;
  programmazione_id: string;
};

type ProgrammazioneRow = {
  titolo: string;
};
type LavoroPrecedente = {
  id: string;
  allenamento_id: string;
  sezione: string;
  descrizione: string | null;
  obbiettivo: string | null;
  tempo_totale: number | null;
};

// Drill bank: libreria di esercizi riutilizzabili del club (tabella
// drill_bank). Scegliendone uno si copiano i valori nel lavoro corrente
// (copia indipendente: modifiche successive non toccano il drill salvato).
type DrillBank = {
  id: string;
  club_id: string;
  nome: string;
  sezione: string | null;
  descrizione: string | null;
  obbiettivo: string | null;
  obbiettivo_tag: string | null;
  rango: string | null;
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

type Lavoro = {
  id: string;
  contemporaneo: boolean;
  gruppo_id: string | null;
  sezione: string;
  descrizione: string;
  obbiettivo: string;
  obbiettivo_tag: string;
  rango: string;
  immagine_lavoro: string;
  tempo_lavoro: string;
  ripetizione: string;
  tempo_recupero: string;
  tempo_totale: string;
  // Campi "drill bank" (tab Dettagli): approfondimenti opzionali su un
  // lavoro, editabili separatamente dai campi principali.
  codice: string;
  spazio: string;
  materiale: string;
  punti_chiave_coaching: string;
  progressione: string;
  riferimento_gps: string;
  perche_serve: string;
};

function generaIdLavoro() {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
    return crypto.randomUUID();
  }

  return `lavoro-${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

const OBBIETTIVO_TAG = [
  "Passaggio",
  "Calcio",
  "Breack Down",
  "Struttura",
  "Touche",
  "Mischia",
  "POD",
  "Attacco",
  "Difesa",
  "Contrattacco",
  "Spazio",
  "Placcaggio",
  "Manualità",
  "Continuità Diretta",
  "Continuita Indiretta",
  "Offload",
  "Gestione 9/10",
  "Gestione Flanker",
  "Analisi Video",
];
type DettagliProgrammazione = {
  programmazione: string | null;
  mesociclo: string | null;
  focusTecnico: string | null;
  intensita: string | null;
  rpeTarget: string | null;
  focusAvanti: string | null;
  focusTrequarti: string | null;
  coloreMesociclo: string | null;
};
const RANGHI = [
  "Individuale",
  "Mini Unit (3-5)",
  "Unit (5-10)",
  "Collettivo Parziale",
  "Collettivo Totale",
];

const SEZIONI: string[] = [
  "RIUNIONE",
  "VIDEO",
  "TEAM BUILDING",
  "TOUCH",
  "ATTIVAZIONE / RISCALDAMENTO",
  "LAVORO TECNICO-TATTICO",
  "REPARTO",
  "SITUAZIONI DI GIOCO / MATCH",
  "PALESTRA",
  "COOL-DOWN / DEFATICAMENTO",
  "H2O",
];

// Sezioni "semplificate": non hanno obiettivo/rango/ripetizioni/recupero,
// solo descrizione (facoltativa) ed eventuale immagine/video, con il
// tempo totale inserito direttamente (come per H2O) invece di essere
// calcolato da tempo di lavoro x ripetizioni.
const SEZIONI_SEMPLIFICATE = ["RIUNIONE", "VIDEO", "TEAM BUILDING"];

function isSezioneSemplificata(sezione: string) {
  return SEZIONI_SEMPLIFICATE.includes(sezione.trim().toUpperCase());
}

const COLORE_H2O = "#38bdf8";

function isLavoroH2O(lavoro: Lavoro) {
  return lavoro.sezione.trim().toUpperCase() === "H2O";
}

function isLavoroSemplificato(lavoro: Lavoro) {
  return isSezioneSemplificata(lavoro.sezione);
}

function coloreSezione(sezione: string, themeColor: string) {
  return sezione.trim().toUpperCase() === "H2O" ? COLORE_H2O : themeColor;
}

function calcolaTempoTotale(lavoro: Lavoro) {
  if (isLavoroH2O(lavoro) || isLavoroSemplificato(lavoro)) {
    return Number(lavoro.tempo_totale) || 0;
  }

  const tempoLavoro = Number(lavoro.tempo_lavoro) || 0;
  const ripetizioni = Number(lavoro.ripetizione) || 0;
  const recupero = Number(lavoro.tempo_recupero) || 0;

  if (ripetizioni <= 0) return 0;

  if (ripetizioni === 1) {
    return tempoLavoro;
  }

  return tempoLavoro * ripetizioni + recupero * (ripetizioni - 1);
}
function creaLavoroVuoto(sezione = ""): Lavoro {
  return {
    id: generaIdLavoro(),
    contemporaneo: false,
    gruppo_id: null,
    sezione,
    descrizione: "",
    obbiettivo: "",
    obbiettivo_tag: "",
    rango: "",
    immagine_lavoro: "",
    tempo_lavoro: "",
    ripetizione: "",
    tempo_recupero: "",
    tempo_totale: "",
    codice: "",
    spazio: "",
    materiale: "",
    punti_chiave_coaching: "",
    progressione: "",
    riferimento_gps: "",
    perche_serve: "",
  };
}

// Orario di fine calcolato da orario di inizio + somma dei tempo_totale dei
// lavori (deduplicando i lavori "in contemporanea", che condividono lo
// stesso intervallo). Restituisce "" se manca l'orario di inizio.
function calcolaOraFine(oraInizio: string, minutiTotali: number) {
  if (!oraInizio) return "";

  const [oreStr, minutiStr] = oraInizio.split(":");
  const ore = Number(oreStr) || 0;
  const minuti = Number(minutiStr) || 0;

  const totaleMinutiGiorno = ore * 60 + minuti + minutiTotali;
  const oreFine = Math.floor(totaleMinutiGiorno / 60) % 24;
  const minutiFine = ((totaleMinutiGiorno % 60) + 60) % 60;

  return `${String(oreFine).padStart(2, "0")}:${String(minutiFine).padStart(2, "0")}`;
}

export default function NuovoAllenamentoModal({
  onClose,
  onSaved,
  themeColor,
  isAdmin,
  vistaLavoriPredefinita = "card",
}: {
  onClose: () => void;
  onSaved: () => void | Promise<void>;
  themeColor: string;
  isAdmin: boolean;
  // Impostata dall'admin in Impostazioni club (unica per tutto il club):
  // non è più una scelta libera dentro il singolo form di creazione.
  vistaLavoriPredefinita?: "card" | "tabella";
}) {
  const { showToast } = useToast();
  const [tipo, setTipo] = useState<TipoAllenamento>("Seduta Mattutina");
  const [dataAllenamento, setDataAllenamento] = useState("");
  const [oraInizio, setOraInizio] = useState("");
  const [loading, setLoading] = useState(false);

  // Vista card (una per lavoro) oppure vista tabella (griglia stile
  // foglio di calcolo, con colonna Orario calcolata): fissata dall'admin in
  // Impostazioni, uguale per tutti gli utenti (non più un interruttore
  // libero dentro il form). Partiamo dal valore passato dalla pagina
  // allenamenti (potrebbe essere quello caricato all'apertura della pagina,
  // quindi non aggiornato se l'admin ha cambiato l'impostazione nel
  // frattempo) e lo rinfreschiamo appena il modale si apre, così la scelta
  // più recente viene sempre rispettata anche senza ricaricare la pagina.
  const [vistaLavori, setVistaLavori] = useState<"card" | "tabella">(
    vistaLavoriPredefinita
  );

  // Tab attiva ("generale", "dettagli" o "drillbank") per ciascun lavoro,
  // indicizzata per id: di default tutti mostrano i campi principali.
  const [tabLavoroAttiva, setTabLavoroAttiva] = useState<
    Record<string, "generale" | "dettagli" | "drillbank">
  >({});

  const [drillBank, setDrillBank] = useState<DrillBank[]>([]);
  const [clubIdCorrente, setClubIdCorrente] = useState<string | null>(null);

  // Caricato una sola volta all'apertura del form (non dipende dalla data
  // della seduta, a differenza del contesto di programmazione più sotto).
  useEffect(() => {
    async function caricaDrillBank() {
      const {
        data: { user },
      } = await supabase.auth.getUser();

      if (!user) return;

      const { data: profilo } = await supabase
        .from("profili")
        .select("last_club_id")
        .eq("auth_user_id", user.id)
        .single();

      if (!profilo?.last_club_id) return;

      setClubIdCorrente(profilo.last_club_id);

      const { data, error } = await supabase
        .from("drill_bank")
        .select("*")
        .eq("club_id", profilo.last_club_id)
        .order("nome", { ascending: true });

      if (!error) setDrillBank((data as DrillBank[]) || []);

      const { data: clubData, error: clubError } = await supabase
        .from("club")
        .select("preferenza_vista_lavori")
        .eq("id", profilo.last_club_id)
        .maybeSingle();

      if (!clubError && clubData?.preferenza_vista_lavori) {
        setVistaLavori(
          clubData.preferenza_vista_lavori === "tabella" ? "tabella" : "card"
        );
      }
    }

    caricaDrillBank();
  }, []);

  // Copia i valori di un drill salvato dentro il lavoro corrente: copia
  // indipendente, non un riferimento (modifiche successive al lavoro o al
  // drill nel bank non si influenzano a vicenda).
  function applicaDrillBank(id: string, drill: DrillBank) {
    setLavori((prev) =>
      prev.map((lavoro) => {
        if (lavoro.id !== id) return lavoro;

        return {
          ...lavoro,
          sezione: drill.sezione ?? lavoro.sezione,
          descrizione: drill.descrizione ?? "",
          obbiettivo: drill.obbiettivo ?? "",
          obbiettivo_tag: drill.obbiettivo_tag ?? "",
          rango: drill.rango ?? "",
          tempo_lavoro:
            drill.tempo_lavoro !== null ? String(drill.tempo_lavoro) : "",
          ripetizione:
            drill.ripetizione !== null ? String(drill.ripetizione) : "",
          tempo_recupero:
            drill.tempo_recupero !== null ? String(drill.tempo_recupero) : "",
          tempo_totale:
            drill.tempo_totale !== null ? String(drill.tempo_totale) : "",
          codice: drill.codice ?? "",
          spazio: drill.spazio ?? "",
          materiale: drill.materiale ?? "",
          punti_chiave_coaching: drill.punti_chiave_coaching ?? "",
          progressione: drill.progressione ?? "",
          riferimento_gps: drill.riferimento_gps ?? "",
          perche_serve: drill.perche_serve ?? "",
        };
      })
    );

    showToast({ type: "success", message: `Drill "${drill.nome}" caricato.` });
  }

  // Salva il lavoro corrente come nuovo drill riutilizzabile nel drill
  // bank del club.
  async function salvaNelDrillBank(lavoro: Lavoro) {
    if (!clubIdCorrente) {
      showToast({
        type: "error",
        message: "Nessun club attivo: impossibile salvare nel drill bank.",
      });
      return;
    }

    const nome = window.prompt(
      "Nome del drill da salvare nel drill bank:",
      lavoro.descrizione || lavoro.sezione || ""
    );

    if (!nome || !nome.trim()) return;

    const { error } = await supabase.from("drill_bank").insert({
      club_id: clubIdCorrente,
      nome: nome.trim(),
      sezione: lavoro.sezione || null,
      descrizione: lavoro.descrizione || null,
      obbiettivo: lavoro.obbiettivo || null,
      obbiettivo_tag: lavoro.obbiettivo_tag || null,
      rango: lavoro.rango || null,
      tempo_lavoro: lavoro.tempo_lavoro ? Number(lavoro.tempo_lavoro) : null,
      ripetizione: lavoro.ripetizione ? Number(lavoro.ripetizione) : null,
      tempo_recupero: lavoro.tempo_recupero
        ? Number(lavoro.tempo_recupero)
        : null,
      tempo_totale: calcolaTempoTotale(lavoro),
      codice: lavoro.codice || null,
      spazio: lavoro.spazio || null,
      materiale: lavoro.materiale || null,
      punti_chiave_coaching: lavoro.punti_chiave_coaching || null,
      progressione: lavoro.progressione || null,
      riferimento_gps: lavoro.riferimento_gps || null,
      perche_serve: lavoro.perche_serve || null,
    });

    if (error) {
      showToast({
        type: "error",
        message: `Errore salvataggio nel drill bank: ${error.message}`,
      });
      return;
    }

    showToast({
      type: "success",
      message: `"${nome.trim()}" salvato nel drill bank.`,
    });

    const { data } = await supabase
      .from("drill_bank")
      .select("*")
      .eq("club_id", clubIdCorrente)
      .order("nome", { ascending: true });

    setDrillBank((data as DrillBank[]) || []);
  }

  const [allenamentoPrecedente, setAllenamentoPrecedente] =
    useState<AllenamentoPrecedente | null>(null);

  const [lavoriPrecedenti, setLavoriPrecedenti] = useState<LavoroPrecedente[]>(
    []
  );
  const [allenamentoPrecedenteAperto, setAllenamentoPrecedenteAperto] =
    useState(true);
  const [dettagliProgrammazione, setDettagliProgrammazione] =
  useState<DettagliProgrammazione>({
    programmazione: null,
    mesociclo: null,
    focusTecnico: null,
    intensita: null,
    rpeTarget: null,
    focusAvanti: null,
    focusTrequarti: null,
    coloreMesociclo: null,
  });


  const [allenamentiSettimana, setAllenamentiSettimana] = useState<
    AllenamentoPrecedente[]
  >([]);

  const [lavori, setLavori] = useState<Lavoro[]>([]);

  // Raggruppa i lavori in blocchi: singoli, oppure gruppi di lavori
  // contemporanei che condividono lo stesso gruppo_id.
  const blocchiLavori = useMemo(() => {
    const blocchi: { gruppoId: string | null; membri: Lavoro[] }[] = [];
    const gruppiVisti = new Set<string>();

    lavori.forEach((lavoro) => {
      if (lavoro.contemporaneo && lavoro.gruppo_id) {
        if (gruppiVisti.has(lavoro.gruppo_id)) return;

        gruppiVisti.add(lavoro.gruppo_id);

        blocchi.push({
          gruppoId: lavoro.gruppo_id,
          membri: lavori.filter((l) => l.gruppo_id === lavoro.gruppo_id),
        });
      } else {
        blocchi.push({ gruppoId: null, membri: [lavoro] });
      }
    });

    return blocchi;
  }, [lavori]);

  const riepilogoSezioni = useMemo(() => {
    const mappa = new Map<
      string,
      {
        sezione: string;
        minuti: number;
        esercizi: number;
      }
    >();

    const gruppiContati = new Set<string>();

    lavori.forEach((lavoro) => {
      const sezione = lavoro.sezione || "Senza sezione";
      const corrente = mappa.get(sezione) ?? {
        sezione,
        minuti: 0,
        esercizi: 0,
      };

      let minuti = calcolaTempoTotale(lavoro);

      if (lavoro.contemporaneo && lavoro.gruppo_id) {
        if (gruppiContati.has(lavoro.gruppo_id)) {
          minuti = 0;
        } else {
          gruppiContati.add(lavoro.gruppo_id);
        }
      }

      corrente.minuti += minuti;
      corrente.esercizi += 1;
      mappa.set(sezione, corrente);
    });

    return Array.from(mappa.values());
  }, [lavori]);

  const totaleMinuti = useMemo(() => {
    const gruppiContati = new Set<string>();

    return lavori.reduce((totale, lavoro) => {
      if (lavoro.contemporaneo && lavoro.gruppo_id) {
        if (gruppiContati.has(lavoro.gruppo_id)) return totale;
        gruppiContati.add(lavoro.gruppo_id);
      }

      return totale + calcolaTempoTotale(lavoro);
    }, 0);
  }, [lavori]);

  // Sola lettura: calcolato da orario di inizio + durata complessiva.
  const oraFine = useMemo(
    () => calcolaOraFine(oraInizio, totaleMinuti),
    [oraInizio, totaleMinuti],
  );

  // Orario di inizio/fine di ogni lavoro (per la colonna "Orario" della
  // vista tabella): stessa logica usata nella vista Microcicli/Macrocicli,
  // i lavori in contemporanea condividono lo stesso slot.
  const orariLavoriMap = useMemo(() => {
    const risultato = new Map<string, { inizio: string; fine: string }>();
    if (!oraInizio) return risultato;

    function orarioAMinuti(orario: string) {
      const [ore, minuti] = orario.split(":").map((p) => Number(p) || 0);
      return ore * 60 + minuti;
    }

    function minutiAOrario(minuti: number) {
      const h = Math.floor(minuti / 60) % 24;
      const m = ((minuti % 60) + 60) % 60;
      return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`;
    }

    let cursore = orarioAMinuti(oraInizio);
    const gruppiVisti = new Map<string, { inizio: string; fine: string }>();

    for (const lavoro of lavori) {
      const durata = calcolaTempoTotale(lavoro);

      if (lavoro.contemporaneo && lavoro.gruppo_id) {
        const rangeGruppo = gruppiVisti.get(lavoro.gruppo_id);

        if (rangeGruppo) {
          risultato.set(lavoro.id, rangeGruppo);
          continue;
        }
      }

      const range = {
        inizio: minutiAOrario(cursore),
        fine: minutiAOrario(cursore + durata),
      };

      risultato.set(lavoro.id, range);

      if (lavoro.contemporaneo && lavoro.gruppo_id) {
        gruppiVisti.set(lavoro.gruppo_id, range);
      }

      cursore += durata;
    }

    return risultato;
  }, [oraInizio, lavori]);

  function cambiaTipoAllenamento(nuovoTipo: TipoAllenamento) {
    setTipo(nuovoTipo);
  }

  function aggiungiLavoro() {
    setLavori((prev) => [...prev, creaLavoroVuoto()]);
  }

  function aggiornaLavoro(
    id: string,
    campo: keyof Lavoro,
    valore: string
  ) {
    setLavori((prev) =>
      prev.map((lavoro) => {
        if (lavoro.id !== id) return lavoro;

        if (campo === "sezione" && valore.toUpperCase() === "H2O") {
          return {
            ...creaLavoroVuoto("H2O"),
            id: lavoro.id,
            tempo_totale: lavoro.tempo_totale,
          };
        }

        return {
          ...lavoro,
          [campo]: valore,
        };
      })
    );
  }

  // Aggiorna un campo condiviso (sezione, tempo lavoro, ripetizioni,
  // tempo recupero) su tutti i lavori che appartengono allo stesso
  // gruppo di lavori contemporanei.
  function aggiornaCampoGruppo(
    gruppoId: string,
    campo: "sezione",
    valore: string
  ) {
    setLavori((prev) =>
      prev.map((lavoro) =>
        lavoro.gruppo_id === gruppoId
          ? { ...lavoro, [campo]: valore }
          : lavoro
      )
    );
  }

  function attivaContemporaneo(id: string) {
    const nuovoGruppoId = generaIdLavoro();

    setLavori((prev) =>
      prev.map((lavoro) =>
        lavoro.id === id
          ? { ...lavoro, contemporaneo: true, gruppo_id: nuovoGruppoId }
          : lavoro
      )
    );
  }

  function disattivaContemporaneo(gruppoId: string) {
    setLavori((prev) =>
      prev.map((lavoro) =>
        lavoro.gruppo_id === gruppoId
          ? { ...lavoro, contemporaneo: false, gruppo_id: null }
          : lavoro
      )
    );
  }

  function aggiungiLavoroParallelo(gruppoId: string) {
    setLavori((prev) => {
      const riferimento = prev.find((lavoro) => lavoro.gruppo_id === gruppoId);
      if (!riferimento) return prev;

      const nuovo: Lavoro = {
        ...creaLavoroVuoto(riferimento.sezione),
        contemporaneo: true,
        gruppo_id: gruppoId,
        tempo_lavoro: riferimento.tempo_lavoro,
        ripetizione: riferimento.ripetizione,
        tempo_recupero: riferimento.tempo_recupero,
      };

      const ultimoIndiceGruppo = prev.reduce(
        (ultimo, lavoro, i) => (lavoro.gruppo_id === gruppoId ? i : ultimo),
        -1
      );

      const copia = [...prev];
      copia.splice(ultimoIndiceGruppo + 1, 0, nuovo);
      return copia;
    });
  }

  function rimuoviLavoroParallelo(id: string) {
    setLavori((prev) => {
      const lavoro = prev.find((l) => l.id === id);
      if (!lavoro?.gruppo_id) return prev;

      const membriRimanenti = prev.filter(
        (l) => l.gruppo_id === lavoro.gruppo_id && l.id !== id
      );

      const senzaLavoro = prev.filter((l) => l.id !== id);

      // Se resta un solo membro nel gruppo, lo trasformiamo di nuovo
      // in un lavoro singolo (non ha più senso tenerlo "contemporaneo").
      if (membriRimanenti.length === 1) {
        return senzaLavoro.map((l) =>
          l.id === membriRimanenti[0].id
            ? { ...l, contemporaneo: false, gruppo_id: null }
            : l
        );
      }

      return senzaLavoro;
    });
  }

  function eliminaLavoro(id: string) {
    setLavori((prev) => prev.filter((l) => l.id !== id));
  }

  function eliminaGruppo(gruppoId: string) {
    setLavori((prev) => prev.filter((l) => l.gruppo_id !== gruppoId));
  }

  useEffect(() => {
    async function caricaContestoAllenamento() {
      if (!dataAllenamento) return;

      const {
        data: { user },
      } = await supabase.auth.getUser();

      if (!user) return;

      const { data: profilo } = await supabase
        .from("profili")
        .select("last_club_id, last_squadra_id")
        .eq("auth_user_id", user.id)
        .single();

      if (!profilo?.last_club_id || !profilo.last_squadra_id) return;

      const data = new Date(`${dataAllenamento}T12:00:00`);

      const inizioSettimana = new Date(data);
      const giorno = inizioSettimana.getDay() || 7;
  // I dettagli della seduta vengono presi dal mesociclo (programmazione)
  // in base alla settimana di programmazione la cui data_inizio/data_fine
  // contiene la data dell'allenamento che si sta creando.
  const { data: settimanaProgrammata } = await supabase
  .from("programmazione_settimane")
  .select("focus_tecnico,intensita,rpe_target,focus_avanti,focus_trequarti,fase_id")
  .eq("club_id", profilo.last_club_id)
  .eq("squadra_id", profilo.last_squadra_id)
  .lte("data_inizio", dataAllenamento)
  .gte("data_fine", dataAllenamento)
  .maybeSingle<SettimanaProgrammataRow>();

if (settimanaProgrammata?.fase_id) {
  const { data: faseProgrammazione } = await supabase
    .from("programmazione_fasi")
    .select("nome,colore,programmazione_id")
    .eq("id", settimanaProgrammata.fase_id)
    .eq("club_id", profilo.last_club_id)
    .eq("squadra_id", profilo.last_squadra_id)
    .maybeSingle<FaseProgrammazioneRow>();

  let titoloProgrammazione: string | null = null;

  if (faseProgrammazione?.programmazione_id) {
    const { data: programmazione } = await supabase
      .from("programmazioni")
      .select("titolo")
      .eq("id", faseProgrammazione.programmazione_id)
      .eq("club_id", profilo.last_club_id)
      .eq("squadra_id", profilo.last_squadra_id)
      .maybeSingle<ProgrammazioneRow>();

    titoloProgrammazione = programmazione?.titolo ?? null;
  }

  setDettagliProgrammazione({
    programmazione: titoloProgrammazione,
    mesociclo: faseProgrammazione?.nome ?? null,
    focusTecnico: settimanaProgrammata.focus_tecnico ?? null,
    intensita: settimanaProgrammata.intensita ?? null,
    rpeTarget: settimanaProgrammata.rpe_target ?? null,
    focusAvanti: settimanaProgrammata.focus_avanti ?? null,
    focusTrequarti: settimanaProgrammata.focus_trequarti ?? null,
    coloreMesociclo: faseProgrammazione?.colore ?? null,
  });
} else {
  setDettagliProgrammazione({
    programmazione: null,
    mesociclo: null,
    focusTecnico: null,
    intensita: null,
    rpeTarget: null,
    focusAvanti: null,
    focusTrequarti: null,
    coloreMesociclo: null,
  });
}
      inizioSettimana.setDate(
        inizioSettimana.getDate() - giorno + 1
      );

      const fineSettimana = new Date(inizioSettimana);
      fineSettimana.setDate(inizioSettimana.getDate() + 6);

      const inizio = inizioSettimana.toISOString().slice(0, 10);
      const fine = fineSettimana.toISOString().slice(0, 10);

      const { data: precedente } = await supabase
        .from("allenamenti")
        .select("id,titolo,data_allenamento,tipo_allenamento")
        .eq("club_id", profilo.last_club_id)
        .eq("squadra_id", profilo.last_squadra_id)
        .lt("data_allenamento", dataAllenamento)
        .order("data_allenamento", { ascending: false })
        .limit(1)
        .maybeSingle();

      setAllenamentoPrecedente(precedente ?? null);

      if (precedente?.id) {
        const { data: lavoriPrec } = await supabase
          .from("lavori_allenamento")
          .select(
            "id,allenamento_id,sezione,descrizione,obbiettivo,tempo_totale"
          )
          .eq("allenamento_id", precedente.id)
          .order("ordine", { ascending: true });

        setLavoriPrecedenti(lavoriPrec ?? []);
      } else {
        setLavoriPrecedenti([]);
      }

      const { data: settimana } = await supabase
        .from("allenamenti")
        .select("id,titolo,data_allenamento,tipo_allenamento")
        .eq("club_id", profilo.last_club_id)
        .eq("squadra_id", profilo.last_squadra_id)
        .gte("data_allenamento", inizio)
        .lte("data_allenamento", fine)
        .order("data_allenamento", { ascending: true });

      setAllenamentiSettimana(settimana ?? []);
    }

    void caricaContestoAllenamento();
  }, [dataAllenamento]);

  async function salvaAllenamento() {
    if (!isAdmin) {
      showToast({
        type: "error",
        message: "Non hai i permessi per creare o modificare un allenamento.",
      });
      return;
    }

    if (!dataAllenamento) {
      showToast({
        type: "error",
        message: "Inserisci la data dell'allenamento.",
      });
      return;
    }

    if (lavori.some((lavoro) => !lavoro.sezione)) {
      showToast({
        type: "error",
        message: "Seleziona una sezione per ogni lavoro.",
      });
      return;
    }

    const totaliPerGruppo = new Map<string, number>();
    const gruppoConTotaliDiversi = lavori.find((lavoro) => {
      if (!lavoro.contemporaneo || !lavoro.gruppo_id) return false;
      const totale = calcolaTempoTotale(lavoro);
      const totaleAtteso = totaliPerGruppo.get(lavoro.gruppo_id);
      if (totaleAtteso === undefined) {
        totaliPerGruppo.set(lavoro.gruppo_id, totale);
        return false;
      }
      return totale !== totaleAtteso;
    });

    if (gruppoConTotaliDiversi) {
      showToast({
        type: "error",
        message:
          "I lavori contemporanei possono avere ripetizioni, tempi di lavoro e recuperi diversi, ma devono avere lo stesso tempo totale.",
      });
      return;
    }

    setLoading(true);

    try {
      const {
        data: { user },
        error: userError,
      } = await supabase.auth.getUser();

      if (userError || !user) {
        throw new Error("Utente non autenticato.");
      }

      const { data: profilo, error: profiloError } = await supabase
        .from("profili")
        .select("last_club_id, last_squadra_id")
        .eq("auth_user_id", user.id)
        .single();

      if (profiloError || !profilo?.last_club_id) {
        throw new Error("Nessun club selezionato.");
      }

      if (!profilo.last_squadra_id) {
        throw new Error("Nessuna squadra selezionata.");
      }

      const lavoriDaSalvare = lavori.map((lavoro) => {
        const h2o = isLavoroH2O(lavoro);

        // I campi "drill bank" (tab Dettagli) sono testo libero opzionale,
        // validi a prescindere dal tipo di lavoro (anche H2O/semplificati).
        const dettagli = {
          codice: lavoro.codice || null,
          spazio: lavoro.spazio || null,
          materiale: lavoro.materiale || null,
          punti_chiave_coaching: lavoro.punti_chiave_coaching || null,
          progressione: lavoro.progressione || null,
          riferimento_gps: lavoro.riferimento_gps || null,
          perche_serve: lavoro.perche_serve || null,
        };

        if (h2o) {
          return {
            sezione: "H2O",
            descrizione: null,
            obbiettivo: null,
            obbiettivo_tag: null,
            rango: null,
            immagine_lavoro: null,
            tempo_lavoro: null,
            ripetizione: null,
            tempo_recupero: null,
            tempo_totale: Number(lavoro.tempo_totale) || 0,
            contemporaneo: false,
            gruppo_contemporaneo: null,
            ...dettagli,
          };
        }

        return {
          sezione: lavoro.sezione,
          descrizione: lavoro.descrizione || null,
          obbiettivo: lavoro.obbiettivo || null,
          obbiettivo_tag: lavoro.obbiettivo_tag || null,
          rango: lavoro.rango || null,
          immagine_lavoro: lavoro.immagine_lavoro || null,
          tempo_lavoro: lavoro.tempo_lavoro
            ? Number(lavoro.tempo_lavoro)
            : null,
          ripetizione: lavoro.ripetizione
            ? Number(lavoro.ripetizione)
            : null,
          tempo_recupero: lavoro.tempo_recupero
            ? Number(lavoro.tempo_recupero)
            : null,
          tempo_totale: calcolaTempoTotale(lavoro),
          contemporaneo: lavoro.contemporaneo,
          gruppo_contemporaneo: lavoro.contemporaneo ? lavoro.gruppo_id : null,
          ...dettagli,
        };
      });

      // Il controllo include anche tipo_allenamento: mattina e sera sono
      // sedute distinte anche se cadono nello stesso giorno. Solo una
      // seconda seduta con lo STESSO tipo (es. due volte "Seduta Mattutina")
      // viene unita a quella già esistente.
      const { data: allenamentoEsistente, error: checkError } =
        await supabase
          .from("allenamenti")
          .select("id,durata_minuti,titolo,tipo_allenamento,ora_inizio")
          .eq("club_id", profilo.last_club_id)
          .eq("squadra_id", profilo.last_squadra_id)
          .eq("data_allenamento", dataAllenamento)
          .eq("tipo_allenamento", tipo)
          .maybeSingle();

      if (checkError) throw checkError;

      let allenamentoId: string;

      if (!allenamentoEsistente) {
        const { data: nuovoAllenamento, error: allenamentoError } =
          await supabase
            .from("allenamenti")
            .insert({
              club_id: profilo.last_club_id,
              squadra_id: profilo.last_squadra_id,
              titolo: `${tipo} - ${dataAllenamento}`,
              data_allenamento: dataAllenamento,
              tipo_allenamento: tipo,
              ora_inizio: oraInizio || null,
              ora_fine: oraFine || null,
              durata_minuti: totaleMinuti,
              stato: "bozza",
              created_by: user.id,
            })
            .select("id")
            .single();

        if (allenamentoError) throw allenamentoError;

        if (!nuovoAllenamento?.id) {
          throw new Error(
            "Errore nella creazione dell'allenamento."
          );
        }

        allenamentoId = nuovoAllenamento.id;

        // Nessuna presenza viene pre-inserita alla creazione della seduta.
        // Le presenze vivono in presenze_giornaliere, una riga per
        // (giocatore, giornata), e vengono create solo quando lo staff le
        // registra davvero. Chi non ha una riga viene contato come assente
        // ingiustificato in fase di calcolo, sulla base della rosa attiva
        // (vedi src/lib/presenze/presenze-giornaliere.ts): non serve
        // scrivere righe di assenza nel database.
      } else {
        allenamentoId = allenamentoEsistente.id;

        const nuovaDurata =
          (allenamentoEsistente.durata_minuti ?? 0) +
          totaleMinuti;

        // Se la seduta esistente ha già un orario di inizio, ricalcoliamo
        // l'orario di fine sulla nuova durata complessiva; altrimenti
        // usiamo quello eventualmente inserito ora.
        const oraInizioEsistente = allenamentoEsistente.ora_inizio || oraInizio;
        const nuovaOraFine = oraInizioEsistente
          ? calcolaOraFine(oraInizioEsistente, nuovaDurata)
          : null;

        const { error: updateError } = await supabase
          .from("allenamenti")
          .update({
            durata_minuti: nuovaDurata,
            ora_inizio: oraInizioEsistente || null,
            ora_fine: nuovaOraFine,
            updated_at: new Date().toISOString(),
          })
          .eq("id", allenamentoId);

        if (updateError) throw updateError;
      }

      if (lavoriDaSalvare.length > 0) {
        const { data: ultimiLavori, error: ultimiLavoriError } =
          await supabase
            .from("lavori_allenamento")
            .select("ordine")
            .eq("allenamento_id", allenamentoId)
            .order("ordine", { ascending: false })
            .limit(1);

        if (ultimiLavoriError) throw ultimiLavoriError;

        const ultimoOrdine = ultimiLavori?.[0]?.ordine ?? 0;

        const { error: lavoriError } = await supabase
          .from("lavori_allenamento")
          .insert(
            lavoriDaSalvare.map((lavoro, index) => ({
              ...lavoro,
              allenamento_id: allenamentoId,
              ordine: ultimoOrdine + index + 1,
            }))
          );

        if (lavoriError) throw lavoriError;
      }

      await onSaved();
      onClose();
    } catch (error) {
      // Un Error nativo (o un PostgrestError, che lo estende) ha message e
      // stack non enumerabili: passato da solo a console.error, l'overlay
      // di Next.js lo serializza come "{}" e nasconde il messaggio reale.
      // Estraiamo i campi a mano così restano visibili in console.
      const dettagli =
        error && typeof error === "object"
          ? {
              message: (error as { message?: string }).message,
              details: (error as { details?: string }).details,
              hint: (error as { hint?: string }).hint,
              code: (error as { code?: string }).code,
            }
          : error;

      console.error("Errore salvataggio allenamento:", dettagli);

      const messaggio =
        error instanceof Error
          ? error.message
          : error && typeof error === "object" && "message" in error
            ? String((error as { message?: unknown }).message)
            : "Errore durante il salvataggio.";

      showToast({
        type: "error",
        message: messaggio,
      });
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="space-y-4 sm:space-y-6">
      <div className="flex items-start justify-between gap-3 border-b border-white/10 pb-4 sm:gap-6 sm:pb-6">
        <div>
          <h2 className="text-2xl font-black text-white sm:text-3xl">
            Nuovo allenamento
          </h2>

          <p className="mt-1 text-sm text-zinc-400">
            Crea una nuova seduta per la squadra selezionata.
          </p>
        </div>

        <button
          type="button"
          onClick={onClose}
          className="shrink-0 rounded-xl border border-white/10 p-2.5 text-zinc-400 transition hover:bg-white/5 hover:text-white sm:p-3"
        >
          <X size={20} />
        </button>
      </div>

      <div className="min-w-0 space-y-4 sm:space-y-6">
          <AppCard>
            <div className="grid gap-3 sm:gap-4 md:grid-cols-2 xl:grid-cols-4">
              <div>
                <label className="mb-1 block text-sm text-zinc-400">
                  Data
                </label>

                <DateInput
                  value={dataAllenamento}
                  onChange={(v) => setDataAllenamento(v)}
                  max="2100-12-31"
                  wrapperClassName="bg-zinc-900"
                  wrapperStyle={{ borderColor: `${themeColor}55` }}
                />
              </div>

              <div>
                <label className="mb-1 block text-sm text-zinc-400">
                  Tipo allenamento
                </label>

                <select
                  value={tipo}
                  onChange={(e) =>
                    cambiaTipoAllenamento(
                      e.target.value as TipoAllenamento
                    )
                  }
                  className="w-full rounded-xl border bg-zinc-950 px-4 py-3 text-white outline-none"
                  style={{
                    borderColor: `${themeColor}55`,
                  }}
                >
                  <option value="Seduta Mattutina">
                    Seduta Mattutina
                  </option>

                  <option value="Seduta Serale">
                    Seduta Serale
                  </option>
                </select>
              </div>

              <div>
                <label className="mb-1 block text-sm text-zinc-400">
                  Orario di inizio
                </label>

                <input
                  type="time"
                  value={oraInizio}
                  onChange={(e) => setOraInizio(e.target.value)}
                  className="w-full rounded-xl border bg-zinc-950 px-4 py-3 text-white outline-none"
                  style={{ borderColor: `${themeColor}55` }}
                />
              </div>

              <div>
                <label className="mb-1 block text-sm text-zinc-400">
                  Orario di fine (calcolato)
                </label>

                <div
                  className="flex w-full items-center rounded-xl border bg-zinc-900/60 px-4 py-3 text-zinc-300"
                  style={{ borderColor: `${themeColor}30` }}
                >
                  {oraFine || "—"}
                </div>
              </div>
            </div>
          </AppCard>

          <div className="grid gap-4 sm:gap-6 sm:grid-cols-2 xl:grid-cols-3">
            <AppCard>
  <h2 className="text-lg font-bold text-white">
    Dettagli programmazione
  </h2>

  <div className="mt-4 space-y-3 text-sm">
    <SidebarRow
      label="Programmazione"
      value={dettagliProgrammazione.programmazione ?? "Non trovata"}
    />

    <SidebarRow
      label="Mesociclo"
      value={dettagliProgrammazione.mesociclo ?? "Non trovato"}
    />

    <SidebarRow
      label="Focus tecnico"
      value={dettagliProgrammazione.focusTecnico ?? "Non definito"}
    />

    <SidebarRow
      label="Focus Avanti"
      value={dettagliProgrammazione.focusAvanti ?? "Non definito"}
    />

    <SidebarRow
      label="Focus Trequarti"
      value={dettagliProgrammazione.focusTrequarti ?? "Non definito"}
    />

    <SidebarRow
      label="Intensità"
      value={
        dettagliProgrammazione.intensita
          ? dettagliProgrammazione.intensita.charAt(0).toUpperCase() +
            dettagliProgrammazione.intensita.slice(1)
          : "Non definita"
      }
    />

    <RpeRow
      rpe={dettagliProgrammazione.rpeTarget}
      colore={
        dettagliProgrammazione.coloreMesociclo ||
        themeColor
      }
    />
  </div>
</AppCard>

            <AppCard>
              <h2 className="text-lg font-bold text-white">
                Dettagli allenamento
              </h2>

              <p className="mt-1 text-sm text-zinc-500">
                Minutaggio per ogni sezione
              </p>

              <div className="mt-4 space-y-3">
                {riepilogoSezioni.length === 0 && (
                  <p className="text-sm text-zinc-500">
                    Nessuna sezione inserita.
                  </p>
                )}

                {riepilogoSezioni.map((item) => {
                  const colore = coloreSezione(item.sezione, themeColor);

                  return (
                    <div
                      key={item.sezione}
                      className="rounded-xl border p-3"
                      style={{
                        borderColor: `${colore}40`,
                        backgroundColor:
                          item.sezione.trim().toUpperCase() === "H2O"
                            ? `${colore}12`
                            : undefined,
                      }}
                    >
                      <p
                        className="text-sm font-semibold"
                        style={{ color: colore }}
                      >
                        {item.sezione}
                      </p>

                      <p className="mt-1 text-xs text-zinc-400">
                        {item.minuti} min · {item.esercizi}{" "}
                        {item.sezione.trim().toUpperCase() === "H2O"
                          ? "pause"
                          : "lavori"}
                      </p>
                    </div>
                  );
                })}
              </div>
            </AppCard>

            <AppCard>
              <h2 className="text-lg font-bold text-white">
                Distribuzione lavoro
              </h2>

              <div className="mt-5 flex justify-center">
                <PieChart
                  sections={riepilogoSezioni}
                  themeColor={themeColor}
                />
              </div>
            </AppCard>

            <AppCard className="sm:col-span-2 xl:col-span-3">
              <button
                type="button"
                onClick={() =>
                  setAllenamentoPrecedenteAperto((current) => !current)
                }
                className="flex w-full items-center justify-between gap-3 text-left"
              >
                <h2 className="text-lg font-bold text-white">
                  Allenamento precedente
                </h2>

                <ChevronDown
                  className={`h-5 w-5 shrink-0 text-zinc-500 transition ${
                    allenamentoPrecedenteAperto ? "rotate-180" : ""
                  }`}
                />
              </button>

              {allenamentoPrecedenteAperto && (
                <>
                  {!allenamentoPrecedente && (
                    <p className="mt-3 text-sm text-zinc-500">
                      Seleziona una data per vedere il precedente.
                    </p>
                  )}

                  {allenamentoPrecedente && (
                    <div className="mt-4 space-y-3">
                      <div>
                        <p className="font-semibold text-white">
                          {allenamentoPrecedente.titolo}
                        </p>

                        <p className="text-sm text-zinc-500">
                          {formatDataIT(allenamentoPrecedente.data_allenamento)}
                        </p>
                      </div>

                      {lavoriPrecedenti.length === 0 ? (
                        <p className="text-sm text-zinc-500">
                          Nessun lavoro registrato per questa seduta.
                        </p>
                      ) : (
                        <div className="overflow-x-auto rounded-xl border border-zinc-700">
                          <table className="w-full min-w-[720px] border-collapse text-sm">
                            <thead style={{ backgroundColor: themeColor }}>
                              <tr className="text-left text-white">
                                <th className="border border-black/10 px-3 py-2 font-semibold">
                                  Sezione
                                </th>
                                <th className="border border-black/10 px-3 py-2 font-semibold">
                                  Descrizione
                                </th>
                                <th className="border border-black/10 px-3 py-2 font-semibold">
                                  Obbiettivo
                                </th>
                                <th className="border border-black/10 px-3 py-2 text-right font-semibold">
                                  Tempo totale
                                </th>
                              </tr>
                            </thead>

                            <tbody>
                              {lavoriPrecedenti.map((lavoro, index) => {
                                const h2oRiga =
                                  lavoro.sezione.trim().toUpperCase() === "H2O";

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
                                          themeColor
                                        ),
                                      }}
                                    >
                                      {lavoro.sezione}
                                    </td>

                                    <td className="border border-zinc-800 px-3 py-2 text-zinc-300">
                                      {h2oRiga
                                        ? "Pausa acqua"
                                        : lavoro.descrizione || "—"}
                                    </td>

                                    <td className="border border-zinc-800 px-3 py-2 text-zinc-300">
                                      {h2oRiga
                                        ? "—"
                                        : lavoro.obbiettivo || "—"}
                                    </td>

                                    <td className="border border-zinc-800 bg-sky-900/30 px-3 py-2 text-right font-bold text-sky-200">
                                      {lavoro.tempo_totale ?? 0} min
                                    </td>
                                  </tr>
                                );
                              })}
                            </tbody>
                          </table>
                        </div>
                      )}
                    </div>
                  )}
                </>
              )}
            </AppCard>

            <AppCard>
              <h2 className="text-lg font-bold text-white">
                Settimana corrente
              </h2>

              <p className="mt-2 text-sm text-zinc-500">
                Rispetto alla data selezionata.
              </p>

              <div className="mt-4 space-y-3">
                {allenamentiSettimana.length === 0 && (
                  <p className="text-sm text-zinc-500">
                    Nessun allenamento nella settimana.
                  </p>
                )}

                {allenamentiSettimana.map((allenamento) => (
                  <div
                    key={allenamento.id}
                    className="rounded-xl border border-zinc-800 bg-zinc-950 p-3"
                  >
                    <p className="text-sm font-semibold text-white">
                      {allenamento.titolo}
                    </p>

                    <p className="text-xs text-zinc-500">
                      {formatDataIT(allenamento.data_allenamento)}
                    </p>
                  </div>
                ))}
              </div>
            </AppCard>
          </div>

          <AppCard>
            <div className="mb-5 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between sm:gap-4">
              <div>
                <h2 className="text-xl font-bold text-white">
                  Lavori allenamento
                </h2>

                <p className="mt-1 text-sm text-zinc-500">
                  Aggiungi i lavori e assegna a ciascuno un tipo.
                  {" "}Vista impostata dall&apos;admin in Impostazioni.
                </p>
              </div>
            </div>

            {lavori.length === 0 ? (
              <div className="rounded-2xl border border-dashed border-zinc-800 bg-zinc-950/50 px-6 py-12 text-center">
                <p className="text-sm text-zinc-500">
                  Nessun lavoro inserito.
                </p>

                <button
                  type="button"
                  onClick={aggiungiLavoro}
                  className="mt-4 inline-flex items-center gap-2 text-sm font-bold"
                  style={{ color: themeColor }}
                >
                  <Plus size={16} />
                  Inserisci il primo lavoro
                </button>
              </div>
            ) : vistaLavori === "tabella" ? (
              <div className="space-y-3">
                <datalist id="sezioni-tabella-lavori-datalist">
                  {SEZIONI.map((s) => (
                    <option key={s} value={s} />
                  ))}
                </datalist>

                <div className="overflow-x-auto rounded-2xl border border-zinc-800">
                  <table className="min-w-[1500px] w-full border-collapse text-sm">
                    <thead style={{ backgroundColor: themeColor }}>
                      <tr className="text-left text-white">
                        <th className="px-3 py-2.5 font-semibold">Orario</th>
                        <th className="px-3 py-2.5 font-semibold">Tipo</th>
                        <th className="px-3 py-2.5 font-semibold">Drill</th>
                        <th className="min-w-[280px] px-3 py-2.5 font-semibold">
                          Consegna e organizzazione
                        </th>
                        <th className="min-w-[280px] px-3 py-2.5 font-semibold">
                          Punti chiave di coaching
                        </th>
                        <th className="px-3 py-2.5 text-right font-semibold">
                          Ripet.
                        </th>
                        <th className="px-3 py-2.5 text-right font-semibold">
                          T. lavoro
                        </th>
                        <th className="px-3 py-2.5 text-right font-semibold">
                          Recupero
                        </th>
                        <th className="px-3 py-2.5 text-right font-semibold">
                          Totale
                        </th>
                        <th className="px-3 py-2.5 text-center font-semibold">
                          Contemp.
                        </th>
                        <th className="px-3 py-2.5" />
                      </tr>
                    </thead>

                    <tbody>
                      {lavori.map((lavoro) => {
                        const range = orariLavoriMap.get(lavoro.id);
                        const h2oRiga = isLavoroH2O(lavoro);
                        const semplificatoRiga = isLavoroSemplificato(lavoro);
                        const tempoModificabile = h2oRiga || semplificatoRiga;
                        const inGruppo = Boolean(
                          lavoro.contemporaneo && lavoro.gruppo_id
                        );

                        function aggiornaCampoRiga(
                          campo:
                            | "sezione"
                            | "tempo_lavoro"
                            | "ripetizione"
                            | "tempo_recupero",
                          valore: string
                        ) {
                          if (lavoro.gruppo_id && campo === "sezione") {
                            aggiornaCampoGruppo(lavoro.gruppo_id, campo, valore);
                          } else {
                            aggiornaLavoro(lavoro.id, campo, valore);
                          }
                        }

                        return (
                          <tr
                            key={lavoro.id}
                            className={`border-t align-top ${
                              inGruppo
                                ? "border-zinc-800 bg-zinc-900/40"
                                : "border-zinc-800 bg-zinc-950/70"
                            }`}
                          >
                            <td className="whitespace-nowrap px-3 py-2 text-zinc-400">
                              {range ? `${range.inizio}–${range.fine}` : "—"}
                            </td>

                            <td className="px-3 py-2">
                              <input
                                type="text"
                                list="sezioni-tabella-lavori-datalist"
                                value={lavoro.sezione}
                                onChange={(e) =>
                                  aggiornaCampoRiga("sezione", e.target.value)
                                }
                                className="w-36 rounded-lg border border-zinc-800 bg-zinc-900 px-2 py-1.5 text-white outline-none"
                              />
                            </td>

                            <td className="px-3 py-2">
                              <input
                                type="text"
                                value={lavoro.descrizione}
                                onChange={(e) =>
                                  aggiornaLavoro(
                                    lavoro.id,
                                    "descrizione",
                                    e.target.value
                                  )
                                }
                                className="w-56 rounded-lg border border-zinc-800 bg-zinc-900 px-2 py-1.5 text-white outline-none"
                              />
                            </td>

                            <td className="px-3 py-2">
                              <input
                                type="text"
                                value={lavoro.obbiettivo}
                                onChange={(e) =>
                                  aggiornaLavoro(lavoro.id, "obbiettivo", e.target.value)
                                }
                                className="w-full min-w-[260px] rounded-lg border border-zinc-800 bg-zinc-900 px-2 py-1.5 text-white outline-none"
                              />
                            </td>

                            <td className="px-3 py-2">
                              <input
                                type="text"
                                value={lavoro.punti_chiave_coaching}
                                onChange={(e) =>
                                  aggiornaLavoro(
                                    lavoro.id,
                                    "punti_chiave_coaching",
                                    e.target.value
                                  )
                                }
                                className="w-full min-w-[260px] rounded-lg border border-zinc-800 bg-zinc-900 px-2 py-1.5 text-white outline-none"
                              />
                            </td>

                            <td className="px-3 py-2 text-right">
                              {tempoModificabile ? (
                                <span className="text-zinc-600">—</span>
                              ) : (
                                <input
                                  type="number"
                                  min={0}
                                  value={lavoro.ripetizione}
                                  onChange={(e) =>
                                    aggiornaCampoRiga("ripetizione", e.target.value)
                                  }
                                  className="w-16 rounded-lg border border-zinc-800 bg-zinc-900 px-2 py-1.5 text-right text-white outline-none"
                                />
                              )}
                            </td>

                            <td className="px-3 py-2 text-right">
                              {tempoModificabile ? (
                                <span className="text-zinc-600">—</span>
                              ) : (
                                <input
                                  type="number"
                                  min={0}
                                  value={lavoro.tempo_lavoro}
                                  onChange={(e) =>
                                    aggiornaCampoRiga("tempo_lavoro", e.target.value)
                                  }
                                  className="w-16 rounded-lg border border-zinc-800 bg-zinc-900 px-2 py-1.5 text-right text-white outline-none"
                                />
                              )}
                            </td>

                            <td className="px-3 py-2 text-right">
                              {tempoModificabile ? (
                                <span className="text-zinc-600">—</span>
                              ) : (
                                <input
                                  type="number"
                                  min={0}
                                  value={lavoro.tempo_recupero}
                                  onChange={(e) =>
                                    aggiornaCampoRiga("tempo_recupero", e.target.value)
                                  }
                                  className="w-16 rounded-lg border border-zinc-800 bg-zinc-900 px-2 py-1.5 text-right text-white outline-none"
                                />
                              )}
                            </td>

                            <td className="px-3 py-2 text-right">
                              {tempoModificabile ? (
                                <input
                                  type="number"
                                  min={0}
                                  value={lavoro.tempo_totale}
                                  onChange={(e) =>
                                    aggiornaLavoro(
                                      lavoro.id,
                                      "tempo_totale",
                                      e.target.value
                                    )
                                  }
                                  className="w-16 rounded-lg border border-zinc-800 bg-zinc-900 px-2 py-1.5 text-right text-white outline-none"
                                />
                              ) : (
                                <span className="font-bold text-white">
                                  {calcolaTempoTotale(lavoro)}
                                </span>
                              )}
                            </td>

                            <td className="px-3 py-2">
                              <div className="flex items-center justify-center gap-1">
                                <button
                                  type="button"
                                  onClick={() =>
                                    inGruppo && lavoro.gruppo_id
                                      ? disattivaContemporaneo(lavoro.gruppo_id)
                                      : attivaContemporaneo(lavoro.id)
                                  }
                                  title={
                                    inGruppo
                                      ? "Sciogli il gruppo di lavori in contemporanea"
                                      : "Rendi questo lavoro in contemporanea"
                                  }
                                  className={`flex h-7 w-7 items-center justify-center rounded-lg border transition ${
                                    inGruppo
                                      ? "border-transparent text-white"
                                      : "border-zinc-800 text-zinc-500 hover:text-white"
                                  }`}
                                  style={
                                    inGruppo
                                      ? { backgroundColor: themeColor }
                                      : undefined
                                  }
                                >
                                  <Users size={13} />
                                </button>

                                {inGruppo && lavoro.gruppo_id && (
                                  <button
                                    type="button"
                                    onClick={() =>
                                      aggiungiLavoroParallelo(lavoro.gruppo_id!)
                                    }
                                    title="Aggiungi un altro lavoro parallelo a questo gruppo"
                                    className="flex h-7 w-7 items-center justify-center rounded-lg border border-zinc-800 text-zinc-500 transition hover:text-white"
                                  >
                                    <Plus size={13} />
                                  </button>
                                )}
                              </div>
                            </td>

                            <td className="px-3 py-2 text-right">
                              <button
                                type="button"
                                onClick={() =>
                                  inGruppo
                                    ? rimuoviLavoroParallelo(lavoro.id)
                                    : eliminaLavoro(lavoro.id)
                                }
                                className="text-red-500 hover:text-red-400"
                                title="Elimina lavoro"
                              >
                                <Trash2 size={15} />
                              </button>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>

                <p className="text-xs text-zinc-500">
                  Immagini/video e i campi della tab Dettagli si gestiscono
                  dalla vista card. I lavori dello stesso gruppo in
                  contemporanea condividono Tipo, Ripetizioni, Tempo lavoro e
                  Recupero.
                </p>

                <button
                  type="button"
                  onClick={aggiungiLavoro}
                  className="flex w-full items-center justify-center gap-2 rounded-xl px-4 py-2.5 text-sm font-bold text-white transition sm:w-auto"
                  style={{
                    backgroundColor: themeColor,
                    boxShadow: `0 10px 25px ${themeColor}25`,
                  }}
                >
                  <Plus size={16} />
                  Aggiungi lavoro
                </button>
              </div>
            ) : (
              <div className="divide-y divide-zinc-800">
                {blocchiLavori.map((blocco, indiceBlocco) => {
                  const numero = indiceBlocco + 1;

                  // Blocco singolo: lavoro normale oppure pausa H2O.
                  if (!blocco.gruppoId) {
                    const lavoro = blocco.membri[0];
                    const h2o = isLavoroH2O(lavoro);
                    const semplificato = isLavoroSemplificato(lavoro);
                    const colore = coloreSezione(lavoro.sezione, themeColor);

                    return (
                      <div
                        key={lavoro.id}
                        className="py-5 first:pt-0 last:pb-0 sm:py-6"
                      >
                        <div className="mb-4 flex items-start justify-between gap-3">
                          <div className="flex items-center gap-3">
                            <div
                              className="flex h-9 w-9 items-center justify-center rounded-xl text-sm font-black"
                              style={{
                                backgroundColor: `${colore}18`,
                                color: colore,
                              }}
                            >
                              {h2o ? <Droplets size={18} /> : numero}
                            </div>

                            <div>
                              <p className="text-sm font-bold text-white">
                                {h2o ? "Pausa H2O" : `Lavoro ${numero}`}
                              </p>

                              {lavoro.sezione && (
                                <p className="text-xs text-zinc-500">
                                  {lavoro.sezione}
                                </p>
                              )}
                            </div>
                          </div>

                          <button
                            type="button"
                            onClick={() => eliminaLavoro(lavoro.id)}
                            className="shrink-0 rounded-xl border border-red-500/20 px-2.5 py-2 text-sm text-red-500 transition hover:text-red-400 sm:flex sm:items-center sm:gap-1.5 sm:border-0 sm:px-0 sm:py-0"
                          >
                            <Trash2 size={15} />
                            Elimina
                          </button>
                        </div>

                        <div className="mb-4">
                          <SelectField
                            label="Tipo"
                            value={lavoro.sezione}
                            options={SEZIONI}
                            onChange={(value) =>
                              aggiornaLavoro(lavoro.id, "sezione", value)
                            }
                            themeColor={colore}
                            allowCustom
                          />
                        </div>

                        <div className="mb-3 inline-flex items-center gap-1 rounded-xl border border-zinc-800 bg-zinc-950 p-1">
                          {(
                            [
                              ["generale", "Generale"],
                              ["dettagli", "Dettagli"],
                              ["drillbank", "Drill bank"],
                            ] as const
                          ).map(([valore, etichetta]) => {
                            const attiva =
                              (tabLavoroAttiva[lavoro.id] || "generale") ===
                              valore;

                            return (
                              <button
                                key={valore}
                                type="button"
                                onClick={() =>
                                  setTabLavoroAttiva((prev) => ({
                                    ...prev,
                                    [lavoro.id]: valore,
                                  }))
                                }
                                className={`rounded-lg px-3 py-1.5 text-xs font-bold transition ${
                                  attiva
                                    ? "text-white"
                                    : "text-zinc-500 hover:text-white"
                                }`}
                                style={
                                  attiva
                                    ? { backgroundColor: colore }
                                    : undefined
                                }
                              >
                                {etichetta}
                              </button>
                            );
                          })}
                        </div>

                        {(tabLavoroAttiva[lavoro.id] || "generale") ===
                        "drillbank" ? (
                          <div className="rounded-2xl border border-zinc-800 bg-zinc-950/60 p-4">
                            <p className="mb-3 text-sm text-zinc-400">
                              Carica un lavoro salvato in precedenza nel drill
                              bank del club (copia indipendente, non un
                              collegamento), oppure salva questo lavoro per
                              riusarlo in altre sedute.
                            </p>

                            <div className="flex flex-wrap items-center gap-2">
                              <select
                                value=""
                                onChange={(e) => {
                                  const drill = drillBank.find(
                                    (d) => d.id === e.target.value
                                  );
                                  if (drill) applicaDrillBank(lavoro.id, drill);
                                }}
                                className="rounded-lg border border-zinc-800 bg-zinc-950 px-2 py-1.5 text-xs text-zinc-300 outline-none"
                              >
                                <option value="">
                                  {drillBank.length === 0
                                    ? "Drill bank vuoto"
                                    : "Carica dal drill bank..."}
                                </option>
                                {drillBank.map((drill) => (
                                  <option key={drill.id} value={drill.id}>
                                    {drill.codice
                                      ? `${drill.codice} · ${drill.nome}`
                                      : drill.nome}
                                  </option>
                                ))}
                              </select>

                              <button
                                type="button"
                                onClick={() => salvaNelDrillBank(lavoro)}
                                className="rounded-lg border border-zinc-800 px-2 py-1.5 text-xs font-bold text-zinc-300 transition hover:text-white"
                              >
                                Salva nel drill bank
                              </button>
                            </div>
                          </div>
                        ) : (tabLavoroAttiva[lavoro.id] || "generale") ===
                          "dettagli" ? (
                          <DettagliLavoroForm
                            lavoro={lavoro}
                            onChange={(campo, value) =>
                              aggiornaLavoro(lavoro.id, campo, value)
                            }
                          />
                        ) : h2o ? (
                          <div
                            className="rounded-2xl border p-4"
                            style={{
                              borderColor: `${colore}35`,
                              backgroundColor: `${colore}0D`,
                            }}
                          >
                            <div className="flex items-center gap-3">
                              <div
                                className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl"
                                style={{
                                  backgroundColor: `${colore}20`,
                                  color: colore,
                                }}
                              >
                                <Droplets size={21} />
                              </div>

                              <div className="min-w-0 flex-1">
                                <label className="mb-1 block text-sm font-medium text-zinc-300">
                                  Minutaggio H2O
                                </label>

                                <input
                                  type="number"
                                  min="0"
                                  value={lavoro.tempo_totale}
                                  onChange={(e) =>
                                    aggiornaLavoro(
                                      lavoro.id,
                                      "tempo_totale",
                                      e.target.value
                                    )
                                  }
                                  placeholder="Es. 3"
                                  className="w-full rounded-xl border bg-zinc-950 px-3 py-2.5 text-white outline-none"
                                  style={{
                                    borderColor: `${colore}55`,
                                  }}
                                />
                              </div>

                              <span
                                className="mt-6 shrink-0 text-sm font-bold"
                                style={{ color: colore }}
                              >
                                min
                              </span>
                            </div>
                          </div>
                        ) : semplificato ? (
                          <div className="grid gap-3 sm:gap-4 md:grid-cols-2">
                            <div className="md:col-span-2">
                              <label className="mb-1 block text-sm text-zinc-400">
                                Drill
                              </label>

                              <textarea
                                value={lavoro.descrizione}
                                onChange={(e) =>
                                  aggiornaLavoro(
                                    lavoro.id,
                                    "descrizione",
                                    e.target.value
                                  )
                                }
                                rows={3}
                                className="w-full rounded-xl border border-zinc-800 bg-zinc-900 px-3 py-2 text-white outline-none"
                              />
                            </div>

                            <div className="md:col-span-2">
                              <InputField
                                label="Immagine o video lavoro (URL)"
                                placeholder="Link a un'immagine, un video o YouTube/Vimeo"
                                value={lavoro.immagine_lavoro}
                                onChange={(value) =>
                                  aggiornaLavoro(
                                    lavoro.id,
                                    "immagine_lavoro",
                                    value
                                  )
                                }
                              />

                              <AnteprimaMediaLavoro
                                url={lavoro.immagine_lavoro}
                              />
                            </div>

                            <InputField
                              label="Tempo totale (min)"
                              type="number"
                              value={lavoro.tempo_totale}
                              onChange={(value) =>
                                aggiornaLavoro(
                                  lavoro.id,
                                  "tempo_totale",
                                  value
                                )
                              }
                            />
                          </div>
                        ) : (
                          <>
                            <div className="grid gap-3 sm:gap-4 md:grid-cols-2">
                              <div className="md:col-span-2">
                                <label className="mb-1 block text-sm text-zinc-400">
                                  Drill
                                </label>

                                <textarea
                                  value={lavoro.descrizione}
                                  onChange={(e) =>
                                    aggiornaLavoro(
                                      lavoro.id,
                                      "descrizione",
                                      e.target.value
                                    )
                                  }
                                  rows={3}
                                  className="w-full rounded-xl border border-zinc-800 bg-zinc-900 px-3 py-2 text-white outline-none"
                                />
                              </div>

                              <InputField
                                label="Consegna e organizzazione"
                                value={lavoro.obbiettivo}
                                onChange={(value) =>
                                  aggiornaLavoro(lavoro.id, "obbiettivo", value)
                                }
                              />

                              <SelectField
                                label="Obbiettivo Tag"
                                value={lavoro.obbiettivo_tag}
                                options={OBBIETTIVO_TAG}
                                onChange={(value) =>
                                  aggiornaLavoro(
                                    lavoro.id,
                                    "obbiettivo_tag",
                                    value
                                  )
                                }
                                allowCustom
                              />

                              <SelectField
                                label="Rango"
                                value={lavoro.rango}
                                options={RANGHI}
                                onChange={(value) =>
                                  aggiornaLavoro(lavoro.id, "rango", value)
                                }
                              />

                              <div>
                                <InputField
                                  label="Immagine o video lavoro (URL)"
                                  placeholder="Link a un'immagine, un video o YouTube/Vimeo"
                                  value={lavoro.immagine_lavoro}
                                  onChange={(value) =>
                                    aggiornaLavoro(
                                      lavoro.id,
                                      "immagine_lavoro",
                                      value
                                    )
                                  }
                                />

                                <AnteprimaMediaLavoro
                                  url={lavoro.immagine_lavoro}
                                />
                              </div>

                              <InputField
                                label="Ripetizioni"
                                type="number"
                                value={lavoro.ripetizione}
                                onChange={(value) =>
                                  aggiornaLavoro(
                                    lavoro.id,
                                    "ripetizione",
                                    value
                                  )
                                }
                              />

                              <InputField
                                label="Tempo lavoro"
                                type="number"
                                value={lavoro.tempo_lavoro}
                                onChange={(value) =>
                                  aggiornaLavoro(
                                    lavoro.id,
                                    "tempo_lavoro",
                                    value
                                  )
                                }
                              />

                              <InputField
                                label="Tempo recupero"
                                type="number"
                                value={lavoro.tempo_recupero}
                                onChange={(value) =>
                                  aggiornaLavoro(
                                    lavoro.id,
                                    "tempo_recupero",
                                    value
                                  )
                                }
                              />

                              <div>
                                <label className="mb-1 block text-sm text-zinc-400">
                                  Tempo totale
                                </label>

                                <div
                                  className="flex h-[42px] items-center rounded-xl border border-zinc-800 bg-zinc-900 px-3 text-lg font-semibold"
                                  style={{ color: colore }}
                                >
                                  {calcolaTempoTotale(lavoro)} min
                                </div>
                              </div>
                            </div>

                            <label className="mt-4 flex items-center gap-2 text-sm text-zinc-400">
                              <input
                                type="checkbox"
                                checked={false}
                                onChange={() => attivaContemporaneo(lavoro.id)}
                                className="h-4 w-4 rounded border-zinc-700 bg-zinc-900"
                              />
                              Lavoro in contemporanea (più gruppi che lavorano
                              nello stesso momento)
                            </label>
                          </>
                        )}
                      </div>
                    );
                  }

                  // Blocco di lavori contemporanei: condividono sezione e
                  // tempi, ma ogni membro ha una propria descrizione/obiettivo.
                  const gruppoId = blocco.gruppoId;
                  const membri = blocco.membri;
                  const riferimento = membri[0];
                  const coloreGruppo = coloreSezione(
                    riferimento.sezione,
                    themeColor
                  );

                  return (
                    <div
                      key={gruppoId}
                      className="py-5 first:pt-0 last:pb-0 sm:py-6"
                    >
                      <div className="mb-4 flex items-start justify-between gap-3">
                        <div className="flex items-center gap-3">
                          <div
                            className="flex h-9 w-9 items-center justify-center rounded-xl"
                            style={{
                              backgroundColor: `${coloreGruppo}18`,
                              color: coloreGruppo,
                            }}
                          >
                            <Users size={18} />
                          </div>

                          <div>
                            <p className="text-sm font-bold text-white">
                              Lavoro {numero} · gruppi in contemporanea (
                              {membri.length})
                            </p>

                            {riferimento.sezione && (
                              <p className="text-xs text-zinc-500">
                                {riferimento.sezione}
                              </p>
                            )}
                          </div>
                        </div>

                        <button
                          type="button"
                          onClick={() => eliminaGruppo(gruppoId)}
                          className="shrink-0 rounded-xl border border-red-500/20 px-2.5 py-2 text-sm text-red-500 transition hover:text-red-400 sm:flex sm:items-center sm:gap-1.5 sm:border-0 sm:px-0 sm:py-0"
                        >
                          <Trash2 size={15} />
                          Elimina
                        </button>
                      </div>

                      <div className="mb-4 rounded-2xl border border-zinc-800 bg-zinc-950/60 p-4">
                        <div className="mb-3">
                          <SelectField
                            label="Tipo (condiviso dal gruppo)"
                            value={riferimento.sezione}
                            options={SEZIONI.filter((s) => s !== "H2O")}
                            onChange={(value) =>
                              aggiornaCampoGruppo(gruppoId, "sezione", value)
                            }
                            themeColor={coloreGruppo}
                            allowCustom
                          />
                        </div>

                        <p className="text-xs text-zinc-500">
                          Ogni lavoro parallelo può avere ripetizioni, tempo di
                          lavoro e recupero differenti. Il tempo totale deve
                          essere uguale per tutti i lavori del gruppo.
                        </p>

                        {membri.length === 1 && (
                          <button
                            type="button"
                            onClick={() => disattivaContemporaneo(gruppoId)}
                            className="mt-3 text-xs font-semibold text-zinc-500 underline decoration-dotted hover:text-zinc-300"
                          >
                            Annulla contemporaneità
                          </button>
                        )}
                      </div>

                      <div className="space-y-4">
                        {membri.map((membro, indiceMembro) => (
                          <div
                            key={membro.id}
                            className="rounded-2xl border border-zinc-800 bg-zinc-950 p-4"
                          >
                            <div className="mb-3 flex items-center justify-between gap-3">
                              <p className="text-xs font-bold uppercase tracking-wide text-zinc-500">
                                Gruppo {indiceMembro + 1}
                              </p>

                              {membri.length > 1 && (
                                <button
                                  type="button"
                                  onClick={() =>
                                    rimuoviLavoroParallelo(membro.id)
                                  }
                                  className="flex h-8 w-8 items-center justify-center rounded-lg text-zinc-400 transition hover:bg-red-500/20 hover:text-red-300"
                                  title="Rimuovi questo lavoro parallelo"
                                >
                                  <Trash2 size={14} />
                                </button>
                              )}
                            </div>

                            <div className="mb-3 inline-flex items-center gap-1 rounded-xl border border-zinc-800 bg-zinc-950 p-1">
                              {(
                                [
                                  ["generale", "Generale"],
                                  ["dettagli", "Dettagli"],
                                  ["drillbank", "Drill bank"],
                                ] as const
                              ).map(([valore, etichetta]) => {
                                const attiva =
                                  (tabLavoroAttiva[membro.id] || "generale") ===
                                  valore;

                                return (
                                  <button
                                    key={valore}
                                    type="button"
                                    onClick={() =>
                                      setTabLavoroAttiva((prev) => ({
                                        ...prev,
                                        [membro.id]: valore,
                                      }))
                                    }
                                    className={`rounded-lg px-3 py-1.5 text-xs font-bold transition ${
                                      attiva
                                        ? "text-white"
                                        : "text-zinc-500 hover:text-white"
                                    }`}
                                    style={
                                      attiva
                                        ? { backgroundColor: coloreGruppo }
                                        : undefined
                                    }
                                  >
                                    {etichetta}
                                  </button>
                                );
                              })}
                            </div>

                            {(tabLavoroAttiva[membro.id] || "generale") ===
                            "drillbank" ? (
                              <div className="rounded-2xl border border-zinc-800 bg-zinc-950/60 p-4">
                                <p className="mb-3 text-sm text-zinc-400">
                                  Carica un lavoro salvato in precedenza nel
                                  drill bank del club (copia indipendente),
                                  oppure salva questo lavoro per riusarlo in
                                  altre sedute.
                                </p>

                                <div className="flex flex-wrap items-center gap-2">
                                  <select
                                    value=""
                                    onChange={(e) => {
                                      const drill = drillBank.find(
                                        (d) => d.id === e.target.value
                                      );
                                      if (drill)
                                        applicaDrillBank(membro.id, drill);
                                    }}
                                    className="rounded-lg border border-zinc-800 bg-zinc-950 px-2 py-1.5 text-xs text-zinc-300 outline-none"
                                  >
                                    <option value="">
                                      {drillBank.length === 0
                                        ? "Drill bank vuoto"
                                        : "Carica dal drill bank..."}
                                    </option>
                                    {drillBank.map((drill) => (
                                      <option key={drill.id} value={drill.id}>
                                        {drill.codice
                                          ? `${drill.codice} · ${drill.nome}`
                                          : drill.nome}
                                      </option>
                                    ))}
                                  </select>

                                  <button
                                    type="button"
                                    onClick={() => salvaNelDrillBank(membro)}
                                    className="rounded-lg border border-zinc-800 px-2 py-1.5 text-xs font-bold text-zinc-300 transition hover:text-white"
                                  >
                                    Salva nel drill bank
                                  </button>
                                </div>
                              </div>
                            ) : (tabLavoroAttiva[membro.id] || "generale") ===
                              "dettagli" ? (
                              <DettagliLavoroForm
                                lavoro={membro}
                                onChange={(campo, value) =>
                                  aggiornaLavoro(membro.id, campo, value)
                                }
                              />
                            ) : (
                            <div className="grid gap-3 sm:gap-4 md:grid-cols-2">
                              <div className="md:col-span-2">
                                <label className="mb-1 block text-sm text-zinc-400">
                                  Drill
                                </label>

                                <textarea
                                  value={membro.descrizione}
                                  onChange={(e) =>
                                    aggiornaLavoro(
                                      membro.id,
                                      "descrizione",
                                      e.target.value
                                    )
                                  }
                                  rows={2}
                                  className="w-full rounded-xl border border-zinc-800 bg-zinc-900 px-3 py-2 text-white outline-none"
                                />
                              </div>

                              <InputField
                                label="Consegna e organizzazione"
                                value={membro.obbiettivo}
                                onChange={(value) =>
                                  aggiornaLavoro(
                                    membro.id,
                                    "obbiettivo",
                                    value
                                  )
                                }
                              />

                              <SelectField
                                label="Obbiettivo Tag"
                                value={membro.obbiettivo_tag}
                                options={OBBIETTIVO_TAG}
                                onChange={(value) =>
                                  aggiornaLavoro(
                                    membro.id,
                                    "obbiettivo_tag",
                                    value
                                  )
                                }
                                allowCustom
                              />

                              <SelectField
                                label="Rango"
                                value={membro.rango}
                                options={RANGHI}
                                onChange={(value) =>
                                  aggiornaLavoro(membro.id, "rango", value)
                                }
                              />

                              <div>
                                <InputField
                                  label="Immagine o video lavoro (URL)"
                                  placeholder="Link a un'immagine, un video o YouTube/Vimeo"
                                  value={membro.immagine_lavoro}
                                  onChange={(value) =>
                                    aggiornaLavoro(
                                      membro.id,
                                      "immagine_lavoro",
                                      value
                                    )
                                  }
                                />

                                <AnteprimaMediaLavoro
                                  url={membro.immagine_lavoro}
                                />
                              </div>

                              <div className="md:col-span-2 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
                                <InputField
                                  label="Ripetizioni"
                                  type="number"
                                  value={membro.ripetizione}
                                  onChange={(value) =>
                                    aggiornaLavoro(membro.id, "ripetizione", value)
                                  }
                                />
                                <InputField
                                  label="Tempo lavoro"
                                  type="number"
                                  value={membro.tempo_lavoro}
                                  onChange={(value) =>
                                    aggiornaLavoro(membro.id, "tempo_lavoro", value)
                                  }
                                />
                                <InputField
                                  label="Tempo recupero"
                                  type="number"
                                  value={membro.tempo_recupero}
                                  onChange={(value) =>
                                    aggiornaLavoro(membro.id, "tempo_recupero", value)
                                  }
                                />
                                <div>
                                  <label className="mb-1 block text-sm text-zinc-400">
                                    Tempo totale
                                  </label>
                                  <div
                                    className="flex h-[42px] items-center rounded-xl border border-zinc-800 bg-zinc-900 px-3 text-lg font-semibold"
                                    style={{ color: coloreGruppo }}
                                  >
                                    {calcolaTempoTotale(membro)} min
                                  </div>
                                </div>
                              </div>
                            </div>
                            )}
                          </div>
                        ))}

                        <button
                          type="button"
                          onClick={() => aggiungiLavoroParallelo(gruppoId)}
                          className="flex w-full items-center justify-center gap-2 rounded-xl border border-dashed px-4 py-2.5 text-sm font-bold transition sm:w-auto"
                          style={{
                            borderColor: `${coloreGruppo}55`,
                            color: coloreGruppo,
                          }}
                        >
                          <Plus size={16} />
                          Aggiungi lavoro parallelo
                        </button>
                      </div>
                    </div>
                  );
                })}

                <button
                  type="button"
                  onClick={aggiungiLavoro}
                  className="flex w-full items-center justify-center gap-2 rounded-xl px-4 py-2.5 text-sm font-bold text-white transition sm:w-auto"
                  style={{
                    backgroundColor: themeColor,
                    boxShadow: `0 10px 25px ${themeColor}25`,
                  }}
                >
                  <Plus size={16} />
                  Aggiungi lavoro
                </button>
              </div>
            )}
          </AppCard>

          {isAdmin && (
          <div className="flex flex-col items-end gap-2">
            <button
              type="button"
              onClick={salvaAllenamento}
              disabled={loading}
              className="flex w-full items-center justify-center gap-2 rounded-xl px-6 py-3 font-bold text-white transition disabled:opacity-50 sm:w-auto"
              style={{
                backgroundColor: themeColor,
                boxShadow: `0 12px 30px ${themeColor}33`,
              }}
            >
              <Save size={18} />
              {loading
                ? "Salvataggio..."
                : "Salva allenamento"}
            </button>
          </div>
          )}
      </div>
    </div>
  );
}

function SidebarRow({
  label,
  value,
}: {
  label: string;
  value: string;
}) {
  return (
    <div className="flex items-center justify-between gap-4 border-b border-zinc-800 pb-2">
      <span className="text-zinc-500">{label}</span>
      <span className="text-right font-medium text-white">
        {value}
      </span>
    </div>
  );
}

function InputField({
  label,
  value,
  onChange,
  type = "text",
  placeholder,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  type?: string;
  placeholder?: string;
}) {
  return (
    <div>
      <label className="mb-1 block text-sm text-zinc-400">
        {label}
      </label>

      <input
        type={type}
        value={value}
        placeholder={placeholder}
        onChange={(e) => onChange(e.target.value)}
        className="w-full rounded-xl border border-zinc-800 bg-zinc-900 px-3 py-2 text-white outline-none"
      />
    </div>
  );
}

// Tab "Dettagli" di un lavoro: approfondimenti facoltativi in stile
// "drill bank" (codice, spazio, materiale, punti chiave di coaching,
// progressione, riferimento GPS, perché serve), separati dai campi
// principali per non appesantire il form di default.
function DettagliLavoroForm({
  lavoro,
  onChange,
}: {
  lavoro: Lavoro;
  onChange: (
    campo:
      | "codice"
      | "spazio"
      | "materiale"
      | "punti_chiave_coaching"
      | "progressione"
      | "riferimento_gps"
      | "perche_serve",
    value: string
  ) => void;
}) {
  return (
    <div className="grid gap-3 sm:gap-4 md:grid-cols-2">
      <InputField
        label="Codice"
        placeholder="Es. A1"
        value={lavoro.codice}
        onChange={(value) => onChange("codice", value)}
      />

      <InputField
        label="Spazio"
        placeholder="Es. 3 griglie parallele da 20×20 m"
        value={lavoro.spazio}
        onChange={(value) => onChange("spazio", value)}
      />

      <InputField
        label="Materiale"
        placeholder="Es. 12 coni, 3 palloni"
        value={lavoro.materiale}
        onChange={(value) => onChange("materiale", value)}
      />

      <InputField
        label="Riferimento GPS"
        placeholder="Es. 45-55 m/min"
        value={lavoro.riferimento_gps}
        onChange={(value) => onChange("riferimento_gps", value)}
      />

      <div className="md:col-span-2">
        <label className="mb-1 block text-sm text-zinc-400">
          Punti chiave di coaching
        </label>
        <textarea
          value={lavoro.punti_chiave_coaching}
          onChange={(e) => onChange("punti_chiave_coaching", e.target.value)}
          rows={3}
          className="w-full rounded-xl border border-zinc-800 bg-zinc-900 px-3 py-2 text-white outline-none"
        />
      </div>

      <div className="md:col-span-2">
        <label className="mb-1 block text-sm text-zinc-400">
          Progressione
        </label>
        <textarea
          value={lavoro.progressione}
          onChange={(e) => onChange("progressione", e.target.value)}
          rows={2}
          className="w-full rounded-xl border border-zinc-800 bg-zinc-900 px-3 py-2 text-white outline-none"
        />
      </div>

      <div className="md:col-span-2">
        <label className="mb-1 block text-sm text-zinc-400">
          Perché serve
        </label>
        <textarea
          value={lavoro.perche_serve}
          onChange={(e) => onChange("perche_serve", e.target.value)}
          rows={2}
          className="w-full rounded-xl border border-zinc-800 bg-zinc-900 px-3 py-2 text-white outline-none"
        />
      </div>
    </div>
  );
}

function SelectField({
  label,
  value,
  options,
  onChange,
  themeColor,
  allowCustom = false,
}: {
  label: string;
  value: string;
  options: string[];
  onChange: (value: string) => void;
  themeColor?: string;
  allowCustom?: boolean;
}) {
  const datalistId = useId();

  if (allowCustom) {
    return (
      <div>
        <label className="mb-1 block text-sm text-zinc-400">
          {label}
        </label>

        <input
          type="text"
          list={datalistId}
          value={value}
          placeholder="Seleziona o scrivi una nuova voce"
          onChange={(e) => onChange(e.target.value)}
          className="w-full rounded-xl border bg-zinc-900 px-3 py-2 text-white outline-none"
          style={{
            borderColor: themeColor
              ? `${themeColor}55`
              : undefined,
          }}
        />

        <datalist id={datalistId}>
          {options.map((option) => (
            <option key={option} value={option} />
          ))}
        </datalist>
      </div>
    );
  }

  return (
    <div>
      <label className="mb-1 block text-sm text-zinc-400">
        {label}
      </label>

      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="w-full rounded-xl border bg-zinc-900 px-3 py-2 text-white outline-none"
        style={{
          borderColor: themeColor
            ? `${themeColor}55`
            : undefined,
        }}
      >
        <option value="">Seleziona</option>

        {options.map((option) => (
          <option key={option} value={option}>
            {option}
          </option>
        ))}
      </select>
    </div>
  );
}

function PieChart({
  sections,
  themeColor,
}: {
  sections: {
    sezione: string;
    minuti: number;
    esercizi: number;
  }[];
  themeColor: string;
}) {
  const totale = sections.reduce(
    (sum, section) => sum + section.minuti,
    0
  );

  if (totale === 0) {
    return (
      <div className="flex h-40 w-40 items-center justify-center rounded-full border border-zinc-800 text-center text-xs text-zinc-500">
        Nessun dato
      </div>
    );
  }

  const colors = [
    themeColor,
    "#f97316",
    "#eab308",
    "#22c55e",
    "#6366f1",
    "#a855f7",
  ];

  let prossimoIndiceColore = 0;

  function coloreSlice(sezione: string) {
    if (sezione.trim().toUpperCase() === "H2O") return COLORE_H2O;

    const colore = colors[prossimoIndiceColore % colors.length];
    prossimoIndiceColore += 1;
    return colore;
  }

  const sezioniConMinuti = sections.filter((section) => section.minuti > 0);
  const coloriPerSezione = new Map(
    sezioniConMinuti.map((section) => [section.sezione, coloreSlice(section.sezione)])
  );

  const gradient = sezioniConMinuti
    .reduce(
      (acc, section) => {
        const percentage =
          (section.minuti / totale) * 100;

        const start = acc.progress;
        const end = start + percentage;

        return {
          progress: end,
          values: [
            ...acc.values,
            `${coloriPerSezione.get(section.sezione)} ${start}% ${end}%`,
          ],
        };
      },
      {
        progress: 0,
        values: [] as string[],
      }
    )
    .values.join(", ");

  return (
    <div className="space-y-4">
      <div
        className="mx-auto h-40 w-40 rounded-full"
        style={{
          background: `conic-gradient(${gradient})`,
        }}
      />

      <div className="space-y-2">
        {sezioniConMinuti.map((section) => (
            <div
              key={section.sezione}
              className="flex items-center gap-2 text-xs"
            >
              <span
                className="h-3 w-3 rounded-full"
                style={{
                  backgroundColor: coloriPerSezione.get(section.sezione),
                }}
              />

              <span className="text-zinc-400">
                {section.sezione}:{" "}
                {(
                  (section.minuti / totale) *
                  100
                ).toFixed(0)}
                %
              </span>
            </div>
          ))}
      </div>
    </div>
  );
}

function RpeRow({
  rpe,
  colore,
}: {
  rpe: string | null;
  colore: string;
}) {
  return (
    <div className="flex items-center justify-between gap-4 border-b border-zinc-800 pb-2">
      <span className="text-zinc-500">Intensità RPE</span>

      <div className="flex items-center gap-2">
        <span
          className="h-3 w-3 rounded-full"
          style={{
            backgroundColor: colore,
            boxShadow: `0 0 14px ${colore}80`,
          }}
        />

        <span className="font-semibold text-white">
          {rpe ? `${rpe}/10` : "Non definita"}
        </span>
      </div>
    </div>
  );
}
