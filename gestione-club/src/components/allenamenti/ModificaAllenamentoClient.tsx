"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { Droplets, Loader2, Plus, Save, Trash2, ArrowLeft, Users } from "lucide-react";

import {
  aggiornaAllenamento,
  eliminaAllenamento,
} from "@/app/(dashboard)/allenamenti/[id]/actions";
import { DateInput } from "@/components/ui/DateInput";

const SEZIONI = [
  "Analisi Video / Riunioni",
  "ATTIVAZIONE / RISCALDAMENTO",
  "LAVORO TECNICO-TATTICO",
  "REPARTO",
  "SITUAZIONI DI GIOCO / MATCH",
  "PALESTRA",
  "COOL-DOWN / DEFATICAMENTO",
  "H2O",
];

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

const RANGHI = [
  "Individuale",
  "Mini Unit (3-5)",
  "Unit (5-10)",
  "Collettivo Parziale",
  "Collettivo Totale",
];

const COLORE_H2O = "#38bdf8";

function isSezioneH2O(sezione: string) {
  return sezione.trim().toUpperCase() === "H2O";
}

function coloreSezione(sezione: string, themeColor: string) {
  return isSezioneH2O(sezione) ? COLORE_H2O : themeColor;
}

function calcolaTempoTotale(lavoro: {
  sezione: string;
  tempo_lavoro: string;
  ripetizione: string;
  tempo_recupero: string;
  tempo_totale: string;
}) {
  if (isSezioneH2O(lavoro.sezione)) {
    return Number(lavoro.tempo_totale) || 0;
  }

  const tempoLavoro = Number(lavoro.tempo_lavoro) || 0;
  const ripetizioni = Number(lavoro.ripetizione) || 0;
  const recupero = Number(lavoro.tempo_recupero) || 0;

  if (ripetizioni <= 0) return 0;
  if (ripetizioni === 1) return tempoLavoro;

  return tempoLavoro * ripetizioni + recupero * (ripetizioni - 1);
}

function generaId() {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
    return crypto.randomUUID();
  }

  return `lavoro-${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

type Allenamento = {
  id: string;
  titolo: string | null;
  data_allenamento: string;
  tipo_allenamento: string | null;
  ora_inizio: string | null;
  ora_fine: string | null;
  luogo: string | null;
  obiettivo: string | null;
  note: string | null;
};

type Lavoro = {
  id: string;
  allenamento_id: string;
  sezione: string;
  descrizione: string | null;
  obbiettivo: string | null;
  obbiettivo_tag: string | null;
  rango: string | null;
  immagine_lavoro: string | null;
  tempo_lavoro: number | null;
  ripetizione: number | null;
  tempo_recupero: number | null;
  tempo_totale: number | null;
  contemporaneo: boolean | null;
  gruppo_contemporaneo: string | null;
  ordine: number | null;
};

type LavoroForm = {
  chiave: string;
  id?: string;
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
  contemporaneo: boolean;
  gruppo_id: string | null;
};

type Props = {
  themeColor: string;
  allenamento: Allenamento;
  lavoriIniziali: Lavoro[];
};

function lavoroToForm(lavoro: Lavoro): LavoroForm {
  return {
    chiave: lavoro.id,
    id: lavoro.id,
    sezione: lavoro.sezione ?? "",
    descrizione: lavoro.descrizione ?? "",
    obbiettivo: lavoro.obbiettivo ?? "",
    obbiettivo_tag: lavoro.obbiettivo_tag ?? "",
    rango: lavoro.rango ?? "",
    immagine_lavoro: lavoro.immagine_lavoro ?? "",
    tempo_lavoro: lavoro.tempo_lavoro?.toString() ?? "",
    ripetizione: lavoro.ripetizione?.toString() ?? "",
    tempo_recupero: lavoro.tempo_recupero?.toString() ?? "",
    tempo_totale: lavoro.tempo_totale?.toString() ?? "",
    contemporaneo: Boolean(lavoro.contemporaneo && lavoro.gruppo_contemporaneo),
    gruppo_id:
      lavoro.contemporaneo && lavoro.gruppo_contemporaneo
        ? lavoro.gruppo_contemporaneo
        : null,
  };
}

function lavoroVuoto(sezione = ""): LavoroForm {
  return {
    chiave: generaId(),
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
    contemporaneo: false,
    gruppo_id: null,
  };
}

export default function ModificaAllenamentoClient({
  themeColor,
  allenamento,
  lavoriIniziali,
}: Props) {
  const router = useRouter();

  const [titolo, setTitolo] = useState(allenamento.titolo ?? "");
  const [dataAllenamento, setDataAllenamento] = useState(
    allenamento.data_allenamento ?? ""
  );
  const [tipoAllenamento, setTipoAllenamento] = useState(
    allenamento.tipo_allenamento ?? ""
  );
  const [oraInizio, setOraInizio] = useState(allenamento.ora_inizio ?? "");
  const [oraFine, setOraFine] = useState(allenamento.ora_fine ?? "");
  const [luogo, setLuogo] = useState(allenamento.luogo ?? "");
  const [obiettivo, setObiettivo] = useState(allenamento.obiettivo ?? "");
  const [note, setNote] = useState(allenamento.note ?? "");

  const [lavori, setLavori] = useState<LavoroForm[]>(
    lavoriIniziali.map(lavoroToForm)
  );
  const [lavoriEliminatiIds, setLavoriEliminatiIds] = useState<string[]>([]);

  const [loading, setLoading] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [errore, setErrore] = useState<string | null>(null);

  // Raggruppa i lavori in blocchi: singoli oppure gruppi di lavori
  // contemporanei che condividono lo stesso gruppo_id.
  const blocchiLavori = useMemo(() => {
    const blocchi: { gruppoId: string | null; membri: LavoroForm[] }[] = [];
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

  const minutiTotali = useMemo(() => {
    const gruppiContati = new Set<string>();

    return lavori.reduce((somma, lavoro) => {
      if (lavoro.contemporaneo && lavoro.gruppo_id) {
        if (gruppiContati.has(lavoro.gruppo_id)) return somma;
        gruppiContati.add(lavoro.gruppo_id);
      }

      return somma + calcolaTempoTotale(lavoro);
    }, 0);
  }, [lavori]);

  function aggiornaLavoro(
    chiave: string,
    campo: keyof Omit<LavoroForm, "chiave" | "id" | "gruppo_id" | "contemporaneo">,
    valore: string
  ) {
    setLavori((prev) =>
      prev.map((lavoro) => {
        if (lavoro.chiave !== chiave) return lavoro;

        if (campo === "sezione" && valore.toUpperCase() === "H2O") {
          return {
            ...lavoroVuoto("H2O"),
            chiave: lavoro.chiave,
            id: lavoro.id,
            tempo_totale: lavoro.tempo_totale,
          };
        }

        const aggiornato = { ...lavoro, [campo]: valore };

        if (
          campo === "tempo_lavoro" ||
          campo === "ripetizione" ||
          campo === "tempo_recupero"
        ) {
          aggiornato.tempo_totale = String(calcolaTempoTotale(aggiornato));
        }

        return aggiornato;
      })
    );
  }

  // Aggiorna un campo condiviso (sezione, tempo lavoro, ripetizioni, tempo
  // recupero) su tutti i lavori dello stesso gruppo di contemporaneità.
  function aggiornaCampoGruppo(
    gruppoId: string,
    campo: "sezione" | "tempo_lavoro" | "ripetizione" | "tempo_recupero",
    valore: string
  ) {
    setLavori((prev) =>
      prev.map((lavoro) => {
        if (lavoro.gruppo_id !== gruppoId) return lavoro;

        const aggiornato = { ...lavoro, [campo]: valore };
        aggiornato.tempo_totale = String(calcolaTempoTotale(aggiornato));

        return aggiornato;
      })
    );
  }

  function attivaContemporaneo(chiave: string) {
    const nuovoGruppoId = generaId();

    setLavori((prev) =>
      prev.map((lavoro) =>
        lavoro.chiave === chiave
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
      const riferimento = prev.find((l) => l.gruppo_id === gruppoId);
      if (!riferimento) return prev;

      const nuovo: LavoroForm = {
        ...lavoroVuoto(riferimento.sezione),
        contemporaneo: true,
        gruppo_id: gruppoId,
        tempo_lavoro: riferimento.tempo_lavoro,
        ripetizione: riferimento.ripetizione,
        tempo_recupero: riferimento.tempo_recupero,
        tempo_totale: riferimento.tempo_totale,
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

  function segnaEliminato(lavoro: LavoroForm) {
    if (lavoro.id) {
      setLavoriEliminatiIds((ids) => [...ids, lavoro.id as string]);
    }
  }

  function rimuoviLavoroParallelo(chiave: string) {
    setLavori((prev) => {
      const lavoro = prev.find((l) => l.chiave === chiave);
      if (!lavoro?.gruppo_id) return prev;

      segnaEliminato(lavoro);

      const membriRimanenti = prev.filter(
        (l) => l.gruppo_id === lavoro.gruppo_id && l.chiave !== chiave
      );

      const senzaLavoro = prev.filter((l) => l.chiave !== chiave);

      if (membriRimanenti.length === 1) {
        return senzaLavoro.map((l) =>
          l.chiave === membriRimanenti[0].chiave
            ? { ...l, contemporaneo: false, gruppo_id: null }
            : l
        );
      }

      return senzaLavoro;
    });
  }

  function aggiungiLavoro() {
    setLavori((prev) => [...prev, lavoroVuoto()]);
  }

  function rimuoviLavoro(chiave: string) {
    setLavori((prev) => {
      const lavoro = prev.find((item) => item.chiave === chiave);
      if (lavoro) segnaEliminato(lavoro);

      return prev.filter((item) => item.chiave !== chiave);
    });
  }

  function eliminaGruppo(gruppoId: string) {
    setLavori((prev) => {
      prev
        .filter((l) => l.gruppo_id === gruppoId)
        .forEach((lavoro) => segnaEliminato(lavoro));

      return prev.filter((l) => l.gruppo_id !== gruppoId);
    });
  }

  async function handleSalva() {
    setErrore(null);

    if (!dataAllenamento) {
      setErrore("Inserisci la data dell'allenamento.");
      return;
    }

    const lavoriConSezioneMancante = lavori.some(
      (lavoro) => !lavoro.sezione.trim()
    );

    if (lavoriConSezioneMancante) {
      setErrore("Ogni lavoro deve avere una sezione.");
      return;
    }

    setLoading(true);

    try {
      const res = await aggiornaAllenamento({
        allenamento_id: allenamento.id,
        titolo,
        data_allenamento: dataAllenamento,
        tipo_allenamento: tipoAllenamento,
        ora_inizio: oraInizio || null,
        ora_fine: oraFine || null,
        luogo,
        obiettivo,
        note,
        lavori: lavori.map((lavoro) => ({
          id: lavoro.id,
          sezione: lavoro.sezione.trim(),
          descrizione: lavoro.descrizione || null,
          obbiettivo: lavoro.obbiettivo || null,
          obbiettivo_tag: lavoro.obbiettivo_tag || null,
          rango: lavoro.rango || null,
          immagine_lavoro: lavoro.immagine_lavoro || null,
          tempo_lavoro: lavoro.tempo_lavoro ? Number(lavoro.tempo_lavoro) : null,
          ripetizione: lavoro.ripetizione ? Number(lavoro.ripetizione) : null,
          tempo_recupero: lavoro.tempo_recupero
            ? Number(lavoro.tempo_recupero)
            : null,
          tempo_totale: lavoro.tempo_totale ? Number(lavoro.tempo_totale) : null,
          contemporaneo: lavoro.contemporaneo,
          gruppo_contemporaneo: lavoro.contemporaneo ? lavoro.gruppo_id : null,
        })),
        lavoriEliminatiIds,
      });

      if (!res.success) {
        setErrore(res.message);
        return;
      }

      router.push("/allenamenti");
      router.refresh();
    } catch {
      setErrore("Errore durante il salvataggio dell'allenamento.");
    } finally {
      setLoading(false);
    }
  }

  async function handleElimina() {
    const conferma = window.confirm(
      "Eliminare definitivamente questo allenamento? Verranno eliminati anche i lavori e le presenze collegate. L'operazione non può essere annullata."
    );

    if (!conferma) return;

    setIsDeleting(true);
    setErrore(null);

    try {
      const res = await eliminaAllenamento(allenamento.id);

      if (!res.success) {
        setErrore(res.message);
        return;
      }

      router.push("/allenamenti");
      router.refresh();
    } catch {
      setErrore("Errore durante l'eliminazione dell'allenamento.");
    } finally {
      setIsDeleting(false);
    }
  }

  const tipoAllenamentoStandard =
    tipoAllenamento === "Seduta Mattutina" || tipoAllenamento === "Seduta Serale";

  return (
    <div className="space-y-5 pb-10 sm:space-y-6">
      <div
        className="overflow-hidden rounded-2xl border border-zinc-800 bg-zinc-950 p-4 sm:rounded-3xl sm:p-6"
        style={{ boxShadow: `0 0 40px ${themeColor}18` }}
      >
        <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
          <div className="min-w-0">
            <button
              type="button"
              onClick={() => router.push("/allenamenti")}
              className="mb-3 inline-flex items-center gap-1.5 text-xs font-bold uppercase tracking-widest text-zinc-500 transition hover:text-zinc-300"
            >
              <ArrowLeft className="h-3.5 w-3.5" />
              Torna agli allenamenti
            </button>

            <h1 className="break-words text-2xl font-black leading-tight text-white sm:text-3xl">
              Modifica allenamento
            </h1>

            <p className="mt-2 text-sm leading-6 text-zinc-400">
              Aggiorna i dati generali e i lavori della seduta.
            </p>
          </div>

          <button
            type="button"
            onClick={handleElimina}
            disabled={isDeleting}
            className="inline-flex shrink-0 items-center gap-2 rounded-xl border border-red-500/30 bg-red-500/10 px-3 py-2 text-xs font-bold uppercase tracking-wider text-red-300 transition hover:bg-red-500/20 disabled:cursor-not-allowed disabled:opacity-50"
          >
            <Trash2 className="h-3.5 w-3.5" />
            {isDeleting ? "Eliminazione..." : "Elimina allenamento"}
          </button>
        </div>
      </div>

      <div className="rounded-3xl border border-zinc-800 bg-zinc-950 p-5 sm:p-6">
        <h2 className="mb-4 text-lg font-black text-white">Dati generali</h2>

        <div className="grid gap-4 md:grid-cols-2">
          <Campo label="Titolo">
            <input
              type="text"
              value={titolo}
              onChange={(e) => setTitolo(e.target.value)}
              className="h-12 w-full rounded-2xl border border-zinc-700 bg-zinc-900 px-4 text-sm text-white outline-none focus:ring-2 focus:ring-zinc-600"
            />
          </Campo>

          <Campo label="Tipo allenamento">
            <select
              value={tipoAllenamento}
              onChange={(e) => setTipoAllenamento(e.target.value)}
              className="h-12 w-full rounded-2xl border border-zinc-700 bg-zinc-900 px-4 text-sm text-white outline-none focus:ring-2 focus:ring-zinc-600"
            >
              {!tipoAllenamentoStandard && tipoAllenamento && (
                <option value={tipoAllenamento}>{tipoAllenamento}</option>
              )}
              {!tipoAllenamento && <option value="">Seleziona</option>}
              <option value="Seduta Mattutina">Seduta Mattutina</option>
              <option value="Seduta Serale">Seduta Serale</option>
            </select>
          </Campo>

          <Campo label="Data allenamento">
            <DateInput
              required
              value={dataAllenamento}
              onChange={(v) => setDataAllenamento(v)}
              wrapperClassName="h-12 rounded-2xl border-zinc-700 bg-zinc-900 focus-within:ring-2 focus-within:ring-zinc-600"
            />
          </Campo>

          <Campo label="Luogo">
            <input
              type="text"
              value={luogo}
              onChange={(e) => setLuogo(e.target.value)}
              className="h-12 w-full rounded-2xl border border-zinc-700 bg-zinc-900 px-4 text-sm text-white outline-none focus:ring-2 focus:ring-zinc-600"
            />
          </Campo>

          <Campo label="Ora inizio">
            <input
              type="time"
              value={oraInizio}
              onChange={(e) => setOraInizio(e.target.value)}
              className="h-12 w-full rounded-2xl border border-zinc-700 bg-zinc-900 px-4 text-sm text-white outline-none focus:ring-2 focus:ring-zinc-600"
            />
          </Campo>

          <Campo label="Ora fine">
            <input
              type="time"
              value={oraFine}
              onChange={(e) => setOraFine(e.target.value)}
              className="h-12 w-full rounded-2xl border border-zinc-700 bg-zinc-900 px-4 text-sm text-white outline-none focus:ring-2 focus:ring-zinc-600"
            />
          </Campo>
        </div>

        <div className="mt-4">
          <Campo label="Obiettivo">
            <textarea
              rows={3}
              value={obiettivo}
              onChange={(e) => setObiettivo(e.target.value)}
              className="w-full resize-none rounded-2xl border border-zinc-700 bg-zinc-900 px-4 py-3 text-sm text-white outline-none focus:ring-2 focus:ring-zinc-600"
            />
          </Campo>
        </div>

        <div className="mt-4">
          <Campo label="Note">
            <textarea
              rows={3}
              value={note}
              onChange={(e) => setNote(e.target.value)}
              className="w-full resize-none rounded-2xl border border-zinc-700 bg-zinc-900 px-4 py-3 text-sm text-white outline-none focus:ring-2 focus:ring-zinc-600"
            />
          </Campo>
        </div>
      </div>

      <div className="rounded-3xl border border-zinc-800 bg-zinc-950 p-5 sm:p-6">
        <div className="mb-4 flex items-center justify-between gap-3">
          <h2 className="text-lg font-black text-white">
            Lavori ({lavori.length}) · {minutiTotali} min totali
          </h2>

          <button
            type="button"
            onClick={aggiungiLavoro}
            className="inline-flex items-center gap-2 rounded-xl px-3 py-2 text-xs font-bold uppercase tracking-wider text-white transition hover:opacity-90"
            style={{ backgroundColor: themeColor }}
          >
            <Plus className="h-3.5 w-3.5" />
            Aggiungi lavoro
          </button>
        </div>

        <div className="space-y-4">
          {lavori.length === 0 && (
            <div className="rounded-2xl border border-dashed border-zinc-700 bg-zinc-900 p-5 text-center text-sm text-zinc-400">
              Nessun lavoro inserito.
            </div>
          )}

          {blocchiLavori.map((blocco) => {
            // Blocco singolo: lavoro normale oppure pausa H2O.
            if (!blocco.gruppoId) {
              const lavoro = blocco.membri[0];
              const h2o = isSezioneH2O(lavoro.sezione);
              const colore = coloreSezione(lavoro.sezione, themeColor);

              return (
                <div
                  key={lavoro.chiave}
                  className="rounded-2xl border border-zinc-800 bg-zinc-900 p-4"
                >
                  <div className="mb-3 flex items-center justify-between gap-3">
                    <p className="flex items-center gap-2 text-xs font-bold uppercase tracking-wide text-zinc-500">
                      {h2o && <Droplets size={14} style={{ color: colore }} />}
                      {h2o ? "Pausa H2O" : "Lavoro"}
                    </p>

                    <button
                      type="button"
                      onClick={() => rimuoviLavoro(lavoro.chiave)}
                      title="Rimuovi lavoro"
                      className="flex h-8 w-8 items-center justify-center rounded-lg text-zinc-400 transition hover:bg-red-500/20 hover:text-red-300"
                    >
                      <Trash2 size={14} />
                    </button>
                  </div>

                  <div className="grid gap-3 md:grid-cols-2">
                    <Campo label="Sezione">
                      <select
                        value={lavoro.sezione}
                        onChange={(e) =>
                          aggiornaLavoro(lavoro.chiave, "sezione", e.target.value)
                        }
                        className="h-11 w-full rounded-xl border bg-zinc-950 px-3 text-sm text-white outline-none focus:ring-2 focus:ring-zinc-600"
                        style={{ borderColor: `${colore}55` }}
                      >
                        <option value="">Seleziona</option>
                        {SEZIONI.map((s) => (
                          <option key={s} value={s}>
                            {s}
                          </option>
                        ))}
                      </select>
                    </Campo>

                    {!h2o && (
                      <Campo label="Obiettivo">
                        <input
                          type="text"
                          value={lavoro.obbiettivo}
                          onChange={(e) =>
                            aggiornaLavoro(
                              lavoro.chiave,
                              "obbiettivo",
                              e.target.value
                            )
                          }
                          className="h-11 w-full rounded-xl border border-zinc-700 bg-zinc-950 px-3 text-sm text-white outline-none focus:ring-2 focus:ring-zinc-600"
                        />
                      </Campo>
                    )}
                  </div>

                  {h2o ? (
                    <div className="mt-3 grid gap-3 grid-cols-2 md:grid-cols-4">
                      <Campo label="Tempo totale (min)">
                        <input
                          type="number"
                          min={0}
                          value={lavoro.tempo_totale}
                          onChange={(e) =>
                            aggiornaLavoro(
                              lavoro.chiave,
                              "tempo_totale",
                              e.target.value
                            )
                          }
                          className="h-11 w-full rounded-xl border border-zinc-700 bg-zinc-950 px-3 text-sm text-white outline-none focus:ring-2 focus:ring-zinc-600"
                        />
                      </Campo>
                    </div>
                  ) : (
                    <>
                      <div className="mt-3">
                        <Campo label="Descrizione">
                          <textarea
                            rows={2}
                            value={lavoro.descrizione}
                            onChange={(e) =>
                              aggiornaLavoro(
                                lavoro.chiave,
                                "descrizione",
                                e.target.value
                              )
                            }
                            className="w-full resize-none rounded-xl border border-zinc-700 bg-zinc-950 px-3 py-2 text-sm text-white outline-none focus:ring-2 focus:ring-zinc-600"
                          />
                        </Campo>
                      </div>

                      <div className="mt-3 grid gap-3 md:grid-cols-2">
                        <Campo label="Obbiettivo Tag">
                          <select
                            value={lavoro.obbiettivo_tag}
                            onChange={(e) =>
                              aggiornaLavoro(
                                lavoro.chiave,
                                "obbiettivo_tag",
                                e.target.value
                              )
                            }
                            className="h-11 w-full rounded-xl border border-zinc-700 bg-zinc-950 px-3 text-sm text-white outline-none focus:ring-2 focus:ring-zinc-600"
                          >
                            <option value="">Seleziona</option>
                            {OBBIETTIVO_TAG.map((tag) => (
                              <option key={tag} value={tag}>
                                {tag}
                              </option>
                            ))}
                          </select>
                        </Campo>

                        <Campo label="Rango">
                          <select
                            value={lavoro.rango}
                            onChange={(e) =>
                              aggiornaLavoro(lavoro.chiave, "rango", e.target.value)
                            }
                            className="h-11 w-full rounded-xl border border-zinc-700 bg-zinc-950 px-3 text-sm text-white outline-none focus:ring-2 focus:ring-zinc-600"
                          >
                            <option value="">Seleziona</option>
                            {RANGHI.map((r) => (
                              <option key={r} value={r}>
                                {r}
                              </option>
                            ))}
                          </select>
                        </Campo>
                      </div>

                      <div className="mt-3">
                        <Campo label="Immagine lavoro">
                          <input
                            type="text"
                            value={lavoro.immagine_lavoro}
                            onChange={(e) =>
                              aggiornaLavoro(
                                lavoro.chiave,
                                "immagine_lavoro",
                                e.target.value
                              )
                            }
                            className="h-11 w-full rounded-xl border border-zinc-700 bg-zinc-950 px-3 text-sm text-white outline-none focus:ring-2 focus:ring-zinc-600"
                          />
                        </Campo>
                      </div>

                      <div className="mt-3 grid gap-3 grid-cols-2 md:grid-cols-4">
                        <Campo label="Tempo lavoro (min)">
                          <input
                            type="number"
                            min={0}
                            value={lavoro.tempo_lavoro}
                            onChange={(e) =>
                              aggiornaLavoro(
                                lavoro.chiave,
                                "tempo_lavoro",
                                e.target.value
                              )
                            }
                            className="h-11 w-full rounded-xl border border-zinc-700 bg-zinc-950 px-3 text-sm text-white outline-none focus:ring-2 focus:ring-zinc-600"
                          />
                        </Campo>

                        <Campo label="Ripetizioni">
                          <input
                            type="number"
                            min={0}
                            value={lavoro.ripetizione}
                            onChange={(e) =>
                              aggiornaLavoro(
                                lavoro.chiave,
                                "ripetizione",
                                e.target.value
                              )
                            }
                            className="h-11 w-full rounded-xl border border-zinc-700 bg-zinc-950 px-3 text-sm text-white outline-none focus:ring-2 focus:ring-zinc-600"
                          />
                        </Campo>

                        <Campo label="Recupero (min)">
                          <input
                            type="number"
                            min={0}
                            value={lavoro.tempo_recupero}
                            onChange={(e) =>
                              aggiornaLavoro(
                                lavoro.chiave,
                                "tempo_recupero",
                                e.target.value
                              )
                            }
                            className="h-11 w-full rounded-xl border border-zinc-700 bg-zinc-950 px-3 text-sm text-white outline-none focus:ring-2 focus:ring-zinc-600"
                          />
                        </Campo>

                        <Campo label="Totale (min)">
                          <div
                            className="flex h-11 w-full items-center rounded-xl border border-zinc-700 bg-zinc-950 px-3 text-sm font-semibold"
                            style={{ color: colore }}
                          >
                            {calcolaTempoTotale(lavoro)} min
                          </div>
                        </Campo>
                      </div>

                      <label className="mt-3 flex items-center gap-2 text-sm text-zinc-400">
                        <input
                          type="checkbox"
                          checked={false}
                          onChange={() => attivaContemporaneo(lavoro.chiave)}
                          className="h-4 w-4 rounded border-zinc-700 bg-zinc-950"
                        />
                        Lavoro in contemporanea (più gruppi che lavorano nello
                        stesso momento)
                      </label>
                    </>
                  )}
                </div>
              );
            }

            // Blocco di lavori contemporanei.
            const gruppoId = blocco.gruppoId;
            const membri = blocco.membri;
            const riferimento = membri[0];
            const coloreGruppo = coloreSezione(riferimento.sezione, themeColor);

            return (
              <div
                key={gruppoId}
                className="rounded-2xl border border-zinc-800 bg-zinc-900 p-4"
              >
                <div className="mb-3 flex items-center justify-between gap-3">
                  <p className="flex items-center gap-2 text-xs font-bold uppercase tracking-wide text-zinc-500">
                    <Users size={14} style={{ color: coloreGruppo }} />
                    Gruppo in contemporanea ({membri.length})
                  </p>

                  <button
                    type="button"
                    onClick={() => eliminaGruppo(gruppoId)}
                    title="Elimina gruppo"
                    className="flex h-8 w-8 items-center justify-center rounded-lg text-zinc-400 transition hover:bg-red-500/20 hover:text-red-300"
                  >
                    <Trash2 size={14} />
                  </button>
                </div>

                <div className="mb-4 rounded-xl border border-zinc-800 bg-zinc-950/60 p-3">
                  <div className="mb-3">
                    <Campo label="Sezione (condivisa dal gruppo)">
                      <select
                        value={riferimento.sezione}
                        onChange={(e) =>
                          aggiornaCampoGruppo(gruppoId, "sezione", e.target.value)
                        }
                        className="h-11 w-full rounded-xl border bg-zinc-950 px-3 text-sm text-white outline-none focus:ring-2 focus:ring-zinc-600"
                        style={{ borderColor: `${coloreGruppo}55` }}
                      >
                        <option value="">Seleziona</option>
                        {SEZIONI.filter((s) => s !== "H2O").map((s) => (
                          <option key={s} value={s}>
                            {s}
                          </option>
                        ))}
                      </select>
                    </Campo>
                  </div>

                  <div className="grid gap-3 grid-cols-2 md:grid-cols-4">
                    <Campo label="Tempo lavoro (min)">
                      <input
                        type="number"
                        min={0}
                        value={riferimento.tempo_lavoro}
                        onChange={(e) =>
                          aggiornaCampoGruppo(
                            gruppoId,
                            "tempo_lavoro",
                            e.target.value
                          )
                        }
                        className="h-11 w-full rounded-xl border border-zinc-700 bg-zinc-950 px-3 text-sm text-white outline-none focus:ring-2 focus:ring-zinc-600"
                      />
                    </Campo>

                    <Campo label="Ripetizioni">
                      <input
                        type="number"
                        min={0}
                        value={riferimento.ripetizione}
                        onChange={(e) =>
                          aggiornaCampoGruppo(
                            gruppoId,
                            "ripetizione",
                            e.target.value
                          )
                        }
                        className="h-11 w-full rounded-xl border border-zinc-700 bg-zinc-950 px-3 text-sm text-white outline-none focus:ring-2 focus:ring-zinc-600"
                      />
                    </Campo>

                    <Campo label="Recupero (min)">
                      <input
                        type="number"
                        min={0}
                        value={riferimento.tempo_recupero}
                        onChange={(e) =>
                          aggiornaCampoGruppo(
                            gruppoId,
                            "tempo_recupero",
                            e.target.value
                          )
                        }
                        className="h-11 w-full rounded-xl border border-zinc-700 bg-zinc-950 px-3 text-sm text-white outline-none focus:ring-2 focus:ring-zinc-600"
                      />
                    </Campo>

                    <Campo label="Totale (min)">
                      <div
                        className="flex h-11 w-full items-center rounded-xl border border-zinc-700 bg-zinc-950 px-3 text-sm font-semibold"
                        style={{ color: coloreGruppo }}
                      >
                        {calcolaTempoTotale(riferimento)} min
                      </div>
                    </Campo>
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

                <div className="space-y-3">
                  {membri.map((membro, indice) => (
                    <div
                      key={membro.chiave}
                      className="rounded-xl border border-zinc-800 bg-zinc-950 p-3"
                    >
                      <div className="mb-2 flex items-center justify-between gap-3">
                        <p className="text-xs font-bold uppercase tracking-wide text-zinc-500">
                          Gruppo {indice + 1}
                        </p>

                        {membri.length > 1 && (
                          <button
                            type="button"
                            onClick={() => rimuoviLavoroParallelo(membro.chiave)}
                            title="Rimuovi questo lavoro parallelo"
                            className="flex h-7 w-7 items-center justify-center rounded-lg text-zinc-400 transition hover:bg-red-500/20 hover:text-red-300"
                          >
                            <Trash2 size={13} />
                          </button>
                        )}
                      </div>

                      <div className="grid gap-3 md:grid-cols-2">
                        <div className="md:col-span-2">
                          <Campo label="Descrizione">
                            <textarea
                              rows={2}
                              value={membro.descrizione}
                              onChange={(e) =>
                                aggiornaLavoro(
                                  membro.chiave,
                                  "descrizione",
                                  e.target.value
                                )
                              }
                              className="w-full resize-none rounded-xl border border-zinc-700 bg-zinc-900 px-3 py-2 text-sm text-white outline-none focus:ring-2 focus:ring-zinc-600"
                            />
                          </Campo>
                        </div>

                        <Campo label="Obiettivo">
                          <input
                            type="text"
                            value={membro.obbiettivo}
                            onChange={(e) =>
                              aggiornaLavoro(
                                membro.chiave,
                                "obbiettivo",
                                e.target.value
                              )
                            }
                            className="h-11 w-full rounded-xl border border-zinc-700 bg-zinc-900 px-3 text-sm text-white outline-none focus:ring-2 focus:ring-zinc-600"
                          />
                        </Campo>

                        <Campo label="Obbiettivo Tag">
                          <select
                            value={membro.obbiettivo_tag}
                            onChange={(e) =>
                              aggiornaLavoro(
                                membro.chiave,
                                "obbiettivo_tag",
                                e.target.value
                              )
                            }
                            className="h-11 w-full rounded-xl border border-zinc-700 bg-zinc-900 px-3 text-sm text-white outline-none focus:ring-2 focus:ring-zinc-600"
                          >
                            <option value="">Seleziona</option>
                            {OBBIETTIVO_TAG.map((tag) => (
                              <option key={tag} value={tag}>
                                {tag}
                              </option>
                            ))}
                          </select>
                        </Campo>

                        <Campo label="Rango">
                          <select
                            value={membro.rango}
                            onChange={(e) =>
                              aggiornaLavoro(membro.chiave, "rango", e.target.value)
                            }
                            className="h-11 w-full rounded-xl border border-zinc-700 bg-zinc-900 px-3 text-sm text-white outline-none focus:ring-2 focus:ring-zinc-600"
                          >
                            <option value="">Seleziona</option>
                            {RANGHI.map((r) => (
                              <option key={r} value={r}>
                                {r}
                              </option>
                            ))}
                          </select>
                        </Campo>

                        <Campo label="Immagine lavoro">
                          <input
                            type="text"
                            value={membro.immagine_lavoro}
                            onChange={(e) =>
                              aggiornaLavoro(
                                membro.chiave,
                                "immagine_lavoro",
                                e.target.value
                              )
                            }
                            className="h-11 w-full rounded-xl border border-zinc-700 bg-zinc-900 px-3 text-sm text-white outline-none focus:ring-2 focus:ring-zinc-600"
                          />
                        </Campo>
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
        </div>
      </div>

      {errore && (
        <div className="rounded-2xl border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm font-medium text-red-300">
          {errore}
        </div>
      )}

      <div className="flex items-center justify-end gap-3">
        <button
          type="button"
          onClick={() => router.push("/allenamenti")}
          disabled={loading}
          className="rounded-2xl border border-zinc-700 bg-zinc-950 px-5 py-2.5 text-sm font-semibold text-zinc-300"
        >
          Annulla
        </button>

        <button
          type="button"
          onClick={handleSalva}
          disabled={loading}
          className="inline-flex items-center justify-center gap-2 rounded-2xl px-5 py-2.5 text-sm font-semibold text-white disabled:opacity-60"
          style={{ backgroundColor: themeColor }}
        >
          {loading ? (
            <Loader2 size={17} className="animate-spin" />
          ) : (
            <Save size={17} />
          )}
          {loading ? "Salvataggio..." : "Salva modifiche"}
        </button>
      </div>
    </div>
  );
}

function Campo({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div>
      <label className="mb-2 block text-sm font-semibold text-zinc-300">
        {label}
      </label>

      {children}
    </div>
  );
}
