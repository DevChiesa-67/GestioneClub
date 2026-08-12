"use client";

import { useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { ChevronDown, Search } from "lucide-react";

import type { Partita } from "@/app/(dashboard)/partite/page";

function normalizzaTesto(valore: string | null | undefined): string {
  return (valore || "")
    .normalize("NFD")
    .replace(new RegExp("[\\u0300-\\u036f]", "g"), "")
    .toLowerCase()
    .trim();
}

export function formatDataPartita(data: string) {
  return new Intl.DateTimeFormat("it-IT", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  }).format(new Date(`${data}T12:00:00`));
}

export default function SelettorePartita({
  partite,
  value,
  onChange,
  evidenziaVerde = false,
  placeholder = "Seleziona la partita...",
}: {
  partite: Partita[];
  value: Partita | null;
  onChange: (partita: Partita) => void;
  evidenziaVerde?: boolean;
  placeholder?: string;
}) {
  const [aperto, setAperto] = useState(false);
  const [ricerca, setRicerca] = useState("");
  const containerRef = useRef<HTMLDivElement | null>(null);
  const bottoneRef = useRef<HTMLButtonElement | null>(null);
  const dropdownRef = useRef<HTMLDivElement | null>(null);

  // Posizione del dropdown calcolata dal bottone e usata con
  // position:fixed su un elemento portato in document.body: il popup
  // vive spesso dentro contenitori con overflow-y-auto (es. le modali),
  // che altrimenti taglierebbero il dropdown se questo venisse
  // posizionato "absolute" dentro al proprio contenitore normale.
  //
  // Il posizionamento è "clampato" dentro ai bordi dello schermo: su
  // mobile, quando il bottone è vicino al fondo (es. dentro una modale
  // a foglio ancorata in basso), aprire sempre verso il basso spingeva
  // il popup sotto il bordo inferiore della viewport, rendendolo
  // invisibile/non raggiungibile. Ora si sceglie se aprire sopra o
  // sotto in base allo spazio disponibile e si limita l'altezza a
  // quella effettivamente libera.
  const [posizione, setPosizione] = useState<{
    top: number;
    left: number;
    width: number;
    maxHeight: number;
  } | null>(null);

  function aggiornaPosizione() {
    const rect = bottoneRef.current?.getBoundingClientRect();
    if (!rect) return;

    const margine = 8;
    const altezzaPreferita = 340;

    const spazioSotto = window.innerHeight - rect.bottom - margine;
    const spazioSopra = rect.top - margine;

    const apriSopra =
      spazioSotto < Math.min(altezzaPreferita, 160) && spazioSopra > spazioSotto;

    const maxHeight = Math.max(
      120,
      Math.min(altezzaPreferita, apriSopra ? spazioSopra : spazioSotto),
    );

    const top = apriSopra
      ? Math.max(margine, rect.top - maxHeight - margine)
      : rect.bottom + margine;

    const left = Math.min(
      Math.max(margine, rect.left),
      Math.max(margine, window.innerWidth - rect.width - margine),
    );

    setPosizione({ top, left, width: rect.width, maxHeight });
  }

  useLayoutEffect(() => {
    if (!aperto) return;
    aggiornaPosizione();
  }, [aperto]);

  useEffect(() => {
    if (!aperto) return;

    function chiudiSeFuori(event: MouseEvent) {
      const target = event.target as Node;

      if (
        containerRef.current &&
        !containerRef.current.contains(target) &&
        dropdownRef.current &&
        !dropdownRef.current.contains(target)
      ) {
        setAperto(false);
      }
    }

    function riposiziona() {
      aggiornaPosizione();
    }

    document.addEventListener("mousedown", chiudiSeFuori);
    window.addEventListener("resize", riposiziona);
    window.addEventListener("scroll", riposiziona, true);

    return () => {
      document.removeEventListener("mousedown", chiudiSeFuori);
      window.removeEventListener("resize", riposiziona);
      window.removeEventListener("scroll", riposiziona, true);
    };
  }, [aperto]);

  const partiteFiltrate = useMemo(() => {
    const termine = normalizzaTesto(ricerca);

    const ordinate = [...partite].sort((a, b) =>
      b.data_partita.localeCompare(a.data_partita),
    );

    if (!termine) return ordinate.slice(0, 30);

    return ordinate
      .filter((p) => {
        const testo = normalizzaTesto(
          `${p.squadra_casa?.nome || ""} ${p.squadra_fuori?.nome || ""} ${p.data_partita}`,
        );
        return testo.includes(termine);
      })
      .slice(0, 30);
  }, [partite, ricerca]);

  return (
    <div ref={containerRef} className="relative">
      <button
        ref={bottoneRef}
        type="button"
        onClick={() => setAperto((p) => !p)}
        className={`flex min-h-12 w-full items-center justify-between gap-3 rounded-xl border px-3 text-left text-sm outline-none transition ${
          value
            ? evidenziaVerde
              ? "border-emerald-500/60 bg-emerald-500/5"
              : "border-zinc-700 bg-zinc-900"
            : "border-zinc-800 bg-zinc-900"
        }`}
      >
        {value ? (
          <span className="truncate text-white">
            {value.squadra_casa?.nome || "Casa"} vs{" "}
            {value.squadra_fuori?.nome || "Trasferta"} ·{" "}
            {formatDataPartita(value.data_partita)}
          </span>
        ) : (
          <span className="text-zinc-500">{placeholder}</span>
        )}

        <ChevronDown className="h-4 w-4 shrink-0 text-zinc-500" />
      </button>

      {aperto &&
        posizione &&
        typeof document !== "undefined" &&
        createPortal(
          <div
            ref={dropdownRef}
            className="fixed z-[9999] flex flex-col overflow-hidden rounded-2xl border border-zinc-700 bg-zinc-950 shadow-2xl shadow-black/50"
            style={{
              top: posizione.top,
              left: posizione.left,
              width: posizione.width,
              maxHeight: posizione.maxHeight,
            }}
          >
            <div className="shrink-0 border-b border-zinc-800 p-2.5">
              <div className="relative">
                <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-zinc-500" />
                <input
                  type="text"
                  value={ricerca}
                  onChange={(e) => setRicerca(e.target.value)}
                  placeholder="Cerca squadra o data..."
                  className="min-h-10 w-full rounded-xl border border-zinc-800 bg-zinc-900 pl-9 pr-3 text-sm text-white outline-none placeholder:text-zinc-600 focus:border-zinc-600"
                  autoFocus
                />
              </div>
            </div>

            <div className="min-h-0 flex-1 overflow-y-auto p-2">
              {partiteFiltrate.map((p) => (
                <button
                  key={p.id}
                  type="button"
                  onClick={() => {
                    onChange(p);
                    setAperto(false);
                  }}
                  className="flex w-full items-center justify-between gap-2 rounded-xl p-2.5 text-left text-sm text-zinc-200 transition hover:bg-zinc-900"
                >
                  <span className="truncate">
                    {p.squadra_casa?.nome || "Casa"} vs{" "}
                    {p.squadra_fuori?.nome || "Trasferta"}
                  </span>
                  <span className="shrink-0 text-xs text-zinc-500">
                    {formatDataPartita(p.data_partita)}
                  </span>
                </button>
              ))}

              {partiteFiltrate.length === 0 && (
                <p className="px-3 py-6 text-center text-sm text-zinc-500">
                  Nessuna partita trovata.
                </p>
              )}
            </div>
          </div>,
          document.body,
        )}
    </div>
  );
}
