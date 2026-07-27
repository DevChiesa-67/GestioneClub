// src/lib/date.ts

/*
 * Utility centralizzate per la gestione delle date nel gestionale.
 *
 * Convenzione: nel database e nello stato dei form le date sono sempre
 * in formato ISO (YYYY-MM-DD, eventualmente con orario). In UI vanno
 * sempre mostrate in formato italiano GG/MM/AAAA, indipendentemente
 * dalla lingua/locale del browser di chi le visualizza.
 */

/**
 * Converte una data ISO (YYYY-MM-DD, o un timestamp che inizia così)
 * nel formato italiano GG/MM/AAAA. Ritorna "-" se il valore è vuoto,
 * nullo o non interpretabile come data.
 */
export function formatDataIT(value: string | null | undefined): string {
  if (!value) return "-";

  const isoMatch = value.match(/^(\d{4})-(\d{2})-(\d{2})/);

  if (isoMatch) {
    const [, anno, mese, giorno] = isoMatch;
    return `${giorno}/${mese}/${anno}`;
  }

  const parsed = new Date(value);

  if (Number.isNaN(parsed.getTime())) return "-";

  const giorno = String(parsed.getDate()).padStart(2, "0");
  const mese = String(parsed.getMonth() + 1).padStart(2, "0");
  const anno = parsed.getFullYear();

  return `${giorno}/${mese}/${anno}`;
}

/**
 * Come formatDataIT, ma aggiunge l'orario HH:MM quando il valore
 * originale lo contiene (utile per timestamp completi, es. created_at).
 */
export function formatDataOraIT(value: string | null | undefined): string {
  if (!value) return "-";

  const parsed = new Date(value);

  if (Number.isNaN(parsed.getTime())) return formatDataIT(value);

  const ore = String(parsed.getHours()).padStart(2, "0");
  const minuti = String(parsed.getMinutes()).padStart(2, "0");

  return `${formatDataIT(value)} ${ore}:${minuti}`;
}

/**
 * Converte una data in formato GG/MM/AAAA (o GG-MM-AAAA) in ISO
 * YYYY-MM-DD. Ritorna null se il testo non è una data completa valida.
 */
export function parseDataIT(value: string): string | null {
  const match = value.match(/^(\d{2})[/-](\d{2})[/-](\d{4})$/);

  if (!match) return null;

  const [, giorno, mese, anno] = match;

  return `${anno}-${mese}-${giorno}`;
}
