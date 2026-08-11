-- Aggiunge all'evento (tornei/raduni/team building) l'ora di fine e un
-- logo, come già avviene per partite/club.

ALTER TABLE public.eventi
  ADD COLUMN IF NOT EXISTS ora_fine time,
  ADD COLUMN IF NOT EXISTS logo_url text;

-- Verifica
SELECT column_name, data_type
FROM information_schema.columns
WHERE table_schema = 'public' AND table_name = 'eventi'
ORDER BY ordinal_position;
