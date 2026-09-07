-- Consente agli utenti del club di leggere le statistiche delle partite e
-- agli amministratori del club di crearle o aggiornarle.
-- Sicuro da rieseguire.

ALTER TABLE public.partite_statistiche ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS partite_statistiche_select_club ON public.partite_statistiche;
CREATE POLICY partite_statistiche_select_club
  ON public.partite_statistiche
  FOR SELECT
  USING (
    club_id = (
      SELECT last_club_id
      FROM public.profili
      WHERE auth_user_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS partite_statistiche_insert_admin ON public.partite_statistiche;
CREATE POLICY partite_statistiche_insert_admin
  ON public.partite_statistiche
  FOR INSERT
  WITH CHECK (
    club_id = (
      SELECT last_club_id
      FROM public.profili
      WHERE auth_user_id = auth.uid()
    )
    AND 'admin' = (
      SELECT lower(tipo_profilo::text)
      FROM public.profili
      WHERE auth_user_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS partite_statistiche_update_admin ON public.partite_statistiche;
CREATE POLICY partite_statistiche_update_admin
  ON public.partite_statistiche
  FOR UPDATE
  USING (
    club_id = (
      SELECT last_club_id
      FROM public.profili
      WHERE auth_user_id = auth.uid()
    )
    AND 'admin' = (
      SELECT lower(tipo_profilo::text)
      FROM public.profili
      WHERE auth_user_id = auth.uid()
    )
  )
  WITH CHECK (
    club_id = (
      SELECT last_club_id
      FROM public.profili
      WHERE auth_user_id = auth.uid()
    )
    AND 'admin' = (
      SELECT lower(tipo_profilo::text)
      FROM public.profili
      WHERE auth_user_id = auth.uid()
    )
  );

SELECT policyname, cmd
FROM pg_policies
WHERE schemaname = 'public'
  AND tablename = 'partite_statistiche'
ORDER BY policyname;
