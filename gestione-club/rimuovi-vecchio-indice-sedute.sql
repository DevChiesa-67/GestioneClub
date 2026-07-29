-- Il vincolo vecchio "uq_allenamenti_club_squadra_data" non era in realtà
-- un CONSTRAINT ma un INDICE UNIVOCO creato direttamente con CREATE UNIQUE
-- INDEX: per questo "ALTER TABLE ... DROP CONSTRAINT IF EXISTS" (usato
-- nello script precedente) non l'ha trovato e non l'ha toccato, mentre il
-- nuovo vincolo uq_allenamenti_club_squadra_data_tipo è stato creato in
-- aggiunta. Risultato: sono attive ENTRAMBE le regole, e quella vecchia
-- (senza tipo_allenamento) continua a bloccare la seconda seduta dello
-- stesso giorno.
--
-- 1) Verifica quali indici univoci esistono sulla tabella (facoltativo,
--    utile solo per controllare prima di eliminare):
--
--    SELECT indexname, indexdef
--    FROM pg_indexes
--    WHERE schemaname = 'public' AND tablename = 'allenamenti';
--
-- 2) Elimina l'indice vecchio, ora ridondante rispetto al nuovo vincolo:

DROP INDEX IF EXISTS public.uq_allenamenti_club_squadra_data;
