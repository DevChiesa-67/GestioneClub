-- Potenzia report_personalizzati per la pubblicazione di parametri
-- Catapult nel riepilogo della pagina Performance:
-- - pubblicato: se true (e solo se true) il parametro compare come card
--   nel riepilogo, per i tipi profilo indicati in tipi_profilo_visibili.
-- - tipi_profilo_visibili: quali gruppi (tipo_profilo) possono vedere la
--   card pubblicata. Vuoto = nessuno (va scelto esplicitamente almeno un
--   gruppo prima di poter pubblicare, validato anche lato applicazione).
-- - campo_catapult: nome della colonna reale di catapult_data scelta come
--   parametro (es. "distance_metres"). Valorizzato solo per i report con
--   sezione_performance = 'performance' e tipo_visualizzazione = 'kpi'.
-- - aggregazione_catapult: come aggregare i valori delle sessioni
--   filtrate per calcolare il numero mostrato nella card.

ALTER TABLE public.report_personalizzati
  ADD COLUMN IF NOT EXISTS pubblicato boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS tipi_profilo_visibili text[] NOT NULL DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS campo_catapult text,
  ADD COLUMN IF NOT EXISTS aggregazione_catapult text;

ALTER TABLE public.report_personalizzati
  DROP CONSTRAINT IF EXISTS report_personalizzati_aggregazione_catapult_check;

ALTER TABLE public.report_personalizzati
  ADD CONSTRAINT report_personalizzati_aggregazione_catapult_check
  CHECK (
    aggregazione_catapult IS NULL
    OR aggregazione_catapult IN ('media', 'somma', 'min', 'max', 'ultima')
  );

-- Indice per la query più frequente: "parametri pubblicati di questo club
-- visibili a questo tipo di profilo", eseguita ad ogni caricamento del
-- riepilogo Performance.
CREATE INDEX IF NOT EXISTS report_personalizzati_pubblicati_idx
  ON public.report_personalizzati (club_id, sezione_performance)
  WHERE pubblicato = true;
