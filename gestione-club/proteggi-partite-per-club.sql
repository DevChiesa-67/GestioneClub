-- Isola le partite in base al club attivo del profilo.
-- Sicuro da rieseguire.

ALTER TABLE public.partite ENABLE ROW LEVEL SECURITY;

-- Le policy permissive si combinano con OR: per garantire l'isolamento
-- bisogna sostituire eventuali regole precedenti, non aggiungerne un'altra.
DO $$
DECLARE
  politica record;
BEGIN
  FOR politica IN
    SELECT policyname
    FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'partite'
  LOOP
    EXECUTE format(
      'DROP POLICY IF EXISTS %I ON public.partite',
      politica.policyname
    );
  END LOOP;
END $$;

CREATE POLICY partite_select_club_attivo
ON public.partite FOR SELECT TO authenticated
USING (
  EXISTS (
    SELECT 1
    FROM public.profili AS profilo
    WHERE profilo.auth_user_id::text = auth.uid()::text
      AND profilo.last_club_id::text = partite.club_id::text
  )
);

CREATE POLICY partite_insert_admin_club_attivo
ON public.partite FOR INSERT TO authenticated
WITH CHECK (
  EXISTS (
    SELECT 1
    FROM public.profili AS profilo
    WHERE profilo.auth_user_id::text = auth.uid()::text
      AND profilo.last_club_id::text = partite.club_id::text
      AND lower(profilo.tipo_profilo::text) = 'admin'
  )
);

CREATE POLICY partite_update_admin_club_attivo
ON public.partite FOR UPDATE TO authenticated
USING (
  EXISTS (
    SELECT 1
    FROM public.profili AS profilo
    WHERE profilo.auth_user_id::text = auth.uid()::text
      AND profilo.last_club_id::text = partite.club_id::text
      AND lower(profilo.tipo_profilo::text) = 'admin'
  )
)
WITH CHECK (
  EXISTS (
    SELECT 1
    FROM public.profili AS profilo
    WHERE profilo.auth_user_id::text = auth.uid()::text
      AND profilo.last_club_id::text = partite.club_id::text
      AND lower(profilo.tipo_profilo::text) = 'admin'
  )
);

CREATE POLICY partite_delete_admin_club_attivo
ON public.partite FOR DELETE TO authenticated
USING (
  EXISTS (
    SELECT 1
    FROM public.profili AS profilo
    WHERE profilo.auth_user_id::text = auth.uid()::text
      AND profilo.last_club_id::text = partite.club_id::text
      AND lower(profilo.tipo_profilo::text) = 'admin'
  )
);

NOTIFY pgrst, 'reload schema';

SELECT policyname, cmd
FROM pg_policies
WHERE schemaname = 'public' AND tablename = 'partite'
ORDER BY cmd, policyname;
