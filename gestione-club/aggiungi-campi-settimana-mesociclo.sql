-- Aggiunge alla tabella programmazione_settimane i campi usati per la
-- scheda "settimana" del mesociclo (ex fase): data della seduta
-- specialistica, focus tecnico, intensità, RPE target e i due focus di
-- reparto (avanti/trequarti). Sicuro da rieseguire più volte.

ALTER TABLE public.programmazione_settimane
  ADD COLUMN IF NOT EXISTS data_seduta date,
  ADD COLUMN IF NOT EXISTS focus_tecnico text,
  ADD COLUMN IF NOT EXISTS intensita text,
  ADD COLUMN IF NOT EXISTS rpe_target integer,
  ADD COLUMN IF NOT EXISTS focus_avanti text,
  ADD COLUMN IF NOT EXISTS focus_trequarti text;

-- Vincolo sui valori ammessi per l'intensità (coerente con l'enum
-- applicativo "bassa" | "media" | "alta" già usato per le sedute).
ALTER TABLE public.programmazione_settimane
  DROP CONSTRAINT IF EXISTS programmazione_settimane_intensita_check;

ALTER TABLE public.programmazione_settimane
  ADD CONSTRAINT programmazione_settimane_intensita_check
  CHECK (intensita IS NULL OR intensita IN ('bassa', 'media', 'alta'));
