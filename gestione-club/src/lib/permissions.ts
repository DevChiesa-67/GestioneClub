
export type UserRole = "admin" | "allenatore" | "preparatore" | "giocatore";

export const roleLabels: Record<UserRole, string> = {
  admin: "Admin",
  allenatore: "Allenatore",
  preparatore: "Preparatore",
  giocatore: "Giocatore",
};

export const roleHomePath: Record<UserRole, string> = {
  admin: "/dashboard",
  allenatore: "/dashboard",
  preparatore: "/performance",
  giocatore: "/dashboard",
};

export const routePermissions: Record<string, UserRole[]> = {
  "/dashboard": ["admin", "allenatore", "preparatore", "giocatore"],

  "/club": ["admin", "allenatore"],
  "/squadre": ["admin", "allenatore"],

  "/giocatori": ["admin", "allenatore", "preparatore"],

  "/allenamenti": ["admin", "allenatore", "preparatore"],
  "/partite": ["admin", "allenatore"],

  "/performance": ["admin", "allenatore", "preparatore", "giocatore"],
  "/comunicazioni": ["admin", "allenatore", "preparatore", "giocatore"],

  "/report": ["admin", "allenatore", "preparatore", "giocatore"],
  "/file": ["admin", "allenatore", "preparatore"],

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