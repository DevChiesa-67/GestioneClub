-- Abilita le configurazioni composte delle unita' di misura dei test.
-- Esempi: tempo:secondi,centesimi  /  peso:kg,g
-- Script idempotente da eseguire nel SQL Editor di Supabase.

ALTER TABLE public.test_atletici_forza
  DROP CONSTRAINT IF EXISTS test_atletici_forza_unita_misura_check;

ALTER TABLE public.test_atletici_forza
  ADD CONSTRAINT test_atletici_forza_unita_misura_check
  CHECK (
    unita_misura IN ('secondi', 'kg', 'ripetizioni', 'metri', 'cm')
    OR unita_misura LIKE 'tempo:%'
    OR unita_misura LIKE 'peso:%'
    OR unita_misura LIKE 'lunghezza:%'
  );

-- Il test Agility usa sempre secondi e centesimi.
UPDATE public.test_atletici_forza
SET
  tipo_test = 'atletica',
  unita_misura = 'tempo:secondi,centesimi'
WHERE nome ILIKE '%agility%';

SELECT id, nome, tipo_test, unita_misura
FROM public.test_atletici_forza
ORDER BY nome;
