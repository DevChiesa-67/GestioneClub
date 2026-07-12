// src/hooks/use-page-permissions.ts

"use client";

import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/lib/supabase-client";
import {
  APP_MENU_ITEMS,
  AppMenuItem,
} from "@/lib/navigation/app-menu";

type ProfiloPermessi = {
  last_club_id: string | null;
  tipo_profilo: string | null;
};

type PermessoPagina = {
  pagina_key: string;
  can_view: boolean;
};

type UsePagePermissionsResult = {
  loading: boolean;
  tipoProfilo: string | null;
  isAdmin: boolean;
  allowedKeys: Set<string>;
  allowedMenuItems: AppMenuItem[];
  canAccess: (permissionKey: string) => boolean;
};

export function usePagePermissions(): UsePagePermissionsResult {
  const [loading, setLoading] = useState(true);
  const [tipoProfilo, setTipoProfilo] = useState<string | null>(null);
  const [allowedKeys, setAllowedKeys] = useState<Set<string>>(
    new Set()
  );

  useEffect(() => {
    let mounted = true;

    async function loadPermissions() {
      setLoading(true);

      try {
        const {
          data: { user },
          error: userError,
        } = await supabase.auth.getUser();

        if (userError) {
          throw userError;
        }

        if (!user) {
          if (mounted) {
            setTipoProfilo(null);
            setAllowedKeys(new Set());
          }

          return;
        }

        const { data: profilo, error: profiloError } =
          await supabase
            .from("profili")
            .select("last_club_id,tipo_profilo")
            .eq("auth_user_id", user.id)
            .single<ProfiloPermessi>();

        if (profiloError) {
          throw profiloError;
        }

        if (!mounted) return;

        const normalizedTipoProfilo =
          profilo?.tipo_profilo?.trim().toLowerCase() ?? null;

        setTipoProfilo(normalizedTipoProfilo);

        /*
         * L'admin vede tutte le pagine.
         */
        if (normalizedTipoProfilo === "admin") {
          setAllowedKeys(
            new Set(
              APP_MENU_ITEMS.map((item) => item.permissionKey)
            )
          );

          return;
        }

        if (
          !profilo?.last_club_id ||
          !normalizedTipoProfilo
        ) {
          setAllowedKeys(new Set());
          return;
        }

        const { data: permessi, error: permessiError } =
          await supabase
            .from("permessi_pagine_tipo_profilo")
            .select("pagina_key,can_view")
            .eq("club_id", profilo.last_club_id)
            .eq("tipo_profilo", normalizedTipoProfilo)
            .eq("can_view", true);

        if (permessiError) {
          throw permessiError;
        }

        if (!mounted) return;

        const keys = new Set(
          ((permessi ?? []) as PermessoPagina[])
            .filter((permesso) => permesso.can_view)
            .map((permesso) => permesso.pagina_key)
        );

        setAllowedKeys(keys);
      } catch (error) {
        console.error(
          "Errore caricamento permessi pagine:",
          error
        );

        if (mounted) {
          setTipoProfilo(null);
          setAllowedKeys(new Set());
        }
      } finally {
        if (mounted) {
          setLoading(false);
        }
      }
    }

    void loadPermissions();

    return () => {
      mounted = false;
    };
  }, []);

  const isAdmin = tipoProfilo === "admin";

  const allowedMenuItems = useMemo(() => {
    if (isAdmin) return APP_MENU_ITEMS;

    return APP_MENU_ITEMS.filter((item) =>
      allowedKeys.has(item.permissionKey)
    );
  }, [allowedKeys, isAdmin]);

  function canAccess(permissionKey: string) {
    return isAdmin || allowedKeys.has(permissionKey);
  }

  return {
    loading,
    tipoProfilo,
    isAdmin,
    allowedKeys,
    allowedMenuItems,
    canAccess,
  };
}