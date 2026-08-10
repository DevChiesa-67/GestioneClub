-- Estende i video della pagina File per poterli collegare anche a un
-- Evento (torneo, raduno, team building, ecc.), oltre a Partita e
-- Allenamento come già avveniva.
--
-- Aggiunge una colonna evento_id (come già esistono partita_id e
-- allenamento_id) e allarga il vincolo su tipo_evento in modo da
-- accettare anche il valore 'evento'.

ALTER TABLE public.file_video
  ADD COLUMN IF NOT EXISTS evento_id uuid REFERENCES public.eventi(id) ON DELETE CASCADE;

CREATE INDEX IF NOT EXISTS idx_file_video_evento ON public.file_video (evento_id);

-- Se esiste già un CHECK constraint su tipo_evento (es. limitato a
-- 'partita'/'allenamento'), lo sostituiamo: cerchiamo qualsiasi vincolo
-- di tipo check sulla tabella che citi la colonna tipo_evento e lo
-- rimuoviamo prima di aggiungerne uno nuovo, così lo script è idempotente
-- e funziona sia che il vincolo esista già sia che non esista.
DO $$
DECLARE
  vincolo record;
BEGIN
  FOR vincolo IN
    SELECT conname
    FROM pg_constraint
    WHERE conrelid = 'public.file_video'::regclass
      AND contype = 'c'
      AND pg_get_constraintdef(oid) ILIKE '%tipo_evento%'
  LOOP
    EXECUTE format('ALTER TABLE public.file_video DROP CONSTRAINT %I', vincolo.conname);
  END LOOP;
END $$;

ALTER TABLE public.file_video
  ADD CONSTRAINT file_video_tipo_evento_check
  CHECK (tipo_evento IN ('partita', 'allenamento', 'evento'));

-- Verifica
SELECT column_name, data_type
FROM information_schema.columns
WHERE table_schema = 'public' AND table_name = 'file_video'
ORDER BY ordinal_position;

SELECT conname, pg_get_constraintdef(oid)
FROM pg_constraint
WHERE conrelid = 'public.file_video'::regclass AND contype = 'c';
