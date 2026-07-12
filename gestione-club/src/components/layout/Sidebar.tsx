// src/components/layout/Sidebar.tsx

"use client";

import {
  Dispatch,
  SetStateAction,
  useEffect,
  useMemo,
  useState,
} from "react";
import Link from "next/link";
import Image from "next/image";
import { usePathname } from "next/navigation";
import ClubSwitcher from "./ClubSwitcher";
import { supabase } from "@/lib/supabase-client";
import {
  PanelLeftClose,
  PanelLeftOpen,
} from "lucide-react";
import {
  isMenuItemActive,
} from "@/lib/navigation/app-menu";
import { usePagePermissions } from "@/hooks/use-page-permissions";

type ClubTheme = {
  nome: string | null;
  logo_url: string | null;
  colore_flag: string | null;
};

type SidebarProps = {
  collapsed: boolean;
  setCollapsed: Dispatch<SetStateAction<boolean>>;
};

const DEFAULT_THEME_COLOR = "#d71920";

export function Sidebar({
  collapsed,
  setCollapsed,
}: SidebarProps) {
  const pathname = usePathname();

  const [themeColor, setThemeColor] = useState(
    DEFAULT_THEME_COLOR
  );

  const [clubTheme, setClubTheme] =
    useState<ClubTheme | null>(null);

  const {
    loading: permissionsLoading,
    allowedMenuItems,
  } = usePagePermissions();

  const sidebarItems = useMemo(
    () =>
      allowedMenuItems.filter(
        (item) => item.showInSidebar
      ),
    [allowedMenuItems]
  );

  useEffect(() => {
    let mounted = true;

    async function loadThemeColor() {
      const {
        data: { user },
        error: userError,
      } = await supabase.auth.getUser();

      if (userError || !user || !mounted) return;

      const { data: profile, error: profileError } =
        await supabase
          .from("profili")
          .select("last_club_id")
          .eq("auth_user_id", user.id)
          .single();

      if (
        profileError ||
        !profile?.last_club_id ||
        !mounted
      ) {
        return;
      }

      const { data: club, error: clubError } =
        await supabase
          .from("club")
          .select("nome,logo_url,colore_flag")
          .eq("id", profile.last_club_id)
          .single<ClubTheme>();

      if (clubError || !club || !mounted) return;

      setClubTheme(club);
      setThemeColor(
        club.colore_flag || DEFAULT_THEME_COLOR
      );
    }

    void loadThemeColor();

    return () => {
      mounted = false;
    };
  }, []);

  return (
    <aside
      className={`fixed left-0 top-0 z-40 flex h-screen flex-col border-r border-white/10 bg-[#0d0d0d] transition-[width] duration-300 ${
        collapsed ? "w-20" : "w-60"
      }`}
    >
      {/* HEADER CLUB */}
      <div
        className={`shrink-0 border-b border-white/10 ${
          collapsed ? "px-2 py-1" : "px-3 py-0"
        }`}
      >
        {collapsed ? (
          <div className="flex h-9 w-full items-center justify-center">
            {clubTheme?.logo_url ? (
              <div className="relative h-7 w-7">
                <Image
                  src={clubTheme.logo_url}
                  alt={clubTheme.nome ?? "Logo club"}
                  fill
                  sizes="28px"
                  className="object-contain"
                />
              </div>
            ) : (
              <div
                className="flex h-7 w-7 items-center justify-center rounded-lg text-[10px] font-bold text-white"
                style={{
                  backgroundColor: themeColor,
                }}
              >
                {clubTheme?.nome?.charAt(0) ?? "C"}
              </div>
            )}
          </div>
        ) : (
          <div className="w-full">
            <ClubSwitcher />
          </div>
        )}
      </div>

      {/* NAVIGAZIONE */}
      <nav
        className={`min-h-0 flex-1 space-y-2 overflow-y-auto ${
          collapsed ? "px-3 py-3" : "px-5 py-3"
        }`}
      >
        {!permissionsLoading &&
          sidebarItems.map((item) => {
            const active = isMenuItemActive(
              pathname,
              item.href
            );

            const Icon = item.icon;

            return (
              <Link
                key={item.href}
                href={item.href}
                title={
                  collapsed ? item.label : undefined
                }
                style={
                  active
                    ? {
                        backgroundColor: themeColor,
                        boxShadow: `0 10px 25px ${themeColor}33`,
                      }
                    : undefined
                }
                className={`flex items-center rounded-xl transition ${
                  collapsed
                    ? "justify-center px-3 py-3"
                    : "gap-4 px-4 py-3"
                } ${
                  active
                    ? "text-white"
                    : "text-zinc-400 hover:bg-white/5 hover:text-white"
                }`}
              >
                <Icon size={20} className="shrink-0" />

                {!collapsed && (
                  <span className="truncate">
                    {item.label}
                  </span>
                )}
              </Link>
            );
          })}
      </nav>

      {/* LINGUETTA APERTURA / CHIUSURA */}
      <button
        type="button"
        onClick={() =>
          setCollapsed((value) => !value)
        }
        className="absolute bottom-24 -right-4 z-50 flex h-10 w-8 items-center justify-center rounded-r-xl border border-l-0 border-white/10 bg-[#0d0d0d] text-zinc-400 shadow-lg transition hover:text-white"
        style={{
          boxShadow: collapsed
            ? `0 0 18px ${themeColor}33`
            : "0 10px 25px rgba(0,0,0,0.35)",
        }}
        aria-label={
          collapsed ? "Apri sidebar" : "Chiudi sidebar"
        }
      >
        {collapsed ? (
          <PanelLeftOpen size={18} />
        ) : (
          <PanelLeftClose size={18} />
        )}
      </button>
    </aside>
  );
}