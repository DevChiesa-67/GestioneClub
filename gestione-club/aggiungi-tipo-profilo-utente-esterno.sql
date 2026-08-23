-- ============================================================
-- Nuovo tipo profilo: utente esterno — PARTE 1 di 2
-- ============================================================
--
-- ESEGUI QUESTO FILE DA SOLO, poi esegui
-- aggiungi-tipo-profilo-utente-esterno-parte2.sql.
--
-- PERCHE' DUE FILE
-- Il SQL editor di Supabase esegue tutto cio' che incolli dentro UNA
-- transazione. PostgreSQL non permette di USARE un valore di enum
-- aggiunto nella transazione ancora aperta:
--
--   ERROR: 55P04 unsafe use of new value "utente_esterno"
--          of enum type tipo_profilo_enum
--   HINT:  New enum values must be committed before they can be used.
--
-- La colonna permessi_pagine_tipo_profilo.tipo_profilo e' di tipo
-- tipo_profilo_enum, quindi assegnare le pagine visibili al nuovo ruolo
-- e' gia' un "uso" del valore. Separando i due file, la parte 1 fa il
-- commit e la parte 2 trova il valore disponibile.
--
-- Questa parte contiene un solo statement ed e' sicura da rieseguire.

-- Attenzione: i valori di un enum si aggiungono ma non si rimuovono. Per
-- "togliere" un ruolo si disattiva la riga in tipi_profili (vedi parte 2).

ALTER TYPE public.tipo_profilo_enum
  ADD VALUE IF NOT EXISTS 'utente_esterno';

-- NIENTE ALTRO IN QUESTO FILE, nemmeno una query di verifica: anche solo
-- LEGGERE l'elenco dei valori dell'enum (enum_range) conta come "uso" e
-- farebbe fallire tutto con lo stesso 55P04. La verifica sta nella
-- parte 2, dove il valore e' ormai committato.
