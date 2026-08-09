-- Feature "Minutaggi": import del file Excel "MINUTAGGIO" (tabella CAMBI)
-- per calcolare i minuti giocati da ciascun giocatore in ogni partita.
--
-- partite_minutaggi_import: un file caricato = un import, eventualmente
-- associato a una partita esistente (partita_id nullable finché non
-- viene confermata l'associazione).
--
-- partite_minutaggi_cambi: gli eventi "entra"/"esce" letti dal file,
-- collegati (quando riconosciuti) a un giocatore del club.

CREATE TABLE IF NOT EXISTS public.partite_minutaggi_import (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  club_id uuid NOT NULL REFERENCES public.club(id) ON DELETE CASCADE,
  squadra_id uuid,
  partita_id uuid REFERENCES public.partite(id) ON DELETE SET NULL,
  nome_file text NOT NULL,
  file_path text,
  avversario_rilevato text,
  data_rilevata date,
  luogo_rilevato text,
  durata_minuti integer NOT NULL DEFAULT 80,
  stato text NOT NULL DEFAULT 'da_associare'
    CHECK (stato IN ('da_associare', 'associato')),
  created_by uuid REFERENCES auth.users(id),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_partite_minutaggi_import_club
  ON public.partite_minutaggi_import (club_id);

CREATE INDEX IF NOT EXISTS idx_partite_minutaggi_import_partita
  ON public.partite_minutaggi_import (partita_id);

CREATE TABLE IF NOT EXISTS public.partite_minutaggi_cambi (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  import_id uuid NOT NULL REFERENCES public.partite_minutaggi_import(id) ON DELETE CASCADE,
  club_id uuid NOT NULL REFERENCES public.club(id) ON DELETE CASCADE,
  giocatore_id uuid REFERENCES public.giocatori(id) ON DELETE SET NULL,
  nome_testo text NOT NULL,
  minuto numeric NOT NULL,
  tipo text NOT NULL CHECK (tipo IN ('entra', 'esce')),
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_partite_minutaggi_cambi_import
  ON public.partite_minutaggi_cambi (import_id);

CREATE INDEX IF NOT EXISTS idx_partite_minutaggi_cambi_giocatore
  ON public.partite_minutaggi_cambi (giocatore_id);

ALTER TABLE public.partite_minutaggi_import ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.partite_minutaggi_cambi ENABLE ROW LEVEL SECURITY;

-- Lettura: chiunque sia collegato al club (stesso pattern "lettura
-- autenticati" già usato altrove). Scrittura: solo admin del club.

DROP POLICY IF EXISTS partite_minutaggi_import_select ON public.partite_minutaggi_import;
CREATE POLICY partite_minutaggi_import_select
  ON public.partite_minutaggi_import
  FOR SELECT
  USING (
    club_id = (
      SELECT last_club_id FROM public.profili WHERE auth_user_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS partite_minutaggi_import_insert ON public.partite_minutaggi_import;
CREATE POLICY partite_minutaggi_import_insert
  ON public.partite_minutaggi_import
  FOR INSERT
  WITH CHECK (
    club_id = (
      SELECT last_club_id FROM public.profili WHERE auth_user_id = auth.uid()
    )
    AND (
      SELECT tipo_profilo FROM public.profili WHERE auth_user_id = auth.uid()
    ) = 'admin'::tipo_profilo_enum
  );

DROP POLICY IF EXISTS partite_minutaggi_import_update ON public.partite_minutaggi_import;
CREATE POLICY partite_minutaggi_import_update
  ON public.partite_minutaggi_import
  FOR UPDATE
  USING (
    club_id = (
      SELECT last_club_id FROM public.profili WHERE auth_user_id = auth.uid()
    )
    AND (
      SELECT tipo_profilo FROM public.profili WHERE auth_user_id = auth.uid()
    ) = 'admin'::tipo_profilo_enum
  );

DROP POLICY IF EXISTS partite_minutaggi_import_delete ON public.partite_minutaggi_import;
CREATE POLICY partite_minutaggi_import_delete
  ON public.partite_minutaggi_import
  FOR DELETE
  USING (
    club_id = (
      SELECT last_club_id FROM public.profili WHERE auth_user_id = auth.uid()
    )
    AND (
      SELECT tipo_profilo FROM public.profili WHERE auth_user_id = auth.uid()
    ) = 'admin'::tipo_profilo_enum
  );

DROP POLICY IF EXISTS partite_minutaggi_cambi_select ON public.partite_minutaggi_cambi;
CREATE POLICY partite_minutaggi_cambi_select
  ON public.partite_minutaggi_cambi
  FOR SELECT
  USING (
    club_id = (
      SELECT last_club_id FROM public.profili WHERE auth_user_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS partite_minutaggi_cambi_insert ON public.partite_minutaggi_cambi;
CREATE POLICY partite_minutaggi_cambi_insert
  ON public.partite_minutaggi_cambi
  FOR INSERT
  WITH CHECK (
    club_id = (
      SELECT last_club_id FROM public.profili WHERE auth_user_id = auth.uid()
    )
    AND (
      SELECT tipo_profilo FROM public.profili WHERE auth_user_id = auth.uid()
    ) = 'admin'::tipo_profilo_enum
  );

DROP POLICY IF EXISTS partite_minutaggi_cambi_update ON public.partite_minutaggi_cambi;
CREATE POLICY partite_minutaggi_cambi_update
  ON public.partite_minutaggi_cambi
  FOR UPDATE
  USING (
    club_id = (
      SELECT last_club_id FROM public.profili WHERE auth_user_id = auth.uid()
    )
    AND (
      SELECT tipo_profilo FROM public.profili WHERE auth_user_id = auth.uid()
    ) = 'admin'::tipo_profilo_enum
  );

DROP POLICY IF EXISTS partite_minutaggi_cambi_delete ON public.partite_minutaggi_cambi;
CREATE POLICY partite_minutaggi_cambi_delete
  ON public.partite_minutaggi_cambi
  FOR DELETE
  USING (
    club_id = (
      SELECT last_club_id FROM public.profili WHERE auth_user_id = auth.uid()
    )
    AND (
      SELECT tipo_profilo FROM public.profili WHERE auth_user_id = auth.uid()
    ) = 'admin'::tipo_profilo_enum
  );

-- Bucket storage per i file Excel originali caricati (privato, path
-- "club_id/nomefile.xlsx", accesso via signed URL come già fatto per
-- "loghi-squadre").
INSERT INTO storage.buckets (id, name, public)
VALUES ('minutaggi-partite', 'minutaggi-partite', false)
ON CONFLICT (id) DO NOTHING;

DROP POLICY IF EXISTS minutaggi_partite_storage_select ON storage.objects;
CREATE POLICY minutaggi_partite_storage_select
  ON storage.objects
  FOR SELECT
  USING (
    bucket_id = 'minutaggi-partite'
    AND (storage.foldername(name))[1] = (
      SELECT last_club_id::text FROM public.profili WHERE auth_user_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS minutaggi_partite_storage_insert ON storage.objects;
CREATE POLICY minutaggi_partite_storage_insert
  ON storage.objects
  FOR INSERT
  WITH CHECK (
    bucket_id = 'minutaggi-partite'
    AND (storage.foldername(name))[1] = (
      SELECT last_club_id::text FROM public.profili WHERE auth_user_id = auth.uid()
    )
    AND (
      SELECT tipo_profilo FROM public.profili WHERE auth_user_id = auth.uid()
    ) = 'admin'::tipo_profilo_enum
  );

DROP POLICY IF EXISTS minutaggi_partite_storage_delete ON storage.objects;
CREATE POLICY minutaggi_partite_storage_delete
  ON storage.objects
  FOR DELETE
  USING (
    bucket_id = 'minutaggi-partite'
    AND (storage.foldername(name))[1] = (
      SELECT last_club_id::text FROM public.profili WHERE auth_user_id = auth.uid()
    )
    AND (
      SELECT tipo_profilo FROM public.profili WHERE auth_user_id = auth.uid()
    ) = 'admin'::tipo_profilo_enum
  );

-- Verifica
SELECT polname, polcmd
FROM pg_policy
WHERE polrelid IN (
  'public.partite_minutaggi_import'::regclass,
  'public.partite_minutaggi_cambi'::regclass
);
