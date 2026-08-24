-- =====================================================================
-- Sedute di PALESTRA importate da Excel
-- =====================================================================
-- Il file palestra ha, per ogni esercizio, dati che non trovavano posto
-- nelle colonne di lavori_allenamento pensate per il campo:
--   serie, rep, RPE, carico.
-- Il recupero continua a finire in tempo_recupero (in minuti), il nome
-- dell'esercizio in descrizione e il gruppo (props, backs, ...) in
-- sezione.
--
-- Un ciclo di palestra non e' una singola giornata: vale per un periodo
-- (es. tutto il mesociclo). Le date del ciclo si indicano in fase di
-- importazione e vengono salvate sulla seduta.
--
-- Script idempotente: puo' essere rieseguito. Da lanciare nel SQL editor
-- di Supabase (Dashboard -> SQL Editor) PRIMA di importare un file
-- palestra, altrimenti l'insert fallisce con "column ... does not exist".
-- =====================================================================

-- ---------------------------------------------------------------------
-- 1. Dati dell'esercizio in palestra
-- ---------------------------------------------------------------------
-- ripetizioni e carico sono TEXT di proposito: nel file reale valgono
-- anche 30" (wall sit, plank) oppure "bw" (bodyweight). Forzarli a
-- numero significherebbe perdere quell'informazione.
ALTER TABLE public.lavori_allenamento
  ADD COLUMN IF NOT EXISTS serie numeric,
  ADD COLUMN IF NOT EXISTS ripetizioni text,
  ADD COLUMN IF NOT EXISTS rpe numeric,
  ADD COLUMN IF NOT EXISTS carico text;


-- ---------------------------------------------------------------------
-- 2. Durata del ciclo sulla seduta
-- ---------------------------------------------------------------------
-- data_allenamento resta il giorno della singola seduta; ciclo_dal e
-- ciclo_al dicono per quanto tempo quel programma resta valido.
-- Restano NULL per tutte le sedute di campo gia' esistenti.
ALTER TABLE public.allenamenti
  ADD COLUMN IF NOT EXISTS ciclo_dal date,
  ADD COLUMN IF NOT EXISTS ciclo_al date;


-- ---------------------------------------------------------------------
-- 3. VERIFICA
-- ---------------------------------------------------------------------
SELECT column_name, data_type
FROM information_schema.columns
WHERE table_schema = 'public'
  AND table_name = 'lavori_allenamento'
  AND column_name IN ('serie', 'ripetizioni', 'rpe', 'carico')
ORDER BY column_name;

SELECT column_name, data_type
FROM information_schema.columns
WHERE table_schema = 'public'
  AND table_name = 'allenamenti'
  AND column_name IN ('ciclo_dal', 'ciclo_al')
ORDER BY column_name;
