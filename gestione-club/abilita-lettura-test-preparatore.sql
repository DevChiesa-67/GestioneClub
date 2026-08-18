-- =====================================================================
-- Lettura dei dati dei test per il PREPARATORE (e per l'allenatore)
-- =====================================================================
-- Problema: il preparatore apre /test e non vede nulla, perche'
--   1) la pagina "test" non e' abilitata in permessi_pagine_tipo_profilo
--      (l'admin bypassa i permessi, vedi use-page-permissions.ts);
--   2) le policy RLS su test_misurazioni / test_atletici_forza lasciano
--      leggere solo l'admin.
--
-- Questo script sistema entrambe le cose. E' idempotente: puo' essere
-- rieseguito senza problemi. Da lanciare nel SQL editor di Supabase.
--
-- La SCRITTURA resta riservata all'admin (come fa gia' assertAdmin()
-- in src/app/(dashboard)/test/actions.ts): qui si abilita solo la lettura.
-- =====================================================================


-- ---------------------------------------------------------------------
-- 0. DIAGNOSTICA (opzionale) - com'e' messo adesso
-- ---------------------------------------------------------------------
SELECT
  c.relname                                   AS tabella,
  c.relrowsecurity                            AS rls_attiva,
  COALESCE(p.polname, '(nessuna policy)')     AS policy,
  CASE p.polcmd
    WHEN 'r' THEN 'SELECT'
    WHEN 'a' THEN 'INSERT'
    WHEN 'w' THEN 'UPDATE'
    WHEN 'd' THEN 'DELETE'
    WHEN '*' THEN 'ALL'
  END                                         AS comando
FROM pg_class c
LEFT JOIN pg_policy p ON p.polrelid = c.oid
WHERE c.relname IN ('test_misurazioni', 'test_atletici_forza')
ORDER BY c.relname, p.polname;


-- ---------------------------------------------------------------------
-- 1. Permesso di pagina: "test" visibile a preparatore e allenatore
-- ---------------------------------------------------------------------
INSERT INTO public.permessi_pagine_tipo_profilo (
  club_id,
  tipo_profilo,
  pagina_key,
  can_view,
  updated_at
)
SELECT
  c.id,
  t.tipo_profilo,
  'test',
  true,
  now()
FROM public.club AS c
CROSS JOIN (
  SELECT unnest(ARRAY['preparatore', 'allenatore']::public.tipo_profilo_enum[])
    AS tipo_profilo
) AS t
ON CONFLICT (club_id, tipo_profilo, pagina_key)
DO UPDATE SET
  can_view = true,
  updated_at = now();


-- ---------------------------------------------------------------------
-- 2. test_misurazioni: lettura per lo staff del proprio club
-- ---------------------------------------------------------------------
ALTER TABLE public.test_misurazioni ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS test_misurazioni_select_staff ON public.test_misurazioni;

CREATE POLICY test_misurazioni_select_staff
  ON public.test_misurazioni
  FOR SELECT
  USING (
    club_id = (
      SELECT last_club_id FROM public.profili WHERE auth_user_id = auth.uid()
    )
    AND (
      SELECT tipo_profilo FROM public.profili WHERE auth_user_id = auth.uid()
    ) IN (
      'admin'::public.tipo_profilo_enum,
      'allenatore'::public.tipo_profilo_enum,
      'preparatore'::public.tipo_profilo_enum
    )
  );

-- Scrittura: solo admin del proprio club (stesso pattern di
-- misurazioni_antropometriche / drill_bank / lavori_allenamento).
DROP POLICY IF EXISTS test_misurazioni_insert_admin ON public.test_misurazioni;

CREATE POLICY test_misurazioni_insert_admin
  ON public.test_misurazioni
  FOR INSERT
  WITH CHECK (
    club_id = (
      SELECT last_club_id FROM public.profili WHERE auth_user_id = auth.uid()
    )
    AND (
      SELECT tipo_profilo FROM public.profili WHERE auth_user_id = auth.uid()
    ) = 'admin'::public.tipo_profilo_enum
  );

DROP POLICY IF EXISTS test_misurazioni_update_admin ON public.test_misurazioni;

CREATE POLICY test_misurazioni_update_admin
  ON public.test_misurazioni
  FOR UPDATE
  USING (
    club_id = (
      SELECT last_club_id FROM public.profili WHERE auth_user_id = auth.uid()
    )
    AND (
      SELECT tipo_profilo FROM public.profili WHERE auth_user_id = auth.uid()
    ) = 'admin'::public.tipo_profilo_enum
  )
  WITH CHECK (
    club_id = (
      SELECT last_club_id FROM public.profili WHERE auth_user_id = auth.uid()
    )
    AND (
      SELECT tipo_profilo FROM public.profili WHERE auth_user_id = auth.uid()
    ) = 'admin'::public.tipo_profilo_enum
  );

DROP POLICY IF EXISTS test_misurazioni_delete_admin ON public.test_misurazioni;

CREATE POLICY test_misurazioni_delete_admin
  ON public.test_misurazioni
  FOR DELETE
  USING (
    club_id = (
      SELECT last_club_id FROM public.profili WHERE auth_user_id = auth.uid()
    )
    AND (
      SELECT tipo_profilo FROM public.profili WHERE auth_user_id = auth.uid()
    ) = 'admin'::public.tipo_profilo_enum
  );


-- ---------------------------------------------------------------------
-- 3. test_atletici_forza: e' l'anagrafica dei test, non ha club_id.
--    Senza lettura qui la join in /test torna il test come NULL e la
--    tabella resta vuota anche se le misurazioni si leggono.
-- ---------------------------------------------------------------------
ALTER TABLE public.test_atletici_forza ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS test_atletici_forza_select_autenticati
  ON public.test_atletici_forza;

CREATE POLICY test_atletici_forza_select_autenticati
  ON public.test_atletici_forza
  FOR SELECT
  USING (auth.uid() IS NOT NULL);

DROP POLICY IF EXISTS test_atletici_forza_write_admin
  ON public.test_atletici_forza;

CREATE POLICY test_atletici_forza_write_admin
  ON public.test_atletici_forza
  FOR ALL
  USING (
    (
      SELECT tipo_profilo FROM public.profili WHERE auth_user_id = auth.uid()
    ) = 'admin'::public.tipo_profilo_enum
  )
  WITH CHECK (
    (
      SELECT tipo_profilo FROM public.profili WHERE auth_user_id = auth.uid()
    ) = 'admin'::public.tipo_profilo_enum
  );


-- ---------------------------------------------------------------------
-- 4. VERIFICA
-- ---------------------------------------------------------------------
SELECT
  c.relname AS tabella,
  p.polname AS policy,
  CASE p.polcmd
    WHEN 'r' THEN 'SELECT'
    WHEN 'a' THEN 'INSERT'
    WHEN 'w' THEN 'UPDATE'
    WHEN 'd' THEN 'DELETE'
    WHEN '*' THEN 'ALL'
  END AS comando
FROM pg_class c
JOIN pg_policy p ON p.polrelid = c.oid
WHERE c.relname IN ('test_misurazioni', 'test_atletici_forza')
ORDER BY c.relname, p.polname;

SELECT club_id, tipo_profilo, pagina_key, can_view
FROM public.permessi_pagine_tipo_profilo
WHERE pagina_key = 'test'
ORDER BY club_id, tipo_profilo;
