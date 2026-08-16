-- ============================================================
-- Quali migrazioni non sono mai state eseguite
-- ============================================================
--
-- Elenca colonne e tabelle che i file .sql nella root del progetto
-- dovrebbero aver creato, e mostra SOLO quelle che mancano davvero nel
-- database. Ogni riga significa: quel file va ancora eseguito.
-- Nessuna riga in output = sei in pari.
--
-- Generato leggendo i file .sql del progetto. E' di sola lettura.

WITH attese(file_sql, tabella, colonna) AS (VALUES
  ('aggiungi-campi-drillbank-lavori.sql', 'lavori_allenamento', 'codice'),
  ('aggiungi-campi-drillbank-lavori.sql', 'lavori_allenamento', 'spazio'),
  ('aggiungi-campi-drillbank-lavori.sql', 'lavori_allenamento', 'materiale'),
  ('aggiungi-campi-drillbank-lavori.sql', 'lavori_allenamento', 'punti_chiave_coaching'),
  ('aggiungi-campi-drillbank-lavori.sql', 'lavori_allenamento', 'progressione'),
  ('aggiungi-campi-drillbank-lavori.sql', 'lavori_allenamento', 'riferimento_gps'),
  ('aggiungi-campi-drillbank-lavori.sql', 'lavori_allenamento', 'perche_serve'),
  ('aggiungi-campi-lavori-contemporanei.sql', 'lavori_allenamento', 'contemporaneo'),
  ('aggiungi-campi-lavori-contemporanei.sql', 'lavori_allenamento', 'gruppo_contemporaneo'),
  ('aggiungi-campi-settimana-mesociclo.sql', 'programmazione_settimane', 'data_seduta'),
  ('aggiungi-campi-settimana-mesociclo.sql', 'programmazione_settimane', 'focus_tecnico'),
  ('aggiungi-campi-settimana-mesociclo.sql', 'programmazione_settimane', 'intensita'),
  ('aggiungi-campi-settimana-mesociclo.sql', 'programmazione_settimane', 'rpe_target'),
  ('aggiungi-campi-settimana-mesociclo.sql', 'programmazione_settimane', 'focus_avanti'),
  ('aggiungi-campi-settimana-mesociclo.sql', 'programmazione_settimane', 'focus_trequarti'),
  ('aggiungi-colonna-expiration-time-push-subscriptions.sql', 'push_subscriptions', 'profilo_id'),
  ('aggiungi-colonna-expiration-time-push-subscriptions.sql', 'push_subscriptions', 'club_id'),
  ('aggiungi-colonna-expiration-time-push-subscriptions.sql', 'push_subscriptions', 'squadra_id'),
  ('aggiungi-colonna-expiration-time-push-subscriptions.sql', 'push_subscriptions', 'endpoint'),
  ('aggiungi-colonna-expiration-time-push-subscriptions.sql', 'push_subscriptions', 'p256dh'),
  ('aggiungi-colonna-expiration-time-push-subscriptions.sql', 'push_subscriptions', 'auth'),
  ('aggiungi-colonna-expiration-time-push-subscriptions.sql', 'push_subscriptions', 'expiration_time'),
  ('aggiungi-colonna-expiration-time-push-subscriptions.sql', 'push_subscriptions', 'user_agent'),
  ('aggiungi-colonna-expiration-time-push-subscriptions.sql', 'push_subscriptions', 'created_at'),
  ('aggiungi-colonna-expiration-time-push-subscriptions.sql', 'push_subscriptions', 'updated_at'),
  ('aggiungi-colonne-mancanti-convocazioni.sql', 'partite_convocazioni', 'convocato'),
  ('aggiungi-colonne-mancanti-convocazioni.sql', 'partite_convocazioni', 'titolare'),
  ('aggiungi-colonne-mancanti-convocazioni.sql', 'partite_convocazioni', 'capitano'),
  ('aggiungi-colonne-mancanti-convocazioni.sql', 'partite_convocazioni', 'vicecapitano'),
  ('aggiungi-colonne-mancanti-convocazioni.sql', 'partite_convocazioni', 'posizione'),
  ('aggiungi-colonne-mancanti-convocazioni.sql', 'partite_convocazioni', 'numero_maglia'),
  ('aggiungi-colonne-mancanti-convocazioni.sql', 'partite_convocazioni', 'ordine'),
  ('aggiungi-colonne-mancanti-convocazioni.sql', 'partite_convocazioni', 'ruolo_panchina'),
  ('aggiungi-colonne-mancanti-convocazioni.sql', 'partite_convocazioni', 'note'),
  ('aggiungi-colonne-mancanti-convocazioni.sql', 'partite_convocazioni', 'created_by'),
  ('aggiungi-colonne-mancanti-convocazioni.sql', 'partite_convocazioni', 'created_at'),
  ('aggiungi-colonne-mancanti-convocazioni.sql', 'partite_convocazioni', 'updated_at'),
  ('aggiungi-evento-a-file-video.sql', 'file_video', 'evento_id'),
  ('aggiungi-ora-fine-logo-eventi.sql', 'eventi', 'ora_fine'),
  ('aggiungi-ora-fine-logo-eventi.sql', 'eventi', 'logo_url'),
  ('aggiungi-preferenza-vista-lavori-club.sql', 'club', 'preferenza_vista_lavori'),
  ('aggiungi-statistiche-partita.sql', 'partite_statistiche', 'punti_incontro_vinti'),
  ('aggiungi-statistiche-partita.sql', 'partite_statistiche', 'punti_incontro_persi'),
  ('aggiungi-statistiche-partita.sql', 'partite_statistiche', 'touche_vinte'),
  ('aggiungi-statistiche-partita.sql', 'partite_statistiche', 'touche_perse'),
  ('aggiungi-statistiche-partita.sql', 'partite_statistiche', 'mischie_vinte'),
  ('aggiungi-statistiche-partita.sql', 'partite_statistiche', 'mischie_perse'),
  ('aggiungi-statistiche-partita.sql', 'partite_statistiche', 'placcaggi_efficaci'),
  ('aggiungi-statistiche-partita.sql', 'partite_statistiche', 'placcaggi_non_efficaci'),
  ('potenzia-report-personalizzati.sql', 'report_personalizzati', 'pubblicato'),
  ('potenzia-report-personalizzati.sql', 'report_personalizzati', 'tipi_profilo_visibili'),
  ('potenzia-report-personalizzati.sql', 'report_personalizzati', 'campo_catapult'),
  ('potenzia-report-personalizzati.sql', 'report_personalizzati', 'aggregazione_catapult')
),
tabelle_attese(file_sql, tabella) AS (VALUES
  ('crea-tabella-drill-bank.sql', 'drill_bank'),
  ('crea-tabelle-eventi.sql', 'tipi_eventi'),
  ('crea-tabelle-eventi.sql', 'eventi'),
  ('crea-tabelle-eventi.sql', 'eventi_convocazioni'),
  ('crea-tabelle-minutaggi-partite.sql', 'partite_minutaggi_import'),
  ('crea-tabelle-minutaggi-partite.sql', 'partite_minutaggi_cambi')
)
SELECT a.file_sql, a.tabella || '.' || a.colonna AS oggetto_mancante, 'colonna' AS tipo
FROM attese a
LEFT JOIN information_schema.columns c
  ON c.table_schema = 'public' AND c.table_name = a.tabella AND c.column_name = a.colonna
WHERE c.column_name IS NULL
  AND EXISTS (SELECT 1 FROM information_schema.tables t
              WHERE t.table_schema='public' AND t.table_name = a.tabella)

UNION ALL

SELECT t.file_sql, t.tabella AS oggetto_mancante, 'tabella' AS tipo
FROM tabelle_attese t
LEFT JOIN information_schema.tables x
  ON x.table_schema = 'public' AND x.table_name = t.tabella
WHERE x.table_name IS NULL

ORDER BY 1, 2;
