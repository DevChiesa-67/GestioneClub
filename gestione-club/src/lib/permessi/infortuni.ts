// src/lib/permessi/infortuni.ts
//
// Chi puo' scrivere sugli infortuni. Prima era una costante implicita
// ("solo admin") ripetuta in ogni server action e in ogni pagina; con
// l'arrivo dei ruoli medico e fisioterapista serve un punto solo, cosi'
// le policy RLS lato database (vedi
// aggiungi-tipi-profilo-medico-fisioterapista.sql) e i controlli lato
// applicazione non possono divergere.

export const RUOLI_GESTIONE_INFORTUNI = [
  "admin",
  "medico",
  "fisioterapista",
] as const;

export function puoGestireInfortuni(tipoProfilo?: string | null) {
  const ruolo = String(tipoProfilo || "").toLowerCase();

  return (RUOLI_GESTIONE_INFORTUNI as readonly string[]).includes(ruolo);
}
