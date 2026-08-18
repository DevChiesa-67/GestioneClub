-- =====================================================================
-- Giustificazione delle assenze
-- =====================================================================
-- Quando si segna "AG - Assente Giustificato" in Registra presenze si
-- apre un popup con foto e nome del giocatore e un campo testo: il
-- motivo dell'assenza finisce qui, e viene poi stampato nel PDF
-- Presenze (sezione "Assenze giustificate").
--
-- Il campo e' facoltativo: si puo' registrare l'assenza e completare la
-- giustificazione in un secondo momento, quindi niente NOT NULL.
--
-- Da eseguire nel SQL editor di Supabase. E' sicuro rieseguirlo.
-- =====================================================================

ALTER TABLE public.presenze_giornaliere
  ADD COLUMN IF NOT EXISTS giustificazione text;

COMMENT ON COLUMN public.presenze_giornaliere.giustificazione IS
  'Motivo dell''assenza, compilato nel popup quando lo stato e'' assenza_giustificata. Facoltativo.';

-- ---------------------------------------------------------------------
-- Verifica
-- ---------------------------------------------------------------------
SELECT column_name, data_type, is_nullable
FROM information_schema.columns
WHERE table_schema = 'public'
  AND table_name = 'presenze_giornaliere'
ORDER BY ordinal_position;
