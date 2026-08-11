-- Fix errori a catena "Could not find the 'xxx' column of
-- 'partite_convocazioni' in the schema cache" (prima ruolo_panchina, poi
-- vicecapitano...): la tabella partite_convocazioni sul database non ha
-- mai avuto tutte le colonne che il codice dell'app si aspetta (tab
-- Convocazioni di una partita, popup minutaggio manuale). Invece di
-- aggiungerle una alla volta ogni volta che compare un nuovo errore,
-- questo script le aggiunge tutte insieme (ADD COLUMN IF NOT EXISTS: non
-- tocca le colonne già presenti, quindi è sicuro da rieseguire).

ALTER TABLE public.partite_convocazioni
  ADD COLUMN IF NOT EXISTS convocato boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS titolare boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS capitano boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS vicecapitano boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS posizione text,
  ADD COLUMN IF NOT EXISTS numero_maglia integer,
  ADD COLUMN IF NOT EXISTS ordine integer,
  ADD COLUMN IF NOT EXISTS ruolo_panchina text,
  ADD COLUMN IF NOT EXISTS note text,
  ADD COLUMN IF NOT EXISTS created_by uuid REFERENCES auth.users(id),
  ADD COLUMN IF NOT EXISTS created_at timestamptz NOT NULL DEFAULT now(),
  ADD COLUMN IF NOT EXISTS updated_at timestamptz NOT NULL DEFAULT now();

-- Forza PostgREST a ricaricare subito lo schema (altrimenti le colonne
-- appena aggiunte potrebbero non essere visibili alle API finché non
-- scade la cache).
NOTIFY pgrst, 'reload schema';

-- Verifica: elenco completo delle colonne della tabella dopo il fix.
SELECT column_name, data_type, is_nullable, column_default
FROM information_schema.columns
WHERE table_schema = 'public'
  AND table_name = 'partite_convocazioni'
ORDER BY ordinal_position;
