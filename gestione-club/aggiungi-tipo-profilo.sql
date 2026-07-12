-- Da eseguire manualmente ogni volta che serve un nuovo tipo profilo.
-- Sostituisci 'nuovo_codice' con il codice del ruolo (minuscolo, senza spazi).

-- 1. Aggiunge il valore all'enum (irreversibile: gli enum non si possono
--    "rimuovere", solo aggiungere).
ALTER TYPE public.tipo_profilo_enum ADD VALUE IF NOT EXISTS 'nuovo_codice';

-- 2. Lo registra nell'anagrafica usata dalla UI di Utenti e permessi,
--    così compare come opzione selezionabile.
INSERT INTO public.tipi_profili (codice, nome, descrizione, protetto, attivo)
VALUES ('nuovo_codice', 'Nome visualizzato', 'Descrizione facoltativa', false, true)
ON CONFLICT (codice) DO NOTHING;

-- Per "eliminare" un tipo profilo senza poterlo davvero rimuovere dall'enum,
-- disattivalo così sparisce dalla UI (non selezionabile per nuovi utenti):
-- UPDATE public.tipi_profili SET attivo = false WHERE codice = 'nuovo_codice';
