
export type UserRole =
  | "admin"
  | "allenatore"
  | "preparatore"
  | "giocatore"
  | "medico"
  | "fisioterapista";

export const roleLabels: Record<UserRole, string> = {
  admin: "Admin",
  allenatore: "Allenatore",
  preparatore: "Preparatore",
  giocatore: "Giocatore",
  medico: "Medico",
  fisioterapista: "Fisioterapista",
};

export const roleHomePath: Record<UserRole, string> = {
  admin: "/dashboard",
  allenatore: "/dashboard",
  preparatore: "/performance",
  giocatore: "/dashboard",
  medico: "/infortuni",
  fisioterapista: "/infortuni",
};

/*
 * Medico e fisioterapista leggono tutto il gestionale (filtrato per club
 * dalle policy RLS) e scrivono solo sugli infortuni: qui compaiono su
 * ogni rotta, il permesso di scrittura e' in @/lib/permessi/infortuni.
 */
const SANITARI: UserRole[] = ["medico", "fisioterapista"];

export const routePermissions: Record<string, UserRole[]> = {
  "/dashboard": ["admin", "allenatore", "preparatore", "giocatore", ...SANITARI],

  "/club": ["admin", "allenatore", ...SANITARI],
  "/squadre": ["admin", "allenatore", ...SANITARI],

  "/giocatori": ["admin", "allenatore", "preparatore", ...SANITARI],

  "/allenamenti": ["admin", "allenatore", "preparatore", ...SANITARI],
  "/partite": ["admin", "allenatore", ...SANITARI],
  "/infortuni": ["admin", "allenatore", "preparatore", ...SANITARI],

  "/performance": ["admin", "allenatore", "preparatore", "giocatore", ...SANITARI],
  "/comunicazioni": ["admin", "allenatore", "preparatore", "giocatore", ...SANITARI],

  "/report": ["admin", "allenatore", "preparatore", "giocatore", ...SANITARI],
  "/file": ["admin", "allenatore", "preparatore", ...SANITARI],

  "/utenti-permessi": ["admin"],
  "/impostazioni": ["admin", "allenatore"],
};

export function canAccessRoute(role: UserRole | null | undefined, pathname: string) {
  if (!role) return false;

  const matchedRoute = Object.keys(routePermissions)
    .sort((a, b) => b.length - a.length)
    .find((route) => pathname === route || pathname.startsWith(`${route}/`));

  if (!matchedRoute) return false;

  return routePermissions[matchedRoute].includes(role);
}

export function canAccessMenuItem(role: UserRole | null | undefined, href: string) {
  return canAccessRoute(role, href);
}

export function getDefaultRedirectByRole(role: UserRole | null | undefined) {
  if (!role) return "/login";
  return roleHomePath[role] ?? "/dashboard";
}