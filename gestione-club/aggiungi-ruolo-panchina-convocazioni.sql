-- Fix errore "Could not find the 'ruolo_panchina' column of
-- 'partite_convocazioni' in the schema cache": la colonna manca nella
-- tabella (o non è mai stata propagata alla cache schema di PostgREST),
-- pur essendo già usata dal codice dell'app (tab Convocazioni di una
-- partita, popup minutaggio manuale).

ALTER TABLE public.partite_convocazioni
  ADD COLUMN IF NOT EXISTS ruolo_panchina text;

-- Forza PostgREST a ricaricare subito lo schema (altrimenti il fix sopra
-- potrebbe non essere visibile alle API finché non scade la cache).
NOTIFY pgrst, 'reload schema';

-- Verifica
SELECT column_name, data_type, is_nullable
FROM information_schema.columns
WHERE table_schema = 'public'
  AND table_name = 'partite_convocazioni'
ORDER BY ordinal_position;
