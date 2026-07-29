-- Espande i valori ammessi per l'intensità della settimana di
-- programmazione da 3 a 5 livelli: bassa, medio-bassa, media,
-- medio-alta, alta.
--
-- Il vincolo CHECK esistente (creato da
-- aggiungi-campi-settimana-mesociclo.sql) accettava solo
-- 'bassa' | 'media' | 'alta': con il codice aggiornato per proporre
-- anche 'medio-bassa' e 'medio-alta', salvare una settimana con uno
-- di questi due valori fallirebbe con un errore di vincolo violato
-- finché questo script non viene eseguito.
--
-- Da eseguire nel SQL editor di Supabase (Dashboard -> SQL Editor).

ALTER TABLE public.programmazione_settimane
  DROP CONSTRAINT IF EXISTS programmazione_settimane_intensita_check;

ALTER TABLE public.programmazione_settimane
  ADD CONSTRAINT programmazione_settimane_intensita_check
  CHECK (
    intensita IS NULL
    OR intensita IN ('bassa', 'medio-bassa', 'media', 'medio-alta', 'alta')
  );
