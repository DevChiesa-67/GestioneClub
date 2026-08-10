"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Plus, X } from "lucide-react";
import { DateInput } from "@/components/ui/DateInput";
import { creaEvento, creaTipoEvento } from "@/app/(dashboard)/eventi/actions";
import type { TipoEvento } from "@/app/(dashboard)/partite/page";

type Props = {
  tipiEventi: TipoEvento[];
  coloreClub: string;
};

export function CreaEventoPopup({ tipiEventi, coloreClub }: Props) {
  const router = useRouter();

  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [errore, setErrore] = useState<string | null>(null);

  const [titolo, setTitolo] = useState("");
  const [tipoEventoId, setTipoEventoId] = useState("");
  const [dataInizio, setDataInizio] = useState("");
  const [dataFine, setDataFine] = useState("");
  const [oraInizio, setOraInizio] = useState("");
  const [luogo, setLuogo] = useState("");
  const [note, setNote] = useState("");

  const [nuovaTipologiaAperta, setNuovaTipologiaAperta] = useState(false);
  const [nomeTipologia, setNomeTipologia] = useState("");
  const [coloreTipologia, setColoreTipologia] = useState(coloreClub);
  const [salvandoTipologia, setSalvandoTipologia] = useState(false);

  function resetForm() {
    setTitolo("");
    setTipoEventoId("");
    setDataInizio("");
    setDataFine("");
    setOraInizio("");
    setLuogo("");
    setNote("");
    setErrore(null);
    setNuovaTipologiaAperta(false);
    setNomeTipologia("");
    setColoreTipologia(coloreClub);
  }

  async function salvaTipologia() {
    if (!nomeTipologia.trim()) {
      setErrore("Inserisci il nome della tipologia.");
      return;
    }

    setSalvandoTipologia(true);
    setErrore(null);

    const formData = new FormData();
    formData.set("nome", nomeTipologia.trim());
    formData.set("colore", coloreTipologia);

    const result = await creaTipoEvento(formData);

    setSalvandoTipologia(false);

    if (!result.success) {
      setErrore(result.message);
      return;
    }

    if (result.id) {
      setTipoEventoId(result.id);
    }

    setNomeTipologia("");
    setNuovaTipologiaAperta(false);
    router.refresh();
  }

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();

    if (!titolo.trim()) {
      setErrore("Inserisci il titolo dell'evento.");
      return;
    }

    if (!tipoEventoId) {
      setErrore("Seleziona la tipologia di evento.");
      return;
    }

    if (!dataInizio) {
      setErrore("Indica la data di inizio.");
      return;
    }

    setLoading(true);
    setErrore(null);

    const formData = new FormData();
    formData.set("titolo", titolo.trim());
    formData.set("tipo_evento_id", tipoEventoId);
    formData.set("data_inizio", dataInizio);
    formData.set("data_fine", dataFine);
    formData.set("ora_inizio", oraInizio);
    formData.set("luogo", luogo.trim());
    formData.set("note", note.trim());

    const result = await creaEvento(formData);

    setLoading(false);

    if (!result.success) {
      setErrore(result.message);
      return;
    }

    resetForm();
    setOpen(false);
    router.refresh();
  }

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="inline-flex items-center gap-2 rounded-xl border px-4 py-2 text-sm font-semibold text-white transition hover:scale-[1.02] hover:opacity-90"
        style={{
          borderColor: `${coloreClub}80`,
          backgroundColor: `${coloreClub}18`,
        }}
      >
        <Plus className="h-4 w-4" />
        Crea Evento
      </button>

      {open && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 p-4 backdrop-blur-sm">
          <div
            className="relative max-h-[90vh] w-full max-w-2xl overflow-y-auto rounded-3xl border bg-zinc-950 p-4 shadow-2xl sm:p-6"
            style={{
              borderColor: `${coloreClub}80`,
              boxShadow: `0 0 60px ${coloreClub}25`,
            }}
          >
            <div className="mb-6 flex items-start justify-between gap-4">
              <div>
                <div
                  className="mb-3 inline-flex rounded-full border px-3 py-1 text-xs font-bold uppercase tracking-[0.25em]"
                  style={{
                    borderColor: `${coloreClub}60`,
                    backgroundColor: `${coloreClub}18`,
                    color: coloreClub,
                  }}
                >
                  Eventi
                </div>

                <h2 className="text-2xl font-black text-white">
                  Crea nuovo evento
                </h2>

                <p className="text-sm text-zinc-400">
                  Tornei, raduni, team building e altri appuntamenti del
                  club.
                </p>
              </div>

              <button
                type="button"
                onClick={() => {
                  resetForm();
                  setOpen(false);
                }}
                className="rounded-xl p-2 text-zinc-400 transition hover:bg-zinc-900 hover:text-white"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <form onSubmit={handleSubmit} className="grid gap-5">
              <input
                value={titolo}
                onChange={(e) => setTitolo(e.target.value)}
                placeholder="Titolo evento (es. Torneo di Pasqua)"
                className="rounded-xl border bg-zinc-900 px-3 py-2 text-sm text-white outline-none"
                style={{ borderColor: `${coloreClub}45` }}
              />

              <div>
                <label className="mb-1 block text-sm font-medium text-zinc-300">
                  Tipologia
                </label>

                <div className="flex flex-wrap gap-2">
                  {tipiEventi.map((tipo) => {
                    const active = tipoEventoId === tipo.id;

                    return (
                      <button
                        key={tipo.id}
                        type="button"
                        onClick={() => setTipoEventoId(tipo.id)}
                        className="rounded-xl border px-3 py-2 text-sm font-bold transition hover:opacity-90"
                        style={{
                          borderColor: active
                            ? tipo.colore || coloreClub
                            : `${tipo.colore || coloreClub}35`,
                          backgroundColor: active
                            ? tipo.colore || coloreClub
                            : `${tipo.colore || coloreClub}12`,
                          color: "#ffffff",
                        }}
                      >
                        {tipo.nome}
                      </button>
                    );
                  })}

                  <button
                    type="button"
                    onClick={() => setNuovaTipologiaAperta((v) => !v)}
                    className="flex items-center gap-1.5 rounded-xl border border-dashed px-3 py-2 text-sm font-semibold text-zinc-400 transition hover:text-white"
                    style={{ borderColor: `${coloreClub}45` }}
                  >
                    <Plus className="h-3.5 w-3.5" />
                    Nuova tipologia
                  </button>
                </div>

                {tipiEventi.length === 0 && !nuovaTipologiaAperta && (
                  <p className="mt-2 text-xs text-zinc-500">
                    Non hai ancora nessuna tipologia di evento: creane una
                    con &quot;Nuova tipologia&quot;.
                  </p>
                )}
              </div>

              {nuovaTipologiaAperta && (
                <div
                  className="rounded-2xl border bg-zinc-900/70 p-4"
                  style={{ borderColor: `${coloreClub}55` }}
                >
                  <div className="grid gap-3 sm:grid-cols-[1fr_90px_auto] sm:items-end">
                    <div>
                      <label className="mb-1 block text-xs text-zinc-400">
                        Nome tipologia
                      </label>

                      <input
                        value={nomeTipologia}
                        onChange={(e) => setNomeTipologia(e.target.value)}
                        placeholder="es. Torneo, Raduno, Team building"
                        className="w-full rounded-xl border bg-zinc-950 px-3 py-2 text-sm text-white outline-none"
                        style={{ borderColor: `${coloreClub}45` }}
                      />
                    </div>

                    <div>
                      <label className="mb-1 block text-xs text-zinc-400">
                        Colore
                      </label>

                      <input
                        type="color"
                        value={coloreTipologia}
                        onChange={(e) => setColoreTipologia(e.target.value)}
                        className="h-10 w-full cursor-pointer rounded-xl border bg-zinc-950"
                        style={{ borderColor: `${coloreClub}55` }}
                      />
                    </div>

                    <button
                      type="button"
                      onClick={salvaTipologia}
                      disabled={salvandoTipologia}
                      className="h-10 rounded-xl px-4 text-sm font-semibold text-white transition hover:opacity-90 disabled:opacity-60"
                      style={{ backgroundColor: coloreClub }}
                    >
                      {salvandoTipologia ? "Salvo..." : "Salva"}
                    </button>
                  </div>
                </div>
              )}

              <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
                <DateInput
                  label="Data inizio"
                  value={dataInizio}
                  onChange={setDataInizio}
                  required
                  wrapperClassName="bg-zinc-900"
                  wrapperStyle={{ borderColor: `${coloreClub}45` }}
                />

                <DateInput
                  label="Data fine (facoltativa)"
                  value={dataFine}
                  onChange={setDataFine}
                  wrapperClassName="bg-zinc-900"
                  wrapperStyle={{ borderColor: `${coloreClub}45` }}
                />

                <div>
                  <label className="mb-1 block text-sm font-medium text-zinc-300">
                    Ora inizio
                  </label>

                  <input
                    type="time"
                    value={oraInizio}
                    onChange={(e) => setOraInizio(e.target.value)}
                    className="w-full rounded-xl border bg-zinc-900 px-3 py-2 text-sm text-white outline-none transition"
                    style={{ borderColor: `${coloreClub}45` }}
                  />
                </div>
              </div>

              <input
                value={luogo}
                onChange={(e) => setLuogo(e.target.value)}
                placeholder="Luogo"
                className="rounded-xl border bg-zinc-900 px-3 py-2 text-sm text-white outline-none"
                style={{ borderColor: `${coloreClub}45` }}
              />

              <textarea
                value={note}
                onChange={(e) => setNote(e.target.value)}
                placeholder="Note (facoltative)"
                rows={3}
                className="resize-none rounded-xl border bg-zinc-900 px-3 py-2 text-sm text-white outline-none"
                style={{ borderColor: `${coloreClub}45` }}
              />

              {errore && (
                <p className="rounded-xl border border-red-500/30 bg-red-500/10 px-3 py-2 text-sm text-red-400">
                  {errore}
                </p>
              )}

              <div className="flex justify-end gap-3">
                <button
                  type="button"
                  onClick={() => {
                    resetForm();
                    setOpen(false);
                  }}
                  className="rounded-xl border px-4 py-2 text-sm font-medium text-zinc-300 transition hover:text-white"
                  style={{ borderColor: `${coloreClub}45` }}
                >
                  Annulla
                </button>

                <button
                  type="submit"
                  disabled={loading}
                  className="rounded-xl px-4 py-2 text-sm font-semibold text-white transition hover:scale-[1.02] hover:opacity-90 disabled:opacity-60"
                  style={{
                    background: `linear-gradient(135deg, ${coloreClub}, ${coloreClub}cc)`,
                    boxShadow: `0 0 20px ${coloreClub}45`,
                  }}
                >
                  {loading ? "Creazione..." : "Crea Evento"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </>
  );
}
