// src/hooks/use-notifiche.ts

"use client";

import { useCallback, useEffect, useState } from "react";
import { supabase } from "@/lib/supabase-client";

export type Notifica = {
  id: string;
  titolo: string;
  messaggio: string;
  url: string | null;
  letto: boolean;
  created_at: string;
};

export function useNotifiche() {
  const [profiloId, setProfiloId] = useState<string | null>(null);
  const [notifiche, setNotifiche] = useState<Notifica[]>([]);
  const [loading, setLoading] = useState(true);

  const loadNotifiche = useCallback(async (currentProfiloId: string) => {
    const { data, error } = await supabase
      .from("notifiche")
      .select("id,titolo,messaggio,url,letto,created_at")
      .eq("profilo_id", currentProfiloId)
      .order("created_at", { ascending: false })
      .limit(30);

    if (error) {
      console.error("Errore caricamento notifiche:", error);
      return;
    }

    setNotifiche((data ?? []) as Notifica[]);
  }, []);

  useEffect(() => {
    let mounted = true;

    async function init() {
      setLoading(true);

      const {
        data: { user },
      } = await supabase.auth.getUser();

      if (!user || !mounted) {
        setLoading(false);
        return;
      }

      const { data: profilo, error: profiloError } = await supabase
        .from("profili")
        .select("id")
        .eq("auth_user_id", user.id)
        .single();

      if (profiloError || !profilo || !mounted) {
        setLoading(false);
        return;
      }

      setProfiloId(profilo.id);
      await loadNotifiche(profilo.id);

      if (mounted) setLoading(false);
    }

    void init();

    return () => {
      mounted = false;
    };
  }, [loadNotifiche]);

  /*
   * Aggiornamento in tempo reale: appena arriva una nuova notifica
   * destinata al profilo corrente, la aggiunge subito alla lista
   * (utile mentre l'utente sta usando il gestionale).
   */
  useEffect(() => {
    if (!profiloId) return;

    const channel = supabase
      .channel(`notifiche-${profiloId}`)
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "notifiche",
          filter: `profilo_id=eq.${profiloId}`,
        },
        (payload) => {
          setNotifiche((prev) => {
            const nuova = payload.new as Notifica;

            if (prev.some((n) => n.id === nuova.id)) {
              return prev;
            }

            return [nuova, ...prev].slice(0, 30);
          });
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [profiloId]);

  const nonLette = notifiche.filter((n) => !n.letto).length;

  async function segnaComeLetta(id: string) {
    setNotifiche((prev) =>
      prev.map((n) => (n.id === id ? { ...n, letto: true } : n))
    );

    const { error } = await supabase
      .from("notifiche")
      .update({ letto: true })
      .eq("id", id);

    if (error) {
      console.error("Errore aggiornamento notifica:", error);
    }
  }

  async function segnaTutteComeLette() {
    const daAggiornare = notifiche.filter((n) => !n.letto).map((n) => n.id);

    if (daAggiornare.length === 0) return;

    setNotifiche((prev) => prev.map((n) => ({ ...n, letto: true })));

    const { error } = await supabase
      .from("notifiche")
      .update({ letto: true })
      .in("id", daAggiornare);

    if (error) {
      console.error("Errore aggiornamento notifiche:", error);
    }
  }

  return {
    loading,
    notifiche,
    nonLette,
    segnaComeLetta,
    segnaTutteComeLette,
  };
}
