"use client";

import { useEffect, useMemo, useState } from "react";
import { X, Plus, Trash2, Save, Droplets, Users } from "lucide-react";
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
  rpe_target: number | null;
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
  tempo_totale: number | null;
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
  rpeTarget: number | null;
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
  "Analisi Video / Riunioni",
  "ATTIVAZIONE / RISCALDAMENTO",
  "LAVORO TECNICO-TATTICO",
  "REPARTO",
  "SITUAZIONI DI GIOCO / MATCH",
  "PALESTRA",
  "COOL-DOWN / DEFATICAMENTO",
  "H2O",
];

const COLORE_H2O = "#38bdf8";

function isLavoroH2O(lavoro: Lavoro) {
  return lavoro.sezione.trim().toUpperCase() === "H2O";
}

function coloreSezione(sezione: string, themeColor: string) {
  return sezione.trim().toUpperCase() === "H2O" ? COLORE_H2O : themeColor;
}

function calcolaTempoTotale(lavoro: Lavoro) {
  if (isLavoroH2O(lavoro)) {
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
  };
}

export default function NuovoAllenamentoModal({
  onClose,
  onSaved,
  themeColor,
  isAdmin,
}: {
  onClose: () => void;
  onSaved: () => void | Promise<void>;
  themeColor: string;
  isAdmin: boolean;
}) {
  const { showToast } = useToast();
  const [tipo, setTipo] = useState<TipoAllenamento>("Seduta Mattutina");
  const [dataAllenamento, setDataAllenamento] = useState("");
  const [loading, setLoading] = useState(false);

  const [allenamentoPrecedente, setAllenamentoPrecedente] =
    useState<AllenamentoPrecedente | null>(null);

  const [lavoriPrecedenti, setLavoriPrecedenti] = useState<LavoroPrecedente[]>(
    []
  );
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
    campo: "sezione" | "tempo_lavoro" | "ripetizione" | "tempo_recupero",
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
            "id,allenamento_id,sezione,descrizione,tempo_totale"
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
        };
      });

      const { data: allenamentoEsistente, error: checkError } =
        await supabase
          .from("allenamenti")
          .select("id,durata_minuti,titolo,tipo_allenamento")
          .eq("club_id", profilo.last_club_id)
          .eq("squadra_id", profilo.last_squadra_id)
          .eq("data_allenamento", dataAllenamento)
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
      } else {
        allenamentoId = allenamentoEsistente.id;

        const nuovaDurata =
          (allenamentoEsistente.durata_minuti ?? 0) +
          totaleMinuti;

        const tipoEsistente =
          allenamentoEsistente.tipo_allenamento ?? "";

        const nuovoTipoAllenamento = tipoEsistente.includes(tipo)
          ? tipoEsistente
          : tipoEsistente
            ? `${tipoEsistente} + ${tipo}`
            : tipo;

        const { error: updateError } = await supabase
          .from("allenamenti")
          .update({
            durata_minuti: nuovaDurata,
            tipo_allenamento: nuovoTipoAllenamento,
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
      console.error(
        "Errore salvataggio allenamento:",
        error
      );

      showToast({
        type: "error",
        message:
          error instanceof Error
            ? error.message
            : "Errore durante il salvataggio.",
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

      <div className="grid gap-4 sm:gap-6 xl:grid-cols-[1fr_380px]">
        <main className="space-y-4 sm:space-y-6">
          <AppCard>
            <div className="grid gap-3 sm:gap-4 md:grid-cols-2">
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
            </div>
          </AppCard>

          <AppCard>
            <div className="mb-5 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between sm:gap-4">
              <div>
                <h2 className="text-xl font-bold text-white">
                  Lavori allenamento
                </h2>

                <p className="mt-1 text-sm text-zinc-500">
                  Aggiungi i lavori e assegna a ciascuno una sezione.
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
            ) : (
              <div className="divide-y divide-zinc-800">
                {blocchiLavori.map((blocco, indiceBlocco) => {
                  const numero = indiceBlocco + 1;

                  // Blocco singolo: lavoro normale oppure pausa H2O.
                  if (!blocco.gruppoId) {
                    const lavoro = blocco.membri[0];
                    const h2o = isLavoroH2O(lavoro);
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
                            label="Sezione"
                            value={lavoro.sezione}
                            options={SEZIONI}
                            onChange={(value) =>
                              aggiornaLavoro(lavoro.id, "sezione", value)
                            }
                            themeColor={colore}
                          />
                        </div>

                        {h2o ? (
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
                        ) : (
                          <>
                            <div className="grid gap-3 sm:gap-4 md:grid-cols-2">
                              <div className="md:col-span-2">
                                <label className="mb-1 block text-sm text-zinc-400">
                                  Descrizione
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
                                label="Obbiettivo"
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
                            label="Sezione (condivisa dal gruppo)"
                            value={riferimento.sezione}
                            options={SEZIONI.filter((s) => s !== "H2O")}
                            onChange={(value) =>
                              aggiornaCampoGruppo(gruppoId, "sezione", value)
                            }
                            themeColor={coloreGruppo}
                          />
                        </div>

                        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
                          <InputField
                            label="Tempo lavoro"
                            type="number"
                            value={riferimento.tempo_lavoro}
                            onChange={(value) =>
                              aggiornaCampoGruppo(
                                gruppoId,
                                "tempo_lavoro",
                                value
                              )
                            }
                          />

                          <InputField
                            label="Ripetizioni"
                            type="number"
                            value={riferimento.ripetizione}
                            onChange={(value) =>
                              aggiornaCampoGruppo(
                                gruppoId,
                                "ripetizione",
                                value
                              )
                            }
                          />

                          <InputField
                            label="Tempo recupero"
                            type="number"
                            value={riferimento.tempo_recupero}
                            onChange={(value) =>
                              aggiornaCampoGruppo(
                                gruppoId,
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
                              style={{ color: coloreGruppo }}
                            >
                              {calcolaTempoTotale(riferimento)} min
                            </div>
                          </div>
                        </div>

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

                            <div className="grid gap-3 sm:gap-4 md:grid-cols-2">
                              <div className="md:col-span-2">
                                <label className="mb-1 block text-sm text-zinc-400">
                                  Descrizione
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
                                label="Obbiettivo"
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
                            </div>
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
        </main>

        <aside className="space-y-4 sm:space-y-6 xl:sticky xl:top-6 xl:self-start">
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

          <AppCard>
            <h2 className="text-lg font-bold text-white">
              Allenamento precedente
            </h2>

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

                {lavoriPrecedenti.map((lavoro) => (
                  <div
                    key={lavoro.id}
                    className="rounded-xl border border-zinc-800 bg-zinc-950 p-3"
                  >
                    <p
                      className="text-xs font-bold"
                      style={{ color: coloreSezione(lavoro.sezione, themeColor) }}
                    >
                      {lavoro.sezione}
                    </p>

                    <p className="mt-1 text-sm text-zinc-300">
                      {lavoro.sezione === "H2O"
                        ? "Pausa acqua"
                        : lavoro.descrizione ||
                          "Senza descrizione"}
                    </p>

                    <p className="mt-1 text-xs text-zinc-500">
                      {lavoro.tempo_totale ?? 0} min
                    </p>
                  </div>
                ))}
              </div>
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
        </aside>
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

function SelectField({
  label,
  value,
  options,
  onChange,
  themeColor,
}: {
  label: string;
  value: string;
  options: string[];
  onChange: (value: string) => void;
  themeColor?: string;
}) {
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
  rpe: number | null;
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