-- Flag Accademia sui giocatori.
-- Script idempotente da eseguire nel SQL Editor di Supabase.

ALTER TABLE public.giocatori
  ADD COLUMN IF NOT EXISTS accademia boolean NOT NULL DEFAULT false;

COMMENT ON COLUMN public.giocatori.accademia IS
  'Indica se il giocatore appartiene al percorso Accademia.';

SELECT id, nome, cognome, accademia
FROM public.giocatori
ORDER BY cognome, nome;
