// src/lib/permessi/pagine-gestionale.ts

export type PaginaGestionale = {
  key: string;
  label: string;
  href: string;
};

export const PAGINE_GESTIONALE: PaginaGestionale[] = [
  {
    key: "dashboard",
    label: "Dashboard",
    href: "/dashboard",
  },
  {
    key: "giocatori",
    label: "Giocatori",
    href: "/giocatori",
  },
  {
    key: "squadre",
    label: "Squadre",
    href: "/squadre",
  },
  {
    key: "allenamenti",
    label: "Allenamenti",
    href: "/allenamenti",
  },
  {
    key: "programmazione",
    label: "Programmazione",
    href: "/programmazione",
  },
  {
    key: "partite",
    label: "Partite",
    href: "/partite",
  },
  {
    key: "convocazioni",
    label: "Convocazioni",
    href: "/convocazioni",
  },
  {
    key: "presenze",
    label: "Presenze",
    href: "/presenze",
  },
  {
    key: "misurazioni",
    label: "Misurazioni",
    href: "/misurazioni",
  },
  {
    key: "test",
    label: "Test",
    href: "/test",
  },
  {
    key: "infortuni",
    label: "Infortuni",
    href: "/infortuni",
  },
  {
    key: "performance",
    label: "Performance",
    href: "/performance",
  },
  {
    key: "report",
    label: "Report",
    href: "/report",
  },
  {
    key: "file",
    label: "File e video",
    href: "/file",
  },
  {
    key: "comunicazioni",
    label: "Comunicazioni",
    href: "/comunicazioni",
  },
  {
    key: "utenti_permessi",
    label: "Utenti e permessi",
    href: "/utenti-permessi",
  },
];