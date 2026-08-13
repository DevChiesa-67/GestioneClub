"use client";

import { X } from "lucide-react";

type LavoroDettaglio = {
  sezione: string;
  descrizione: string | null;
  obbiettivo?: string | null;
  tempo_lavoro: number | null;
  ripetizione: number | null;
  tempo_recupero: number | null;
  tempo_totale: number | null;
  codice?: string | null;
  spazio?: string | null;
  materiale?: string | null;
  punti_chiave_coaching?: string | null;
  progressione?: string | null;
  riferimento_gps?: string | null;
  perche_serve?: string | null;
};

function Campo({
  label,
  value,
  largo,
}: {
  label: string;
  value: string | null | undefined;
  largo?: boolean;
}) {
  if (!value) return null;

  return (
    <div className={largo ? "sm:col-span-2" : undefined}>
      <p className="text-xs font-bold uppercase tracking-wide text-zinc-500">
        {label}
      </p>
      <p className="mt-1 whitespace-pre-line text-sm text-zinc-200">{value}</p>
    </div>
  );
}

export default function DettaglioLavoroModal({
  lavoro,
  themeColor,
  onClose,
}: {
  lavoro: LavoroDettaglio;
  themeColor: string;
  onClose: () => void;
}) {
  return (
    <div
      className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/70 p-4"
      onClick={onClose}
    >
      <div
        className="max-h-[85vh] w-full max-w-3xl overflow-y-auto rounded-2xl border border-zinc-800 bg-zinc-950 p-5 shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="mb-4 flex items-start justify-between gap-3">
          <div>
            <p
              className="text-xs font-bold uppercase tracking-wide"
              style={{ color: themeColor }}
            >
              {lavoro.sezione}
              {lavoro.codice && (
                <span className="ml-2 text-zinc-500">· {lavoro.codice}</span>
              )}
            </p>
            <h2 className="mt-1 text-lg font-bold text-white">
              {lavoro.descrizione || "Drill bank"}
            </h2>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="shrink-0 rounded-lg p-1.5 text-zinc-400 hover:bg-zinc-900 hover:text-white"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="mb-4 flex flex-wrap gap-3 text-sm text-zinc-400">
          {lavoro.ripetizione !== null && (
            <span>Ripetizioni: {lavoro.ripetizione}</span>
          )}
          {lavoro.tempo_lavoro !== null && (
            <span>Lavoro: {lavoro.tempo_lavoro} min</span>
          )}
          {lavoro.tempo_recupero !== null && (
            <span>Recupero: {lavoro.tempo_recupero} min</span>
          )}
          {lavoro.tempo_totale !== null && (
            <span className="font-semibold text-zinc-200">
              Totale: {lavoro.tempo_totale} min
            </span>
          )}
        </div>

        <div className="grid gap-4 border-t border-zinc-800 pt-4 sm:grid-cols-2">
          <Campo label="Obiettivo" value={lavoro.obbiettivo} largo />
          <Campo label="Spazio" value={lavoro.spazio} />
          <Campo label="Materiale" value={lavoro.materiale} />
          <Campo label="Riferimento GPS" value={lavoro.riferimento_gps} />
          <Campo
            label="Punti chiave / coaching"
            value={lavoro.punti_chiave_coaching}
            largo
          />
          <Campo label="Progressione" value={lavoro.progressione} largo />
          <Campo label="Perché serve" value={lavoro.perche_serve} largo />

          {!lavoro.spazio &&
            !lavoro.materiale &&
            !lavoro.punti_chiave_coaching &&
            !lavoro.progressione &&
            !lavoro.riferimento_gps &&
            !lavoro.perche_serve && (
              <p className="text-sm text-zinc-500">
                Nessun dettaglio aggiuntivo dal drill bank per questo lavoro.
              </p>
            )}
        </div>
      </div>
    </div>
  );
}
