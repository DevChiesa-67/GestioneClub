"use client";

import { useState } from "react";
import {
  AlertTriangle,
  CalendarRange,
  ChevronDown,
  Dumbbell,
  Loader2,
  Upload,
} from "lucide-react";

import { AppCard } from "@/components/ui/AppCard";
import { supabase } from "@/lib/supabase-client";
import { useToast } from "@/components/ui/Toast";
import {
  parsePalestraDaExcel,
  riepilogoEsercizio,
  type BloccoPalestra,
} from "@/lib/import-palestra-excel";

// Flusso di importazione delle sedute di PALESTRA. Vive accanto a
// ImportaAllenamentiModal (che gestisce le sedute di campo) e ne
// condivide l'impianto: upload -> anteprima modificabile -> salvataggio.
//
// Differenza sostanziale: il file palestra non contiene date. Un ciclo
// vale per un periodo, quindi qui si indicano la durata del ciclo
// (dal / al) e la data di ogni blocco (day A, day B, ...).

type BloccoModificabile = BloccoPalestra & {
  id: string;
  selezionato: boolean;
  data: string;
};

type VistaBlocchi = "day" | "gruppo";

type Props = {
  onClose: () => void;
  onSaved: () => void | Promise<void>;
  themeColor: string;
  isAdmin: boolean;
  /** Avvisa il modale padre: a file caricato non si cambia piu' tipo. */
  onFileCaricato?: (caricato: boolean) => void;
};

const TIPO_ALLENAMENTO_PALESTRA = "Palestra";

function generaId() {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
    return crypto.randomUUID();
  }
  return `blocco-${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

function aggiungiGiorni(dataIso: string, giorni: number) {
  if (!dataIso) return "";
  const [anno, mese, giorno] = dataIso.split("-").map(Number);
  const data = new Date(Date.UTC(anno, mese - 1, giorno + giorni));
  return `${data.getUTCFullYear()}-${String(data.getUTCMonth() + 1).padStart(2, "0")}-${String(data.getUTCDate()).padStart(2, "0")}`;
}

function formattaData(dataIso: string) {
  if (!dataIso) return "—";
  const [anno, mese, giorno] = dataIso.split("-");
  return `${giorno}/${mese}/${anno}`;
}

type ErroreSupabase = {
  code?: string;
  message?: string;
  details?: string;
  hint?: string;
};

function dettaglioErrore(error: unknown) {
  if (error instanceof Error) return error.message;
  if (typeof error !== "object" || !error) return String(error);

  const supabaseError = error as ErroreSupabase;
  return [supabaseError.message, supabaseError.details, supabaseError.hint]
    .filter(Boolean)
    .join(" — ") || "errore sconosciuto";
}

function isColonnaMancante(error: unknown) {
  if (typeof error !== "object" || !error) return false;
  const supabaseError = error as ErroreSupabase;
  const testo = `${supabaseError.message ?? ""} ${supabaseError.details ?? ""}`;
  return (
    supabaseError.code === "PGRST204" ||
    supabaseError.code === "42703" ||
    /column|colonna|schema cache/i.test(testo)
  );
}

export default function ImportaPalestraSezione({
  onClose,
  onSaved,
  themeColor,
  isAdmin,
  onFileCaricato,
}: Props) {
  const { showToast } = useToast();

  const [caricamentoFile, setCaricamentoFile] = useState(false);
  const [erroreFile, setErroreFile] = useState<string | null>(null);
  const [avvisi, setAvvisi] = useState<string[]>([]);
  const [blocchi, setBlocchi] = useState<BloccoModificabile[] | null>(null);
  const [bloccoEspanso, setBloccoEspanso] = useState<string | null>(null);
  const [cicloDal, setCicloDal] = useState("");
  const [cicloAl, setCicloAl] = useState("");
  const [salvando, setSalvando] = useState(false);
  const [vistaBlocchi, setVistaBlocchi] = useState<VistaBlocchi>("day");

  async function handleFile(file: File) {
    setErroreFile(null);
    setCaricamentoFile(true);

    try {
      const buffer = await file.arrayBuffer();
      const risultato = parsePalestraDaExcel(buffer);

      if (risultato.blocchi.length === 0) {
        setErroreFile(
          "Non è stato trovato nessun esercizio. In ogni foglio serve una riga di intestazione con «esercizio», preceduta dall'etichetta del blocco (es. day A)."
        );
        setAvvisi(risultato.avvisi);
        return;
      }

      // Se il file non porta le date del ciclo (il file palestra "grezzo"
      // non le ha), si parte da oggi e le sistema l'utente.
      const oggi = new Date();
      const partenza =
        risultato.cicloDal ??
        `${oggi.getFullYear()}-${String(oggi.getMonth() + 1).padStart(2, "0")}-${String(oggi.getDate()).padStart(2, "0")}`;

      const fine = risultato.cicloAl ?? aggiungiGiorni(partenza, 27);

      setCicloDal(partenza);
      setCicloAl(fine);

      setBlocchi(
        risultato.blocchi.map((blocco, indice) => ({
          ...blocco,
          id: generaId(),
          selezionato: true,
          data: aggiungiGiorni(partenza, indice),
        }))
      );

      setAvvisi(risultato.avvisi);
      setBloccoEspanso(null);
      onFileCaricato?.(true);
    } catch (error) {
      console.error("Errore lettura file palestra:", error);
      setErroreFile(
        "Non è stato possibile leggere questo file. Verifica che sia un .xlsx valido."
      );
    } finally {
      setCaricamentoFile(false);
    }
  }

  function aggiornaBlocco(
    id: string,
    campo: "selezionato" | "data",
    valore: boolean | string
  ) {
    setBlocchi((prev) =>
      prev ? prev.map((b) => (b.id === id ? { ...b, [campo]: valore } : b)) : prev
    );
  }

  /** Ridistribuisce i blocchi a partire dalla nuova data di inizio ciclo. */
  function aggiornaCicloDal(valore: string) {
    setCicloDal(valore);

    setBlocchi((prev) =>
      prev
        ? prev.map((blocco, indice) => ({
            ...blocco,
            data: aggiungiGiorni(valore, indice),
          }))
        : prev
    );
  }

  function ricominciaDaCapo() {
    setBlocchi(null);
    setAvvisi([]);
    setErroreFile(null);
    setCicloDal("");
    setCicloAl("");
    onFileCaricato?.(false);
  }

  const blocchiSelezionati = (blocchi ?? []).filter((b) => b.selezionato);

  const eserciziSelezionati = blocchiSelezionati.reduce(
    (totale, blocco) => totale + blocco.esercizi.length,
    0
  );

  // Piu' blocchi con la stessa data diventano un'unica seduta: e' la
  // regola concordata ("tutto nella stessa seduta"), e serve anche a non
  // violare il vincolo unico (club, squadra, data, tipo) sugli allenamenti.
  const dateDistinte = Array.from(
    new Set(blocchiSelezionati.map((b) => b.data).filter(Boolean))
  ).sort();

  const gruppiAnteprima = Array.from(
    new Set((blocchi ?? []).flatMap((blocco) => blocco.gruppi))
  );

  function validaPrimaDiSalvare() {
    if (!cicloDal || !cicloAl) {
      return "Indica la data di inizio e di fine del ciclo.";
    }

    if (cicloAl < cicloDal) {
      return "La data di fine ciclo precede quella di inizio.";
    }

    if (blocchiSelezionati.length === 0) {
      return "Seleziona almeno un blocco da importare.";
    }

    const senzaData = blocchiSelezionati.find((b) => !b.data);
    if (senzaData) {
      return `Indica la data del blocco "${senzaData.etichetta}".`;
    }

    const fuoriCiclo = blocchiSelezionati.find(
      (b) => b.data < cicloDal || b.data > cicloAl
    );

    if (fuoriCiclo) {
      return `La data del blocco "${fuoriCiclo.etichetta}" è fuori dal ciclo ${formattaData(cicloDal)} – ${formattaData(cicloAl)}.`;
    }

    return null;
  }

  async function importaSedute() {
    if (!isAdmin) {
      showToast({
        type: "error",
        message: "Non hai i permessi per importare allenamenti.",
      });
      return;
    }

    const erroreValidazione = validaPrimaDiSalvare();

    if (erroreValidazione) {
      showToast({ type: "error", message: erroreValidazione });
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

      for (const data of dateDistinte) {
        const blocchiDelGiorno = blocchiSelezionati.filter(
          (b) => b.data === data
        );

        const titolo = `Palestra — ${blocchiDelGiorno
          .map((b) => b.etichetta)
          .join(" + ")}`;

        try {
          const { data: esistente, error: checkError } = await supabase
            .from("allenamenti")
            .select("id")
            .eq("club_id", profilo.last_club_id)
            .eq("squadra_id", profilo.last_squadra_id)
            .eq("data_allenamento", data)
            .eq("tipo_allenamento", TIPO_ALLENAMENTO_PALESTRA)
            .limit(1)
            .maybeSingle();

          if (checkError) throw checkError;

          let allenamentoId: string;

          if (!esistente) {
            const datiAllenamento = {
              club_id: profilo.last_club_id,
              squadra_id: profilo.last_squadra_id,
              titolo,
              data_allenamento: data,
              tipo_allenamento: TIPO_ALLENAMENTO_PALESTRA,
              stato: "bozza",
              created_by: user.id,
            };

            let { data: nuovo, error: insertError } = await supabase
              .from("allenamenti")
              .insert({
                ...datiAllenamento,
                ciclo_dal: cicloDal,
                ciclo_al: cicloAl,
              })
              .select("id")
              .single();

            // Compatibilita' con database sui quali la migrazione palestra
            // non e' ancora stata eseguita: la seduta resta importabile,
            // semplicemente il periodo del ciclo non viene persistito.
            if (insertError && isColonnaMancante(insertError)) {
              const tentativoCompatibile = await supabase
                .from("allenamenti")
                .insert(datiAllenamento)
                .select("id")
                .single();
              nuovo = tentativoCompatibile.data;
              insertError = tentativoCompatibile.error;
            }

            if (insertError) {
              throw new Error(
                `Creazione seduta: ${dettaglioErrore(insertError)}`
              );
            }
            if (!nuovo?.id) throw new Error("Errore nella creazione della seduta.");

            allenamentoId = nuovo.id;
          } else {
            // Seduta palestra gia' presente in quel giorno: la
            // sovrascriviamo con i dati freschi del file invece di
            // accodare, come fa l'import degli allenamenti.
            allenamentoId = esistente.id;

            const { error: deleteError } = await supabase
              .from("lavori_allenamento")
              .delete()
              .eq("allenamento_id", allenamentoId);

            if (deleteError) throw deleteError;

            // Le RLS non segnalano errore se bloccano la DELETE: la query
            // "riesce" senza cancellare nulla. Senza questo controllo il
            // reimport raddoppierebbe gli esercizi in silenzio.
            const { count: rimasti, error: verificaError } = await supabase
              .from("lavori_allenamento")
              .select("id", { count: "exact", head: true })
              .eq("allenamento_id", allenamentoId);

            if (verificaError) throw verificaError;

            if ((rimasti ?? 0) > 0) {
              throw new Error(
                `${rimasti} esercizi vecchi non cancellati (probabile permesso mancante sulla cancellazione). Import di questa seduta annullato per non duplicare.`
              );
            }

            let { error: updateError } = await supabase
              .from("allenamenti")
              .update({
                titolo,
                ciclo_dal: cicloDal,
                ciclo_al: cicloAl,
                updated_at: new Date().toISOString(),
              })
              .eq("id", allenamentoId);

            if (updateError && isColonnaMancante(updateError)) {
              const tentativoCompatibile = await supabase
                .from("allenamenti")
                .update({
                  titolo,
                  updated_at: new Date().toISOString(),
                })
                .eq("id", allenamentoId);
              updateError = tentativoCompatibile.error;
            }

            if (updateError) {
              throw new Error(
                `Aggiornamento seduta: ${dettaglioErrore(updateError)}`
              );
            }
          }

          const lavori = blocchiDelGiorno.flatMap((blocco) =>
            blocco.esercizi.map((esercizio) => ({
              allenamento_id: allenamentoId,
              sezione: esercizio.gruppo,
              descrizione: esercizio.esercizio,
              serie: esercizio.serie,
              ripetizioni: esercizio.ripetizioni,
              rpe: esercizio.rpe,
              carico: esercizio.carico,
              tempo_recupero: esercizio.recupero_minuti,
              // In palestra il "tempo lavoro" non esiste: il volume e'
              // serie x rep, non i minuti. Restano nulli di proposito.
              tempo_lavoro: null as number | null,
              tempo_totale: null as number | null,
              // Riepilogo leggibile per le schermate che non conoscono
              // ancora le colonne nuove.
              punti_chiave_coaching: riepilogoEsercizio(esercizio),
              contemporaneo: false,
              gruppo_contemporaneo: null as string | null,
            }))
          );

          if (lavori.length > 0) {
            const lavoriOrdinati = lavori.map((lavoro, indice) => ({
              ...lavoro,
              ordine: indice + 1,
            }));

            let { error: lavoriError } = await supabase
              .from("lavori_allenamento")
              .insert(lavoriOrdinati);

            if (lavoriError && isColonnaMancante(lavoriError)) {
              const lavoriCompatibili = lavoriOrdinati.map((lavoro) => ({
                allenamento_id: lavoro.allenamento_id,
                sezione: lavoro.sezione,
                descrizione: lavoro.descrizione,
                tempo_recupero: lavoro.tempo_recupero,
                tempo_lavoro: lavoro.tempo_lavoro,
                tempo_totale: lavoro.tempo_totale,
                punti_chiave_coaching: lavoro.punti_chiave_coaching,
                contemporaneo: lavoro.contemporaneo,
                gruppo_contemporaneo: lavoro.gruppo_contemporaneo,
                ordine: lavoro.ordine,
              }));
              const tentativoCompatibile = await supabase
                .from("lavori_allenamento")
                .insert(lavoriCompatibili);
              lavoriError = tentativoCompatibile.error;
            }

            if (lavoriError) {
              throw new Error(
                `Salvataggio esercizi: ${dettaglioErrore(lavoriError)}`
              );
            }
          }

          importate += 1;
        } catch (error) {
          const dettaglio = dettaglioErrore(error);
          console.warn(`Import palestra ${data} non riuscito: ${dettaglio}`);

          errori.push(`${titolo} (${formattaData(data)}): ${dettaglio}`);
        }
      }

      if (importate > 0) await onSaved();

      if (errori.length === 0) {
        showToast({
          type: "success",
          message: `${importate} sedute di palestra importate correttamente.`,
        });
        onClose();
      } else {
        showToast({
          type: importate > 0 ? "success" : "error",
          message:
            importate > 0
              ? `${importate} sedute importate. Errore su: ${errori.join(", ")}.`
              : `Import fallito: ${errori.join(", ")}.`,
        });
      }
    } catch (error) {
      console.error("Errore import palestra:", error);
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

  if (!blocchi) {
    return (
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
                : "Trascina qui il file palestra oppure clicca per selezionarlo"}
            </p>
            <p className="mt-1 text-sm text-zinc-500">
              Un foglio per gruppo, con le colonne esercizio, serie, rep, rpe,
              carico, recupero e note
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
          <p className="mt-4 flex items-start gap-2 text-sm text-red-400">
            <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
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
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-sm text-zinc-400">
          Trovati{" "}
          <span className="font-semibold text-white">{blocchi.length}</span>{" "}
          blocchi — {blocchiSelezionati.length} selezionati,{" "}
          {eserciziSelezionati} esercizi in {dateDistinte.length}{" "}
          {dateDistinte.length === 1 ? "seduta" : "sedute"}.
        </p>

        <button
          type="button"
          onClick={ricominciaDaCapo}
          className="text-sm font-semibold text-zinc-400 underline hover:text-white"
        >
          Scegli un altro file
        </button>
      </div>

      {/* DURATA DEL CICLO */}
      <div className="rounded-2xl border border-zinc-800 bg-zinc-950 p-4">
        <div className="flex items-center gap-2">
          <CalendarRange
            className="h-5 w-5 shrink-0"
            style={{ color: themeColor }}
          />
          <p className="font-bold text-white">Durata del ciclo</p>
        </div>

        <p className="mt-1 text-sm leading-6 text-zinc-400">
          Per quanto tempo resta valido questo programma. Viene salvato su
          ogni seduta importata.
        </p>

        <div className="mt-3 grid gap-3 sm:grid-cols-2">
          <label className="block">
            <span className="mb-2 block text-xs font-bold uppercase tracking-wide text-zinc-500">
              Inizio ciclo
            </span>
            <input
              type="date"
              value={cicloDal}
              onChange={(e) => aggiornaCicloDal(e.target.value)}
              className="h-12 w-full rounded-xl border border-zinc-800 bg-black px-3 text-white outline-none focus:border-zinc-600"
            />
          </label>

          <label className="block">
            <span className="mb-2 block text-xs font-bold uppercase tracking-wide text-zinc-500">
              Fine ciclo
            </span>
            <input
              type="date"
              min={cicloDal}
              value={cicloAl}
              onChange={(e) => setCicloAl(e.target.value)}
              className="h-12 w-full rounded-xl border border-zinc-800 bg-black px-3 text-white outline-none focus:border-zinc-600"
            />
          </label>
        </div>

        <p className="mt-3 text-xs text-zinc-500">
          Cambiando l&apos;inizio del ciclo le date dei blocchi vengono
          ridistribuite di conseguenza.
        </p>
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
          </ul>
        </div>
      )}

      {/* MODALITA' DI VISUALIZZAZIONE */}
      <div className="flex items-center justify-between gap-3">
        <p className="text-sm font-bold text-white">Suddividi la seduta</p>
        <div className="inline-flex rounded-xl border border-zinc-800 bg-zinc-950 p-1">
          {([
            ["day", "Per Day"],
            ["gruppo", "Per gruppo"],
          ] as const).map(([valore, etichetta]) => (
            <button
              key={valore}
              type="button"
              onClick={() => setVistaBlocchi(valore)}
              className={`rounded-lg px-3 py-2 text-xs font-bold transition ${
                vistaBlocchi === valore
                  ? "bg-white text-black"
                  : "text-zinc-400 hover:text-white"
              }`}
            >
              {etichetta}
            </button>
          ))}
        </div>
      </div>

      {/* BLOCCHI PER DAY */}
      {vistaBlocchi === "day" && <div className="space-y-3">
        {blocchi.map((blocco) => {
          const espanso = bloccoEspanso === blocco.id;

          return (
            <div
              key={blocco.id}
              className="overflow-hidden rounded-2xl border border-zinc-800 bg-zinc-950"
            >
              <div className="flex flex-col gap-3 p-4 lg:flex-row lg:items-center">
                <label className="flex min-w-0 flex-1 items-start gap-3">
                  <input
                    type="checkbox"
                    checked={blocco.selezionato}
                    onChange={(e) =>
                      aggiornaBlocco(blocco.id, "selezionato", e.target.checked)
                    }
                    className="mt-1 h-4 w-4 shrink-0 cursor-pointer accent-emerald-500"
                  />

                  <span className="min-w-0">
                    <span className="flex items-center gap-2">
                      <Dumbbell
                        className="h-4 w-4 shrink-0"
                        style={{ color: themeColor }}
                      />
                      <span className="truncate font-black text-white">
                        {blocco.etichetta}
                      </span>
                    </span>

                    <span className="mt-1 block text-xs leading-5 text-zinc-500">
                      {blocco.gruppi.join(" · ")} — {blocco.esercizi.length}{" "}
                      esercizi
                    </span>
                  </span>
                </label>

                <div className="flex shrink-0 items-end gap-2">
                  <button
                    type="button"
                    onClick={() => setBloccoEspanso(espanso ? null : blocco.id)}
                    className="grid h-11 w-11 shrink-0 place-items-center rounded-xl border border-zinc-800 text-zinc-400 transition hover:bg-white/5 hover:text-white"
                    aria-label={espanso ? "Chiudi dettaglio" : "Apri dettaglio"}
                  >
                    <ChevronDown
                      className={`h-4 w-4 transition-transform ${espanso ? "rotate-180" : ""}`}
                    />
                  </button>
                </div>
              </div>

              {espanso && (
                <TabellaEsercizi esercizi={blocco.esercizi} mostraGruppo />
              )}
            </div>
          );
        })}
      </div>}

      {/* BLOCCHI PER GRUPPO */}
      {vistaBlocchi === "gruppo" && (
        <div className="space-y-3">
          {gruppiAnteprima.map((gruppo) => {
            const blocchiDelGruppo = blocchi
              .map((blocco) => ({
                blocco,
                esercizi: blocco.esercizi.filter(
                  (esercizio) => esercizio.gruppo === gruppo
                ),
              }))
              .filter(({ esercizi }) => esercizi.length > 0);

            return (
              <div
                key={gruppo}
                className="overflow-hidden rounded-2xl border border-zinc-800 bg-zinc-950"
              >
                <div className="flex items-center gap-2 p-4">
                  <Dumbbell
                    className="h-4 w-4 shrink-0"
                    style={{ color: themeColor }}
                  />
                  <p className="font-black text-white">{gruppo}</p>
                  <span className="text-xs text-zinc-500">
                    {blocchiDelGruppo.reduce(
                      (totale, voce) => totale + voce.esercizi.length,
                      0
                    )}{" "}
                    esercizi
                  </span>
                </div>

                <div className="divide-y divide-zinc-800 border-t border-zinc-800">
                  {blocchiDelGruppo.map(({ blocco, esercizi }) => (
                    <div key={blocco.id}>
                      <label className="flex items-center gap-3 bg-white/[0.03] px-4 py-3">
                        <input
                          type="checkbox"
                          checked={blocco.selezionato}
                          onChange={(e) =>
                            aggiornaBlocco(
                              blocco.id,
                              "selezionato",
                              e.target.checked
                            )
                          }
                          className="h-4 w-4 cursor-pointer accent-emerald-500"
                        />
                        <span className="text-sm font-bold text-white">
                          {blocco.etichetta}
                        </span>
                      </label>
                      <TabellaEsercizi esercizi={esercizi} />
                    </div>
                  ))}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {dateDistinte.length > 0 && dateDistinte.length < blocchiSelezionati.length && (
        <p className="rounded-xl border border-zinc-800 bg-zinc-950 px-4 py-3 text-sm text-zinc-400">
          Alcuni blocchi condividono la stessa data: verranno uniti in
          un&apos;unica seduta di palestra.
        </p>
      )}

      <div className="flex flex-col-reverse gap-3 border-t border-white/10 pt-4 sm:flex-row sm:justify-end">
        <button
          type="button"
          onClick={onClose}
          className="rounded-xl border border-zinc-700 px-5 py-3 text-sm font-bold text-zinc-300 transition hover:bg-white/5"
        >
          Annulla
        </button>

        <button
          type="button"
          onClick={importaSedute}
          disabled={salvando || !isAdmin || blocchiSelezionati.length === 0}
          className="inline-flex items-center justify-center gap-2 rounded-xl px-5 py-3 text-sm font-black text-white transition hover:brightness-110 disabled:cursor-not-allowed disabled:opacity-50"
          style={{ backgroundColor: themeColor }}
        >
          {salvando ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <Dumbbell className="h-4 w-4" />
          )}
          {salvando
            ? "Importazione..."
            : `Importa ${dateDistinte.length} ${dateDistinte.length === 1 ? "seduta" : "sedute"}`}
        </button>
      </div>
    </div>
  );
}

function TabellaEsercizi({
  esercizi,
  mostraGruppo = false,
}: {
  esercizi: BloccoPalestra["esercizi"];
  mostraGruppo?: boolean;
}) {
  return (
    <div>
      <div className={`hidden gap-2 bg-white/5 px-4 py-2.5 text-[11px] font-bold uppercase tracking-wide text-zinc-500 md:grid ${
        mostraGruppo
          ? "grid-cols-[1fr_1.4fr_0.5fr_0.6fr_0.5fr_0.7fr_0.7fr]"
          : "grid-cols-[1.4fr_0.5fr_0.6fr_0.5fr_0.7fr_0.7fr]"
      }`}>
        {mostraGruppo && <span>Gruppo</span>}
        <span>Esercizio</span>
        <span>Serie</span>
        <span>Rep</span>
        <span>RPE</span>
        <span>Carico</span>
        <span>Recupero</span>
      </div>

      <div className="divide-y divide-zinc-900">
        {esercizi.map((esercizio, indice) => (
          <div
            key={`${esercizio.gruppo}-${esercizio.esercizio}-${indice}`}
            className={`px-4 py-3 md:grid md:gap-2 ${
              mostraGruppo
                ? "md:grid-cols-[1fr_1.4fr_0.5fr_0.6fr_0.5fr_0.7fr_0.7fr]"
                : "md:grid-cols-[1.4fr_0.5fr_0.6fr_0.5fr_0.7fr_0.7fr]"
            }`}
          >
            {mostraGruppo && (
              <p className="truncate text-xs font-bold uppercase tracking-wide text-zinc-500 md:text-sm md:font-normal md:normal-case md:tracking-normal md:text-zinc-400">
                {esercizio.gruppo}
              </p>
            )}
            <p className="font-semibold text-white md:truncate md:font-normal">
              {esercizio.esercizio}
            </p>
            <p className="mt-1 text-sm text-zinc-400 md:mt-0 md:hidden">
              {riepilogoEsercizio(esercizio) ?? "—"}
            </p>
            <p className="hidden text-sm text-zinc-300 md:block">
              {esercizio.serie ?? "—"}
            </p>
            <p className="hidden text-sm text-zinc-300 md:block">
              {esercizio.ripetizioni ?? "—"}
            </p>
            <p className="hidden text-sm text-zinc-300 md:block">
              {esercizio.rpe ?? "—"}
            </p>
            <p className="hidden truncate text-sm text-zinc-300 md:block">
              {esercizio.carico ?? "—"}
            </p>
            <p className="hidden truncate text-sm text-zinc-300 md:block">
              {esercizio.recupero_testo ?? "—"}
            </p>
            {esercizio.note && (
              <p className={`mt-1 text-xs leading-5 text-zinc-500 ${
                mostraGruppo ? "md:col-span-7" : "md:col-span-6"
              }`}>
                {esercizio.note}
              </p>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
