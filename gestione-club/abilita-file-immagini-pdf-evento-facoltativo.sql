-- Allinea la tabella file_video al modulo File:
-- accetta video, immagini e PDF e rende facoltativa l'associazione a un evento.
DO $$
DECLARE
  vincolo record;
  definizione text;
BEGIN
  FOR vincolo IN
    SELECT oid, conname
    FROM pg_constraint
    WHERE conrelid = 'public.file_video'::regclass
      AND contype = 'c'
  LOOP
    definizione := lower(pg_get_constraintdef(vincolo.oid));

    IF definizione LIKE '%video_mime_type%'
       OR (definizione LIKE '%partita_id%' AND definizione LIKE '%allenamento_id%')
    THEN
      EXECUTE format('ALTER TABLE public.file_video DROP CONSTRAINT %I', vincolo.conname);
    END IF;
  END LOOP;
END $$;

ALTER TABLE public.file_video
  ADD CONSTRAINT file_video_mime_type_check
  CHECK (
    video_mime_type = 'application/pdf'
    OR video_mime_type LIKE 'image/%'
    OR video_mime_type LIKE 'video/%'
  );

-- partita_id, allenamento_id ed evento_id restano nullable.
