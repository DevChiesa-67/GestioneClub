-- Allinea completamente lo schema delle statistiche partita.
-- Lo script e' idempotente e puo' essere rieseguito.

DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'partite_statistiche'
      AND column_name = 'calci_fatti'
  ) AND NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'partite_statistiche'
      AND column_name = 'trasformazioni_fatte'
  ) THEN
    ALTER TABLE public.partite_statistiche
      RENAME COLUMN calci_fatti TO trasformazioni_fatte;
  END IF;

  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'partite_statistiche'
      AND column_name = 'calci_subiti'
  ) AND NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'partite_statistiche'
      AND column_name = 'trasformazioni_subite'
  ) THEN
    ALTER TABLE public.partite_statistiche
      RENAME COLUMN calci_subiti TO trasformazioni_subite;
  END IF;
END $$;

ALTER TABLE public.partite_statistiche
  ADD COLUMN IF NOT EXISTS trasformazioni_fatte integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS trasformazioni_subite integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS calci_piazzati_totali integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS calci_piazzati_fatti integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS punti_incontro_vinti integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS punti_incontro_persi integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS touche_vinte integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS touche_perse integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS touche_totali integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS mischie_vinte integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS mischie_perse integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS mischie_totali integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS placcaggi_efficaci integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS placcaggi_non_efficaci integer NOT NULL DEFAULT 0;

ALTER TABLE public.partite_statistiche
  DROP CONSTRAINT IF EXISTS partite_statistiche_touche_totali_check,
  DROP CONSTRAINT IF EXISTS partite_statistiche_mischie_totali_check;

ALTER TABLE public.partite_statistiche
  ADD CONSTRAINT partite_statistiche_touche_totali_check
    CHECK (touche_totali >= 0),
  ADD CONSTRAINT partite_statistiche_mischie_totali_check
    CHECK (mischie_totali >= 0);

ALTER TABLE public.partite_statistiche ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS partite_statistiche_select_club ON public.partite_statistiche;
CREATE POLICY partite_statistiche_select_club
  ON public.partite_statistiche FOR SELECT
  USING (
    club_id = (
      SELECT last_club_id FROM public.profili WHERE auth_user_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS partite_statistiche_insert_admin ON public.partite_statistiche;
CREATE POLICY partite_statistiche_insert_admin
  ON public.partite_statistiche FOR INSERT
  WITH CHECK (
    club_id = (
      SELECT last_club_id FROM public.profili WHERE auth_user_id = auth.uid()
    )
    AND 'admin' = (
      SELECT lower(tipo_profilo::text)
      FROM public.profili WHERE auth_user_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS partite_statistiche_update_admin ON public.partite_statistiche;
CREATE POLICY partite_statistiche_update_admin
  ON public.partite_statistiche FOR UPDATE
  USING (
    club_id = (
      SELECT last_club_id FROM public.profili WHERE auth_user_id = auth.uid()
    )
    AND 'admin' = (
      SELECT lower(tipo_profilo::text)
      FROM public.profili WHERE auth_user_id = auth.uid()
    )
  )
  WITH CHECK (
    club_id = (
      SELECT last_club_id FROM public.profili WHERE auth_user_id = auth.uid()
    )
    AND 'admin' = (
      SELECT lower(tipo_profilo::text)
      FROM public.profili WHERE auth_user_id = auth.uid()
    )
  );

NOTIFY pgrst, 'reload schema';

SELECT column_name, data_type, is_nullable, column_default
FROM information_schema.columns
WHERE table_schema = 'public'
  AND table_name = 'partite_statistiche'
ORDER BY ordinal_position;
