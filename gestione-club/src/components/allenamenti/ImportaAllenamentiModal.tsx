"use client";

import { useState } from "react";
import {
  AlertTriangle,
  CheckCircle2,
  ChevronDown,
  Loader2,
  Upload,
  X,
} from "lucide-react";

import { AppCard } from "@/components/ui/AppCard";
import { supabase } from "@/lib/supabase-client";
import { useToast } from "@/components/ui/Toast";
import {
  parseSeduteDaExcel,
  type SedutaImportata,
  type LavoroImportato,
} from "@/lib/import-allenamento-excel";

type SedutaModificabile = SedutaImportata & {
  id: string;
  selezionata: boolean;
};

type Props = {
  onClose: () => void;
  onSaved: () => void | Promise<void>;
  themeColor: string;
  isAdmin: boolean;
};

// Stessa formula di calcolaTempoTotale usata nel builder manuale (vedi
// NuovoAllenamentoModal.tsx), riscritta qui sui campi già numerici prodotti
// dal parser Excel invece che sui campi stringa del form. Per H2O/CAMBIO e
// per i lavori con minutaggio letto dal Drill bank (tempo_totale_fisso),
// il valore va usato così com'è, senza ricalcolarlo da ripetizioni.
function calcolaTempoTotaleImportato(lavoro: LavoroImportato): number {
  if (lavoro.tempo_totale_fisso) {
    return lavoro.tempo_totale ?? 0;
  }

  const tempoLavoro = lavoro.tempo_lavoro ?? 0;
  const ripetizioni = lavoro.ripetizione ?? 0;
  const recupero = lavoro.tempo_recupero ?? 0;

  if (ripetizioni <= 0) return 0;
  if (ripetizioni === 1) return tempoLavoro;

  return tempoLavoro * ripetizioni + recupero * (ripetizioni - 1);
}

// Somma i tempo_totale dei lavori di una seduta deduplicando i gruppi
// "contemporaneo" (stazioni in parallelo contano una volta sola).
function calcolaDurataSeduta(seduta: SedutaImportata): number {
  const gruppiContati = new Set<string>();

  return seduta.lavori.reduce((totale, lavoro) => {
    if (lavoro.contemporaneo && lavoro.gruppo_contemporaneo) {
      if (gruppiContati.has(lavoro.gruppo_contemporaneo)) return totale;
      gruppiContati.add(lavoro.gruppo_contemporaneo);
    }

    return totale + calcolaTempoTotaleImportato(lavoro);
  }, 0);
}

function generaId() {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
    return crypto.randomUUID();
  }
  return `seduta-${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

export default function ImportaAllenamentiModal({
  onClose,
  onSaved,
  themeColor,
  isAdmin,
}: Props) {
  const { showToast } = useToast();
  const [caricamentoFile, setCaricamentoFile] = useState(false);
  const [erroreFile, setErroreFile] = useState<string | null>(null);
  const [avvisi, setAvvisi] = useState<string[]>([]);
  const [sedute, setSedute] = useState<SedutaModificabile[] | null>(null);
  const [sedutaEspansa, setSedutaEspansa] = useState<string | null>(null);
  const [salvando, setSalvando] = useState(false);

  async function handleFile(file: File) {
    setErroreFile(null);
    setCaricamentoFile(true);

    try {
      const buffer = await file.arrayBuffer();
      const risultato = parseSeduteDaExcel(buffer);

      if (risultato.sedute.length === 0) {
        setErroreFile(
          "Non è stata trovata nessuna seduta nel file. Verifica che il formato corrisponda al modello atteso."
        );
        setAvvisi(risultato.avvisi);
        return;
      }

      setSedute(
        risultato.sedute.map((seduta) => ({
          ...seduta,
          id: generaId(),
          selezionata: true,
        }))
      );
      setAvvisi(risultato.avvisi);
      setSedutaEspansa(null);
    } catch (error) {
      console.error("Errore lettura file Excel:", error);
      setErroreFile(
        "Non è stato possibile leggere questo file. Verifica che sia un .xlsx valido."
      );
    } finally {
      setCaricamentoFile(false);
    }
  }

  function aggiornaSeduta(
    id: string,
    campo: keyof SedutaModificabile,
    valore: unknown
  ) {
    setSedute((prev) =>
      prev
        ? prev.map((s) => (s.id === id ? { ...s, [campo]: valore } : s))
        : prev
    );
  }

  function ricominciaDaCapo() {
    setSedute(null);
    setAvvisi([]);
    setErroreFile(null);
  }

  const seduteSelezionate = (sedute ?? []).filter((s) => s.selezionata);

  async function importaSedute() {
    if (!isAdmin) {
      showToast({
        type: "error",
        message: "Non hai i permessi per importare allenamenti.",
      });
      return;
    }

    if (seduteSelezionate.length === 0) {
      showToast({
        type: "error",
        message: "Seleziona almeno una seduta da importare.",
      });
      return;
    }

    setSalvando(true);

    try {
      const {
        data: { user },
        error: userError,
      } = await supabase.auth.getUser();

      if (userError || !user) throw new Error("Utente non autenticato.");

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

      let importate = 0;
      const errori: string[] = [];

      for (const seduta of seduteSelezionate) {
        try {
          const speciale = (lavoro: LavoroImportato) =>
            lavoro.sezione === "H2O" || lavoro.sezione === "CAMBIO";

          const lavoriDaSalvare = seduta.lavori.map((lavoro) => ({
            sezione: lavoro.sezione,
            descrizione: lavoro.descrizione,
            obbiettivo: null as string | null,
            obbiettivo_tag: null as string | null,
            rango: lavoro.rango,
            immagine_lavoro: null as string | null,
            tempo_lavoro: speciale(lavoro) ? null : lavoro.tempo_lavoro,
            ripetizione: speciale(lavoro) ? null : lavoro.ripetizione,
            tempo_recupero: speciale(lavoro) ? null : lavoro.tempo_recupero,
            tempo_totale: calcolaTempoTotaleImportato(lavoro),
            contemporaneo: lavoro.contemporaneo,
            gruppo_contemporaneo: lavoro.gruppo_contemporaneo,
            codice: lavoro.codice,
            spazio: lavoro.spazio,
            materiale: lavoro.materiale,
            punti_chiave_coaching: lavoro.punti_chiave_coaching,
            progressione: lavoro.progressione,
            riferimento_gps: lavoro.riferimento_gps,
            perche_serve: lavoro.perche_serve,
          }));

          const durataMinuti = calcolaDurataSeduta(seduta);

          const { data: allenamentoEsistente, error: checkError } =
            await supabase
              .from("allenamenti")
              .select("id, durata_minuti")
              .eq("club_id", profilo.last_club_id)
              .eq("squadra_id", profilo.last_squadra_id)
              .eq("data_allenamento", seduta.data_allenamento)
              .eq("tipo_allenamento", seduta.tipo_allenamento)
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
                  titolo: seduta.titolo,
                  data_allenamento: seduta.data_allenamento,
                  tipo_allenamento: seduta.tipo_allenamento,
                  ora_inizio: seduta.ora_inizio,
                  ora_fine: seduta.ora_fine,
                  durata_minuti: durataMinuti,
                  stato: "bozza",
                  created_by: user.id,
                })
                .select("id")
                .single();

            if (allenamentoError) throw allenamentoError;
            if (!nuovoAllenamento?.id) {
              throw new Error("Errore nella creazione dell'allenamento.");
            }

            allenamentoId = nuovoAllenamento.id;
          } else {
            allenamentoId = allenamentoEsistente.id;

            const { error: updateError } = await supabase
              .from("allenamenti")
              .update({
                durata_minuti:
                  (allenamentoEsistente.durata_minuti ?? 0) + durataMinuti,
                ora_fine: seduta.ora_fine,
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

          importate += 1;
        } catch (error) {
          console.error(
            `Errore import seduta ${seduta.data_allenamento}:`,
            error
          );
          errori.push(`${seduta.titolo} (${seduta.data_allenamento})`);
        }
      }

      if (importate > 0) {
        await onSaved();
      }

      if (errori.length === 0) {
        showToast({
          type: "success",
          message: `${importate} sedute importate correttamente.`,
        });
        onClose();
      } else {
        showToast({
          type: importate > 0 ? "success" : "error",
          message:
            importate > 0
              ? `${importate} sedute importate. Errore su: ${errori.join(", ")}.`
              : `Import fallito per tutte le sedute selezionate: ${errori.join(", ")}.`,
        });
      }
    } catch (error) {
      console.error("Errore import Excel:", error);
      showToast({
        type: "error",
        message:
          error instanceof Error
            ? error.message
            : "Errore durante l'importazione.",
      });
    } finally {
      setSalvando(false);
    }
  }

  return (
    <div className="space-y-4 sm:space-y-6">
      <div className="flex items-start justify-between gap-3 border-b border-white/10 pb-4 sm:gap-6 sm:pb-6">
        <div>
          <h2 className="text-2xl font-black text-white sm:text-3xl">
            Importa da Excel
          </h2>
          <p className="mt-1 text-sm text-zinc-400">
            Carica un file con la programmazione della settimana: leggiamo le
            sedute e te le mostriamo in anteprima prima di salvarle.
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

      {!sedute ? (
        <AppCard>
          <label className="flex min-h-[200px] cursor-pointer flex-col items-center justify-center gap-3 rounded-2xl border-2 border-dashed border-zinc-700 p-8 text-center transition hover:border-zinc-500">
            {caricamentoFile ? (
              <Loader2 className="h-8 w-8 animate-spin text-zinc-400" />
            ) : (
              <Upload className="h-8 w-8 text-zinc-500" />
            )}

            <div>
              <p className="font-semibold text-white">
                {caricamentoFile
                  ? "Lettura del file in corso..."
                  : "Trascina qui il file oppure clicca per selezionarlo"}
              </p>
              <p className="mt-1 text-sm text-zinc-500">
                Formato .xlsx con la programmazione settimanale
              </p>
            </div>

            <input
              type="file"
              accept=".xlsx,.xls"
              className="hidden"
              disabled={caricamentoFile}
              onChange={(e) => {
                const file = e.target.files?.[0];
                if (file) void handleFile(file);
                e.target.value = "";
              }}
            />
          </label>

          {erroreFile && (
            <p className="mt-4 flex items-center gap-2 text-sm text-red-400">
              <AlertTriangle className="h-4 w-4 shrink-0" />
              {erroreFile}
            </p>
          )}

          {avvisi.length > 0 && (
            <ul className="mt-4 ml-6 list-disc space-y-1 text-xs text-amber-300/80">
              {avvisi.slice(0, 8).map((avviso, i) => (
                <li key={i}>{avviso}</li>
              ))}
            </ul>
          )}
        </AppCard>
      ) : (
        <div className="space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <p className="text-sm text-zinc-400">
              Trovate{" "}
              <span className="font-semibold text-white">
                {sedute.length}
              </span>{" "}
              sedute — {seduteSelezionate.length} selezionate per l&apos;import.
            </p>

            <button
              type="button"
              onClick={ricominciaDaCapo}
              className="text-sm font-semibold text-zinc-400 underline hover:text-white"
            >
              Scegli un altro file
            </button>
          </div>

          {avvisi.length > 0 && (
            <div className="rounded-xl border border-amber-500/30 bg-amber-500/10 p-4 text-sm text-amber-200">
              <p className="mb-2 flex items-center gap-2 font-semibold">
                <AlertTriangle className="h-4 w-4" />
                {avvisi.length} righe non riconosciute (ignorate)
              </p>

              <ul className="ml-6 list-disc space-y-1 text-xs text-amber-200/80">
                {avvisi.slice(0, 8).map((avviso, i) => (
                  <li key={i}>{avviso}</li>
                ))}
                {avvisi.length > 8 && <li>… e altre {avvisi.length - 8}.</li>}
              </ul>
            </div>
          )}

          <div className="space-y-3">
            {sedute.map((seduta) => (
              <SedutaPreviewCard
                key={seduta.id}
                seduta={seduta}
                espansa={sedutaEspansa === seduta.id}
                onToggleEspansa={() =>
                  setSedutaEspansa((prev) =>
                    prev === seduta.id ? null : seduta.id
                  )
                }
                onChange={(campo, valore) =>
                  aggiornaSeduta(seduta.id, campo, valore)
                }
                themeColor={themeColor}
              />
            ))}
          </div>
        </div>
      )}

      {sedute && (
        <div className="flex flex-col-reverse gap-3 border-t border-white/10 pt-4 sm:flex-row sm:justify-end sm:pt-6">
          <button
            type="button"
            onClick={onClose}
            disabled={salvando}
            className="rounded-2xl border border-white/10 px-5 py-3 text-sm font-bold text-zinc-300 transition hover:bg-white/5 disabled:opacity-50"
          >
            Annulla
          </button>

          <button
            type="button"
            onClick={importaSedute}
            disabled={salvando || seduteSelezionate.length === 0}
            className="inline-flex items-center justify-center gap-2 rounded-2xl px-5 py-3 text-sm font-black text-white transition hover:brightness-110 disabled:opacity-50"
            style={{
              backgroundColor: themeColor,
              boxShadow: `0 16px 36px ${themeColor}38`,
            }}
          >
            {salvando ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <CheckCircle2 className="h-4 w-4" />
            )}
            {salvando
              ? "Importazione..."
              : `Importa ${seduteSelezionate.length} sedute`}
          </button>
        </div>
      )}
    </div>
  );
}

function SedutaPreviewCard({
  seduta,
  espansa,
  onToggleEspansa,
  onChange,
  themeColor,
}: {
  seduta: SedutaModificabile;
  espansa: boolean;
  onToggleEspansa: () => void;
  onChange: (campo: keyof SedutaModificabile, valore: unknown) => void;
  themeColor: string;
}) {
  const durata = calcolaDurataSeduta(seduta);

  return (
    <div
      className={`overflow-hidden rounded-2xl border transition ${
        seduta.selezionata
          ? "border-zinc-700 bg-zinc-950"
          : "border-zinc-800 bg-zinc-950/40 opacity-60"
      }`}
    >
      <div className="flex flex-wrap items-start justify-between gap-3 p-4">
        <div className="flex flex-1 items-start gap-3">
          <input
            type="checkbox"
            checked={seduta.selezionata}
            onChange={(e) => onChange("selezionata", e.target.checked)}
            className="mt-1.5 h-4 w-4 shrink-0"
          />

          <div className="grid flex-1 grid-cols-1 gap-2 sm:grid-cols-2 md:grid-cols-4">
            <div>
              <label className="mb-1 block text-[11px] font-bold uppercase tracking-wide text-zinc-500">
                Titolo
              </label>
              <input
                type="text"
                value={seduta.titolo}
                onChange={(e) => onChange("titolo", e.target.value)}
                className="w-full rounded-lg border border-zinc-800 bg-zinc-900 px-2 py-1.5 text-sm text-white outline-none"
              />
            </div>

            <div>
              <label className="mb-1 block text-[11px] font-bold uppercase tracking-wide text-zinc-500">
                Data
              </label>
              <input
                type="date"
                value={seduta.data_allenamento}
                onChange={(e) => onChange("data_allenamento", e.target.value)}
                className="w-full rounded-lg border border-zinc-800 bg-zinc-900 px-2 py-1.5 text-sm text-white outline-none"
              />
            </div>

            <div>
              <label className="mb-1 block text-[11px] font-bold uppercase tracking-wide text-zinc-500">
                Tipo
              </label>
              <select
                value={seduta.tipo_allenamento}
                onChange={(e) => onChange("tipo_allenamento", e.target.value)}
                className="w-full rounded-lg border border-zinc-800 bg-zinc-900 px-2 py-1.5 text-sm text-white outline-none"
              >
                <option value="Seduta Mattutina">Seduta Mattutina</option>
                <option value="Seduta Serale">Seduta Serale</option>
              </select>
            </div>

            <div className="flex gap-2">
              <div className="flex-1">
                <label className="mb-1 block text-[11px] font-bold uppercase tracking-wide text-zinc-500">
                  Inizio
                </label>
                <input
                  type="time"
                  value={seduta.ora_inizio ?? ""}
                  onChange={(e) => onChange("ora_inizio", e.target.value)}
                  className="w-full rounded-lg border border-zinc-800 bg-zinc-900 px-2 py-1.5 text-sm text-white outline-none"
                />
              </div>

              <div className="flex-1">
                <label className="mb-1 block text-[11px] font-bold uppercase tracking-wide text-zinc-500">
                  Fine
                </label>
                <input
                  type="time"
                  value={seduta.ora_fine ?? ""}
                  onChange={(e) => onChange("ora_fine", e.target.value)}
                  className="w-full rounded-lg border border-zinc-800 bg-zinc-900 px-2 py-1.5 text-sm text-white outline-none"
                />
              </div>
            </div>
          </div>
        </div>

        <div className="flex shrink-0 items-center gap-3">
          <span className="whitespace-nowrap text-xs text-zinc-500">
            {seduta.lavori.length} lavori · ~{durata} min
          </span>

          <button
            type="button"
            onClick={onToggleEspansa}
            className="rounded-lg border border-zinc-800 p-2 text-zinc-400 hover:text-white"
          >
            <ChevronDown
              className={`h-4 w-4 transition ${espansa ? "rotate-180" : ""}`}
            />
          </button>
        </div>
      </div>

      {espansa && (
        <div className="overflow-x-auto border-t border-zinc-800 p-4">
          <table className="w-full min-w-[900px] border-collapse text-sm">
            <thead style={{ backgroundColor: themeColor }}>
              <tr className="text-left text-white">
                <th className="border border-black/10 px-3 py-2 font-semibold">
                  Orario
                </th>
                <th className="border border-black/10 px-3 py-2 font-semibold">
                  Sezione
                </th>
                <th className="border border-black/10 px-3 py-2 font-semibold">
                  Rango
                </th>
                <th className="border border-black/10 px-3 py-2 font-semibold">
                  Drill
                </th>
                <th className="min-w-[220px] border border-black/10 px-3 py-2 font-semibold">
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
              </tr>
            </thead>

            <tbody>
              {seduta.lavori.map((lavoro, index) => {
                const speciale =
                  lavoro.sezione === "H2O" || lavoro.sezione === "CAMBIO";

                return (
                  <tr
                    key={index}
                    className={index % 2 === 0 ? "bg-zinc-950" : "bg-zinc-900/40"}
                  >
                    <td className="border border-zinc-800 px-3 py-2 text-zinc-500">
                      {lavoro.orario_riferimento ?? "—"}
                    </td>

                    <td className="border border-zinc-800 bg-zinc-800/60 px-3 py-2 font-bold text-white">
                      {lavoro.sezione}
                      {lavoro.contemporaneo && (
                        <span className="ml-1 text-[10px] font-normal text-zinc-400">
                          (parallelo)
                        </span>
                      )}
                    </td>

                    <td className="border border-zinc-800 px-3 py-2 text-zinc-400">
                      {lavoro.rango ?? "—"}
                    </td>

                    <td className="border border-zinc-800 px-3 py-2 text-zinc-300">
                      {lavoro.titolo ?? "—"}
                      {lavoro.codice && (
                        <span className="ml-1 text-xs text-zinc-500">
                          ({lavoro.codice})
                        </span>
                      )}
                    </td>

                    <td className="border border-zinc-800 px-3 py-2 text-zinc-400">
                      {lavoro.descrizione ?? "—"}
                    </td>

                    <td className="border border-zinc-800 px-3 py-2 text-right text-zinc-400">
                      {lavoro.ripetizione ?? "—"}
                    </td>

                    <td className="border border-zinc-800 px-3 py-2 text-right text-zinc-400">
                      {lavoro.tempo_lavoro ?? "—"}
                    </td>

                    <td className="border border-zinc-800 px-3 py-2 text-right text-zinc-400">
                      {lavoro.tempo_recupero ?? "—"}
                    </td>

                    <td
                      className={`border border-zinc-800 px-3 py-2 text-right font-bold ${
                        speciale
                          ? "bg-sky-900/30 text-sky-200"
                          : "text-white"
                      }`}
                    >
                      {calcolaTempoTotaleImportato(lavoro)} min
                      {lavoro.tempo_da_drill_bank && (
                        <span className="ml-1 text-[10px] font-normal text-emerald-400">
                          (drill bank)
                        </span>
                      )}
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
