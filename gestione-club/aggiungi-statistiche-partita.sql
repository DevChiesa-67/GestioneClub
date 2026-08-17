-- Aggiunge le nuove statistiche di partita (punti di incontro, touche,
-- mischie, placcaggi) alla tabella partite_statistiche.
-- Sicuro da rieseguire più volte (IF NOT EXISTS su ogni colonna).

ALTER TABLE public.partite_statistiche
  ADD COLUMN IF NOT EXISTS punti_incontro_vinti integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS punti_incontro_persi integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS touche_vinte integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS touche_perse integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS touche_totali integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS mischie_vinte integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS mischie_perse integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS mischie_totali integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS placcaggi_efficaci integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS placcaggi_non_efficaci integer NOT NULL DEFAULT 0;
