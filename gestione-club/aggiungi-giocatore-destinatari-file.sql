-- Permette di condividere un file con profili oppure con singoli giocatori.
ALTER TABLE public.file_video_destinatari
  ADD COLUMN IF NOT EXISTS giocatore_id uuid;

-- Il destinatario può essere un giocatore, quindi profilo_id non è obbligatorio.
ALTER TABLE public.file_video_destinatari
  ALTER COLUMN profilo_id DROP NOT NULL;

-- Aggiunge la FK soltanto se non è già presente.
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conrelid = 'public.file_video_destinatari'::regclass
      AND conname = 'file_video_destinatari_giocatore_id_fkey'
  ) THEN
    ALTER TABLE public.file_video_destinatari
      ADD CONSTRAINT file_video_destinatari_giocatore_id_fkey
      FOREIGN KEY (giocatore_id)
      REFERENCES public.giocatori(id)
      ON DELETE CASCADE;
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_file_video_destinatari_giocatore
  ON public.file_video_destinatari(giocatore_id);

NOTIFY pgrst, 'reload schema';
