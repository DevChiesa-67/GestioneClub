"use client";

import { useState } from "react";
import { X, Save, Loader2 } from "lucide-react";

import { modificaDettagliPartita } from "@/app/(dashboard)/partite/[id]/actions";

export type SquadraPartitaOption = {
  id: string;
  nome: string;
  abbreviazione: string | null;
  logo_path: string | null;
};

type TipoPartita = "amichevole" | "campionato" | "barrage";

const TIPI_PARTITA: { value: TipoPartita; label: string }[] = [
  { value: "amichevole", label: "Amichevole" },
  { value: "campionato", label: "Campionato" },
  { value: "barrage", label: "Barrage" },
];

type Props = {
  open: boolean;
  onClose: () => void;
  onSaved: () => void;
  brand: string;
  partitaId: string;
  squadre: SquadraPartitaOption[];
  valoriIniziali: {
    squadra_casa_id: string;
    squadra_fuori_id: string;
    data_partita: string;
    ora_partita: string;
    luogo: string;
    tipo_partita: string;
    note: string;
  };
};

export default function ModificaDettagliPartitaModal({
  open,
  onClose,
  onSaved,
  brand,
  partitaId,
  squadre,
  valoriIniziali,
}: Props) {
  const [loading, setLoading] = useState(false);
  const [errore, setErrore] = useState<string | null>(null);

  const [squadraCasaId, setSquadraCasaId] = useState(
    valoriIniziali.squadra_casa_id
  );
  const [squadraFuoriId, setSquadraFuoriId] = useState(
    valoriIniziali.squadra_fuori_id
  );
  const [dataPartita, setDataPartita] = useState(valoriIniziali.data_partita);
  const [oraPartita, setOraPartita] = useState(valoriIniziali.ora_partita);
  const [luogo, setLuogo] = useState(valoriIniziali.luogo);
  const [tipoPartita, setTipoPartita] = useState<string>(
    valoriIniziali.tipo_partita
  );
  const [note, setNote] = useState(valoriIniziali.note);

  if (!open) return null;

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();

    if (!squadraCasaId || !squadraFuoriId) {
      setErrore("Seleziona entrambe le squadre.");
      return;
    }

    if (squadraCasaId === squadraFuoriId) {
      setErrore("Le due squadre devono essere diverse.");
      return;
    }

    setLoading(true);
    setErrore(null);

    try {
      await modificaDettagliPartita({
        partita_id: partitaId,
        squadra_casa_id: squadraCasaId,
        squadra_fuori_id: squadraFuoriId,
        data_partita: dataPartita,
        ora_partita: oraPartita,
        luogo,
        tipo_partita: tipoPartita,
        note,
      });

      onSaved();
      onClose();
    } catch (error) {
      setErrore(
        error instanceof Error
          ? error.message
          : "Errore durante il salvataggio dei dettagli."
      );
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/55 p-4 backdrop-blur-[2px]">
      <div className="max-h-[92vh] w-full max-w-2xl overflow-y-auto rounded-3xl bg-zinc-950 shadow-2xl">
        <div
          className="flex items-center justify-between px-6 py-5 text-white"
          style={{ backgroundColor: brand }}
        >
          <div>
            <h2 className="text-lg font-bold">Modifica dettagli partita</h2>
            <p className="mt-1 text-sm text-white/75">
              Aggiorna squadre, data, ora, luogo e tipo partita.
            </p>
          </div>

          <button
            type="button"
            onClick={onClose}
            disabled={loading}
            className="flex h-9 w-9 items-center justify-center rounded-xl text-white transition hover:bg-black/15 disabled:opacity-50"
          >
            <X size={20} />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-5 bg-zinc-950 p-6">
          <div className="grid gap-4 md:grid-cols-2">
            <div>
              <label className="mb-2 block text-sm font-semibold text-zinc-300">
                Squadra 1
              </label>

              <select
                value={squadraCasaId}
                onChange={(e) => setSquadraCasaId(e.target.value)}
                className="h-12 w-full rounded-2xl border border-zinc-700 bg-zinc-900 px-4 text-sm text-white outline-none focus:ring-2 focus:ring-zinc-600"
              >
                <option value="">Seleziona squadra</option>

                {squadre.map((squadra) => (
                  <option key={squadra.id} value={squadra.id}>
                    {squadra.nome}
                    {squadra.abbreviazione ? ` (${squadra.abbreviazione})` : ""}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="mb-2 block text-sm font-semibold text-zinc-300">
                Squadra 2
              </label>

              <select
                value={squadraFuoriId}
                onChange={(e) => setSquadraFuoriId(e.target.value)}
                className="h-12 w-full rounded-2xl border border-zinc-700 bg-zinc-900 px-4 text-sm text-white outline-none focus:ring-2 focus:ring-zinc-600"
              >
                <option value="">Seleziona squadra</option>

                {squadre.map((squadra) => (
                  <option key={squadra.id} value={squadra.id}>
                    {squadra.nome}
                    {squadra.abbreviazione ? ` (${squadra.abbreviazione})` : ""}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div className="grid gap-4 md:grid-cols-2">
            <div>
              <label className="mb-2 block text-sm font-semibold text-zinc-300">
                Data partita
              </label>

              <input
                type="date"
                required
                value={dataPartita}
                onChange={(e) => setDataPartita(e.target.value)}
                className="h-12 w-full rounded-2xl border border-zinc-700 bg-zinc-900 px-4 text-sm text-white outline-none focus:ring-2 focus:ring-zinc-600"
              />
            </div>

            <div>
              <label className="mb-2 block text-sm font-semibold text-zinc-300">
                Ora partita
              </label>

              <input
                type="time"
                required
                value={oraPartita}
                onChange={(e) => setOraPartita(e.target.value)}
                className="h-12 w-full rounded-2xl border border-zinc-700 bg-zinc-900 px-4 text-sm text-white outline-none focus:ring-2 focus:ring-zinc-600"
              />
            </div>
          </div>

          <div>
            <label className="mb-2 block text-sm font-semibold text-zinc-300">
              Luogo
            </label>

            <input
              type="text"
              value={luogo}
              onChange={(e) => setLuogo(e.target.value)}
              placeholder="Campo / indirizzo"
              className="h-12 w-full rounded-2xl border border-zinc-700 bg-zinc-900 px-4 text-sm text-white outline-none focus:ring-2 focus:ring-zinc-600"
            />
          </div>

          <div>
            <label className="mb-2 block text-sm font-semibold text-zinc-300">
              Tipo partita
            </label>

            <div className="flex flex-wrap gap-3">
              {TIPI_PARTITA.map((tipo) => {
                const active = tipoPartita === tipo.value;

                return (
                  <button
                    key={tipo.value}
                    type="button"
                    onClick={() => setTipoPartita(tipo.value)}
                    className="rounded-xl border px-4 py-2 text-sm font-bold text-white transition hover:opacity-90"
                    style={{
                      borderColor: active ? brand : `${brand}35`,
                      backgroundColor: active ? brand : `${brand}12`,
                    }}
                  >
                    {tipo.label}
                  </button>
                );
              })}
            </div>
          </div>

          <div>
            <label className="mb-2 block text-sm font-semibold text-zinc-300">
              Note
            </label>

            <textarea
              rows={3}
              value={note}
              onChange={(e) => setNote(e.target.value)}
              placeholder="Note sulla partita..."
              className="w-full resize-none rounded-2xl border border-zinc-700 bg-zinc-900 px-4 py-3 text-sm text-white outline-none focus:ring-2 focus:ring-zinc-600"
            />
          </div>

          {errore && (
            <div className="rounded-2xl border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm font-medium text-red-300">
              {errore}
            </div>
          )}

          <div className="flex items-center justify-end gap-3 border-t border-zinc-800 pt-5">
            <button
              type="button"
              onClick={onClose}
              disabled={loading}
              className="rounded-2xl border border-zinc-700 bg-zinc-950 px-5 py-2.5 text-sm font-semibold text-zinc-300"
            >
              Annulla
            </button>

            <button
              type="submit"
              disabled={loading}
              className="inline-flex items-center justify-center gap-2 rounded-2xl px-5 py-2.5 text-sm font-semibold text-white disabled:opacity-60"
              style={{ backgroundColor: brand }}
            >
              {loading ? (
                <Loader2 size={17} className="animate-spin" />
              ) : (
                <Save size={17} />
              )}
              {loading ? "Salvataggio..." : "Salva dettagli"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
