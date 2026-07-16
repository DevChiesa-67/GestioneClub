"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { Loader2, Plus, Save, Trash2, ArrowLeft } from "lucide-react";

import {
  aggiornaAllenamento,
  eliminaAllenamento,
} from "@/app/(dashboard)/allenamenti/[id]/actions";

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
  tempo_lavoro: number | null;
  ripetizione: number | null;
  tempo_recupero: number | null;
  tempo_totale: number | null;
  ordine: number | null;
};

type LavoroForm = {
  chiave: string;
  id?: string;
  sezione: string;
  descrizione: string;
  obbiettivo: string;
  tempo_lavoro: string;
  ripetizione: string;
  tempo_recupero: string;
  tempo_totale: string;
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
    tempo_lavoro: lavoro.tempo_lavoro?.toString() ?? "",
    ripetizione: lavoro.ripetizione?.toString() ?? "",
    tempo_recupero: lavoro.tempo_recupero?.toString() ?? "",
    tempo_totale: lavoro.tempo_totale?.toString() ?? "",
  };
}

function lavoroVuoto(): LavoroForm {
  return {
    chiave: crypto.randomUUID(),
    sezione: "",
    descrizione: "",
    obbiettivo: "",
    tempo_lavoro: "",
    ripetizione: "",
    tempo_recupero: "",
    tempo_totale: "",
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

  const minutiTotali = useMemo(() => {
    return lavori.reduce(
      (somma, lavoro) => somma + (Number(lavoro.tempo_totale) || 0),
      0
    );
  }, [lavori]);

  function aggiornaLavoro(
    chiave: string,
    campo: keyof Omit<LavoroForm, "chiave" | "id">,
    valore: string
  ) {
    setLavori((prev) =>
      prev.map((lavoro) => {
        if (lavoro.chiave !== chiave) return lavoro;

        const aggiornato = { ...lavoro, [campo]: valore };

        if (campo === "tempo_lavoro" || campo === "ripetizione") {
          const tempoLavoro = Number(
            campo === "tempo_lavoro" ? valore : lavoro.tempo_lavoro
          ) || 0;
          const ripetizione = Number(
            campo === "ripetizione" ? valore : lavoro.ripetizione
          ) || 0;

          if (tempoLavoro > 0 && ripetizione > 0) {
            aggiornato.tempo_totale = String(tempoLavoro * ripetizione);
          }
        }

        return aggiornato;
      })
    );
  }

  function aggiungiLavoro() {
    setLavori((prev) => [...prev, lavoroVuoto()]);
  }

  function rimuoviLavoro(chiave: string) {
    setLavori((prev) => {
      const lavoro = prev.find((item) => item.chiave === chiave);

      if (lavoro?.id) {
        setLavoriEliminatiIds((ids) => [...ids, lavoro.id as string]);
      }

      return prev.filter((item) => item.chiave !== chiave);
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
          tempo_lavoro: lavoro.tempo_lavoro ? Number(lavoro.tempo_lavoro) : null,
          ripetizione: lavoro.ripetizione ? Number(lavoro.ripetizione) : null,
          tempo_recupero: lavoro.tempo_recupero
            ? Number(lavoro.tempo_recupero)
            : null,
          tempo_totale: lavoro.tempo_totale ? Number(lavoro.tempo_totale) : null,
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
      "Eliminare definitivamente questo allenamento? Verranno eliminati anche i lavori e le presenze collegate. L'operazione non è reversibile."
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
            <input
              type="text"
              value={tipoAllenamento}
              onChange={(e) => setTipoAllenamento(e.target.value)}
              className="h-12 w-full rounded-2xl border border-zinc-700 bg-zinc-900 px-4 text-sm text-white outline-none focus:ring-2 focus:ring-zinc-600"
            />
          </Campo>

          <Campo label="Data allenamento">
            <input
              type="date"
              required
              value={dataAllenamento}
              onChange={(e) => setDataAllenamento(e.target.value)}
              className="h-12 w-full rounded-2xl border border-zinc-700 bg-zinc-900 px-4 text-sm text-white outline-none focus:ring-2 focus:ring-zinc-600"
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

          {lavori.map((lavoro) => (
            <div
              key={lavoro.chiave}
              className="rounded-2xl border border-zinc-800 bg-zinc-900 p-4"
            >
              <div className="mb-3 flex items-center justify-between gap-3">
                <p className="text-xs font-bold uppercase tracking-wide text-zinc-500">
                  Lavoro
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
                  <input
                    type="text"
                    required
                    value={lavoro.sezione}
                    onChange={(e) =>
                      aggiornaLavoro(lavoro.chiave, "sezione", e.target.value)
                    }
                    className="h-11 w-full rounded-xl border border-zinc-700 bg-zinc-950 px-3 text-sm text-white outline-none focus:ring-2 focus:ring-zinc-600"
                  />
                </Campo>

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
              </div>

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
            </div>
          ))}
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
