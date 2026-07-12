"use client";

import { useEffect, useMemo, useState } from "react";
import { X, Plus, Trash2, Save, Droplets } from "lucide-react";
import { AppCard } from "@/components/ui/AppCard";
import { supabase } from "@/lib/supabase-client";
import { useToast } from "@/components/ui/Toast";

type TipoAllenamento = "Mattina + Palestra" | "Sessione Campo";

type AllenamentoPrecedente = {
  id: string;
  titolo: string;
  data_allenamento: string;
  tipo_allenamento: string | null;
};
type SedutaProgrammataRow = {
  tema: string | null;
  rpe: number | null;
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
  fase: string | null;
  tema: string | null;
  rpe: number | null;
  coloreFase: string | null;
};
const RANGHI = [
  "Individuale",
  "Mini Unit (3-5)",
  "Unit (5-10)",
  "Collettivo Parziale",
  "Collettivo Totale",
];

const SEZIONI: Record<TipoAllenamento, string[]> = {
  "Mattina + Palestra": [
    "ALLENAMENTO MATTUTINO",
    "PALESTRA SERALE",
    "H2O",
  ],
  "Sessione Campo": [
    "Analisi Video/ Riunioni",
    "ATTIVAZIONE / RISCALDAMENTO",
    "LAVORO TECNICO-TATTICO",
    "REPARTO",
    "SITUAZIONI DI GIOCO / MATCH",
    "COOL-DOWN / DEFATICAMENTO",
    "H2O",
  ],
};
function isLavoroH2O(lavoro: Lavoro) {
  return lavoro.sezione.trim().toUpperCase() === "H2O";
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
  const [tipo, setTipo] = useState<TipoAllenamento>("Sessione Campo");
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
    fase: null,
    tema: null,
    rpe: null,
    coloreFase: null,
  });


  const [allenamentiSettimana, setAllenamentiSettimana] = useState<
    AllenamentoPrecedente[]
  >([]);

  const [lavori, setLavori] = useState<Lavoro[]>([]);

  

  const riepilogoSezioni = useMemo(() => {
    const mappa = new Map<
      string,
      {
        sezione: string;
        minuti: number;
        esercizi: number;
      }
    >();

    lavori.forEach((lavoro) => {
      const sezione = lavoro.sezione || "Senza sezione";
      const corrente = mappa.get(sezione);

      if (corrente) {
        corrente.minuti += calcolaTempoTotale(lavoro);
        corrente.esercizi += 1;
      } else {
        mappa.set(sezione, {
          sezione,
          minuti: calcolaTempoTotale(lavoro),
          esercizi: 1,
        });
      }
    });

    return Array.from(mappa.values());
  }, [lavori]);

  const totaleMinuti = useMemo(() => {
    return lavori.reduce(
      (totale, lavoro) => totale + calcolaTempoTotale(lavoro),
      0
    );
  }, [lavori]);

  function cambiaTipoAllenamento(nuovoTipo: TipoAllenamento) {
    setTipo(nuovoTipo);
    setLavori([]);
  }

  function aggiungiLavoro() {
    setLavori((prev) => [...prev, creaLavoroVuoto()]);
  }

  function aggiornaLavoro(
    index: number,
    campo: keyof Lavoro,
    valore: string
  ) {
    setLavori((prev) =>
      prev.map((lavoro, i) => {
        if (i !== index) return lavoro;

        if (campo === "sezione" && valore.toUpperCase() === "H2O") {
          return {
            ...creaLavoroVuoto("H2O"),
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

  function eliminaLavoro(index: number) {
    setLavori((prev) => prev.filter((_, i) => i !== index));
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
  const { data: sedutaProgrammata } = await supabase
  .from("programmazione_sedute")
  .select("tema,rpe,fase_id")
  .eq("club_id", profilo.last_club_id)
  .eq("squadra_id", profilo.last_squadra_id)
  .eq("data_seduta", dataAllenamento)
  .maybeSingle<SedutaProgrammataRow>();

if (sedutaProgrammata?.fase_id) {
  const { data: faseProgrammazione } = await supabase
    .from("programmazione_fasi")
    .select("nome,colore,programmazione_id")
    .eq("id", sedutaProgrammata.fase_id)
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
    fase: faseProgrammazione?.nome ?? null,
    tema: sedutaProgrammata.tema ?? null,
    rpe: sedutaProgrammata.rpe ?? null,
    coloreFase: faseProgrammazione?.colore ?? null,
  });
} else {
  setDettagliProgrammazione({
    programmazione: null,
    fase: null,
    tema: null,
    rpe: null,
    coloreFase: null,
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

                <input
                  type="date"
                  value={dataAllenamento}
                  onChange={(e) =>
                    setDataAllenamento(e.target.value)
                  }
                  max="2100-12-31"
                  className="w-full rounded-xl border bg-zinc-900 px-4 py-3 text-base text-white outline-none transition dark:[color-scheme:dark]"
                  style={{
                    borderColor: `${themeColor}55`,
                  }}
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
                  <option value="Mattina + Palestra">
                    Mattina + Palestra
                  </option>

                  <option value="Sessione Campo">
                    Sessione Campo
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
                {lavori.map((lavoro, index) => {
                  const h2o = isLavoroH2O(lavoro);

                  return (
                    <div
                      key={index}
                      className="py-5 first:pt-0 last:pb-0 sm:py-6"
                    >
                      <div className="mb-4 flex items-start justify-between gap-3">
                        <div className="flex items-center gap-3">
                          <div
                            className="flex h-9 w-9 items-center justify-center rounded-xl text-sm font-black"
                            style={{
                              backgroundColor: `${themeColor}18`,
                              color: themeColor,
                            }}
                          >
                            {h2o ? (
                              <Droplets size={18} />
                            ) : (
                              index + 1
                            )}
                          </div>

                          <div>
                            <p className="text-sm font-bold text-white">
                              {h2o
                                ? "Pausa H2O"
                                : `Lavoro ${index + 1}`}
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
                          onClick={() => eliminaLavoro(index)}
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
                          options={SEZIONI[tipo]}
                          onChange={(value) =>
                            aggiornaLavoro(
                              index,
                              "sezione",
                              value
                            )
                          }
                          themeColor={themeColor}
                        />
                      </div>

                      {h2o ? (
                        <div
                          className="rounded-2xl border p-4"
                          style={{
                            borderColor: `${themeColor}35`,
                            backgroundColor: `${themeColor}0D`,
                          }}
                        >
                          <div className="flex items-center gap-3">
                            <div
                              className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl"
                              style={{
                                backgroundColor: `${themeColor}20`,
                                color: themeColor,
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
                                    index,
                                    "tempo_totale",
                                    e.target.value
                                  )
                                }
                                placeholder="Es. 3"
                                className="w-full rounded-xl border bg-zinc-950 px-3 py-2.5 text-white outline-none"
                                style={{
                                  borderColor: `${themeColor}55`,
                                }}
                              />
                            </div>

                            <span
                              className="mt-6 shrink-0 text-sm font-bold"
                              style={{ color: themeColor }}
                            >
                              min
                            </span>
                          </div>
                        </div>
                      ) : (
                        <div className="grid gap-3 sm:gap-4 md:grid-cols-2">
                          <div className="md:col-span-2">
                            <label className="mb-1 block text-sm text-zinc-400">
                              Descrizione
                            </label>

                            <textarea
                              value={lavoro.descrizione}
                              onChange={(e) =>
                                aggiornaLavoro(
                                  index,
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
                              aggiornaLavoro(
                                index,
                                "obbiettivo",
                                value
                              )
                            }
                          />

                          <SelectField
                            label="Obbiettivo Tag"
                            value={lavoro.obbiettivo_tag}
                            options={OBBIETTIVO_TAG}
                            onChange={(value) =>
                              aggiornaLavoro(
                                index,
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
                              aggiornaLavoro(
                                index,
                                "rango",
                                value
                              )
                            }
                          />

                          <InputField
                            label="Immagine lavoro"
                            value={lavoro.immagine_lavoro}
                            onChange={(value) =>
                              aggiornaLavoro(
                                index,
                                "immagine_lavoro",
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
                                index,
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
                                index,
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
                                index,
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
                              style={{ color: themeColor }}
                            >
                              {calcolaTempoTotale(lavoro)} min
                            </div>
                          </div>
                        </div>
                      )}
                    </div>
                  );
                })} <button
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
      label="Fase"
      value={dettagliProgrammazione.fase ?? "Non trovata"}
    />

    <SidebarRow
      label="Tema tecnico/tattico"
      value={dettagliProgrammazione.tema ?? "Non definito"}
    />

    <RpeRow
      rpe={dettagliProgrammazione.rpe}
      colore={
        dettagliProgrammazione.coloreFase ||
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

              {riepilogoSezioni.map((item) => (
                <div
                  key={item.sezione}
                  className="rounded-xl border border-zinc-800 bg-zinc-950 p-3"
                >
                  <p className="text-sm font-semibold text-white">
                    {item.sezione}
                  </p>

                  <p className="mt-1 text-xs text-zinc-400">
                    {item.minuti} min · {item.esercizi}{" "}
                    {item.sezione === "H2O"
                      ? "pause"
                      : "lavori"}
                  </p>
                </div>
              ))}
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
                    {allenamentoPrecedente.data_allenamento}
                  </p>
                </div>

                {lavoriPrecedenti.map((lavoro) => (
                  <div
                    key={lavoro.id}
                    className="rounded-xl border border-zinc-800 bg-zinc-950 p-3"
                  >
                    <p
                      className="text-xs font-bold"
                      style={{ color: themeColor }}
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
                    {allenamento.data_allenamento}
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
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  type?: string;
}) {
  return (
    <div>
      <label className="mb-1 block text-sm text-zinc-400">
        {label}
      </label>

      <input
        type={type}
        value={value}
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
    "#06b6d4",
    "#6366f1",
    "#a855f7",
  ];

  const gradient = sections
    .filter((section) => section.minuti > 0)
    .reduce(
      (acc, section, index) => {
        const percentage =
          (section.minuti / totale) * 100;

        const start = acc.progress;
        const end = start + percentage;

        return {
          progress: end,
          values: [
            ...acc.values,
            `${colors[index % colors.length]} ${start}% ${end}%`,
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
        {sections
          .filter((section) => section.minuti > 0)
          .map((section, index) => (
            <div
              key={section.sezione}
              className="flex items-center gap-2 text-xs"
            >
              <span
                className="h-3 w-3 rounded-full"
                style={{
                  backgroundColor:
                    colors[index % colors.length],
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