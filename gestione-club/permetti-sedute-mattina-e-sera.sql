-- Permette di avere più sedute di allenamento nello stesso giorno per la
-- stessa squadra, purché siano di tipo diverso (es. una "Seduta Mattutina"
-- e una "Seduta Serale" lo stesso giorno).
--
-- Il vincolo esistente uq_allenamenti_club_squadra_data impediva QUALSIASI
-- doppia seduta lo stesso giorno (club_id, squadra_id, data_allenamento),
-- causando l'errore:
--   duplicate key value violates unique constraint
--   "uq_allenamenti_club_squadra_data"
--
-- Lo sostituiamo con un vincolo che include anche tipo_allenamento: resta
-- vietato creare due volte lo stesso tipo di seduta lo stesso giorno (in
-- quel caso l'app unisce i lavori nella seduta già esistente), ma è ora
-- possibile avere una seduta mattutina e una serale nello stesso giorno.
--
-- Da eseguire nel SQL editor di Supabase (Dashboard -> SQL Editor).

ALTER TABLE public.allenamenti
  DROP CONSTRAINT IF EXISTS uq_allenamenti_club_squadra_data;

ALTER TABLE public.allenamenti
  ADD CONSTRAINT uq_allenamenti_club_squadra_data_tipo
  UNIQUE (club_id, squadra_id, data_allenamento, tipo_allenamento);
