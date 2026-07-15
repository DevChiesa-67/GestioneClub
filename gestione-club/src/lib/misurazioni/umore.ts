// src/lib/misurazioni/umore.ts

/*
 * La colonna "umore" di misurazioni_post_allenamento è un intero
 * (constraint 1-10), ma il modulo giocatore espone solo 3 opzioni
 * testuali. Questa mappa è l'unica fonte di verità per la
 * conversione in entrambe le direzioni (form -> DB, DB -> UI).
 */
export const UMORE_OPTIONS = [
  { value: 1, key: "nervoso", label: "Nervoso" },
  { value: 2, key: "stressato", label: "Stressato" },
  { value: 3, key: "bene", label: "Bene" },
] as const;

export type UmoreKey = (typeof UMORE_OPTIONS)[number]["key"];

export function umoreKeyToValue(key: string): number | null {
  const opzione = UMORE_OPTIONS.find((o) => o.key === key);
  return opzione ? opzione.value : null;
}

export function umoreValueToLabel(value: number): string {
  const opzione = UMORE_OPTIONS.find((o) => o.value === value);
  return opzione ? opzione.label : `${value}`;
}
