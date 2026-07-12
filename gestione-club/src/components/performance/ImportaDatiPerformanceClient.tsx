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

function findGiocatore(
  playerName: unknown,
  giocatori: Giocatore[]
): Giocatore | null {
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

  function handleFile(file: File) {
    setError(null);
    setSuccess(null);
    setFilename(file.name);
    setPreviewRows([]);
    setCsvColumns([]);

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
                      Scorri orizzontalmente per visualizzare tutte le colonne
                    </p>
                  </div>

                  {isAdmin && (
                    <button
                      type="button"
                      disabled={isImporting}
                      onClick={handleConfirmImport}
                      className="inline-flex shrink-0 items-center justify-center gap-2 rounded-xl px-4 py-2 text-sm font-medium text-white transition hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-60"
                      style={{
                        backgroundColor: club.colore_flag,
                      }}
                    >
                      <CheckCircle2 className="h-4 w-4" />
                      {isImporting
                        ? "Importazione..."
                        : "Conferma importazione"}
                    </button>
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
                            {column}
                          </th>
                        ))}
                      </tr>
                    </thead>

                    <tbody>
                      {previewRows.map((row, index) => (
                        <tr
                          key={`${String(
                            row.raw_data["Player Name"] ?? ""
                          )}-${index}`}
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
                              <p className="font-medium text-white">
                                {row.giocatore_nome_completo}
                              </p>
                            ) : (
                              <span className="text-zinc-500">-</span>
                            )}
                          </td>

                          {csvColumns.map((column) => {
                            const value = row.raw_data[column];

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
                      ))}
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