-- "Drill bank": libreria di esercizi riutilizzabili del club. Un lavoro di
-- una seduta può essere salvato qui (con un nome) per essere ripescato e
-- riusato in sedute future, oppure una voce del drill bank può essere
-- scelta per precompilare un nuovo lavoro (come COPIA indipendente: le
-- modifiche successive al lavoro nella seduta, o al drill nel bank, non si
-- influenzano a vicenda).

CREATE TABLE IF NOT EXISTS public.drill_bank (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  club_id uuid NOT NULL REFERENCES public.club(id) ON DELETE CASCADE,
  nome text NOT NULL,
  sezione text,
  descrizione text,
  obbiettivo text,
  obbiettivo_tag text,
  rango text,
  tempo_lavoro numeric,
  ripetizione numeric,
  tempo_recupero numeric,
  tempo_totale numeric,
  codice text,
  spazio text,
  materiale text,
  punti_chiave_coaching text,
  progressione text,
  riferimento_gps text,
  perche_serve text,
  created_by uuid REFERENCES auth.users(id),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS drill_bank_club_id_idx ON public.drill_bank (club_id);

ALTER TABLE public.drill_bank ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS drill_bank_select ON public.drill_bank;
CREATE POLICY drill_bank_select
  ON public.drill_bank
  FOR SELECT
  USING (
    club_id IN (
      SELECT unnest(club_id) FROM public.profili WHERE auth_user_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS drill_bank_insert ON public.drill_bank;
CREATE POLICY drill_bank_insert
  ON public.drill_bank
  FOR INSERT
  WITH CHECK (
    club_id IN (
      SELECT unnest(club_id) FROM public.profili WHERE auth_user_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS drill_bank_update ON public.drill_bank;
CREATE POLICY drill_bank_update
  ON public.drill_bank
  FOR UPDATE
  USING (
    club_id IN (
      SELECT unnest(club_id) FROM public.profili WHERE auth_user_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS drill_bank_delete ON public.drill_bank;
CREATE POLICY drill_bank_delete
  ON public.drill_bank
  FOR DELETE
  USING (
    club_id IN (
      SELECT unnest(club_id) FROM public.profili WHERE auth_user_id = auth.uid()
    )
  );
