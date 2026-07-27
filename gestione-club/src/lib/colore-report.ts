// Palette di colori saturi e leggibili su sfondo scuro, pensata come
// "colore secondario" per i grafici a due serie (es. Distanza/Sprint,
// ACWR Media Mobile/EWMA). Il colore principale di questi grafici è
// coloreFlag, che il club sceglie liberamente: se venisse accoppiato a
// un rosso fisso e coloreFlag fosse a sua volta rosso/arancio (molto
// comune per i colori sociali di un club), le due serie diventerebbero
// indistinguibili. sceglieColoreSecondario() sceglie sempre, dalla
// palette, il colore più lontano (per distanza RGB) da coloreFlag.
const PALETTE_SECONDARIA = [
  "#38bdf8", // sky
  "#fbbf24", // amber
  "#34d399", // emerald
  "#a78bfa", // violet
  "#f472b6", // pink
  "#facc15", // yellow
  "#f87171", // red (ultima scelta: usata solo se il colore del club è molto lontano dal rosso)
];

function hexARgb(hex: string): [number, number, number] | null {
  const pulito = hex.trim().replace("#", "");

  const normalizzato =
    pulito.length === 3
      ? pulito
          .split("")
          .map((c) => c + c)
          .join("")
      : pulito;

  if (!/^[0-9a-fA-F]{6}$/.test(normalizzato)) return null;

  const numero = parseInt(normalizzato, 16);

  return [(numero >> 16) & 255, (numero >> 8) & 255, numero & 255];
}

function distanzaColore(
  a: [number, number, number],
  b: [number, number, number]
) {
  return Math.sqrt(
    (a[0] - b[0]) ** 2 + (a[1] - b[1]) ** 2 + (a[2] - b[2]) ** 2
  );
}

/**
 * Sceglie, dalla palette secondaria, il colore con il maggior contrasto
 * cromatico rispetto a coloreFlag — così le due serie di un grafico
 * restano sempre distinguibili indipendentemente dal colore sociale
 * scelto dal club.
 */
export function sceglieColoreSecondario(coloreFlag: string): string {
  const base = hexARgb(coloreFlag);

  if (!base) return PALETTE_SECONDARIA[0];

  let migliore = PALETTE_SECONDARIA[0];
  let miglioreDistanza = -1;

  for (const candidato of PALETTE_SECONDARIA) {
    const rgbCandidato = hexARgb(candidato);
    if (!rgbCandidato) continue;

    const distanza = distanzaColore(base, rgbCandidato);

    if (distanza > miglioreDistanza) {
      miglioreDistanza = distanza;
      migliore = candidato;
    }
  }

  return migliore;
}

// Colori semantici fissi, indipendenti da coloreFlag: usarli per
// indicatori di miglioramento/peggioramento (es. delta tra due sedute)
// rende il segno immediatamente leggibile, cosa che non è garantita
// se si usa il colore sociale del club per il "positivo".
export const COLORE_POSITIVO = "#34d399"; // emerald-400
export const COLORE_NEGATIVO = "#f87171"; // red-400
