-- Aggiunge i campi della "drill bank" a ogni lavoro di una seduta, per la
-- nuova tab "Dettagli" nel form di creazione/modifica seduta.
-- Tutti testo libero, opzionali: nessun impatto sui lavori già esistenti.

ALTER TABLE public.lavori_allenamento
  ADD COLUMN IF NOT EXISTS codice text,
  ADD COLUMN IF NOT EXISTS spazio text,
  ADD COLUMN IF NOT EXISTS materiale text,
  ADD COLUMN IF NOT EXISTS punti_chiave_coaching text,
  ADD COLUMN IF NOT EXISTS progressione text,
  ADD COLUMN IF NOT EXISTS riferimento_gps text,
  ADD COLUMN IF NOT EXISTS perche_serve text;
