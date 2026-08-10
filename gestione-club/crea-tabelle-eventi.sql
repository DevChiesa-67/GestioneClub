-- Feature "Eventi": tornei, raduni, team building e simili, da mostrare
-- insieme alle partite nella pagina Partite e nella dashboard.
--
-- tipi_eventi: anagrafica delle tipologie di evento (gestibile
--   dall'admin direttamente dall'app, es. "Torneo", "Raduno",
--   "Team building"), per club.
-- eventi: l'evento vero e proprio, con un range di date (data_fine
--   nullable per eventi di un solo giorno).
-- eventi_convocazioni: chi è convocato/partecipa a un evento, stesso
--   ruolo di partite_convocazioni ma senza i campi specifici da
--   formazione (titolare, capitano, numero maglia...) che per un
--   raduno o un torneo non hanno senso.

CREATE TABLE IF NOT EXISTS public.tipi_eventi (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  club_id uuid NOT NULL REFERENCES public.club(id) ON DELETE CASCADE,
  nome text NOT NULL,
  colore text,
  attivo boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (club_id, nome)
);

CREATE TABLE IF NOT EXISTS public.eventi (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  club_id uuid NOT NULL REFERENCES public.club(id) ON DELETE CASCADE,
  squadra_id uuid,
  tipo_evento_id uuid NOT NULL REFERENCES public.tipi_eventi(id) ON DELETE RESTRICT,
  titolo text NOT NULL,
  data_inizio date NOT NULL,
  data_fine date,
  ora_inizio time,
  luogo text,
  note text,
  created_by uuid REFERENCES auth.users(id),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_eventi_club ON public.eventi (club_id);
CREATE INDEX IF NOT EXISTS idx_eventi_tipo ON public.eventi (tipo_evento_id);
CREATE INDEX IF NOT EXISTS idx_eventi_data_inizio ON public.eventi (data_inizio);

CREATE TABLE IF NOT EXISTS public.eventi_convocazioni (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  evento_id uuid NOT NULL REFERENCES public.eventi(id) ON DELETE CASCADE,
  club_id uuid NOT NULL REFERENCES public.club(id) ON DELETE CASCADE,
  giocatore_id uuid NOT NULL REFERENCES public.giocatori(id) ON DELETE CASCADE,
  convocato boolean NOT NULL DEFAULT true,
  note text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (evento_id, giocatore_id)
);

CREATE INDEX IF NOT EXISTS idx_eventi_convocazioni_evento
  ON public.eventi_convocazioni (evento_id);

ALTER TABLE public.tipi_eventi ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.eventi ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.eventi_convocazioni ENABLE ROW LEVEL SECURITY;

-- ================= tipi_eventi =================
-- Lettura: chiunque sia collegato al club. Scrittura: solo admin.

DROP POLICY IF EXISTS tipi_eventi_select ON public.tipi_eventi;
CREATE POLICY tipi_eventi_select
  ON public.tipi_eventi
  FOR SELECT
  USING (
    club_id = (
      SELECT last_club_id FROM public.profili WHERE auth_user_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS tipi_eventi_insert ON public.tipi_eventi;
CREATE POLICY tipi_eventi_insert
  ON public.tipi_eventi
  FOR INSERT
  WITH CHECK (
    club_id = (
      SELECT last_club_id FROM public.profili WHERE auth_user_id = auth.uid()
    )
    AND (
      SELECT tipo_profilo FROM public.profili WHERE auth_user_id = auth.uid()
    ) = 'admin'::tipo_profilo_enum
  );

DROP POLICY IF EXISTS tipi_eventi_update ON public.tipi_eventi;
CREATE POLICY tipi_eventi_update
  ON public.tipi_eventi
  FOR UPDATE
  USING (
    club_id = (
      SELECT last_club_id FROM public.profili WHERE auth_user_id = auth.uid()
    )
    AND (
      SELECT tipo_profilo FROM public.profili WHERE auth_user_id = auth.uid()
    ) = 'admin'::tipo_profilo_enum
  );

DROP POLICY IF EXISTS tipi_eventi_delete ON public.tipi_eventi;
CREATE POLICY tipi_eventi_delete
  ON public.tipi_eventi
  FOR DELETE
  USING (
    club_id = (
      SELECT last_club_id FROM public.profili WHERE auth_user_id = auth.uid()
    )
    AND (
      SELECT tipo_profilo FROM public.profili WHERE auth_user_id = auth.uid()
    ) = 'admin'::tipo_profilo_enum
  );

-- ================= eventi =================

DROP POLICY IF EXISTS eventi_select ON public.eventi;
CREATE POLICY eventi_select
  ON public.eventi
  FOR SELECT
  USING (
    club_id = (
      SELECT last_club_id FROM public.profili WHERE auth_user_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS eventi_insert ON public.eventi;
CREATE POLICY eventi_insert
  ON public.eventi
  FOR INSERT
  WITH CHECK (
    club_id = (
      SELECT last_club_id FROM public.profili WHERE auth_user_id = auth.uid()
    )
    AND (
      SELECT tipo_profilo FROM public.profili WHERE auth_user_id = auth.uid()
    ) = 'admin'::tipo_profilo_enum
  );

DROP POLICY IF EXISTS eventi_update ON public.eventi;
CREATE POLICY eventi_update
  ON public.eventi
  FOR UPDATE
  USING (
    club_id = (
      SELECT last_club_id FROM public.profili WHERE auth_user_id = auth.uid()
    )
    AND (
      SELECT tipo_profilo FROM public.profili WHERE auth_user_id = auth.uid()
    ) = 'admin'::tipo_profilo_enum
  );

DROP POLICY IF EXISTS eventi_delete ON public.eventi;
CREATE POLICY eventi_delete
  ON public.eventi
  FOR DELETE
  USING (
    club_id = (
      SELECT last_club_id FROM public.profili WHERE auth_user_id = auth.uid()
    )
    AND (
      SELECT tipo_profilo FROM public.profili WHERE auth_user_id = auth.uid()
    ) = 'admin'::tipo_profilo_enum
  );

-- ================= eventi_convocazioni =================

DROP POLICY IF EXISTS eventi_convocazioni_select ON public.eventi_convocazioni;
CREATE POLICY eventi_convocazioni_select
  ON public.eventi_convocazioni
  FOR SELECT
  USING (
    club_id = (
      SELECT last_club_id FROM public.profili WHERE auth_user_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS eventi_convocazioni_insert ON public.eventi_convocazioni;
CREATE POLICY eventi_convocazioni_insert
  ON public.eventi_convocazioni
  FOR INSERT
  WITH CHECK (
    club_id = (
      SELECT last_club_id FROM public.profili WHERE auth_user_id = auth.uid()
    )
    AND (
      SELECT tipo_profilo FROM public.profili WHERE auth_user_id = auth.uid()
    ) = 'admin'::tipo_profilo_enum
  );

DROP POLICY IF EXISTS eventi_convocazioni_update ON public.eventi_convocazioni;
CREATE POLICY eventi_convocazioni_update
  ON public.eventi_convocazioni
  FOR UPDATE
  USING (
    club_id = (
      SELECT last_club_id FROM public.profili WHERE auth_user_id = auth.uid()
    )
    AND (
      SELECT tipo_profilo FROM public.profili WHERE auth_user_id = auth.uid()
    ) = 'admin'::tipo_profilo_enum
  );

DROP POLICY IF EXISTS eventi_convocazioni_delete ON public.eventi_convocazioni;
CREATE POLICY eventi_convocazioni_delete
  ON public.eventi_convocazioni
  FOR DELETE
  USING (
    club_id = (
      SELECT last_club_id FROM public.profili WHERE auth_user_id = auth.uid()
    )
    AND (
      SELECT tipo_profilo FROM public.profili WHERE auth_user_id = auth.uid()
    ) = 'admin'::tipo_profilo_enum
  );

-- Tipologie di base, così la pagina Eventi non parte vuota (sostituisci
-- '00000000-0000-0000-0000-000000000000' con l'id del tuo club, oppure
-- crea le tipologie direttamente dall'app col pulsante "Nuova tipologia").
-- INSERT INTO public.tipi_eventi (club_id, nome, colore) VALUES
--   ('00000000-0000-0000-0000-000000000000', 'Torneo', '#f59e0b'),
--   ('00000000-0000-0000-0000-000000000000', 'Raduno', '#38bdf8'),
--   ('00000000-0000-0000-0000-000000000000', 'Team building', '#34d399')
-- ON CONFLICT (club_id, nome) DO NOTHING;

-- Verifica
SELECT polname, polcmd
FROM pg_policy
WHERE polrelid IN (
  'public.tipi_eventi'::regclass,
  'public.eventi'::regclass,
  'public.eventi_convocazioni'::regclass
);
