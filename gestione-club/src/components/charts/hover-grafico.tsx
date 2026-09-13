"use client";

import { useCallback, useRef, useState } from "react";
import type { MouseEvent as ReactMouseEvent, TouchEvent as ReactTouchEvent } from "react";

/*
 * HOVER CONDIVISO DEI GRAFICI SVG
 * ================================
 * I grafici della sezione Performance sono SVG scritti a mano, non
 * recharts: il passaggio del mouse va gestito a mano. Questo modulo
 * tiene in un posto solo le tre cose che servivano ovunque:
 *
 * - `useHoverGrafico`: da una coordinata del mouse ricava l'indice del
 *   punto/barra sotto il cursore;
 * - `LineaHover`: la riga verticale bianca;
 * - `TooltipGrafico`: il riquadro con data e valori.
 *
 * Perche' un hook e non `<title>` dentro le `<rect>`: il tooltip nativo
 * del browser compare dopo un secondo, sparisce da solo dopo pochi
 * secondi, non si puo' stilare e su una linea (dove non ci sono aree da
 * sorvolare) non compare affatto.
 */

/** Come si mappa la x del mouse sull'indice dei dati. */
export type ModoHover =
  /** Grafici a linea: i punti stanno SUI bordi, si prende il piu' vicino. */
  | "punti"
  /** Grafici a barre: ogni indice occupa una fascia, si prende la fascia. */
  | "fasce";

type ParametriHover = {
  /** Larghezza del viewBox, non quella a schermo. */
  viewBoxWidth: number;
  /** Margine sinistro dell'area disegnata. */
  left: number;
  /** Larghezza dell'area disegnata. */
  chartW: number;
  /** Quanti punti/barre ci sono. */
  count: number;
  modo: ModoHover;
};

export function useHoverGrafico({
  viewBoxWidth,
  left,
  chartW,
  count,
  modo,
}: ParametriHover) {
  const ref = useRef<SVGSVGElement | null>(null);
  const [indice, setIndice] = useState<number | null>(null);

  const aggiorna = useCallback(
    (clientX: number) => {
      const svg = ref.current;

      if (!svg || count === 0) return;

      /*
       * La conversione schermo → disegno passa dalla matrice dell'SVG,
       * NON dal rapporto fra clientX e la larghezza dell'elemento.
       *
       * Con `preserveAspectRatio` di default (xMidYMid meet) e un SVG a
       * cui viene imposta anche l'altezza, il disegno viene scalato per
       * entrarci tutto e poi CENTRATO: restano due bande vuote ai lati
       * e le coordinate del viewBox non coprono piu' tutta la larghezza
       * dell'elemento. Calcolando in proporzione alla larghezza, la
       * riga bianca finiva spostata rispetto al puntatore.
       *
       * `getScreenCTM()` tiene conto di scala e centratura, quindi
       * funziona in tutti i casi: SVG che riempie la card, SVG con
       * altezza fissa e bande laterali, contenitore che scorre.
       */
      const ctm = svg.getScreenCTM();

      // Fallback proporzionale: serve solo dove getScreenCTM non e'
      // disponibile (ambienti di test), ed e' esatto quando il disegno
      // riempie davvero l'elemento.
      const rect = svg.getBoundingClientRect();

      const xViewBox =
        ctm && ctm.a
          ? (clientX - ctm.e) / ctm.a
          : rect.width > 0
          ? ((clientX - rect.left) / rect.width) * viewBoxWidth
          : null;

      if (xViewBox === null) return;

      const relativo = (xViewBox - left) / (chartW || 1);

      const grezzo =
        modo === "punti"
          ? Math.round(relativo * Math.max(count - 1, 1))
          : Math.floor(relativo * count);

      setIndice(Math.min(count - 1, Math.max(0, grezzo)));
    },
    [chartW, count, left, modo, viewBoxWidth]
  );

  /**
   * Percorso inverso: da una x del disegno ai pixel dall'angolo sinistro
   * dell'SVG. Serve al tooltip, che e' HTML e vive fuori dall'SVG: senza
   * questa conversione si posizionerebbe anche lui sulle bande vuote.
   */
  const proiettaX = useCallback((xViewBox: number) => {
    const svg = ref.current;

    if (!svg) return 0;

    const ctm = svg.getScreenCTM();
    const rect = svg.getBoundingClientRect();

    if (!ctm) return 0;

    return xViewBox * ctm.a + ctm.e - rect.left;
  }, []);

  /** Larghezza dell'SVG a schermo, per non far uscire il tooltip. */
  const larghezzaSvg = useCallback(() => {
    return ref.current?.getBoundingClientRect().width ?? 0;
  }, []);

  const handlers = {
    onMouseMove: (evento: ReactMouseEvent<SVGSVGElement>) =>
      aggiorna(evento.clientX),
    onMouseLeave: () => setIndice(null),
    onTouchStart: (evento: ReactTouchEvent<SVGSVGElement>) => {
      const tocco = evento.touches[0];

      if (tocco) aggiorna(tocco.clientX);
    },
    onTouchMove: (evento: ReactTouchEvent<SVGSVGElement>) => {
      const tocco = evento.touches[0];

      if (tocco) aggiorna(tocco.clientX);
    },
    onTouchEnd: () => setIndice(null),
  };

  return { ref, indice, handlers, proiettaX, larghezzaSvg };
}

/**
 * Riga verticale bianca sotto il cursore. `pointerEvents: none` e'
 * obbligatorio: senza, la riga stessa intercetta il mouse e l'hover
 * inizia a sfarfallare.
 */
export function LineaHover({
  x,
  top,
  bottom,
}: {
  x: number;
  top: number;
  bottom: number;
}) {
  return (
    <line
      x1={x}
      x2={x}
      y1={top}
      y2={bottom}
      stroke="#ffffff"
      strokeWidth={1.5}
      strokeDasharray="5 4"
      opacity={0.85}
      style={{ pointerEvents: "none" }}
    />
  );
}

/** Pallino bianco sul valore agganciato. */
export function PuntoHover({
  x,
  y,
  colore,
}: {
  x: number;
  y: number;
  colore: string;
}) {
  return (
    <circle
      cx={x}
      cy={y}
      r={5}
      fill={colore}
      stroke="#ffffff"
      strokeWidth={2}
      style={{ pointerEvents: "none" }}
    />
  );
}

export type VoceTooltip = {
  label: string;
  valore: string;
  colore?: string;
};

/**
 * Riquadro con data e valori. E' HTML e non SVG: il testo resta della
 * stessa dimensione a qualsiasi zoom del grafico, mentre dentro l'SVG
 * scalerebbe insieme al disegno.
 *
 * Va messo dentro un contenitore `relative` largo quanto l'SVG.
 */
export function TooltipGrafico({
  xPixel,
  larghezza,
  titolo,
  voci,
}: {
  /** Pixel dall'angolo sinistro dell'SVG (usa `proiettaX` dell'hook). */
  xPixel: number;
  /** Larghezza dell'SVG a schermo (usa `larghezzaSvg` dell'hook). */
  larghezza: number;
  titolo: string;
  voci: VoceTooltip[];
}) {
  /*
   * Posizione in pixel e non in percentuale del viewBox: quando l'SVG e'
   * centrato con bande vuote ai lati le due cose non coincidono, ed e'
   * quello che faceva finire il riquadro lontano dalla riga bianca.
   *
   * Vicino ai bordi si clampa di ~110px per non far uscire il riquadro
   * dalla card.
   */
  const margine = 110;

  const xClamp =
    larghezza > margine * 2
      ? Math.min(larghezza - margine, Math.max(margine, xPixel))
      : xPixel;

  return (
    <div
      className="pointer-events-none absolute top-2 z-10 -translate-x-1/2 rounded-xl border border-zinc-700 bg-zinc-950/95 px-3 py-2 shadow-2xl backdrop-blur-sm"
      style={{ left: `${xClamp}px` }}
    >
      <p className="whitespace-nowrap text-[11px] font-black uppercase tracking-wider text-zinc-400">
        {titolo}
      </p>

      {voci.map((voce) => (
        <p
          key={voce.label}
          className="mt-1 flex items-center gap-2 whitespace-nowrap text-xs font-bold text-white"
        >
          {voce.colore && (
            <span
              className="h-2 w-2 shrink-0 rounded-full"
              style={{ backgroundColor: voce.colore }}
            />
          )}

          <span className="text-zinc-400">{voce.label}</span>
          <span>{voce.valore}</span>
        </p>
      ))}
    </div>
  );
}

/** Numero leggibile: separatore di migliaia e niente decimali inutili. */
export function formatValore(valore: number | null | undefined) {
  if (valore === null || valore === undefined || !Number.isFinite(valore)) {
    return "-";
  }

  const decimali = Math.abs(valore) < 10 && !Number.isInteger(valore) ? 2 : 0;

  return valore.toLocaleString("it-IT", {
    minimumFractionDigits: decimali,
    maximumFractionDigits: decimali,
  });
}
