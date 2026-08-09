-- Permette a un admin di aggiornare/eliminare le misurazioni
-- antropometriche del proprio club (stesso pattern già usato per
-- drill_bank e lavori_allenamento: club_id confrontato con
-- profili.last_club_id dell'utente autenticato, ristretto ai soli
-- admin per update/delete).

ALTER TABLE public.misurazioni_antropometriche ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS misurazioni_antropometriche_update_admin
  ON public.misurazioni_antropometriche;

CREATE POLICY misurazioni_antropometriche_update_admin
  ON public.misurazioni_antropometriche
  FOR UPDATE
  USING (
    club_id = (
      SELECT last_club_id FROM public.profili WHERE auth_user_id = auth.uid()
    )
    AND (
      SELECT tipo_profilo FROM public.profili WHERE auth_user_id = auth.uid()
    ) = 'admin'::tipo_profilo_enum
  )
  WITH CHECK (
    club_id = (
      SELECT last_club_id FROM public.profili WHERE auth_user_id = auth.uid()
    )
    AND (
      SELECT tipo_profilo FROM public.profili WHERE auth_user_id = auth.uid()
    ) = 'admin'::tipo_profilo_enum
  );

DROP POLICY IF EXISTS misurazioni_antropometriche_delete_admin
  ON public.misurazioni_antropometriche;

CREATE POLICY misurazioni_antropometriche_delete_admin
  ON public.misurazioni_antropometriche
  FOR DELETE
  USING (
    club_id = (
      SELECT last_club_id FROM public.profili WHERE auth_user_id = auth.uid()
    )
    AND (
      SELECT tipo_profilo FROM public.profili WHERE auth_user_id = auth.uid()
    ) = 'admin'::tipo_profilo_enum
  );

-- Verifica: dovresti vedere anche le policy update/delete qui sotto.
SELECT polname, polcmd
FROM pg_policy
WHERE polrelid = 'public.misurazioni_antropometriche'::regclass;
