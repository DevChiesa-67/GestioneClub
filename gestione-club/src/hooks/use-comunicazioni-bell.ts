// src/hooks/use-comunicazioni-bell.ts

"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { supabase } from "@/lib/supabase-client";
import { comunicazioneVisibilePerProfilo } from "@/lib/comunicazioni/destinatari";

export type ComunicazioneBell = {
  id: string;
  titolo: string;
  descrizione: string;
  created_at: string;
  destinatari_tipo: string[] | null;
  destinatari_profili: string[] | null;
};

/*
 * Alimenta la campanella della Topbar direttamente con le comunicazioni
 * (invece di una tabella "notifiche" separata): il conteggio e la lista
 * riflettono esattamente lo stato "letta/non letta" già usato nella
 * pagina Comunicazioni (tabella comunicazioni_letture), applicando lo
 * stesso filtro destinatari (comunicazioneVisibilePerProfilo).
 *
 * Si aggiorna in tempo reale quando arriva una nuova comunicazione nel
 * club, o quando l'utente segna qualcosa come letto da qualsiasi punto
 * del gestionale (pagina Comunicazioni o dropdown della campanella).
 */
export function useComunicazioniBell() {
  const [userId, setUserId] = useState<string | null>(null);
  const [profiloId, setProfiloId] = useState<string | null>(null);
  const [tipoProfilo, setTipoProfilo] = useState<string | null>(null);
  const [clubId, setClubId] = useState<string | null>(null);

  const [comunicazioni, setComunicazioni] = useState<ComunicazioneBell[]>([]);
  const [lettureIds, setLettureIds] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(true);

  const loadComunicazioni = useCallback(async (attivoClubId: string) => {
    const { data, error } = await supabase
      .from("comunicazioni")
      .select(
        "id,titolo,descrizione,created_at,destinatari_tipo,destinatari_profili"
      )
      .eq("club_id", attivoClubId)
      .order("created_at", { ascending: false })
      .limit(30);

    if (error) {
      console.error("Errore caricamento comunicazioni (campanella):", error);
      return;
    }

    setComunicazioni((data ?? []) as ComunicazioneBell[]);
  }, []);

  const loadLetture = useCallback(async (attivoUserId: string) => {
    const { data, error } = await supabase
      .from("comunicazioni_letture")
      .select("comunicazione_id")
      .eq("user_id", attivoUserId);

    if (error) {
      console.error("Errore caricamento letture (campanella):", error);
      return;
    }

    setLettureIds(
      new Set((data ?? []).map((riga) => riga.comunicazione_id))
    );
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

      setUserId(user.id);

      const { data: profilo, error } = await supabase
        .from("profili")
        .select("id,tipo_profilo,last_club_id")
        .eq("auth_user_id", user.id)
        .single();

      if (error || !profilo?.last_club_id || !mounted) {
        setLoading(false);
        return;
      }

      setProfiloId(profilo.id);
      setTipoProfilo(profilo.tipo_profilo);
      setClubId(profilo.last_club_id);

      await Promise.all([
        loadComunicazioni(profilo.last_club_id),
        loadLetture(user.id),
      ]);

      if (mounted) setLoading(false);
    }

    void init();

    return () => {
      mounted = false;
    };
  }, [loadComunicazioni, loadLetture]);

  /*
   * Realtime: nuove comunicazioni nel club attivo.
   */
  useEffect(() => {
    if (!clubId) return;

    const channel = supabase
      .channel(`comunicazioni-bell-${clubId}`)
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "comunicazioni",
          filter: `club_id=eq.${clubId}`,
        },
        (payload) => {
          setComunicazioni((prev) => {
            const nuova = payload.new as ComunicazioneBell;

            if (prev.some((c) => c.id === nuova.id)) {
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
  }, [clubId]);

  /*
   * Realtime: nuove letture proprie, segnate da qualsiasi pagina.
   */
  useEffect(() => {
    if (!userId) return;

    const channel = supabase
      .channel(`comunicazioni-letture-${userId}`)
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "comunicazioni_letture",
          filter: `user_id=eq.${userId}`,
        },
        (payload) => {
          const nuovaLettura = payload.new as {
            comunicazione_id: string;
          };

          setLettureIds((prev) => {
            if (prev.has(nuovaLettura.comunicazione_id)) return prev;

            const next = new Set(prev);
            next.add(nuovaLettura.comunicazione_id);
            return next;
          });
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [userId]);

  const comunicazioniVisibili = useMemo(() => {
    if (!profiloId) return [];

    return comunicazioni.filter((comunicazione) =>
      comunicazioneVisibilePerProfilo(comunicazione, {
        id: profiloId,
        tipoProfilo,
      })
    );
  }, [comunicazioni, profiloId, tipoProfilo]);

  const nonLette = useMemo(
    () =>
      comunicazioniVisibili.filter((c) => !lettureIds.has(c.id)).length,
    [comunicazioniVisibili, lettureIds]
  );

  async function segnaComeLetta(comunicazioneId: string) {
    if (!userId || lettureIds.has(comunicazioneId)) return;

    setLettureIds((prev) => {
      const next = new Set(prev);
      next.add(comunicazioneId);
      return next;
    });

    const { error } = await supabase.from("comunicazioni_letture").upsert(
      {
        comunicazione_id: comunicazioneId,
        user_id: userId,
      },
      {
        onConflict: "comunicazione_id,user_id",
        ignoreDuplicates: true,
      }
    );

    if (error) {
      console.error("Errore aggiornamento lettura comunicazione:", error);
    }
  }

  async function segnaTutteComeLette() {
    const daSegnare = comunicazioniVisibili.filter(
      (c) => !lettureIds.has(c.id)
    );

    if (daSegnare.length === 0) return;

    setLettureIds((prev) => {
      const next = new Set(prev);
      daSegnare.forEach((c) => next.add(c.id));
      return next;
    });

    if (!userId) return;

    const { error } = await supabase.from("comunicazioni_letture").upsert(
      daSegnare.map((c) => ({
        comunicazione_id: c.id,
        user_id: userId,
      })),
      {
        onConflict: "comunicazione_id,user_id",
        ignoreDuplicates: true,
      }
    );

    if (error) {
      console.error("Errore aggiornamento letture comunicazioni:", error);
    }
  }

  return {
    loading,
    comunicazioni: comunicazioniVisibili,
    lettureIds,
    nonLette,
    segnaComeLetta,
    segnaTutteComeLette,
  };
}
