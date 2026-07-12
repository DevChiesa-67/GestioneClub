-- Popola l'anagrafica tipi_profili con i ruoli base già usati nell'enum.
-- Senza questi record la pagina "Utenti e permessi" non ha nessun tipo
-- profilo attivo da proporre, quindi il pulsante "Aggiungi utente" resta
-- disabilitato anche per l'admin.

INSERT INTO public.tipi_profili (codice, nome, descrizione, protetto, attivo)
VALUES
  ('admin', 'Amministratore', 'Accesso completo al gestionale.', true, true),
  ('allenatore', 'Allenatore', 'Gestisce allenamenti, partite e programmazione.', false, true),
  ('preparatore', 'Preparatore', 'Gestisce performance, misurazioni e infortuni.', false, true),
  ('giocatore', 'Giocatore', 'Accesso limitato ai propri dati.', false, true)
ON CONFLICT (codice) DO UPDATE
SET attivo = true;
