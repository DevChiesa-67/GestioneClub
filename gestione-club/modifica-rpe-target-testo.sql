-- Il "RPE target/seduta" della settimana passa da numero singolo a testo
-- libero, per permettere sia un valore secco ("5") sia un intervallo
-- ("5-6") cosi' come viene espresso nella pratica dai preparatori.
-- USING rpe_target::text converte i valori interi gia' salvati (es. 7)
-- nella loro rappresentazione testuale (es. "7"), senza perdita di dati.

ALTER TABLE public.programmazione_settimane
  ALTER COLUMN rpe_target TYPE text USING rpe_target::text;

-- Vincolo di formato: un numero da 0 a 10, oppure un intervallo "a-b" con
-- a e b entrambi da 0 a 10 (l'ordine a<=b viene comunque già garantito e
-- validato anche lato applicazione).
ALTER TABLE public.programmazione_settimane
  DROP CONSTRAINT IF EXISTS programmazione_settimane_rpe_target_check;

ALTER TABLE public.programmazione_settimane
  ADD CONSTRAINT programmazione_settimane_rpe_target_check
  CHECK (rpe_target IS NULL OR rpe_target ~ '^(10|[0-9])(-(10|[0-9]))?$');
