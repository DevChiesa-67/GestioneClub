-- ============================================================
-- Colonne Catapult visibili per tipo profilo
-- ============================================================
--
-- Permette all'admin di decidere, per ogni tipo profilo, quali colonne
-- del report Performance (tab Performance / Riepilogo) sono visibili.
-- Un preparatore puo' vedere tutto, un giocatore magari solo distanza e
-- durata, un dirigente niente di tecnico.
--
-- REGOLA IMPORTANTE, pensata per non rompere nulla al primo deploy:
--   - tipo profilo SENZA nessuna riga qui  -> vede TUTTE le colonne
--   - tipo profilo CON almeno una riga     -> vede solo quelle con can_view = true
-- Cosi' finche' l'admin non tocca niente il comportamento resta identico
-- a oggi, e la restrizione parte solo quando viene configurata davvero.
-- L'admin vede sempre tutto, a prescindere da queste righe.
--
-- Da eseguire nel SQL editor di Supabase (Dashboard -> SQL Editor).
-- E' sicuro rieseguirlo piu' volte.

CREATE TABLE IF NOT EXISTS public.permessi_colonne_catapult (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  club_id uuid NOT NULL REFERENCES public.club(id) ON DELETE CASCADE,
  tipo_profilo text NOT NULL,
  /* Chiave della colonna nel report, es. "distance", "player_load",
     "vel_zone_5_distance_metres". Vedi src/lib/performance/colonne-report-catapult.ts */
  colonna_key text NOT NULL,
  can_view boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (club_id, tipo_profilo, colonna_key)
);

CREATE INDEX IF NOT EXISTS idx_permessi_colonne_catapult_lookup
  ON public.permessi_colonne_catapult (club_id, tipo_profilo)
  WHERE can_view = true;

-- ------------------------------------------------------------
-- RLS
-- ------------------------------------------------------------
-- Lettura: chiunque del club (ogni utente deve poter sapere quali
-- colonne gli spettano). Scrittura: solo admin.

ALTER TABLE public.permessi_colonne_catapult ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS permessi_colonne_catapult_select ON public.permessi_colonne_catapult;
CREATE POLICY permessi_colonne_catapult_select
  ON public.permessi_colonne_catapult
  FOR SELECT
  USING (
    club_id = (
      SELECT last_club_id FROM public.profili WHERE auth_user_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS permessi_colonne_catapult_insert ON public.permessi_colonne_catapult;
CREATE POLICY permessi_colonne_catapult_insert
  ON public.permessi_colonne_catapult
  FOR INSERT
  WITH CHECK (
    club_id = (
      SELECT last_club_id FROM public.profili WHERE auth_user_id = auth.uid()
    )
    AND (
      SELECT tipo_profilo::text FROM public.profili WHERE auth_user_id = auth.uid()
    ) = 'admin'
  );

DROP POLICY IF EXISTS permessi_colonne_catapult_update ON public.permessi_colonne_catapult;
CREATE POLICY permessi_colonne_catapult_update
  ON public.permessi_colonne_catapult
  FOR UPDATE
  USING (
    club_id = (
      SELECT last_club_id FROM public.profili WHERE auth_user_id = auth.uid()
    )
    AND (
      SELECT tipo_profilo::text FROM public.profili WHERE auth_user_id = auth.uid()
    ) = 'admin'
  );

DROP POLICY IF EXISTS permessi_colonne_catapult_delete ON public.permessi_colonne_catapult;
CREATE POLICY permessi_colonne_catapult_delete
  ON public.permessi_colonne_catapult
  FOR DELETE
  USING (
    club_id = (
      SELECT last_club_id FROM public.profili WHERE auth_user_id = auth.uid()
    )
    AND (
      SELECT tipo_profilo::text FROM public.profili WHERE auth_user_id = auth.uid()
    ) = 'admin'
  );

-- ------------------------------------------------------------
-- Verifica
-- ------------------------------------------------------------

SELECT
  tipo_profilo,
  count(*) FILTER (WHERE can_view)     AS colonne_visibili,
  count(*) FILTER (WHERE NOT can_view) AS colonne_nascoste
FROM public.permessi_colonne_catapult
GROUP BY tipo_profilo
ORDER BY tipo_profilo;

-- Nessuna riga qui sopra = nessuna restrizione configurata, tutti vedono
-- tutte le colonne. E' lo stato di partenza corretto.
