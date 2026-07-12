"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { createPortal } from "react-dom";
import { usePathname, useRouter } from "next/navigation";
import { Bell, ChevronDown, Menu, X } from "lucide-react";

import { supabase } from "@/lib/supabase-client";
import { usePagePermissions } from "@/hooks/use-page-permissions";
import {
  useComunicazioniBell,
  type ComunicazioneBell,
} from "@/hooks/use-comunicazioni-bell";
import { isMenuItemActive } from "@/lib/navigation/app-menu";

type Squadra = {
  id: string;
  nome: string;
  categoria: string | null;
  stagione: string | null;
};

type Profilo = {
  nome: string | null;
  cognome: string | null;
  email: string | null;
  last_club_id: string | null;
  last_squadra_id: string | null;
};

type ClubTheme = {
  nome: string | null;
  colore_flag: string | null;
};

type SquadraPartitaLogo = {
  logo_path: string | null;
};

const DEFAULT_THEME_COLOR = "#d71920";

const PAGE_INFO: Record<
  string,
  {
    title: string;
    subtitle: string;
  }
> = {
  "/dashboard": {
    title: "Dashboard",
    subtitle: "Panoramica del club e della squadra selezionati.",
  },
  "/ai-chat": {
    title: "AI Chatbot",
    subtitle: "Interagisci con l'assistente intelligente del club.",
  },
  "/club": {
    title: "Gestione Club",
    subtitle: "Configura club, colori, squadre e impostazioni.",
  },
  "/squadre": {
    title: "Squadre",
    subtitle: "Gestisci le squadre del club.",
  },
  "/giocatori": {
    title: "Giocatori",
    subtitle: "Gestisci i giocatori della squadra selezionata.",
  },
  "/giocate": {
    title: "Giocate Rugby",
    subtitle:
      "Consulta codici, famiglie e significati delle giocate della squadra attiva.",
  },
  "/allenamenti": {
    title: "Allenamenti",
    subtitle: "Organizza e monitora le sessioni di allenamento.",
  },
  "/allenamenti/programmazione": {
    title: "Programmazione Macrociclo e Mesociclo",
    subtitle:
      "Gestisci fasi, settimane, sedute, carico interno RPE e carico GPS della squadra selezionata.",
  },
  "/allenamenti/nuovo": {
    title: "Nuovo allenamento",
    subtitle: "Crea una nuova seduta di allenamento.",
  },
  "/partite": {
    title: "Partite",
    subtitle: "Calendario e risultati delle partite.",
  },
  "/performance": {
    title: "Performance",
    subtitle: "Analizza le prestazioni degli atleti.",
  },
  "/performance/importa-dati": {
    title: "Catapult Import",
    subtitle: "Importa e analizza i dati di performance.",
  },
  "/misurazioni": {
    title: "Misurazioni",
    subtitle: "Gestisci le misurazioni dei giocatori.",
  },
  "/comunicazioni": {
    title: "Comunicazioni",
    subtitle: "Invia messaggi e avvisi alla squadra.",
  },
  "/infortuni": {
    title: "Infortuni",
    subtitle: "Gestisci gli infortuni e il percorso di recupero.",
  },
  "/reportistica": {
    title: "Report",
    subtitle: "Crea statistiche e report.",
  },
  "/file": {
    title: "File",
    subtitle: "Documenti condivisi del club.",
  },
  "/utenti-permessi": {
    title: "Utenti",
    subtitle: "Gestisci utenti e permessi.",
  },
  "/impostazioni": {
    title: "Impostazioni",
    subtitle: "Configura il gestionale.",
  },
  "/test": {
    title: "Test",
    subtitle: "Inserisci e monitora test atletici e test di forza.",
  },
};

function usePathBoundBoolean(pathname: string) {
  const [state, setState] = useState({
    pathname,
    value: false,
  });

  const value = state.pathname === pathname ? state.value : false;

  const setValue = useCallback(
    (nextValue: boolean | ((previous: boolean) => boolean)) => {
      setState((previousState) => {
        const currentValue =
          previousState.pathname === pathname ? previousState.value : false;

        const resolvedValue =
          typeof nextValue === "function" ? nextValue(currentValue) : nextValue;

        return {
          pathname,
          value: resolvedValue,
        };
      });
    },
    [pathname],
  );

  return [value, setValue] as const;
}

function getPageInfo(pathname: string) {
  if (PAGE_INFO[pathname]) {
    return PAGE_INFO[pathname];
  }

  const matchingPath = Object.keys(PAGE_INFO)
    .filter((path) => path !== "/dashboard" && pathname.startsWith(`${path}/`))
    .sort((a, b) => b.length - a.length)[0];

  if (matchingPath) {
    return PAGE_INFO[matchingPath];
  }

  const lastSegment = pathname.split("/").filter(Boolean).pop();

  return {
    title: lastSegment
      ? lastSegment
          .replaceAll("-", " ")
          .replace(/\b\w/g, (char) => char.toUpperCase())
      : "Dashboard",
    subtitle: "",
  };
}

function getInitials(
  nome?: string | null,
  cognome?: string | null,
  email?: string | null,
) {
  const first = nome?.trim().charAt(0) ?? "";
  const second = cognome?.trim().charAt(0) ?? "";

  if (first || second) {
    return `${first}${second}`.toUpperCase();
  }

  return email?.trim().charAt(0).toUpperCase() ?? "U";
}

function getClubInitials(clubName: string) {
  return (
    clubName
      .split(" ")
      .filter(Boolean)
      .slice(0, 2)
      .map((word) => word.charAt(0))
      .join("")
      .toUpperCase() || "CL"
  );
}

function formatOraNotifica(createdAt: string) {
  const data = new Date(createdAt);
  const diffMs = Date.now() - data.getTime();
  const diffMin = Math.round(diffMs / 60000);

  if (diffMin < 1) return "Adesso";
  if (diffMin < 60) return `${diffMin} min fa`;

  const diffOre = Math.round(diffMin / 60);
  if (diffOre < 24) return `${diffOre} ${diffOre === 1 ? "ora" : "ore"} fa`;

  const diffGiorni = Math.round(diffOre / 24);
  if (diffGiorni < 7) return `${diffGiorni} ${diffGiorni === 1 ? "giorno" : "giorni"} fa`;

  return data.toLocaleDateString("it-IT", {
    day: "numeric",
    month: "short",
  });
}

function getLogoPublicUrl(logoPath: string | null | undefined) {
  if (!logoPath) {
    return null;
  }

  const cleanPath = logoPath
    .trim()
    .replace(/^\/+/, "")
    .replace(/^loghi-squadre\//, "");

  const { data } = supabase.storage
    .from("loghi-squadre")
    .getPublicUrl(cleanPath);

  return data.publicUrl;
}

export function Topbar() {
  const pathname = usePathname();
  const router = useRouter();

  const pageInfo = useMemo(() => getPageInfo(pathname), [pathname]);

  const { loading: permissionsLoading, allowedMenuItems } =
    usePagePermissions();

  const {
    comunicazioni: comunicazioniNonLette,
    lettureIds,
    nonLette,
    segnaComeLetta,
    segnaTutteComeLette,
  } = useComunicazioniBell();

  const mobileMenuItems = useMemo(
    () => allowedMenuItems.filter((item) => item.showInMobileMenu),
    [allowedMenuItems],
  );

  const userMenuItems = useMemo(
    () => allowedMenuItems.filter((item) => item.showInUserMenu),
    [allowedMenuItems],
  );

  const [squadre, setSquadre] = useState<Squadra[]>([]);

  const [activeSquadra, setActiveSquadra] = useState<Squadra | null>(null);

  const [profilo, setProfilo] = useState<Profilo | null>(null);

  const [themeColor, setThemeColor] = useState(DEFAULT_THEME_COLOR);

  const [clubName, setClubName] = useState("Nome Club");

  const [clubLogoUrl, setClubLogoUrl] = useState<string | null>(null);

  const [openSquadre, setOpenSquadre] = usePathBoundBoolean(pathname);

  const [openUserMenu, setOpenUserMenu] = usePathBoundBoolean(pathname);

  const [openNotifiche, setOpenNotifiche] = usePathBoundBoolean(pathname);

  const [openMobileMenu, setOpenMobileMenu] = usePathBoundBoolean(pathname);

  const initials = getInitials(profilo?.nome, profilo?.cognome, profilo?.email);

  /*
   * Blocca lo scroll della pagina quando
   * il drawer mobile è aperto.
   */
  useEffect(() => {
    if (!openMobileMenu) {
      return;
    }

    const previousOverflow = document.body.style.overflow;

    document.body.style.overflow = "hidden";

    return () => {
      document.body.style.overflow = previousOverflow;
    };
  }, [openMobileMenu]);

  useEffect(() => {
    let isMounted = true;

    async function loadTopbarData() {
      const {
        data: { user },
        error: userError,
      } = await supabase.auth.getUser();

      if (userError || !user || !isMounted) {
        return;
      }

      /*
       * 1. Profilo corrente.
       */
      const { data: profiloData, error: profiloError } = await supabase
        .from("profili")
        .select(
          `
            nome,
            cognome,
            email,
            last_club_id,
            last_squadra_id
          `,
        )
        .eq("auth_user_id", user.id)
        .single<Profilo>();

      if (profiloError || !profiloData || !isMounted) {
        console.error("Errore caricamento profilo:", profiloError);

        return;
      }

      setProfilo(profiloData);

      if (!profiloData.last_club_id) {
        setSquadre([]);
        setActiveSquadra(null);
        setThemeColor(DEFAULT_THEME_COLOR);
        setClubName("Nome Club");
        setClubLogoUrl(null);

        return;
      }

      const activeClubId = profiloData.last_club_id;

      /*
       * 2. Club attivo.
       */
      const { data: clubData, error: clubError } = await supabase
        .from("club")
        .select("nome,colore_flag")
        .eq("id", activeClubId)
        .single<ClubTheme>();

      if (!isMounted) {
        return;
      }

      if (clubError) {
        console.error("Errore caricamento tema club:", clubError);

        setThemeColor(DEFAULT_THEME_COLOR);
        setClubName("Nome Club");
      } else {
        setThemeColor(clubData?.colore_flag || DEFAULT_THEME_COLOR);

        setClubName(clubData?.nome || "Nome Club");
      }

      /*
       * 3. Squadre appartenenti al club attivo.
       */
      const { data: squadreData, error: squadreError } = await supabase
        .from("squadre")
        .select(
          `
            id,
            nome,
            categoria,
            stagione
          `,
        )
        .eq("club_id", activeClubId)
        .order("nome", {
          ascending: true,
        });

      if (squadreError || !isMounted) {
        console.error("Errore caricamento squadre:", squadreError);

        return;
      }

      const formattedSquadre: Squadra[] = squadreData ?? [];

      setSquadre(formattedSquadre);

      const selectedSquadra =
        formattedSquadre.find(
          (squadra) => squadra.id === profiloData.last_squadra_id,
        ) ??
        formattedSquadre[0] ??
        null;

      setActiveSquadra(selectedSquadra);

      /*
       * 4. Sincronizza last_squadra_id.
       */
      if (
        selectedSquadra &&
        profiloData.last_squadra_id !== selectedSquadra.id
      ) {
        const { error: updateError } = await supabase
          .from("profili")
          .update({
            last_squadra_id: selectedSquadra.id,
            updated_at: new Date().toISOString(),
          })
          .eq("auth_user_id", user.id);

        if (updateError) {
          console.error("Errore aggiornamento squadra attiva:", updateError);
        }
      }

      if (!selectedSquadra && profiloData.last_squadra_id) {
        const { error: resetError } = await supabase
          .from("profili")
          .update({
            last_squadra_id: null,
            updated_at: new Date().toISOString(),
          })
          .eq("auth_user_id", user.id);

        if (resetError) {
          console.error("Errore reset squadra attiva:", resetError);
        }
      }

      /*
       * 5. Logo del club/squadra.
       */
      if (!selectedSquadra) {
        setClubLogoUrl(null);
        return;
      }

      const { data: logoData, error: logoError } = await supabase
        .from("squadre_partite")
        .select("logo_path")
        .eq("club_id", activeClubId)
        .not("logo_path", "is", null)
        .limit(1)
        .maybeSingle<SquadraPartitaLogo>();

      if (!isMounted) {
        return;
      }

      if (logoError) {
        console.error("Errore caricamento logo club:", logoError);

        setClubLogoUrl(null);
        return;
      }

      const logoUrl = getLogoPublicUrl(logoData?.logo_path);

      setClubLogoUrl(logoUrl);
    }

    void loadTopbarData();

    return () => {
      isMounted = false;
    };
  }, []);

  async function selectSquadra(squadra: Squadra) {
    const {
      data: { user },
      error: userError,
    } = await supabase.auth.getUser();

    if (userError || !user) {
      return;
    }

    /*
     * Impedisce di impostare una squadra
     * che non appartiene all'elenco caricato
     * per il club attivo.
     */
    const squadraValida = squadre.some((item) => item.id === squadra.id);

    if (!squadraValida) {
      console.error("Tentativo di selezionare una squadra non valida.");

      return;
    }

    const { error } = await supabase
      .from("profili")
      .update({
        last_squadra_id: squadra.id,
        updated_at: new Date().toISOString(),
      })
      .eq("auth_user_id", user.id);

    if (error) {
      console.error("Errore selezione squadra:", error);

      return;
    }

    setActiveSquadra(squadra);
    setOpenSquadre(false);

    window.location.reload();
  }

  function apriComunicazione(comunicazione: ComunicazioneBell) {
    if (!lettureIds.has(comunicazione.id)) {
      void segnaComeLetta(comunicazione.id);
    }

    setOpenNotifiche(false);

    router.push(`/comunicazioni/${comunicazione.id}`);
  }

  const mobileDrawer =
    openMobileMenu && typeof document !== "undefined"
      ? createPortal(
          <div className="fixed inset-0 z-[2147483647] lg:hidden">
            {/* OVERLAY */}
            <button
              type="button"
              className="absolute inset-0 z-0 h-full w-full cursor-default bg-black/75 backdrop-blur-sm"
              onClick={() => setOpenMobileMenu(false)}
              aria-label="Chiudi menu"
            />

            {/* DRAWER */}
            <aside className="absolute right-0 top-0 z-10 h-dvh w-[86%] max-w-[370px] overflow-y-auto overscroll-contain border-l border-white/10 bg-[#111] shadow-2xl">
              {/* HEADER */}
              <div className="sticky top-0 z-20 flex min-h-[72px] items-center justify-between gap-3 border-b border-white/10 bg-[#111]/95 px-4 backdrop-blur-xl">
                <div className="flex min-w-0 items-center gap-3">
                  {clubLogoUrl ? (
                    <div className="flex h-12 w-12 shrink-0 items-center justify-center">
                      <Image
                        src={clubLogoUrl}
                        alt={`Logo ${clubName}`}
                        width={96}
                        height={96}
                        className="h-12 w-12 object-contain"
                      />
                    </div>
                  ) : (
                    <div
                      className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl text-xs font-black text-white"
                      style={{
                        backgroundColor: themeColor,
                      }}
                    >
                      {getClubInitials(clubName)}
                    </div>
                  )}

                  <div className="min-w-0">
                    <p className="text-[10px] uppercase tracking-[0.18em] text-zinc-500">
                      Club attivo
                    </p>

                    <p className="truncate text-base font-black text-white">
                      {clubName}
                    </p>
                  </div>
                </div>

                <button
                  type="button"
                  onClick={() => setOpenMobileMenu(false)}
                  className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-white/10 text-white transition hover:bg-white/5"
                  aria-label="Chiudi menu"
                >
                  <X size={22} />
                </button>
              </div>

              <div className="p-4">
                {/* PROFILO */}
                <div className="mb-4 rounded-2xl border border-white/10 bg-black/30 p-3">
                  <p className="text-xs uppercase tracking-wide text-zinc-500">
                    Profilo
                  </p>

                  <div className="mt-2 flex items-center gap-3">
                    <div
                      className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl text-sm font-black text-white"
                      style={{
                        backgroundColor: themeColor,
                      }}
                    >
                      {initials}
                    </div>

                    <div className="min-w-0">
                      <p className="truncate text-sm font-bold text-white">
                        {profilo?.nome || profilo?.cognome
                          ? `${profilo?.nome ?? ""} ${
                              profilo?.cognome ?? ""
                            }`.trim()
                          : "Utente"}
                      </p>

                      {profilo?.email && (
                        <p className="truncate text-xs text-zinc-500">
                          {profilo.email}
                        </p>
                      )}
                    </div>
                  </div>
                </div>

                {/* SQUADRA ATTIVA */}
                {activeSquadra && (
                  <div className="mb-4 rounded-2xl border border-white/10 bg-black/30 p-3">
                    <p className="text-xs uppercase tracking-wide text-zinc-500">
                      Squadra attiva
                    </p>

                    <p className="mt-1 truncate text-sm font-bold text-white">
                      {activeSquadra.nome}
                    </p>

                    <p className="truncate text-xs text-zinc-500">
                      {activeSquadra.categoria || "Senza categoria"} ·{" "}
                      {activeSquadra.stagione || "Senza stagione"}
                    </p>
                  </div>
                )}

                {/* MENU FILTRATO */}
                <nav className="space-y-1">
                  {permissionsLoading ? (
                    <div className="space-y-2 py-2">
                      {Array.from({
                        length: 6,
                      }).map((_, index) => (
                        <div
                          key={index}
                          className="h-11 animate-pulse rounded-xl bg-white/5"
                        />
                      ))}
                    </div>
                  ) : mobileMenuItems.length === 0 ? (
                    <div className="rounded-xl border border-white/10 bg-black/20 px-4 py-3 text-sm text-zinc-500">
                      Nessuna pagina disponibile.
                    </div>
                  ) : (
                    mobileMenuItems.map((item) => {
                      const Icon = item.icon;

                      const active = isMenuItemActive(pathname, item.href);

                      return (
                        <Link
                          key={item.href}
                          href={item.href}
                          onClick={() => setOpenMobileMenu(false)}
                          className="flex items-center gap-3 rounded-xl px-3 py-3 text-sm font-semibold text-zinc-300 transition hover:bg-white/5 hover:text-white"
                          style={
                            active
                              ? {
                                  backgroundColor: `${themeColor}24`,
                                  color: "white",
                                }
                              : undefined
                          }
                        >
                          <Icon
                            size={19}
                            className="shrink-0"
                            style={
                              active
                                ? {
                                    color: themeColor,
                                  }
                                : undefined
                            }
                          />

                          <span className="truncate">{item.label}</span>
                        </Link>
                      );
                    })
                  )}
                </nav>
              </div>
            </aside>
          </div>,
          document.body,
        )
      : null;

  return (
    <>
      <header className="sticky top-0 z-40 border-b border-white/10 bg-[#090909]/95 backdrop-blur-xl">
        {/* MOBILE TOPBAR */}
        <div className="flex min-h-[64px] items-center justify-between px-4 lg:hidden">
          <Link
            href="/dashboard"
            className="flex min-w-0 items-center gap-3"
            onClick={() => setOpenMobileMenu(false)}
          >
            {clubLogoUrl ? (
              <div className="flex h-12 w-12 shrink-0 items-center justify-center">
                <Image
                  src={clubLogoUrl}
                  alt={`Logo ${clubName}`}
                  width={96}
                  height={96}
                  className="h-12 w-12 object-contain"
                />
              </div>
            ) : (
              <div
                className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl text-xs font-black text-white"
                style={{
                  backgroundColor: themeColor,
                  boxShadow: `0 10px 25px ${themeColor}33`,
                }}
              >
                {getClubInitials(clubName)}
              </div>
            )}

            <span className="truncate text-sm font-black text-white">
              {clubName}
            </span>
          </Link>

          <button
            type="button"
            onClick={() => {
              setOpenMobileMenu(true);
              setOpenSquadre(false);
              setOpenUserMenu(false);
            }}
            className="flex h-11 w-11 items-center justify-center rounded-xl border border-white/10 text-white transition hover:bg-white/5"
            aria-label="Apri menu"
          >
            <Menu size={24} />
          </button>
        </div>

        {/* DESKTOP TOPBAR */}
        <div className="mx-auto hidden min-h-[72px] w-full max-w-[1700px] items-center justify-between gap-3 px-4 py-3 sm:px-5 lg:flex lg:min-h-20 lg:px-8 lg:py-0">
          <div className="min-w-0 flex-1">
            <h1 className="truncate text-2xl font-black leading-tight text-white sm:text-3xl lg:text-4xl">
              {pageInfo.title}
            </h1>

            {pageInfo.subtitle && (
              <p className="mt-1 hidden truncate text-sm text-zinc-400 sm:block">
                {pageInfo.subtitle}
              </p>
            )}
          </div>

          <div className="flex shrink-0 items-center gap-2 sm:gap-3 lg:gap-5">
            {/* NOTIFICHE */}
            <div className="relative">
              <button
                type="button"
                onClick={() => {
                  setOpenNotifiche((previous) => !previous);

                  setOpenSquadre(false);
                  setOpenUserMenu(false);
                }}
                className="relative flex h-10 w-10 items-center justify-center rounded-xl text-white transition hover:bg-white/5 sm:h-11 sm:w-11"
                aria-label="Notifiche"
              >
                <Bell className="h-5 w-5 sm:h-6 sm:w-6" />

                {nonLette > 0 && (
                  <span
                    className="absolute right-0 top-0 flex h-[18px] min-w-[18px] items-center justify-center rounded-full px-1 text-[9px] font-bold text-white sm:h-5 sm:min-w-5 sm:text-[10px]"
                    style={{
                      backgroundColor: themeColor,
                    }}
                  >
                    {nonLette > 9 ? "9+" : nonLette}
                  </span>
                )}
              </button>

              {openNotifiche && (
                <div className="fixed left-4 right-4 top-[76px] z-50 max-h-[70vh] overflow-y-auto rounded-2xl border border-white/10 bg-[#171717] shadow-2xl sm:absolute sm:left-auto sm:right-0 sm:top-auto sm:mt-3 sm:w-96">
                  <div className="flex items-center justify-between border-b border-white/10 px-4 py-3">
                    <p className="text-sm font-bold text-white">
                      Notifiche
                    </p>

                    {nonLette > 0 && (
                      <button
                        type="button"
                        onClick={() => void segnaTutteComeLette()}
                        className="text-xs font-medium text-zinc-400 transition hover:text-white"
                      >
                        Segna tutte come lette
                      </button>
                    )}
                  </div>

                  {comunicazioniNonLette.length === 0 ? (
                    <p className="px-4 py-6 text-center text-sm text-zinc-500">
                      Nessuna comunicazione.
                    </p>
                  ) : (
                    <div className="p-2">
                      {comunicazioniNonLette.map((comunicazione) => {
                        const letta = lettureIds.has(comunicazione.id);

                        return (
                          <button
                            key={comunicazione.id}
                            type="button"
                            onClick={() => apriComunicazione(comunicazione)}
                            className="flex w-full items-start gap-2 rounded-xl px-3 py-3 text-left transition hover:bg-white/5"
                          >
                            <span
                              className="mt-1.5 h-2 w-2 shrink-0 rounded-full"
                              style={{
                                backgroundColor: letta
                                  ? "transparent"
                                  : themeColor,
                              }}
                            />

                            <span className="min-w-0 flex-1">
                              <span
                                className={`block truncate text-sm ${
                                  letta
                                    ? "font-medium text-zinc-300"
                                    : "font-bold text-white"
                                }`}
                              >
                                {comunicazione.titolo}
                              </span>

                              <span className="mt-0.5 line-clamp-2 block text-xs text-zinc-500">
                                {comunicazione.descrizione}
                              </span>

                              <span className="mt-1 block text-[11px] text-zinc-600">
                                {formatOraNotifica(comunicazione.created_at)}
                              </span>
                            </span>
                          </button>
                        );
                      })}
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* SELETTORE SQUADRA */}
            <div className="relative">
              <button
                type="button"
                onClick={() => {
                  setOpenSquadre((previous) => !previous);

                  setOpenUserMenu(false);
                  setOpenNotifiche(false);
                }}
                className="flex h-10 max-w-[150px] items-center justify-between gap-2 rounded-xl border border-white/10 px-3 text-white transition hover:bg-white/5 sm:h-auto sm:min-w-[190px] sm:max-w-[220px] sm:gap-3 sm:px-4 sm:py-2.5 lg:min-w-[240px] lg:max-w-none lg:gap-4 lg:px-5 lg:py-3"
              >
                <span className="min-w-0 text-left">
                  {activeSquadra ? (
                    <>
                      <span className="block truncate text-xs font-bold sm:text-sm">
                        {activeSquadra.nome}
                      </span>

                      <span className="hidden truncate text-xs text-zinc-400 sm:block">
                        {activeSquadra.categoria || "Senza categoria"} ·{" "}
                        {activeSquadra.stagione || "Senza stagione"}
                      </span>
                    </>
                  ) : (
                    <span className="block truncate text-xs text-zinc-400 sm:text-sm">
                      Nessuna squadra
                    </span>
                  )}
                </span>

                <ChevronDown
                  size={16}
                  className={`shrink-0 transition-transform sm:h-[18px] sm:w-[18px] ${
                    openSquadre ? "rotate-180" : ""
                  }`}
                />
              </button>

              {openSquadre && (
                <div className="fixed left-4 right-4 top-[76px] z-50 max-h-[60vh] overflow-y-auto rounded-2xl border border-white/10 bg-[#171717] p-2 shadow-2xl sm:absolute sm:left-auto sm:right-0 sm:top-auto sm:mt-3 sm:w-80">
                  {squadre.length === 0 ? (
                    <p className="px-4 py-3 text-sm text-zinc-500">
                      Nessuna squadra disponibile.
                    </p>
                  ) : (
                    squadre.map((squadra) => {
                      const isActive = activeSquadra?.id === squadra.id;

                      return (
                        <button
                          key={squadra.id}
                          type="button"
                          onClick={() => void selectSquadra(squadra)}
                          className="w-full rounded-xl px-4 py-3 text-left text-zinc-300 transition hover:bg-white/5 hover:text-white"
                          style={
                            isActive
                              ? {
                                  backgroundColor: `${themeColor}26`,
                                  color: "white",
                                }
                              : undefined
                          }
                        >
                          <span className="block text-sm font-bold">
                            {squadra.nome}
                          </span>

                          <span className="block text-xs text-zinc-500">
                            {squadra.categoria || "Senza categoria"} ·{" "}
                            {squadra.stagione || "Senza stagione"}
                          </span>
                        </button>
                      );
                    })
                  )}
                </div>
              )}
            </div>

            {/* MENU UTENTE */}
            <div className="relative">
              <button
                type="button"
                onClick={() => {
                  setOpenUserMenu((previous) => !previous);

                  setOpenSquadre(false);
                  setOpenNotifiche(false);
                }}
                className="flex h-10 items-center gap-1 rounded-xl transition hover:bg-white/5 sm:h-[46px] sm:gap-2 sm:px-1 lg:h-[50px] lg:gap-3 lg:px-3"
              >
                <div
                  className="flex h-9 w-9 items-center justify-center rounded-xl text-xs font-black text-white sm:h-10 sm:w-10 sm:text-sm"
                  style={{
                    backgroundColor: themeColor,
                    boxShadow: `0 10px 25px ${themeColor}33`,
                  }}
                >
                  {initials}
                </div>

                <ChevronDown
                  size={18}
                  className={`hidden text-zinc-400 transition-transform sm:block ${
                    openUserMenu ? "rotate-180" : ""
                  }`}
                />
              </button>

              {openUserMenu && (
                <div className="fixed left-4 right-4 top-[76px] z-50 rounded-2xl border border-white/10 bg-[#171717] p-2 shadow-2xl sm:absolute sm:left-auto sm:right-0 sm:top-auto sm:mt-3 sm:w-64">
                  <div className="border-b border-white/10 px-3 py-3">
                    <p className="text-sm font-bold text-white">
                      {profilo?.nome || profilo?.cognome
                        ? `${profilo?.nome ?? ""} ${
                            profilo?.cognome ?? ""
                          }`.trim()
                        : "Utente"}
                    </p>

                    {profilo?.email && (
                      <p className="truncate text-xs text-zinc-500">
                        {profilo.email}
                      </p>
                    )}
                  </div>

                  <div className="mt-2">
                    {permissionsLoading ? (
                      <div className="space-y-2 p-1">
                        {Array.from({
                          length: 3,
                        }).map((_, index) => (
                          <div
                            key={index}
                            className="h-10 animate-pulse rounded-xl bg-white/5"
                          />
                        ))}
                      </div>
                    ) : (
                      userMenuItems.map((item) => {
                        const Icon = item.icon;

                        const active = isMenuItemActive(pathname, item.href);

                        return (
                          <Link
                            key={item.href}
                            href={item.href}
                            onClick={() => setOpenUserMenu(false)}
                            className="flex items-center gap-3 rounded-xl px-3 py-3 text-sm text-zinc-300 transition hover:bg-white/5 hover:text-white"
                            style={
                              active
                                ? {
                                    backgroundColor: `${themeColor}20`,
                                    color: "white",
                                  }
                                : undefined
                            }
                          >
                            <Icon
                              size={18}
                              className="shrink-0"
                              style={
                                active
                                  ? {
                                      color: themeColor,
                                    }
                                  : undefined
                              }
                            />

                            <span className="truncate">{item.label}</span>
                          </Link>
                        );
                      })
                    )}
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      </header>

      {mobileDrawer}
    </>
  );
}