"use client";

import { useMemo, useState } from "react";
import Papa from "papaparse";
import {
  Upload,
  FileText,
  CheckCircle2,
  AlertTriangle,
  CalendarDays,
  Dumbbell,
  Trophy,
  UserCheck,
  UserX,
  Columns3,
  Settings2,
  Trash2,
  Database,
  PencilLine,
  ListChecks,
  X,
} from "lucide-react";

import GestisciDefinizioniCatapultModal from "@/components/performance/GestisciDefinizioniCatapultModal";

import {
  confermaImportazioneCatapult,
  eliminaImportazioneCatapult,
} from "@/app/(dashboard)/performance/importa-dati/actions";

type TipoSeduta = "allenamento" | "partita" | null;

type Giocatore = {
  id: string;
  nome: string;
  cognome: string;
};

type ImportDefinition = {
  id: string;
  provider: string;
  campo_origine: string;
  valore_origine: string;
  valore_destinazione: string;
  categoria: string;
  tipo_match: "exact" | "contains" | "starts_with";
  attivo: boolean;
};

type CatapultImportazione = {
  id: string;
  nome: string;
  filename: string | null;
  data_seduta: string | null;
  tipo_seduta: TipoSeduta;
  numero_righe: number;
  numero_giocatori_trovati: number;
  numero_giocatori_non_trovati: number;
  created_at: string;
};

type Props = {
  profilo: {
    id: string;
    last_club_id: string;
    last_squadra_id: string | null;
  };
  club: {
    nome: string;
    colore_flag: string;
  };
  squadra: {
    nome: string;
  };
  giocatori: Giocatore[];
  definitions: ImportDefinition[];
  importazioni: CatapultImportazione[];
  isAdmin: boolean;
};

type CatapultPreviewRow = {
  giocatore_id: string | null;
  giocatore_trovato: boolean;
  giocatore_nome_completo: string | null;
  data_seduta: string;
  tipo_seduta: TipoSeduta;
  raw_data: Record<string, unknown>;
};

/** Unica colonna modificabile nell'anteprima. */
const CAMPO_MODIFICABILE = "Player Name";

type AliasGiocatore = {
  /** Valore come compare in Player Name nell'export Catapult. */
  valore: string;
  /** Prefisso del nome del giocatore in rosa (normalizzato). */
  nomeInizia: string;
  /** Prefisso del cognome in rosa, senza spazi (normalizzato). */
  cognomeInizia: string;
  /** Solo per il tooltip in anteprima. */
  etichetta: string;
};

/**
 * Nomi che Catapult esporta senza corrispondenza in rosa: cognome
 * troncato/errato (Di Pietra invece di Di Pietro) e nome abbreviato.
 * L'abbinamento avviene per prefisso di nome e cognome, così regge anche se
 * in anagrafica il cognome è scritto "Di Pietro", "DiPietro" o "Di Pietra".
 * Per aggiungerne altri basta una riga.
 */
const ALIAS_GIOCATORI_CATAPULT: AliasGiocatore[] = [
  {
    valore: "DI PIETRA GAS",
    nomeInizia: "gas",
    cognomeInizia: "dipietr",
    etichetta: "Gaspare Di Pietro",
  },
  {
    valore: "DI PIETRA GAB",
    nomeInizia: "gab",
    cognomeInizia: "dipietr",
    etichetta: "Gabriele Di Pietro",
  },
];

function normalizeText(value: unknown) {
  return String(value ?? "")
    .trim()
    .toLocaleLowerCase("it-IT")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/\s+/g, " ");
}

function excelSerialDateToISO(value: unknown) {
  if (value === null || value === undefined || value === "") {
    return "";
  }

  const rawValue = String(value).trim();
  const serial = Number(rawValue);

  if (Number.isFinite(serial) && serial > 20000) {
    const excelEpoch = new Date(Date.UTC(1899, 11, 30));
    const date = new Date(
      excelEpoch.getTime() + Math.floor(serial) * 86400000
    );

    return date.toISOString().slice(0, 10);
  }

  const isoMatch = rawValue.match(/^(\d{4})-(\d{2})-(\d{2})$/);

  if (isoMatch) {
    return rawValue;
  }

  const usMatch = rawValue.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);

  if (usMatch) {
    const month = usMatch[1].padStart(2, "0");
    const day = usMatch[2].padStart(2, "0");
    const year = usMatch[3];

    return `${year}-${month}-${day}`;
  }

  return "";
}

function formatDateItalian(value: string | null) {
  if (!value) return "-";

  const [year, month, day] = value.split("-");

  if (!year || !month || !day) {
    return value;
  }

  return `${day}/${month}/${year}`;
}

function formatDateTimeItalian(value: string | null) {
  if (!value) return "-";

  return new Date(value).toLocaleString("it-IT", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function detectTipoSeduta(
  row: Record<string, unknown>,
  definitions: ImportDefinition[]
): TipoSeduta {
  const regoleTipoSeduta = definitions.filter(
    (definition) =>
      definition.provider === "catapult" &&
      definition.categoria === "tipo_seduta" &&
      definition.attivo
  );

  for (const definition of regoleTipoSeduta) {
    const rawValue = row[definition.campo_origine];

    const normalizedValue = normalizeText(rawValue);
    const normalizedOrigin = normalizeText(definition.valore_origine);

    if (!normalizedValue || !normalizedOrigin) {
      continue;
    }

    let matched = false;

    switch (definition.tipo_match) {
      case "exact":
        matched = normalizedValue === normalizedOrigin;
        break;

      case "starts_with":
        matched = normalizedValue.startsWith(normalizedOrigin);
        break;

      case "contains":
      default:
        matched = normalizedValue.includes(normalizedOrigin);
        break;
    }

    if (matched) {
      const destination = normalizeText(definition.valore_destinazione);

      if (destination === "allenamento" || destination === "partita") {
        return destination;
      }
    }
  }

  return null;
}

/** Come normalizeText, ma anche senza spazi: "Di Pietro" -> "dipietro". */
function compattaNome(value: unknown) {
  return normalizeText(value).replace(/ /g, "");
}

/**
 * Restituisce l'alias corrispondente al valore esportato da Catapult,
 * se ce n'è uno. Altrimenti null.
 */
function trovaAliasGiocatore(playerName: unknown): AliasGiocatore | null {
  const normalizedPlayerName = normalizeText(playerName);

  if (!normalizedPlayerName) {
    return null;
  }

  return (
    ALIAS_GIOCATORI_CATAPULT.find(
      (alias) => normalizeText(alias.valore) === normalizedPlayerName
    ) ?? null
  );
}

function findGiocatore(
  playerName: unknown,
  giocatori: Giocatore[]
): Giocatore | null {
  const alias = trovaAliasGiocatore(playerName);

  if (alias) {
    const giocatoreAlias = giocatori.find(
      (giocatore) =>
        compattaNome(giocatore.cognome).startsWith(alias.cognomeInizia) &&
        compattaNome(giocatore.nome).startsWith(alias.nomeInizia)
    );

    if (giocatoreAlias) {
      return giocatoreAlias;
    }
  }

  const normalizedPlayerName = normalizeText(playerName);

  if (!normalizedPlayerName) {
    return null;
  }

  const matchNome = giocatori.find(
    (giocatore) => normalizeText(giocatore.nome) === normalizedPlayerName
  );

  if (matchNome) return matchNome;

  const matchCognome = giocatori.find(
    (giocatore) => normalizeText(giocatore.cognome) === normalizedPlayerName
  );

  if (matchCognome) return matchCognome;

  const matchNomeCognome = giocatori.find((giocatore) => {
    const nomeCognome = normalizeText(
      `${giocatore.nome} ${giocatore.cognome}`
    );

    return nomeCognome === normalizedPlayerName;
  });

  if (matchNomeCognome) return matchNomeCognome;

  const matchCognomeNome = giocatori.find((giocatore) => {
    const cognomeNome = normalizeText(
      `${giocatore.cognome} ${giocatore.nome}`
    );

    return cognomeNome === normalizedPlayerName;
  });

  if (matchCognomeNome) return matchCognomeNome;

  return null;
}

function normalizeCatapultRow(
  row: Record<string, unknown>,
  giocatori: Giocatore[],
  definitions: ImportDefinition[]
): CatapultPreviewRow {
  const giocatore = findGiocatore(row["Player Name"], giocatori);

  return {
    giocatore_id: giocatore?.id ?? null,
    giocatore_trovato: Boolean(giocatore),
    giocatore_nome_completo: giocatore
      ? `${giocatore.nome} ${giocatore.cognome}`
      : null,
    data_seduta: excelSerialDateToISO(row["Date"]),
    tipo_seduta: detectTipoSeduta(row, definitions),
    raw_data: row,
  };
}

/**
 * Maiuscolo applicato in scrittura, non solo via CSS: il valore che finisce
 * nel database dev'essere già normalizzato.
 */
function normalizzaPlayerName(valore: string) {
  return valore.toLocaleUpperCase("it-IT");
}

function formatCellValue(value: unknown) {
  if (value === null || value === undefined || value === "") {
    return "-";
  }

  return String(value);
}

export default function ImportaDatiPerformanceClient({
  club,
  squadra,
  giocatori,
  definitions,
  importazioni,
  isAdmin,
}: Props) {
  const [activeTab, setActiveTab] = useState<"lista" | "importa">("lista");

  const [nomeImportazione, setNomeImportazione] = useState("");
  const [openDefinitions, setOpenDefinitions] = useState(false);
  const [filename, setFilename] = useState("");

  const [previewRows, setPreviewRows] = useState<CatapultPreviewRow[]>([]);
  const [csvColumns, setCsvColumns] = useState<string[]>([]);

  const [openModificaMultipla, setOpenModificaMultipla] = useState(false);
  const [valoreDaSostituire, setValoreDaSostituire] = useState("");
  const [nuovoValore, setNuovoValore] = useState("");

  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  const [isImporting, setIsImporting] = useState(false);
  const [isDeletingId, setIsDeletingId] = useState<string | null>(null);

  const dataSedutaRilevata = useMemo(() => {
    const dates = previewRows.map((row) => row.data_seduta).filter(Boolean);

    return dates[0] ?? "";
  }, [previewRows]);

  const tipoSedutaRilevato = useMemo<TipoSeduta>(() => {
    const tipi = previewRows
      .map((row) => row.tipo_seduta)
      .filter((tipo): tipo is Exclude<TipoSeduta, null> => tipo !== null);

    return tipi[0] ?? null;
  }, [previewRows]);

  const giocatoriTrovati = useMemo(() => {
    return previewRows.filter((row) => row.giocatore_trovato).length;
  }, [previewRows]);

  const giocatoriNonTrovati = useMemo(() => {
    return previewRows.filter((row) => !row.giocatore_trovato).length;
  }, [previewRows]);

  const nomiRosa = useMemo(() => {
    return giocatori
      .map((giocatore) => `${giocatore.nome} ${giocatore.cognome}`)
      .sort((a, b) => a.localeCompare(b, "it-IT"));
  }, [giocatori]);

  /**
   * Valori distinti di Player Name con le righe in cui compaiono e lo stato
   * di abbinamento: sono le opzioni della modifica multipla.
   */
  const valoriPlayerName = useMemo(() => {
    const mappa = new Map<
      string,
      { valore: string; righe: number[]; trovato: boolean }
    >();

    previewRows.forEach((row, index) => {
      const valore = String(row.raw_data["Player Name"] ?? "").trim();
      const chiave = normalizeText(valore);

      const esistente = mappa.get(chiave);

      if (esistente) {
        esistente.righe.push(index);
        return;
      }

      mappa.set(chiave, {
        valore,
        righe: [index],
        trovato: row.giocatore_trovato,
      });
    });

    return Array.from(mappa.values()).sort((a, b) =>
      a.valore.localeCompare(b.valore, "it-IT")
    );
  }, [previewRows]);

  const righeSenzaNome = useMemo(() => {
    return previewRows.filter(
      (row) => String(row.raw_data["Player Name"] ?? "").trim() === ""
    ).length;
  }, [previewRows]);

  /** Righe che verranno toccate dalla modifica multipla. */
  const righeInteressate = useMemo(() => {
    return (
      valoriPlayerName.find(
        (valore) => normalizeText(valore.valore) === valoreDaSostituire
      )?.righe ?? []
    );
  }, [valoreDaSostituire, valoriPlayerName]);

  function aggiornaRighe(indici: number[], valore: string) {
    const valoreNormalizzato = normalizzaPlayerName(valore);
    const daAggiornare = new Set(indici);

    setPreviewRows((prev) =>
      prev.map((row, index) => {
        if (!daAggiornare.has(index)) {
          return row;
        }

        // Ricalcola l'intera riga, non solo la cella: cambia anche
        // l'abbinamento con la rosa.
        return normalizeCatapultRow(
          { ...row.raw_data, [CAMPO_MODIFICABILE]: valoreNormalizzato },
          giocatori,
          definitions
        );
      })
    );
  }

  function apriModificaMultipla() {
    const primoNonAbbinato = valoriPlayerName.find(
      (valore) => !valore.trovato
    );

    const valoreIniziale =
      primoNonAbbinato ?? valoriPlayerName[0] ?? null;

    setValoreDaSostituire(
      valoreIniziale ? normalizeText(valoreIniziale.valore) : ""
    );

    setNuovoValore("");
    setOpenModificaMultipla(true);
  }

  function applicaModificaMultipla() {
    setError(null);

    if (righeInteressate.length === 0) {
      setError("Scegli il nome da sostituire.");
      return;
    }

    if (!nuovoValore.trim()) {
      setError("Inserisci il nuovo nome.");
      return;
    }

    aggiornaRighe(righeInteressate, nuovoValore.trim());

    setOpenModificaMultipla(false);
    setValoreDaSostituire("");
    setNuovoValore("");
  }

  function handleFile(file: File) {
    setError(null);
    setSuccess(null);
    setFilename(file.name);
    setPreviewRows([]);
    setCsvColumns([]);
    setOpenModificaMultipla(false);
    setValoreDaSostituire("");
    setNuovoValore("");

    Papa.parse<Record<string, unknown>>(file, {
      header: true,
      skipEmptyLines: true,

      complete: (result) => {
        if (result.errors.length > 0) {
          const firstError = result.errors[0];

          setError(`Errore CSV: ${firstError.message}`);
          return;
        }

        const columns = result.meta.fields ?? [];

        setCsvColumns(columns);

        const rows = result.data
          .map((row) => normalizeCatapultRow(row, giocatori, definitions))
          .filter((row) => {
            const playerName = String(row.raw_data["Player Name"] ?? "").trim();

            return playerName.length > 0;
          });

        if (rows.length === 0) {
          setError(
            "Il file non contiene righe Catapult valide con Player Name."
          );
          return;
        }

        setPreviewRows(rows);

        if (!nomeImportazione) {
          setNomeImportazione(file.name.replace(/\.csv$/i, ""));
        }
      },

      error: () => {
        setError("Errore durante la lettura del file CSV.");
      },
    });
  }

  async function handleConfirmImport() {
    setError(null);
    setSuccess(null);

    if (!isAdmin) {
      setError("Non hai i permessi per importare dati di Performance.");
      return;
    }

    if (!nomeImportazione.trim()) {
      setError("Inserisci un nome per l'importazione.");
      return;
    }

    if (previewRows.length === 0) {
      setError("Carica prima un file CSV Catapult.");
      return;
    }

    if (righeSenzaNome > 0) {
      setError(
        `Ci sono ${righeSenzaNome} righe senza Player Name: compilale o ricarica il file.`
      );
      return;
    }

    try {
      setIsImporting(true);

      await confermaImportazioneCatapult({
        nome: nomeImportazione,
        filename,
        data_seduta: dataSedutaRilevata || null,
        tipo_seduta: tipoSedutaRilevato,
        rows: previewRows,
      });

      setSuccess("Importazione completata correttamente.");
      setPreviewRows([]);
      setCsvColumns([]);
      setOpenModificaMultipla(false);
      setValoreDaSostituire("");
      setNuovoValore("");
      setFilename("");
      setNomeImportazione("");
      setActiveTab("lista");

      window.location.reload();
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "Errore durante l'importazione."
      );
    } finally {
      setIsImporting(false);
    }
  }

  async function handleDeleteImportazione(importazioneId: string) {
    if (!isAdmin) return;

    const conferma = window.confirm(
      "Vuoi eliminare questa importazione? Verranno eliminati anche tutti i dati collegati."
    );

    if (!conferma) return;

    setError(null);
    setSuccess(null);

    try {
      setIsDeletingId(importazioneId);

      await eliminaImportazioneCatapult(importazioneId);

      setSuccess("Importazione eliminata correttamente.");
      window.location.reload();
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "Errore durante l'eliminazione."
      );
    } finally {
      setIsDeletingId(null);
    }
  }

  return (
    <div className="w-full min-w-0 max-w-full space-y-6 overflow-hidden">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <p className="text-sm text-zinc-400">Performance</p>

          <h1 className="text-2xl font-semibold text-white">
            Importa Dati
          </h1>
        </div>

        <button
          type="button"
          onClick={() => setOpenDefinitions(true)}
          className="inline-flex shrink-0 items-center justify-center gap-2 rounded-xl border border-zinc-800 bg-zinc-900/60 px-4 py-2.5 text-sm font-semibold text-white transition hover:border-zinc-600 hover:bg-zinc-900"
        >
          <Settings2 className="h-4 w-4 text-zinc-400" />
          Gestisci definizioni
        </button>
      </div>

      <div
        className="w-full min-w-0 rounded-2xl border p-5"
        style={{
          borderColor: `${club.colore_flag}55`,
          background: `linear-gradient(
            135deg,
            ${club.colore_flag}22,
            rgba(24,24,27,0.95)
          )`,
        }}
      >
        <p className="text-sm text-zinc-400">Importazione per</p>

        <p className="truncate text-lg font-semibold text-white">
          {club.nome} — {squadra.nome}
        </p>
      </div>

      <div className="flex rounded-2xl border border-zinc-800 bg-zinc-950 p-1">
        <button
          type="button"
          onClick={() => setActiveTab("lista")}
          className="flex-1 rounded-xl px-4 py-2.5 text-sm font-semibold transition"
          style={{
            backgroundColor:
              activeTab === "lista" ? club.colore_flag : "transparent",
            color: activeTab === "lista" ? "white" : "#a1a1aa",
          }}
        >
          Importazioni Catapult
        </button>

        <button
          type="button"
          onClick={() => setActiveTab("importa")}
          className="flex-1 rounded-xl px-4 py-2.5 text-sm font-semibold transition"
          style={{
            backgroundColor:
              activeTab === "importa" ? club.colore_flag : "transparent",
            color: activeTab === "importa" ? "white" : "#a1a1aa",
          }}
        >
          Nuova importazione
        </button>
      </div>

      {error && (
        <div className="flex items-center gap-2 rounded-xl border border-red-900 bg-red-950/50 p-3 text-sm text-red-300">
          <AlertTriangle className="h-4 w-4 shrink-0" />
          {error}
        </div>
      )}

      {success && (
        <div className="flex items-center gap-2 rounded-xl border border-emerald-900 bg-emerald-950/50 p-3 text-sm text-emerald-300">
          <CheckCircle2 className="h-4 w-4 shrink-0" />
          {success}
        </div>
      )}

      {activeTab === "lista" && (
        <div className="rounded-2xl border border-zinc-800 bg-zinc-950">
          <div className="border-b border-zinc-800 p-5">
            <div className="flex items-center gap-2">
              <Database className="h-5 w-5 text-zinc-400" />

              <h2 className="text-lg font-semibold text-white">
                Importazioni Catapult
              </h2>
            </div>

            <p className="mt-1 text-sm text-zinc-400">
              Elenco delle importazioni salvate per il club e la squadra
              attiva.
            </p>
          </div>

          {importazioni.length === 0 ? (
            <div className="p-8 text-center">
              <FileText className="mx-auto mb-3 h-8 w-8 text-zinc-500" />

              <p className="font-medium text-white">
                Nessuna importazione presente
              </p>

              <p className="mt-1 text-sm text-zinc-400">
                Carica un file Catapult dalla tab “Nuova importazione”.
              </p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full min-w-[950px] text-left text-sm">
                <thead className="bg-zinc-900 text-zinc-400">
                  <tr>
                    <th className="px-5 py-3">Nome importazione</th>
                    <th className="px-5 py-3">File</th>
                    <th className="px-5 py-3">Data importazione</th>
                    <th className="px-5 py-3">Data seduta</th>
                    <th className="px-5 py-3">Tipo</th>
                    <th className="px-5 py-3">Righe</th>
                    <th className="px-5 py-3">Giocatori</th>
                    <th className="px-5 py-3 text-right">Azioni</th>
                  </tr>
                </thead>

                <tbody>
                  {importazioni.map((importazione) => (
                    <tr
                      key={importazione.id}
                      className="border-t border-zinc-900"
                    >
                      <td className="px-5 py-4">
                        <p className="font-semibold text-white">
                          {importazione.nome}
                        </p>
                      </td>

                      <td className="px-5 py-4 text-zinc-400">
                        {importazione.filename ?? "-"}
                      </td>

                      <td className="px-5 py-4 text-zinc-300">
                        {formatDateTimeItalian(importazione.created_at)}
                      </td>

                      <td className="px-5 py-4 text-zinc-300">
                        {formatDateItalian(importazione.data_seduta)}
                      </td>

                      <td className="px-5 py-4 text-zinc-300 capitalize">
                        {importazione.tipo_seduta ?? "-"}
                      </td>

                      <td className="px-5 py-4 text-zinc-300">
                        {importazione.numero_righe}
                      </td>

                      <td className="px-5 py-4 text-zinc-300">
                        <span className="text-emerald-400">
                          {importazione.numero_giocatori_trovati}
                        </span>
                        {" / "}
                        <span className="text-amber-400">
                          {importazione.numero_giocatori_non_trovati}
                        </span>
                      </td>

                      <td className="px-5 py-4 text-right">
                        {isAdmin && (
                          <button
                            type="button"
                            disabled={isDeletingId === importazione.id}
                            onClick={() =>
                              handleDeleteImportazione(importazione.id)
                            }
                            className="inline-flex items-center justify-center gap-2 rounded-xl border border-red-900/70 bg-red-950/40 px-3 py-2 text-xs font-semibold text-red-300 transition hover:bg-red-950 disabled:cursor-not-allowed disabled:opacity-50"
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                            {isDeletingId === importazione.id
                              ? "Elimino..."
                              : "Elimina dati"}
                          </button>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {activeTab === "importa" && (
        <>
          <div className="w-full min-w-0 rounded-2xl border border-zinc-800 bg-zinc-950 p-5">
            <div>
              <label className="mb-2 block text-sm text-zinc-300">
                Nome importazione
              </label>

              <input
                value={nomeImportazione}
                onChange={(e) => setNomeImportazione(e.target.value)}
                placeholder="Es. Catapult Allenamento 03/07/2026"
                className="w-full min-w-0 rounded-xl border border-zinc-800 bg-zinc-900 px-4 py-3 text-white outline-none focus:border-zinc-500"
              />
            </div>

            <label className="mt-5 flex cursor-pointer flex-col items-center justify-center rounded-2xl border border-dashed border-zinc-700 bg-zinc-900/60 p-8 text-center transition hover:border-zinc-500">
              <Upload className="mb-3 h-8 w-8 text-zinc-400" />

              <span className="font-medium text-white">
                Carica file CSV Catapult
              </span>

              <span className="mt-1 text-sm text-zinc-400">
                Data, tipo seduta e giocatori saranno individuati
                automaticamente
              </span>

              <input
                type="file"
                accept=".csv"
                className="hidden"
                onChange={(e) => {
                  const file = e.target.files?.[0];

                  if (file) {
                    handleFile(file);
                  }
                }}
              />
            </label>

            {filename && (
              <div className="mt-4 flex min-w-0 items-center gap-2 text-sm text-zinc-300">
                <FileText className="h-4 w-4 shrink-0" />

                <span className="truncate">{filename}</span>
              </div>
            )}
          </div>

          {previewRows.length > 0 && (
            <>
              <div className="grid min-w-0 gap-4 sm:grid-cols-2 xl:grid-cols-4">
                <div className="min-w-0 rounded-2xl border border-zinc-800 bg-zinc-950 p-4">
                  <div className="flex items-center gap-2 text-zinc-400">
                    <CalendarDays className="h-4 w-4 shrink-0" />

                    <span className="truncate text-sm">
                      Data rilevata
                    </span>
                  </div>

                  <p className="mt-2 truncate font-semibold text-white">
                    {formatDateItalian(dataSedutaRilevata)}
                  </p>
                </div>

                <div className="min-w-0 rounded-2xl border border-zinc-800 bg-zinc-950 p-4">
                  <div className="flex items-center gap-2 text-zinc-400">
                    {tipoSedutaRilevato === "partita" ? (
                      <Trophy className="h-4 w-4 shrink-0" />
                    ) : (
                      <Dumbbell className="h-4 w-4 shrink-0" />
                    )}

                    <span className="truncate text-sm">Tipo seduta</span>
                  </div>

                  <p className="mt-2 truncate font-semibold capitalize text-white">
                    {tipoSedutaRilevato ?? "Non rilevato"}
                  </p>
                </div>

                <div className="min-w-0 rounded-2xl border border-zinc-800 bg-zinc-950 p-4">
                  <div className="flex items-center gap-2 text-emerald-400">
                    <UserCheck className="h-4 w-4 shrink-0" />

                    <span className="truncate text-sm">
                      Giocatori trovati
                    </span>
                  </div>

                  <p className="mt-2 text-xl font-semibold text-white">
                    {giocatoriTrovati}
                  </p>
                </div>

                <div className="min-w-0 rounded-2xl border border-zinc-800 bg-zinc-950 p-4">
                  <div className="flex items-center gap-2 text-amber-400">
                    <UserX className="h-4 w-4 shrink-0" />

                    <span className="truncate text-sm">Non trovati</span>
                  </div>

                  <p className="mt-2 text-xl font-semibold text-white">
                    {giocatoriNonTrovati}
                  </p>
                </div>
              </div>

              <datalist id="catapult-nomi-rosa">
                {nomiRosa.map((nome) => (
                  <option key={nome} value={nome} />
                ))}
              </datalist>

              <div className="w-full min-w-0 max-w-full overflow-hidden rounded-2xl border border-zinc-800 bg-zinc-950">
                <div className="flex min-w-0 flex-col gap-4 border-b border-zinc-800 p-5 lg:flex-row lg:items-center lg:justify-between">
                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      <Columns3 className="h-5 w-5 shrink-0 text-zinc-400" />

                      <h2 className="truncate text-lg font-semibold text-white">
                        Anteprima dati CSV
                      </h2>
                    </div>

                    <p className="mt-1 text-sm text-zinc-400">
                      {previewRows.length} righe lette · {csvColumns.length}{" "}
                      colonne trovate
                    </p>

                    <p className="mt-1 text-xs text-zinc-500">
                      {isAdmin
                        ? "Correggi Player Name direttamente in tabella: viene salvato in maiuscolo e l'abbinamento si aggiorna subito."
                        : "Scorri orizzontalmente per visualizzare tutte le colonne"}
                    </p>
                  </div>

                  {isAdmin && (
                    <div className="flex shrink-0 flex-col gap-2 sm:flex-row sm:items-center">
                      <button
                        type="button"
                        onClick={apriModificaMultipla}
                        className="inline-flex items-center justify-center gap-2 rounded-xl border border-zinc-700 bg-zinc-900 px-4 py-2 text-sm font-medium text-white transition hover:border-zinc-500 hover:bg-zinc-800"
                      >
                        <PencilLine className="h-4 w-4 text-zinc-400" />
                        Modifica più righe
                      </button>

                      <button
                        type="button"
                        disabled={isImporting}
                        onClick={handleConfirmImport}
                        className="inline-flex items-center justify-center gap-2 rounded-xl px-4 py-2 text-sm font-medium text-white transition hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-60"
                        style={{
                          backgroundColor: club.colore_flag,
                        }}
                      >
                        <CheckCircle2 className="h-4 w-4" />
                        {isImporting
                          ? "Importazione..."
                          : "Conferma importazione"}
                      </button>
                    </div>
                  )}
                </div>

                <div className="block w-full min-w-0 max-w-full overflow-x-auto overflow-y-hidden overscroll-x-contain">
                  <table className="min-w-max border-collapse text-left text-sm">
                    <thead className="bg-zinc-900 text-zinc-400">
                      <tr>
                        <th className="sticky left-0 z-30 min-w-[150px] whitespace-nowrap border-r border-zinc-800 bg-zinc-900 px-4 py-3">
                          Stato giocatore
                        </th>

                        <th className="sticky left-[150px] z-30 min-w-[220px] whitespace-nowrap border-r border-zinc-800 bg-zinc-900 px-4 py-3">
                          Giocatore associato
                        </th>

                        {csvColumns.map((column) => (
                          <th
                            key={column}
                            className="min-w-[160px] whitespace-nowrap border-r border-zinc-800/60 px-4 py-3 last:border-r-0"
                          >
                            <span className="inline-flex items-center gap-1.5">
                              {column}

                              {isAdmin && column === CAMPO_MODIFICABILE && (
                                <PencilLine className="h-3.5 w-3.5 shrink-0 text-zinc-500" />
                              )}
                            </span>
                          </th>
                        ))}
                      </tr>
                    </thead>

                    <tbody>
                      {previewRows.map((row, index) => {
                        const alias = trovaAliasGiocatore(
                          row.raw_data[CAMPO_MODIFICABILE]
                        );

                        return (
                          <tr
                            key={index}
                            className="border-t border-zinc-900 transition hover:bg-zinc-900/40"
                          >
                            <td className="sticky left-0 z-20 min-w-[150px] whitespace-nowrap border-r border-zinc-800 bg-zinc-950 px-4 py-3">
                              {row.giocatore_trovato ? (
                                <span className="inline-flex items-center gap-1.5 rounded-full border border-emerald-800 bg-emerald-950/50 px-2.5 py-1 text-xs font-medium text-emerald-300">
                                  <UserCheck className="h-3.5 w-3.5" />
                                  Trovato
                                </span>
                              ) : (
                                <span className="inline-flex items-center gap-1.5 rounded-full border border-amber-800 bg-amber-950/50 px-2.5 py-1 text-xs font-medium text-amber-300">
                                  <UserX className="h-3.5 w-3.5" />
                                  Non trovato
                                </span>
                              )}
                            </td>

                            <td className="sticky left-[150px] z-20 min-w-[220px] whitespace-nowrap border-r border-zinc-800 bg-zinc-950 px-4 py-3">
                              {row.giocatore_nome_completo ? (
                                <div className="flex items-center gap-2">
                                  <p className="font-medium text-white">
                                    {row.giocatore_nome_completo}
                                  </p>

                                  {alias && (
                                    <span
                                      title={`Riconosciuto tramite alias: ${alias.etichetta}`}
                                      className="rounded-full border border-zinc-700 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-zinc-400"
                                    >
                                      alias
                                    </span>
                                  )}
                                </div>
                              ) : (
                                <span className="text-zinc-500">-</span>
                              )}
                            </td>

                            {csvColumns.map((column) => {
                              const value = row.raw_data[column];

                              if (isAdmin && column === CAMPO_MODIFICABILE) {
                                return (
                                  <td
                                    key={column}
                                    className="min-w-[230px] border-r border-zinc-900 px-3 py-2 last:border-r-0"
                                  >
                                    <input
                                      value={String(value ?? "")}
                                      list="catapult-nomi-rosa"
                                      spellCheck={false}
                                      autoComplete="off"
                                      onChange={(e) =>
                                        aggiornaRighe([index], e.target.value)
                                      }
                                      onKeyDown={(e) => {
                                        if (e.key === "Enter") {
                                          e.currentTarget.blur();
                                        }
                                      }}
                                      className={`w-full min-w-[206px] rounded-lg border bg-zinc-900 px-3 py-2 text-sm text-white outline-none transition focus:border-zinc-500 ${
                                        row.giocatore_trovato
                                          ? "border-zinc-800"
                                          : "border-amber-800/80"
                                      }`}
                                    />
                                  </td>
                                );
                              }

                              return (
                                <td
                                  key={column}
                                  className="max-w-[260px] whitespace-nowrap border-r border-zinc-900 px-4 py-3 text-zinc-300 last:border-r-0"
                                  title={formatCellValue(value)}
                                >
                                  <div className="max-w-[240px] truncate">
                                    {column === "Date"
                                      ? formatDateItalian(row.data_seduta)
                                      : formatCellValue(value)}
                                  </div>
                                </td>
                              );
                            })}
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>

                <div className="border-t border-zinc-800 bg-zinc-950 px-5 py-3">
                  <p className="text-xs text-zinc-500">
                    {csvColumns.length} colonne Catapult disponibili
                    nell&apos;anteprima
                  </p>
                </div>
              </div>
            </>
          )}
        </>
      )}

      {openModificaMultipla && isAdmin && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 sm:p-6">
          <button
            type="button"
            aria-label="Chiudi finestra"
            onClick={() => setOpenModificaMultipla(false)}
            className="absolute inset-0 cursor-default bg-black/75 backdrop-blur-sm"
          />

          <div className="relative z-10 flex max-h-[90vh] w-full min-w-0 max-w-2xl flex-col overflow-hidden rounded-3xl border border-zinc-800 bg-[#0d0d0d] shadow-2xl">
            <div className="flex shrink-0 items-start justify-between gap-4 border-b border-zinc-800 px-5 py-5 sm:px-6">
              <div className="flex min-w-0 items-center gap-3">
                <div
                  className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl"
                  style={{
                    backgroundColor: `${club.colore_flag}22`,
                    color: club.colore_flag,
                  }}
                >
                  <PencilLine className="h-5 w-5" />
                </div>

                <div className="min-w-0">
                  <h2 className="truncate text-lg font-semibold text-white sm:text-xl">
                    Modifica più righe
                  </h2>

                  <p className="mt-1 text-sm text-zinc-400">
                    Cambia un nome su tutte le righe in cui compare.
                  </p>
                </div>
              </div>

              <button
                type="button"
                aria-label="Chiudi"
                onClick={() => setOpenModificaMultipla(false)}
                className="shrink-0 rounded-xl border border-zinc-800 p-2 text-zinc-400 transition hover:border-zinc-600 hover:text-white"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <div className="min-h-0 flex-1 space-y-4 overflow-y-auto px-5 py-5 sm:px-6">
              <div>
                <label className="mb-2 block text-sm text-zinc-300">
                  Se Player Name è
                </label>

                <select
                  value={valoreDaSostituire}
                  onChange={(e) => setValoreDaSostituire(e.target.value)}
                  className="w-full min-w-0 rounded-xl border border-zinc-800 bg-zinc-900 px-4 py-3 text-white outline-none focus:border-zinc-500"
                >
                  {valoriPlayerName.map((valore) => (
                    <option
                      key={valore.valore || "(vuoto)"}
                      value={normalizeText(valore.valore)}
                    >
                      {valore.valore || "(vuoto)"} · {valore.righe.length}{" "}
                      {valore.righe.length === 1 ? "riga" : "righe"} ·{" "}
                      {valore.trovato ? "abbinato" : "non abbinato"}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="mb-2 block text-sm text-zinc-300">
                  cambialo con
                </label>

                <input
                  value={nuovoValore}
                  list="catapult-nomi-rosa"
                  spellCheck={false}
                  autoComplete="off"
                  onChange={(e) =>
                    setNuovoValore(normalizzaPlayerName(e.target.value))
                  }
                  placeholder="Es. GASPARE DI PIETRO"
                  className="w-full min-w-0 rounded-xl border border-zinc-800 bg-zinc-900 px-4 py-3 text-white outline-none focus:border-zinc-500"
                />

                <p className="mt-2 text-xs text-zinc-500">
                  Il nome viene salvato in maiuscolo e l&apos;abbinamento con
                  la rosa si ricalcola subito.
                </p>
              </div>

              <div className="rounded-2xl border border-zinc-800 bg-zinc-950">
                <div className="border-b border-zinc-800 px-4 py-3">
                  <p className="text-sm font-semibold text-white">
                    Righe interessate ({righeInteressate.length})
                  </p>
                </div>

                <div className="max-h-56 overflow-y-auto">
                  {righeInteressate.length === 0 ? (
                    <p className="px-4 py-4 text-sm text-zinc-500">
                      Nessuna riga corrisponde al nome scelto.
                    </p>
                  ) : (
                    <ul className="divide-y divide-zinc-900">
                      {righeInteressate.map((indiceRiga) => {
                        const riga = previewRows[indiceRiga];

                        return (
                          <li
                            key={indiceRiga}
                            className="flex items-center justify-between gap-3 px-4 py-2.5 text-sm"
                          >
                            <span className="min-w-0 truncate text-zinc-300">
                              Riga {indiceRiga + 1} ·{" "}
                              {formatCellValue(
                                riga?.raw_data["Session Title"]
                              )}
                            </span>

                            <span className="shrink-0 text-xs text-zinc-500">
                              {formatDateItalian(riga?.data_seduta ?? null)}
                            </span>
                          </li>
                        );
                      })}
                    </ul>
                  )}
                </div>
              </div>
            </div>

            <div className="flex shrink-0 flex-col gap-2 border-t border-zinc-800 px-5 py-4 sm:flex-row sm:justify-end sm:px-6">
              <button
                type="button"
                onClick={() => setOpenModificaMultipla(false)}
                className="inline-flex items-center justify-center rounded-xl border border-zinc-800 px-4 py-3 text-sm font-semibold text-zinc-300 transition hover:border-zinc-600 hover:text-white sm:py-2.5"
              >
                Annulla
              </button>

              <button
                type="button"
                onClick={applicaModificaMultipla}
                disabled={
                  righeInteressate.length === 0 || !nuovoValore.trim()
                }
                className="inline-flex items-center justify-center gap-2 rounded-xl px-4 py-3 text-sm font-semibold text-white transition hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-40 sm:py-2.5"
                style={{ backgroundColor: club.colore_flag }}
              >
                <ListChecks className="h-4 w-4" />
                Applica a {righeInteressate.length}{" "}
                {righeInteressate.length === 1 ? "riga" : "righe"}
              </button>
            </div>
          </div>
        </div>
      )}

      <GestisciDefinizioniCatapultModal
        open={openDefinitions}
        onClose={() => setOpenDefinitions(false)}
        definitions={definitions}
        coloreFlag={club.colore_flag}
        onChanged={() => window.location.reload()}
        isAdmin={isAdmin}
      />
    </div>
  );
}