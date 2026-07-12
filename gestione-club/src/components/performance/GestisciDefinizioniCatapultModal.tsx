"use client";

import { FormEvent, useMemo, useState } from "react";
import {
  X,
  Plus,
  Trash2,
  Loader2,
  Tags,
  AlertTriangle,
  CheckCircle2,
  Database,
} from "lucide-react";
import { supabase } from "@/lib/supabase-client";

type TipoMatch = "exact" | "contains" | "starts_with";

export type ImportDefinition = {
  id: string;
  provider: string;
  campo_origine: string;
  valore_origine: string;
  valore_destinazione: string;
  categoria: string;
  tipo_match: TipoMatch;
  attivo: boolean;
};

type Props = {
  open: boolean;
  onClose: () => void;
  definitions: ImportDefinition[];
  coloreFlag?: string;
  onChanged?: () => void;
  isAdmin: boolean;
};

type MessageState =
  | {
      type: "success" | "error";
      text: string;
    }
  | null;

export default function GestisciDefinizioniCatapultModal({
  open,
  onClose,
  definitions,
  coloreFlag = "#d71920",
  onChanged,
  isAdmin,
}: Props) {
  const [localDefinitions, setLocalDefinitions] =
    useState<ImportDefinition[]>(definitions);

  const [campoOrigine, setCampoOrigine] = useState("Tags");
  const [valoreOrigine, setValoreOrigine] = useState("");
  const [valoreDestinazione, setValoreDestinazione] =
    useState("");
  const [categoria, setCategoria] = useState("tipo_seduta");
  const [tipoMatch, setTipoMatch] =
    useState<TipoMatch>("contains");

  const [saving, setSaving] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(
    null
  );

  const [message, setMessage] = useState<MessageState>(null);

  const catapultDefinitions = useMemo(() => {
    return localDefinitions
      .filter(
        (definition) =>
          definition.provider.toLowerCase() === "catapult"
      )
      .sort((a, b) => {
        const categoryCompare = a.categoria.localeCompare(
          b.categoria,
          "it"
        );

        if (categoryCompare !== 0) {
          return categoryCompare;
        }

        const fieldCompare = a.campo_origine.localeCompare(
          b.campo_origine,
          "it"
        );

        if (fieldCompare !== 0) {
          return fieldCompare;
        }

        return a.valore_origine.localeCompare(
          b.valore_origine,
          "it"
        );
      });
  }, [localDefinitions]);

  if (!open) {
    return null;
  }

  function resetForm() {
    setCampoOrigine("Tags");
    setValoreOrigine("");
    setValoreDestinazione("");
    setCategoria("tipo_seduta");
    setTipoMatch("contains");
  }

  async function handleCreate(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (!isAdmin) {
      return;
    }

    setMessage(null);

    const cleanCampoOrigine = campoOrigine.trim();
    const cleanValoreOrigine = valoreOrigine.trim();
    const cleanValoreDestinazione =
      valoreDestinazione.trim();
    const cleanCategoria = categoria.trim();

    if (
      !cleanCampoOrigine ||
      !cleanValoreOrigine ||
      !cleanValoreDestinazione ||
      !cleanCategoria
    ) {
      setMessage({
        type: "error",
        text: "Compila tutti i campi obbligatori.",
      });

      return;
    }

    const alreadyExists = localDefinitions.some(
      (definition) =>
        definition.provider.toLowerCase() === "catapult" &&
        definition.campo_origine.toLocaleLowerCase("it-IT") ===
          cleanCampoOrigine.toLocaleLowerCase("it-IT") &&
        definition.valore_origine.toLocaleLowerCase("it-IT") ===
          cleanValoreOrigine.toLocaleLowerCase("it-IT")
    );

    if (alreadyExists) {
      setMessage({
        type: "error",
        text: "Esiste già una definizione Catapult per questo campo e valore.",
      });

      return;
    }

    setSaving(true);

    const { data, error } = await supabase
      .from("performance_import_definitions")
      .insert({
        provider: "catapult",
        campo_origine: cleanCampoOrigine,
        valore_origine: cleanValoreOrigine,
        valore_destinazione: cleanValoreDestinazione,
        categoria: cleanCategoria,
        tipo_match: tipoMatch,
        attivo: true,
      })
      .select(
        `
          id,
          provider,
          campo_origine,
          valore_origine,
          valore_destinazione,
          categoria,
          tipo_match,
          attivo
        `
      )
      .single();

    setSaving(false);

    if (error || !data) {
      console.error(
        "Errore creazione definizione Catapult:",
        error
      );

      setMessage({
        type: "error",
        text:
          error?.message ??
          "Errore durante la creazione della definizione.",
      });

      return;
    }

    const newDefinition = data as ImportDefinition;

    setLocalDefinitions((current) => [
      ...current,
      newDefinition,
    ]);

    resetForm();

    setMessage({
      type: "success",
      text: "Definizione creata correttamente.",
    });

    onChanged?.();
  }

  async function handleDelete(definition: ImportDefinition) {
    if (!isAdmin) {
      return;
    }

    const confirmed = window.confirm(
      `Vuoi eliminare la definizione "${definition.valore_origine} → ${definition.valore_destinazione}"?`
    );

    if (!confirmed) {
      return;
    }

    setMessage(null);
    setDeletingId(definition.id);

    const { error } = await supabase
      .from("performance_import_definitions")
      .delete()
      .eq("id", definition.id);

    setDeletingId(null);

    if (error) {
      console.error(
        "Errore eliminazione definizione Catapult:",
        error
      );

      setMessage({
        type: "error",
        text:
          error.message ??
          "Errore durante l'eliminazione della definizione.",
      });

      return;
    }

    setLocalDefinitions((current) =>
      current.filter(
        (currentDefinition) =>
          currentDefinition.id !== definition.id
      )
    );

    setMessage({
      type: "success",
      text: "Definizione eliminata correttamente.",
    });

    onChanged?.();
  }

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 sm:p-6">
      {/* OVERLAY */}
      <button
        type="button"
        aria-label="Chiudi finestra"
        onClick={onClose}
        className="absolute inset-0 cursor-default bg-black/75 backdrop-blur-sm"
      />

      {/* MODAL */}
      <div className="relative z-10 flex max-h-[90vh] w-full max-w-5xl min-w-0 flex-col overflow-hidden rounded-3xl border border-zinc-800 bg-[#0d0d0d] shadow-2xl">
        {/* HEADER */}
        <div className="flex shrink-0 items-start justify-between gap-4 border-b border-zinc-800 px-5 py-5 sm:px-6">
          <div className="min-w-0">
            <div className="flex items-center gap-3">
              <div
                className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl"
                style={{
                  backgroundColor: `${coloreFlag}22`,
                  color: coloreFlag,
                }}
              >
                <Tags className="h-5 w-5" />
              </div>

              <div className="min-w-0">
                <h2 className="truncate text-lg font-semibold text-white sm:text-xl">
                  Gestisci definizioni Catapult
                </h2>

                <p className="mt-1 text-sm text-zinc-400">
                  Regole globali utilizzate durante
                  l&apos;importazione dei CSV.
                </p>
              </div>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl border border-zinc-800 text-zinc-400 transition hover:bg-zinc-900 hover:text-white"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* BODY */}
        <div className="min-h-0 flex-1 overflow-y-auto">
          <div className="space-y-6 p-5 sm:p-6">
            {/* MESSAGGIO */}
            {message && (
              <div
                className={`flex items-start gap-3 rounded-xl border p-3 text-sm ${
                  message.type === "success"
                    ? "border-emerald-900 bg-emerald-950/40 text-emerald-300"
                    : "border-red-900 bg-red-950/40 text-red-300"
                }`}
              >
                {message.type === "success" ? (
                  <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0" />
                ) : (
                  <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
                )}

                <span>{message.text}</span>
              </div>
            )}

            {/* FORM NUOVA DEFINIZIONE */}
            {isAdmin && (
            <form
              onSubmit={handleCreate}
              className="rounded-2xl border border-zinc-800 bg-zinc-950 p-4 sm:p-5"
            >
              <div className="mb-5">
                <h3 className="font-semibold text-white">
                  Nuova definizione
                </h3>

                <p className="mt-1 text-sm text-zinc-500">
                  Esempio: Tags / training / allenamento.
                </p>
              </div>

              <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-5">
                {/* CAMPO ORIGINE */}
                <div className="min-w-0">
                  <label className="mb-2 block text-xs font-medium uppercase tracking-wide text-zinc-500">
                    Campo origine
                  </label>

                  <input
                    value={campoOrigine}
                    onChange={(event) =>
                      setCampoOrigine(event.target.value)
                    }
                    placeholder="Tags"
                    className="w-full min-w-0 rounded-xl border border-zinc-800 bg-zinc-900 px-3 py-2.5 text-sm text-white outline-none transition placeholder:text-zinc-600 focus:border-zinc-600"
                  />
                </div>

                {/* VALORE ORIGINE */}
                <div className="min-w-0">
                  <label className="mb-2 block text-xs font-medium uppercase tracking-wide text-zinc-500">
                    Valore origine
                  </label>

                  <input
                    value={valoreOrigine}
                    onChange={(event) =>
                      setValoreOrigine(event.target.value)
                    }
                    placeholder="training"
                    className="w-full min-w-0 rounded-xl border border-zinc-800 bg-zinc-900 px-3 py-2.5 text-sm text-white outline-none transition placeholder:text-zinc-600 focus:border-zinc-600"
                  />
                </div>

                {/* VALORE DESTINAZIONE */}
                <div className="min-w-0">
                  <label className="mb-2 block text-xs font-medium uppercase tracking-wide text-zinc-500">
                    Destinazione
                  </label>

                  <input
                    value={valoreDestinazione}
                    onChange={(event) =>
                      setValoreDestinazione(event.target.value)
                    }
                    placeholder="allenamento"
                    className="w-full min-w-0 rounded-xl border border-zinc-800 bg-zinc-900 px-3 py-2.5 text-sm text-white outline-none transition placeholder:text-zinc-600 focus:border-zinc-600"
                  />
                </div>

                {/* CATEGORIA */}
                <div className="min-w-0">
                  <label className="mb-2 block text-xs font-medium uppercase tracking-wide text-zinc-500">
                    Categoria
                  </label>

                  <input
                    value={categoria}
                    onChange={(event) =>
                      setCategoria(event.target.value)
                    }
                    placeholder="tipo_seduta"
                    className="w-full min-w-0 rounded-xl border border-zinc-800 bg-zinc-900 px-3 py-2.5 text-sm text-white outline-none transition placeholder:text-zinc-600 focus:border-zinc-600"
                  />
                </div>

                {/* TIPO MATCH */}
                <div className="min-w-0">
                  <label className="mb-2 block text-xs font-medium uppercase tracking-wide text-zinc-500">
                    Confronto
                  </label>

                  <select
                    value={tipoMatch}
                    onChange={(event) =>
                      setTipoMatch(
                        event.target.value as TipoMatch
                      )
                    }
                    className="w-full min-w-0 rounded-xl border border-zinc-800 bg-zinc-900 px-3 py-2.5 text-sm text-white outline-none transition focus:border-zinc-600"
                  >
                    <option value="contains">
                      Contiene
                    </option>

                    <option value="exact">
                      Esatto
                    </option>

                    <option value="starts_with">
                      Inizia con
                    </option>
                  </select>
                </div>
              </div>

              <div className="mt-5 flex justify-end">
                <button
                  type="submit"
                  disabled={saving}
                  className="inline-flex items-center justify-center gap-2 rounded-xl px-4 py-2.5 text-sm font-semibold text-white transition hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-50"
                  style={{
                    backgroundColor: coloreFlag,
                  }}
                >
                  {saving ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <Plus className="h-4 w-4" />
                  )}

                  {saving
                    ? "Creazione..."
                    : "Aggiungi definizione"}
                </button>
              </div>
            </form>
            )}

            {/* DEFINIZIONI ESISTENTI */}
            <div className="overflow-hidden rounded-2xl border border-zinc-800 bg-zinc-950">
              <div className="flex items-center justify-between gap-4 border-b border-zinc-800 px-4 py-4 sm:px-5">
                <div>
                  <h3 className="font-semibold text-white">
                    Definizioni esistenti
                  </h3>

                  <p className="mt-1 text-sm text-zinc-500">
                    {catapultDefinitions.length} regole
                    Catapult configurate
                  </p>
                </div>

                <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl border border-zinc-800 text-zinc-500">
                  <Database className="h-4 w-4" />
                </div>
              </div>

              {catapultDefinitions.length === 0 ? (
                <div className="p-8 text-center">
                  <Tags className="mx-auto h-8 w-8 text-zinc-700" />

                  <p className="mt-3 font-medium text-zinc-300">
                    Nessuna definizione
                  </p>

                  <p className="mt-1 text-sm text-zinc-500">
                    Crea la prima regola Catapult dal
                    modulo sopra.
                  </p>
                </div>
              ) : (
                <div className="w-full min-w-0 overflow-x-auto">
                  <table className="w-full min-w-[900px] text-left text-sm">
                    <thead className="bg-zinc-900/80 text-zinc-500">
                      <tr>
                        <th className="whitespace-nowrap px-4 py-3 font-medium">
                          Campo
                        </th>

                        <th className="whitespace-nowrap px-4 py-3 font-medium">
                          Valore origine
                        </th>

                        <th className="whitespace-nowrap px-4 py-3 font-medium">
                          Destinazione
                        </th>

                        <th className="whitespace-nowrap px-4 py-3 font-medium">
                          Categoria
                        </th>

                        <th className="whitespace-nowrap px-4 py-3 font-medium">
                          Match
                        </th>

                        {isAdmin && (
                          <th className="w-[80px] px-4 py-3 text-right font-medium">
                            Azioni
                          </th>
                        )}
                      </tr>
                    </thead>

                    <tbody>
                      {catapultDefinitions.map(
                        (definition) => (
                          <tr
                            key={definition.id}
                            className="border-t border-zinc-900 transition hover:bg-zinc-900/40"
                          >
                            <td className="whitespace-nowrap px-4 py-3 font-medium text-white">
                              {definition.campo_origine}
                            </td>

                            <td className="whitespace-nowrap px-4 py-3">
                              <code className="rounded-lg border border-zinc-800 bg-zinc-900 px-2 py-1 text-xs text-sky-300">
                                {definition.valore_origine}
                              </code>
                            </td>

                            <td className="whitespace-nowrap px-4 py-3">
                              <div className="flex items-center gap-2">
                                <span className="text-zinc-600">
                                  →
                                </span>

                                <code className="rounded-lg border border-emerald-900/60 bg-emerald-950/30 px-2 py-1 text-xs text-emerald-300">
                                  {
                                    definition.valore_destinazione
                                  }
                                </code>
                              </div>
                            </td>

                            <td className="whitespace-nowrap px-4 py-3 text-zinc-300">
                              {definition.categoria}
                            </td>

                            <td className="whitespace-nowrap px-4 py-3">
                              <span className="rounded-full border border-zinc-800 bg-zinc-900 px-2.5 py-1 text-xs text-zinc-400">
                                {definition.tipo_match ===
                                "contains"
                                  ? "Contiene"
                                  : definition.tipo_match ===
                                      "exact"
                                    ? "Esatto"
                                    : "Inizia con"}
                              </span>
                            </td>

                            {isAdmin && (
                              <td className="px-4 py-3 text-right">
                                <button
                                  type="button"
                                  disabled={
                                    deletingId === definition.id
                                  }
                                  onClick={() =>
                                    handleDelete(definition)
                                  }
                                  className="inline-flex h-8 w-8 items-center justify-center rounded-lg border border-red-950 text-red-400 transition hover:bg-red-950/50 hover:text-red-300 disabled:cursor-not-allowed disabled:opacity-50"
                                  title="Elimina definizione"
                                >
                                  {deletingId ===
                                  definition.id ? (
                                    <Loader2 className="h-4 w-4 animate-spin" />
                                  ) : (
                                    <Trash2 className="h-4 w-4" />
                                  )}
                                </button>
                              </td>
                            )}
                          </tr>
                        )
                      )}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* FOOTER */}
        <div className="flex shrink-0 justify-end border-t border-zinc-800 bg-zinc-950/70 px-5 py-4 sm:px-6">
          <button
            type="button"
            onClick={onClose}
            className="rounded-xl border border-zinc-700 px-4 py-2 text-sm font-medium text-white transition hover:bg-zinc-900"
          >
            Chiudi
          </button>
        </div>
      </div>
    </div>
  );
}