-- Verifica che il vincolo unique su allenamenti includa anche
-- tipo_allenamento (mattina/sera separate), non solo data.
-- Esegui nel SQL Editor di Supabase e controlla il risultato:
-- ti aspetti una riga con constraint_name = uq_allenamenti_club_squadra_data_tipo
-- e columns che elenca club_id, squadra_id, data_allenamento, tipo_allenamento.

SELECT
  con.conname AS constraint_name,
  pg_get_constraintdef(con.oid) AS definizione
FROM pg_constraint con
JOIN pg_class rel ON rel.oid = con.conrelid
JOIN pg_namespace nsp ON nsp.oid = rel.relnamespace
WHERE nsp.nspname = 'public'
  AND rel.relname = 'allenamenti'
  AND con.contype = 'u';
