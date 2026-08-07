-- L'import da Excel calcola tempo_lavoro/tempo_recupero in minuti anche
-- per lavori la cui durata nel foglio è espressa in secondi (es. 90" ->
-- 1.5 min, 45" -> 0.75 min). Se le colonne sono di tipo "integer" questo
-- fallisce con:
--   invalid input syntax for type integer: "0.75"
--
-- Le allineiamo a "numeric", stesso tipo già usato in drill_bank per gli
-- stessi campi.
--
-- Da eseguire nel SQL editor di Supabase (Dashboard -> SQL Editor).

ALTER TABLE public.lavori_allenamento
  ALTER COLUMN tempo_lavoro TYPE numeric USING tempo_lavoro::numeric;

ALTER TABLE public.lavori_allenamento
  ALTER COLUMN ripetizione TYPE numeric USING ripetizione::numeric;

ALTER TABLE public.lavori_allenamento
  ALTER COLUMN tempo_recupero TYPE numeric USING tempo_recupero::numeric;

ALTER TABLE public.lavori_allenamento
  ALTER COLUMN tempo_totale TYPE numeric USING tempo_totale::numeric;

-- Verifica: ti aspetti "numeric" per tutte e 4.
SELECT column_name, data_type
FROM information_schema.columns
WHERE table_schema = 'public'
  AND table_name = 'lavori_allenamento'
  AND column_name IN ('tempo_lavoro', 'ripetizione', 'tempo_recupero', 'tempo_totale');
