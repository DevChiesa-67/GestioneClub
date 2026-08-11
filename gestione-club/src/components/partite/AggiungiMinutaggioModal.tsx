"use client";

import Image from "next/image";
import { useEffect, useMemo, useState } from "react";
import {
  AlertTriangle,
  CheckCircle2,
  ClipboardList,
  Loader2,
  Plus,
  Trash2,
  Upload,
  User,
  X,
} from "lucide-react";

import { useToast } from "@/components/ui/Toast";
import { supabase } from "@/lib/supabase-client";
import {
  parseMinutaggioDaExcel,
  type CambioRilevato,
} from "@/lib/minutaggi/parse-minutaggio-excel";
import {
  trovaGiocatoriCorrispondenti,
  type GiocatoreMatch,
} from "@/lib/minutaggi/calcola-minutaggio";
import {
  salvaMinutaggioImport,
  salvaMinutaggioManuale,
} from "@/app/(dashboard)/partite/minutaggi/actions";
import type { Partita } from "@/app/(dashboard)/partite/page";
import SelettorePartita from "@/components/partite/SelettorePartita";

const NUMERI_TITOLARI = Array.from({ length: 15 }, (_, i) => i + 1);

type RigaPanchina = {
  id: string;
  giocatoreId: string;
};

type RigaCambioManuale = {
  id: string;
  minuto: string;
  entraId: string;
  esceId: string;
};

type Props = {
  onClose: () => void;
  onSaved: () => void | Promise<void>;
  themeColor: string;
  giocatori: GiocatoreMatch[];
  partite: Partita[];
};

type RigaCambio = CambioRilevato & {
  id: string;
  candidati: GiocatoreMatch[];
  giocatoreIdSelezionato: string; // "" = nessuno/ignora
};

function generaId() {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
    return crypto.randomUUID();
  }
  return `riga-${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

function normalizzaTesto(valore: string | null | undefined): string {
  return (valore || "")
    .normalize("NFD")
    .replace(new RegExp("[\\u0300-\\u036f]", "g"), "")
    .toLowerCase()
    .trim();
}

function trovaPartitaCorrispondente(
  partite: Partita[],
  avversario: string | null,
  data: string | null,
): Partita | null {
  if (!avversario && !data) return null;

  const avvNorm = normalizzaTesto(avversario);

  let candidati = partite.filter((p) => {
    if (!avvNorm) return true;

    const casa = normalizzaTesto(
      `${p.squadra_casa?.nome || ""} ${p.squadra_casa?.abbreviazione || ""}`,
    );
    const fuori = normalizzaTesto(
      `${p.squadra_fuori?.nome || ""} ${p.squadra_fuori?.abbreviazione || ""}`,
    );

    return (
      (casa && casa.includes(avvNorm)) ||
      (fuori && fuori.includes(avvNorm))
    );
  });

  if (data) {
    const conData = candidati.filter((p) => p.data_partita === data);
    if (conData.length > 0) candidati = conData;
  }

  return candidati.length === 1 ? candidati[0] : null;
}

function GiocatoreAvatarMini({
  giocatore,
}: {
  giocatore: { nome: string; cognome: string; foto_url: string | null } | null;
}) {
  if (!giocatore) {
    return (
      <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full border border-dashed border-zinc-700 bg-zinc-900 text-zinc-600">
        <User className="h-4 w-4" />
      </div>
    );
  }

  const iniziali =
    `${giocatore.nome.charAt(0)}${giocatore.cognome.charAt(0)}`.toUpperCase();

  if (giocatore.foto_url) {
    return (
      <div className="relative h-10 w-10 shrink-0 overflow-hidden rounded-full border border-zinc-700 bg-zinc-800">
        <Image
          src={giocatore.foto_url}
          alt={`${giocatore.nome} ${giocatore.cognome}`}
          fill
          sizes="40px"
          className="object-cover"
        />
      </div>
    );
  }

  return (
    <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full border border-zinc-700 bg-zinc-800 text-xs font-bold text-zinc-300">
      {iniziali}
    </div>
  );
}

export default function AggiungiMinutaggioModal({
  onClose,
  onSaved,
  themeColor,
  giocatori,
  partite,
}: Props) {
  const { showToast } = useToast();

  const [modalita, setModalita] = useState<"manuale" | "file">("manuale");

  // --- Inserimento manuale (formazione ereditata + cambi) ----------------
  const [partitaManuale, setPartitaManuale] = useState<Partita | null>(null);
  const [durataManuale, setDurataManuale] = useState(80);

  // Formazione (titolari 1-15 + panchina): NON modificabile da questo
  // popup, viene sempre ereditata da partite_convocazioni (stessa tabella
  // del tab "Convocazioni" della partita) quando si seleziona la partita.
  const [titolariManuali, setTitolariManuali] = useState<string[]>(
    () => Array(15).fill(""),
  );
  const [panchinaManuale, setPanchinaManuale] = useState<RigaPanchina[]>([]);
  const [caricandoFormazione, setCaricandoFormazione] = useState(false);
  const [formazioneTrovata, setFormazioneTrovata] = useState(false);

  const [cambiManuali, setCambiManuali] = useState<RigaCambioManuale[]>([]);
  const [salvandoManuale, setSalvandoManuale] = useState(false);

  const giocatoriMap = useMemo(
    () => new Map(giocatori.map((g) => [g.id, g])),
    [giocatori],
  );

  function nomeGiocatore(id: string): string {
    const g = giocatoriMap.get(id);
    return g ? `${g.cognome} ${g.nome}` : "";
  }

  // Al cambio di partita, eredita la formazione già salvata nel tab
  // "Convocazioni" di quella partita (titolare + numero_maglia -> slot
  // 1-15, gli altri convocati -> panchina). Se non esiste ancora nessuna
  // convocazione, la formazione resta vuota: va impostata prima nel tab
  // Convocazioni della partita, non è modificabile da qui.
  useEffect(() => {
    if (!partitaManuale) {
      setTitolariManuali(Array(15).fill(""));
      setPanchinaManuale([]);
      setFormazioneTrovata(false);
      return;
    }

    let annullato = false;

    async function caricaFormazione() {
      setCaricandoFormazione(true);

      try {
        const { data, error } = await supabase
          .from("partite_convocazioni")
          .select("giocatore_id, titolare, numero_maglia")
          .eq("partita_id", partitaManuale!.id)
          .eq("convocato", true);

        if (annullato) return;

        if (error || !data || data.length === 0) {
          setTitolariManuali(Array(15).fill(""));
          setPanchinaManuale([]);
          setFormazioneTrovata(false);
          return;
        }

        const nuoviTitolari = Array(15).fill("");
        for (const riga of data) {
          const numero = riga.numero_maglia;
          if (riga.titolare && numero && numero >= 1 && numero <= 15) {
            nuoviTitolari[numero - 1] = riga.giocatore_id;
          }
        }

        const nuovaPanchina: RigaPanchina[] = data
          .filter((riga) => !riga.titolare)
          .map((riga) => ({ id: generaId(), giocatoreId: riga.giocatore_id }));

        setTitolariManuali(nuoviTitolari);
        setPanchinaManuale(nuovaPanchina);
        setFormazioneTrovata(nuoviTitolari.some(Boolean));
      } finally {
        if (!annullato) setCaricandoFormazione(false);
      }
    }

    void caricaFormazione();

    return () => {
      annullato = true;
    };
  }, [partitaManuale]);

  function aggiungiRigaCambio() {
    setCambiManuali((prev) => [
      ...prev,
      { id: generaId(), minuto: "", entraId: "", esceId: "" },
    ]);
  }

  function aggiornaRigaCambio(
    id: string,
    patch: Partial<Omit<RigaCambioManuale, "id">>,
  ) {
    setCambiManuali((prev) =>
      prev.map((r) => (r.id === id ? { ...r, ...patch } : r)),
    );
  }

  function rimuoviRigaCambio(id: string) {
    setCambiManuali((prev) => prev.filter((r) => r.id !== id));
  }

  const idTitolariManuali = useMemo(
    () => titolariManuali.filter(Boolean),
    [titolariManuali],
  );

  const idPanchinaManuale = useMemo(
    () => panchinaManuale.map((r) => r.giocatoreId).filter(Boolean),
    [panchinaManuale],
  );

  // Chi è "entrato" (comparso come entra in un cambio) al minuto più
  // basso registrato: usato solo per il badge di stato nella panchina.
  const primoIngressoPerGiocatore = useMemo(() => {
    const mappa = new Map<string, number>();
    for (const riga of cambiManuali) {
      const minuto = Number(riga.minuto);
      if (!riga.entraId || !Number.isFinite(minuto)) continue;
      const attuale = mappa.get(riga.entraId);
      if (attuale === undefined || minuto < attuale) {
        mappa.set(riga.entraId, minuto);
      }
    }
    return mappa;
  }, [cambiManuali]);

  const erroreManuale = useMemo(() => {
    if (!partitaManuale) return "Seleziona la partita.";
    if (caricandoFormazione) return "Caricamento formazione in corso...";
    if (!formazioneTrovata) {
      return "Questa partita non ha ancora una formazione salvata: impostala prima nel tab Convocazioni della partita.";
    }
    for (const riga of cambiManuali) {
      if (!riga.minuto || !riga.entraId || !riga.esceId) {
        return "Completa o rimuovi le sostituzioni non finite (minuto, entra, esce).";
      }
      if (riga.entraId === riga.esceId) {
        return "In una sostituzione il giocatore che entra e quello che esce devono essere diversi.";
      }
      if (!Number.isFinite(Number(riga.minuto)) || Number(riga.minuto) < 0) {
        return "Il minuto di una sostituzione non è valido.";
      }
    }
    return null;
  }, [partitaManuale, caricandoFormazione, formazioneTrovata, cambiManuali]);

  async function handleConfermaManuale() {
    if (erroreManuale || !partitaManuale) return;

    setSalvandoManuale(true);

    try {
      const result = await salvaMinutaggioManuale({
        partitaId: partitaManuale.id,
        durataMinuti: durataManuale,
        cambi: cambiManuali.map((r) => ({
          minuto: Number(r.minuto),
          giocatoreEntraId: r.entraId,
          giocatoreEsceId: r.esceId,
        })),
      });

      if (!result.success) {
        showToast({ type: "error", message: result.message });
        return;
      }

      showToast({ type: "success", message: result.message });
      await onSaved();
      onClose();
    } catch (error) {
      console.error("Errore salvataggio minutaggio manuale:", error);
      showToast({
        type: "error",
        message: "Errore imprevisto durante il salvataggio.",
      });
    } finally {
      setSalvandoManuale(false);
    }
  }

  // --- Import da file Excel ----------------------------------------------
  const [file, setFile] = useState<File | null>(null);
  const [caricamentoFile, setCaricamentoFile] = useState(false);
  const [erroreFile, setErroreFile] = useState<string | null>(null);
  const [avvisi, setAvvisi] = useState<string[]>([]);
  const [righeCambio, setRigheCambio] = useState<RigaCambio[] | null>(null);

  const [avversarioRilevato, setAvversarioRilevato] = useState<string | null>(
    null,
  );
  const [dataRilevata, setDataRilevata] = useState<string | null>(null);
  const [luogoRilevato, setLuogoRilevato] = useState<string | null>(null);

  const [partitaSelezionata, setPartitaSelezionata] = useState<Partita | null>(
    null,
  );
  const [partitaAutoRilevata, setPartitaAutoRilevata] = useState(false);

  const [durataMinuti, setDurataMinuti] = useState(80);
  const [salvando, setSalvando] = useState(false);

  async function handleFile(selectedFile: File) {
    setErroreFile(null);
    setCaricamentoFile(true);
    setFile(selectedFile);

    try {
      const buffer = await selectedFile.arrayBuffer();
      const risultato = parseMinutaggioDaExcel(buffer);

      if (risultato.cambi.length === 0) {
        setErroreFile(
          "Non è stato trovato nessun cambio nel file. Verifica che il formato corrisponda al modello MINUTAGGIO.",
        );
        setAvvisi(risultato.avvisi);
        setRigheCambio(null);
        return;
      }

      const righe: RigaCambio[] = risultato.cambi.map((cambio) => {
        const candidati = trovaGiocatoriCorrispondenti(
          cambio.nomeTesto,
          giocatori,
        );

        return {
          ...cambio,
          id: generaId(),
          candidati,
          giocatoreIdSelezionato: candidati.length === 1 ? candidati[0].id : "",
        };
      });

      setRigheCambio(righe);
      setAvvisi(risultato.avvisi);
      setAvversarioRilevato(risultato.avversarioRilevato);
      setDataRilevata(risultato.dataRilevata);
      setLuogoRilevato(risultato.luogoRilevato);

      const partitaTrovata = trovaPartitaCorrispondente(
        partite,
        risultato.avversarioRilevato,
        risultato.dataRilevata,
      );

      setPartitaSelezionata(partitaTrovata);
      setPartitaAutoRilevata(Boolean(partitaTrovata));
    } catch (error) {
      console.error("Errore lettura file minutaggio:", error);
      setErroreFile(
        "Non è stato possibile leggere questo file. Verifica che sia un .xlsx valido.",
      );
      setRigheCambio(null);
    } finally {
      setCaricamentoFile(false);
    }
  }

  function aggiornaSelezioneGiocatore(rigaId: string, giocatoreId: string) {
    setRigheCambio((prev) =>
      prev
        ? prev.map((r) =>
            r.id === rigaId
              ? { ...r, giocatoreIdSelezionato: giocatoreId }
              : r,
          )
        : prev,
    );
  }

  const contaNonCollegati = useMemo(() => {
    if (!righeCambio) return 0;
    return righeCambio.filter((r) => !r.giocatoreIdSelezionato).length;
  }, [righeCambio]);

  function classificazioneRiga(riga: RigaCambio): "verde" | "giallo" | "rosso" {
    if (riga.giocatoreIdSelezionato) {
      // Se la selezione corrisponde a un candidato univoco originario, verde.
      if (
        riga.candidati.length === 1 &&
        riga.candidati[0].id === riga.giocatoreIdSelezionato
      ) {
        return "verde";
      }
      // Selezionato manualmente: consideralo risolto (verde).
      return "verde";
    }

    return riga.candidati.length > 1 ? "giallo" : "rosso";
  }

  const bordoClasse: Record<"verde" | "giallo" | "rosso", string> = {
    verde: "border-emerald-500/60 bg-emerald-500/5",
    giallo: "border-amber-500/60 bg-amber-500/5",
    rosso: "border-red-500/60 bg-red-500/5",
  };

  async function handleConferma() {
    if (!file || !righeCambio) return;

    setSalvando(true);

    try {
      const formData = new FormData();
      formData.set("file", file);
      formData.set("partita_id", partitaSelezionata?.id || "");
      formData.set("durata_minuti", String(durataMinuti));
      formData.set("avversario_rilevato", avversarioRilevato || "");
      formData.set("data_rilevata", dataRilevata || "");
      formData.set("luogo_rilevato", luogoRilevato || "");
      formData.set(
        "cambi",
        JSON.stringify(
          righeCambio.map((r) => ({
            nomeTesto: r.nomeTesto,
            minuto: r.minuto,
            tipo: r.tipo,
            giocatoreId: r.giocatoreIdSelezionato || null,
          })),
        ),
      );

      const result = await salvaMinutaggioImport(formData);

      if (!result.success) {
        showToast({ type: "error", message: result.message });
        return;
      }

      showToast({ type: "success", message: result.message });
      await onSaved();
      onClose();
    } catch (error) {
      console.error("Errore salvataggio minutaggio:", error);
      showToast({
        type: "error",
        message: "Errore imprevisto durante il salvataggio.",
      });
    } finally {
      setSalvando(false);
    }
  }

  return (
    <div className="fixed inset-0 z-[9999] flex items-end justify-center bg-black/70 p-0 backdrop-blur-sm sm:items-center sm:p-4">
      <div className="max-h-[92vh] w-full overflow-y-auto rounded-t-3xl border border-zinc-800 bg-zinc-950 sm:max-w-3xl sm:rounded-3xl">
        <div className="sticky top-0 z-10 flex items-center justify-between border-b border-zinc-800 bg-zinc-950/95 p-4 backdrop-blur sm:p-5">
          <div>
            <h2 className="text-lg font-bold text-white">
              Aggiungi Minutaggio
            </h2>
            <p className="text-sm text-zinc-500">
              Inserisci la formazione e i cambi, oppure carica il file
              MINUTAGGIO (tabella CAMBI) di una partita.
            </p>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="flex h-10 w-10 items-center justify-center rounded-xl bg-zinc-900 text-zinc-400 transition hover:text-white"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* MODALITÀ */}
        <div className="flex gap-2 border-b border-zinc-800 px-4 pt-4 sm:px-5">
          <button
            type="button"
            onClick={() => setModalita("manuale")}
            className={`flex items-center gap-2 rounded-t-xl px-4 py-2.5 text-sm font-bold transition ${
              modalita === "manuale"
                ? "bg-zinc-900 text-white"
                : "text-zinc-500 hover:text-zinc-300"
            }`}
          >
            <ClipboardList className="h-4 w-4" />
            Inserisci manualmente
          </button>

          <button
            type="button"
            onClick={() => setModalita("file")}
            className={`flex items-center gap-2 rounded-t-xl px-4 py-2.5 text-sm font-bold transition ${
              modalita === "file"
                ? "bg-zinc-900 text-white"
                : "text-zinc-500 hover:text-zinc-300"
            }`}
          >
            <Upload className="h-4 w-4" />
            Carica file Excel
          </button>
        </div>

        <div className="space-y-5 p-4 sm:p-5">
          {modalita === "manuale" && (
            <>
              {/* PARTITA */}
              <div className="rounded-2xl border border-zinc-800 bg-zinc-900/40 p-4">
                <h3 className="mb-3 text-sm font-bold uppercase tracking-wide text-zinc-400">
                  Partita
                </h3>

                <SelettorePartita
                  partite={partite}
                  value={partitaManuale}
                  onChange={setPartitaManuale}
                  placeholder="Seleziona la partita..."
                />

                <div className="mt-4 flex items-center gap-3">
                  <label className="text-sm font-medium text-zinc-300">
                    Durata partita
                  </label>
                  <input
                    type="number"
                    min={1}
                    max={200}
                    value={durataManuale}
                    onChange={(e) =>
                      setDurataManuale(Number(e.target.value) || 80)
                    }
                    className="w-20 rounded-lg border border-zinc-800 bg-zinc-900 px-2 py-1.5 text-sm text-white outline-none focus:border-zinc-600"
                  />
                  <span className="text-sm text-zinc-500">minuti</span>
                </div>
              </div>

              {partitaManuale && caricandoFormazione && (
                <div className="flex items-center justify-center gap-2 rounded-2xl border border-zinc-800 bg-zinc-900/40 p-6 text-sm text-zinc-400">
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Caricamento formazione...
                </div>
              )}

              {partitaManuale && !caricandoFormazione && !formazioneTrovata && (
                <div className="flex items-start gap-2 rounded-xl border border-amber-500/20 bg-amber-500/5 p-3 text-sm text-amber-300">
                  <AlertTriangle className="h-4 w-4 shrink-0 mt-0.5" />
                  <span>
                    Questa partita non ha ancora una formazione salvata. Vai
                    al tab &quot;Convocazioni&quot; della partita per
                    impostare titolari e panchina, poi torna qui per
                    registrare le sostituzioni.
                  </span>
                </div>
              )}

              {partitaManuale && !caricandoFormazione && formazioneTrovata && (
                <>
                  {/* FORMAZIONE TITOLARE 1-15 (ereditata, sola lettura) */}
                  <div>
                    <h3 className="mb-1 text-sm font-bold uppercase tracking-wide text-zinc-400">
                      Formazione titolare (in campo dal minuto 0)
                    </h3>

                    <p className="mb-3 text-xs text-zinc-500">
                      Ereditata dal tab Convocazioni della partita: non
                      modificabile da qui.
                    </p>

                    <div className="grid gap-2 sm:grid-cols-2">
                      {NUMERI_TITOLARI.filter(
                        (numero) => titolariManuali[numero - 1],
                      ).map((numero) => {
                        const giocatoreId = titolariManuali[numero - 1];
                        const giocatore = giocatoriMap.get(giocatoreId);

                        return (
                          <div
                            key={numero}
                            className="flex items-center gap-2.5 rounded-xl border border-zinc-800 bg-zinc-900/40 p-2"
                          >
                            <span
                              className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg text-xs font-black text-white"
                              style={{ backgroundColor: themeColor }}
                            >
                              {numero}
                            </span>

                            <GiocatoreAvatarMini giocatore={giocatore || null} />

                            <span className="min-w-0 flex-1 truncate text-sm font-semibold text-white">
                              {giocatore
                                ? `${giocatore.cognome} ${giocatore.nome}`
                                : "—"}
                            </span>
                          </div>
                        );
                      })}
                    </div>
                  </div>

                  {/* PANCHINA (ereditata, sola lettura) */}
                  <div>
                    <h3 className="mb-3 text-sm font-bold uppercase tracking-wide text-zinc-400">
                      Panchina (0&apos; finché non entrano)
                    </h3>

                    {panchinaManuale.length === 0 ? (
                      <p className="text-sm text-zinc-500">
                        Nessuna riserva convocata per questa partita.
                      </p>
                    ) : (
                      <div className="space-y-2">
                        {panchinaManuale.map((riga) => {
                          const minutoIngresso = primoIngressoPerGiocatore.get(
                            riga.giocatoreId,
                          );
                          const giocatore = giocatoriMap.get(riga.giocatoreId);

                          return (
                            <div
                              key={riga.id}
                              className="flex items-center gap-2.5 rounded-xl border border-zinc-800 bg-zinc-900/40 p-2"
                            >
                              <GiocatoreAvatarMini
                                giocatore={giocatore || null}
                              />

                              <span className="min-w-0 flex-1 truncate text-sm font-semibold text-white">
                                {giocatore
                                  ? `${giocatore.cognome} ${giocatore.nome}`
                                  : "—"}
                              </span>

                              <span
                                className={`shrink-0 rounded-full border px-2.5 py-1 text-xs font-bold ${
                                  minutoIngresso !== undefined
                                    ? "border-emerald-500/40 bg-emerald-500/10 text-emerald-300"
                                    : "border-zinc-700 bg-zinc-900 text-zinc-500"
                                }`}
                              >
                                {minutoIngresso !== undefined
                                  ? `Entra al ${minutoIngresso}'`
                                  : "0'"}
                              </span>
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </div>

                  {/* SOSTITUZIONI */}
                  <div>
                    <div className="mb-3 flex items-center justify-between">
                      <h3 className="text-sm font-bold uppercase tracking-wide text-zinc-400">
                        Sostituzioni
                      </h3>

                      <button
                        type="button"
                        onClick={aggiungiRigaCambio}
                        disabled={idPanchinaManuale.length === 0}
                        className="flex items-center gap-1.5 rounded-lg border border-zinc-800 bg-zinc-900 px-2.5 py-1.5 text-xs font-bold text-zinc-300 transition hover:border-zinc-600 hover:text-white disabled:cursor-not-allowed disabled:opacity-40"
                      >
                        <Plus className="h-3.5 w-3.5" />
                        Aggiungi cambio
                      </button>
                    </div>

                    {cambiManuali.length === 0 ? (
                      <p className="text-sm text-zinc-500">
                        Nessuna sostituzione registrata.
                      </p>
                    ) : (
                      <div className="space-y-2">
                        {cambiManuali.map((riga) => (
                          <div
                            key={riga.id}
                            className="flex flex-col gap-2 rounded-xl border border-zinc-800 bg-zinc-900/40 p-3 sm:flex-row sm:items-center"
                          >
                            <div className="flex shrink-0 items-center gap-1.5">
                              <input
                                type="number"
                                min={0}
                                max={200}
                                placeholder="Min"
                                value={riga.minuto}
                                onChange={(e) =>
                                  aggiornaRigaCambio(riga.id, {
                                    minuto: e.target.value,
                                  })
                                }
                                className="w-16 rounded-lg border border-zinc-800 bg-zinc-900 px-2 py-1.5 text-sm text-white outline-none focus:border-zinc-600"
                              />
                              <span className="text-xs text-zinc-500">
                                &apos;
                              </span>
                            </div>

                            <div className="flex min-w-0 flex-1 items-center gap-2">
                              <span className="shrink-0 rounded-lg bg-emerald-500/15 px-2 py-1 text-xs font-black uppercase text-emerald-300">
                                Entra
                              </span>

                              <select
                                value={riga.entraId}
                                onChange={(e) =>
                                  aggiornaRigaCambio(riga.id, {
                                    entraId: e.target.value,
                                  })
                                }
                                className="min-w-0 flex-1 rounded-lg border border-zinc-800 bg-zinc-900 px-2 py-1.5 text-sm text-white outline-none focus:border-zinc-600"
                              >
                                <option value="">Seleziona</option>
                                {panchinaManuale
                                  .filter((r) => r.giocatoreId)
                                  .map((r) => (
                                    <option
                                      key={r.giocatoreId}
                                      value={r.giocatoreId}
                                    >
                                      {nomeGiocatore(r.giocatoreId)}
                                    </option>
                                  ))}
                              </select>
                            </div>

                            <div className="flex min-w-0 flex-1 items-center gap-2">
                              <span className="shrink-0 rounded-lg bg-red-500/15 px-2 py-1 text-xs font-black uppercase text-red-300">
                                Esce
                              </span>

                              <select
                                value={riga.esceId}
                                onChange={(e) =>
                                  aggiornaRigaCambio(riga.id, {
                                    esceId: e.target.value,
                                  })
                                }
                                className="min-w-0 flex-1 rounded-lg border border-zinc-800 bg-zinc-900 px-2 py-1.5 text-sm text-white outline-none focus:border-zinc-600"
                              >
                                <option value="">Seleziona</option>
                                {[...titolariManuali, ...idPanchinaManuale]
                                  .filter(Boolean)
                                  .map((id) => (
                                    <option key={id} value={id}>
                                      {nomeGiocatore(id)}
                                    </option>
                                  ))}
                              </select>
                            </div>

                            <button
                              type="button"
                              onClick={() => rimuoviRigaCambio(riga.id)}
                              className="shrink-0 self-end rounded-lg p-1.5 text-zinc-500 transition hover:text-red-400 sm:self-center"
                              aria-label="Rimuovi sostituzione"
                            >
                              <Trash2 className="h-4 w-4" />
                            </button>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </>
              )}
            </>
          )}

          {modalita === "file" && !righeCambio && (
            <label className="flex min-h-40 cursor-pointer flex-col items-center justify-center gap-3 rounded-2xl border-2 border-dashed border-zinc-800 bg-zinc-900/40 p-6 text-center transition hover:border-zinc-600">
              <input
                type="file"
                accept=".xlsx,.xls"
                className="hidden"
                onChange={(e) => {
                  const selected = e.target.files?.[0];
                  if (selected) void handleFile(selected);
                }}
              />

              {caricamentoFile ? (
                <Loader2
                  className="h-8 w-8 animate-spin"
                  style={{ color: themeColor }}
                />
              ) : (
                <Upload className="h-8 w-8 text-zinc-500" />
              )}

              <div>
                <p className="font-semibold text-white">
                  {caricamentoFile
                    ? "Lettura file in corso..."
                    : "Trascina qui il file oppure clicca per selezionarlo"}
                </p>
                <p className="mt-1 text-xs text-zinc-500">
                  Formato .xlsx, foglio con tabella CAMBI (MINUTO/ENTRA/ESCE)
                </p>
              </div>
            </label>
          )}

          {modalita === "file" && erroreFile && (
            <div className="flex items-start gap-2 rounded-xl border border-red-500/20 bg-red-500/10 p-3 text-sm text-red-300">
              <AlertTriangle className="h-4 w-4 shrink-0 mt-0.5" />
              <span>{erroreFile}</span>
            </div>
          )}

          {modalita === "file" && righeCambio && (
            <>
              {/* PARTITA */}
              <div className="rounded-2xl border border-zinc-800 bg-zinc-900/40 p-4">
                <div className="mb-3 flex items-center justify-between gap-2">
                  <h3 className="text-sm font-bold uppercase tracking-wide text-zinc-400">
                    Partita associata
                  </h3>

                  {partitaAutoRilevata && partitaSelezionata && (
                    <span className="flex items-center gap-1 rounded-full border border-emerald-500/40 bg-emerald-500/10 px-2.5 py-1 text-xs font-bold text-emerald-300">
                      <CheckCircle2 className="h-3.5 w-3.5" />
                      Rilevata automaticamente
                    </span>
                  )}
                </div>

                {(avversarioRilevato || dataRilevata || luogoRilevato) && (
                  <p className="mb-3 text-xs text-zinc-500">
                    Dal file:{" "}
                    {avversarioRilevato && `vs ${avversarioRilevato} `}
                    {dataRilevata && `· ${dataRilevata} `}
                    {luogoRilevato && `· campo di ${luogoRilevato}`}
                  </p>
                )}

                <SelettorePartita
                  partite={partite}
                  value={partitaSelezionata}
                  onChange={(p) => {
                    setPartitaSelezionata(p);
                    setPartitaAutoRilevata(false);
                  }}
                  evidenziaVerde={partitaAutoRilevata}
                  placeholder="Seleziona la partita corretta..."
                />

                {!partitaSelezionata && (
                  <p className="mt-2 text-xs text-amber-400">
                    Puoi anche salvare senza associarla ora: la troverai
                    "da associare" nell&apos;elenco Minutaggi.
                  </p>
                )}

                <div className="mt-4 flex items-center gap-3">
                  <label className="text-sm font-medium text-zinc-300">
                    Durata partita
                  </label>
                  <input
                    type="number"
                    min={1}
                    max={200}
                    value={durataMinuti}
                    onChange={(e) =>
                      setDurataMinuti(Number(e.target.value) || 80)
                    }
                    className="w-20 rounded-lg border border-zinc-800 bg-zinc-900 px-2 py-1.5 text-sm text-white outline-none focus:border-zinc-600"
                  />
                  <span className="text-sm text-zinc-500">minuti</span>
                </div>
              </div>

              {/* CAMBI RILEVATI */}
              <div>
                <div className="mb-3 flex items-center justify-between">
                  <h3 className="text-sm font-bold uppercase tracking-wide text-zinc-400">
                    Cambi rilevati ({righeCambio.length})
                  </h3>

                  {contaNonCollegati > 0 && (
                    <span className="flex items-center gap-1.5 text-xs font-semibold text-amber-400">
                      <AlertTriangle className="h-3.5 w-3.5" />
                      {contaNonCollegati} non collegati a un giocatore
                    </span>
                  )}
                </div>

                <div className="space-y-2.5">
                  {righeCambio.map((riga) => {
                    const stato = classificazioneRiga(riga);
                    const giocatoreSelezionato = giocatori.find(
                      (g) => g.id === riga.giocatoreIdSelezionato,
                    );

                    return (
                      <div
                        key={riga.id}
                        className={`flex flex-col gap-3 rounded-2xl border p-3 sm:flex-row sm:items-center ${bordoClasse[stato]}`}
                      >
                        <div className="flex shrink-0 items-center gap-2">
                          <span
                            className={`rounded-lg px-2.5 py-1 text-xs font-black uppercase tracking-wide ${
                              riga.tipo === "entra"
                                ? "bg-emerald-500/15 text-emerald-300"
                                : "bg-red-500/15 text-red-300"
                            }`}
                          >
                            {riga.tipo === "entra" ? "Entra" : "Esce"}
                          </span>
                          <span className="text-sm font-bold text-zinc-300">
                            {riga.minuto}&apos;
                          </span>
                        </div>

                        <div className="flex min-w-0 flex-1 items-center gap-3">
                          <GiocatoreAvatarMini
                            giocatore={giocatoreSelezionato || null}
                          />

                          <div className="min-w-0 flex-1">
                            <p className="truncate text-xs text-zinc-500">
                              Dal file:{" "}
                              <span className="text-zinc-300">
                                {riga.nomeTesto}
                              </span>
                            </p>

                            <select
                              value={riga.giocatoreIdSelezionato}
                              onChange={(e) =>
                                aggiornaSelezioneGiocatore(
                                  riga.id,
                                  e.target.value,
                                )
                              }
                              className="mt-1 w-full min-w-0 rounded-lg border border-zinc-800 bg-zinc-900 px-2 py-1.5 text-sm text-white outline-none focus:border-zinc-600"
                            >
                              <option value="">
                                Nessuno / ignora questo cambio
                              </option>
                              {giocatori.map((g) => (
                                <option key={g.id} value={g.id}>
                                  {g.cognome} {g.nome}
                                </option>
                              ))}
                            </select>
                          </div>

                          <span className="shrink-0">
                            {stato === "verde" && (
                              <CheckCircle2 className="h-5 w-5 text-emerald-400" />
                            )}
                            {stato === "giallo" && (
                              <AlertTriangle className="h-5 w-5 text-amber-400" />
                            )}
                            {stato === "rosso" && (
                              <X className="h-5 w-5 text-red-400" />
                            )}
                          </span>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>

              {avvisi.length > 0 && (
                <div className="rounded-xl border border-amber-500/20 bg-amber-500/5 p-3 text-xs leading-5 text-amber-300">
                  {avvisi.map((avviso, i) => (
                    <p key={i}>{avviso}</p>
                  ))}
                </div>
              )}
            </>
          )}
        </div>

        {modalita === "manuale" && partitaManuale && (
          <div className="sticky bottom-0 flex flex-col-reverse gap-2 border-t border-zinc-800 bg-zinc-950/95 p-4 backdrop-blur sm:flex-row sm:items-center sm:justify-end sm:p-5">
            {erroreManuale && (
              <p className="text-xs text-amber-400 sm:mr-auto">
                {erroreManuale}
              </p>
            )}

            <button
              type="button"
              onClick={onClose}
              className="min-h-11 rounded-xl border border-zinc-800 px-4 text-sm font-semibold text-zinc-300 transition hover:bg-zinc-900"
            >
              Annulla
            </button>

            <button
              type="button"
              onClick={handleConfermaManuale}
              disabled={salvandoManuale || Boolean(erroreManuale)}
              className="flex min-h-11 items-center justify-center gap-2 rounded-xl px-5 text-sm font-semibold text-white transition hover:brightness-110 disabled:cursor-not-allowed disabled:opacity-50"
              style={{ backgroundColor: themeColor }}
            >
              {salvandoManuale && <Loader2 className="h-4 w-4 animate-spin" />}
              {salvandoManuale ? "Salvataggio..." : "Salva minutaggio"}
            </button>
          </div>
        )}

        {modalita === "file" && righeCambio && (
          <div className="sticky bottom-0 flex flex-col-reverse gap-2 border-t border-zinc-800 bg-zinc-950/95 p-4 backdrop-blur sm:flex-row sm:justify-end sm:p-5">
            <button
              type="button"
              onClick={onClose}
              className="min-h-11 rounded-xl border border-zinc-800 px-4 text-sm font-semibold text-zinc-300 transition hover:bg-zinc-900"
            >
              Annulla
            </button>

            <button
              type="button"
              onClick={handleConferma}
              disabled={salvando}
              className="flex min-h-11 items-center justify-center gap-2 rounded-xl px-5 text-sm font-semibold text-white transition hover:brightness-110 disabled:cursor-not-allowed disabled:opacity-50"
              style={{ backgroundColor: themeColor }}
            >
              {salvando && <Loader2 className="h-4 w-4 animate-spin" />}
              {salvando ? "Salvataggio..." : "Conferma import"}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
