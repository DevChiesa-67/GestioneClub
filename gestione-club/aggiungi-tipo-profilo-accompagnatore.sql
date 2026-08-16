-- ============================================================
-- Nuovo tipo profilo: accompagnatore
-- ============================================================
--
-- Un ruolo vive in DUE posti e servono entrambi:
--   1. tipo_profilo_enum  -> il vincolo del database su profili.tipo_profilo
--   2. tipi_profili       -> l'anagrafica che alimenta il menu a tendina
--
-- Se manca il primo l'inserimento fallisce con 22P02; se manca il secondo
-- il ruolo non compare nemmeno tra le opzioni. Da quando la validazione
-- lato applicazione legge tipi_profili invece di una lista fissa nel
-- codice, questi due passaggi sono l'unica cosa che serve: nessuna
-- modifica al codice.
--
-- Da eseguire nel SQL editor di Supabase (Dashboard -> SQL Editor).
-- E' sicuro rieseguirlo piu' volte.

-- ------------------------------------------------------------
-- 1. Valore dell'enum
-- ------------------------------------------------------------
-- Attenzione: i valori di un enum si aggiungono ma non si rimuovono. Per
-- "togliere" un ruolo si disattiva la riga in tipi_profili (vedi in fondo).

ALTER TYPE public.tipo_profilo_enum
  ADD VALUE IF NOT EXISTS 'accompagnatore';

-- ------------------------------------------------------------
-- 2. Anagrafica
-- ------------------------------------------------------------
-- In una transazione separata: un valore appena aggiunto a un enum non e'
-- utilizzabile nella stessa transazione che lo ha creato. Nel SQL editor
-- di Supabase ogni statement viene eseguito di seguito, ma se lanci tutto
-- come blocco unico e ottieni "unsafe use of new value", esegui questa
-- seconda parte da sola.

INSERT INTO public.tipi_profili (codice, nome, descrizione, protetto, attivo)
VALUES (
  'accompagnatore',
  'Accompagnatore',
  'Accompagna la squadra a partite e trasferte.',
  false,
  true
)
ON CONFLICT (codice) DO UPDATE
SET attivo = true,
    nome = EXCLUDED.nome;

-- ------------------------------------------------------------
-- 3. Pagine visibili
-- ------------------------------------------------------------
-- Un ruolo nuovo parte senza permessi: non vedrebbe nessuna voce di menu.
-- Diamogli le pagine ragionevoli per chi accompagna la squadra. Puoi poi
-- correggere tutto da Utenti e permessi.

INSERT INTO public.permessi_pagine_tipo_profilo (
  club_id, tipo_profilo, pagina_key, can_view, updated_at
)
SELECT c.id, 'accompagnatore', p.pagina, true, now()
FROM public.club AS c
CROSS JOIN (VALUES
  ('dashboard'),
  ('calendario'),
  ('partite'),
  ('comunicazioni')
) AS p(pagina)
ON CONFLICT (club_id, tipo_profilo, pagina_key)
DO UPDATE SET can_view = true, updated_at = now();

-- ------------------------------------------------------------
-- Verifica
-- ------------------------------------------------------------

SELECT unnest(enum_range(NULL::public.tipo_profilo_enum))::text AS ruoli_enum;

SELECT codice, nome, attivo FROM public.tipi_profili ORDER BY nome;

SELECT club_id, pagina_key, can_view
FROM public.permessi_pagine_tipo_profilo
WHERE tipo_profilo = 'accompagnatore'
ORDER BY club_id, pagina_key;

-- Per disattivare un ruolo in futuro (sparisce dalla UI e non e' piu'
-- assegnabile, ma gli utenti che ce l'hanno restano validi):
--   UPDATE public.tipi_profili SET attivo = false WHERE codice = 'accompagnatore';
