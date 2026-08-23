-- ============================================================
-- Nuovo tipo profilo: utente esterno — PARTE 2 di 2
-- ============================================================
--
-- ESEGUI PRIMA aggiungi-tipo-profilo-utente-esterno.sql (parte 1), che
-- aggiunge il valore all'enum. Se lanci questo file per primo ottieni
-- "invalid input value for enum tipo_profilo_enum: utente_esterno".
--
-- Qui si fanno le due cose che rendono il ruolo davvero utilizzabile:
--   - la riga in tipi_profili, che alimenta il menu a tendina di
--     "Aggiungi utente" (senza, il ruolo non compare fra le opzioni);
--   - le pagine visibili di partenza, senza le quali chi ha questo
--     profilo entra e non vede nessuna voce di menu.
--
-- Nessuna modifica al codice dell'applicazione e' necessaria: la
-- validazione dei tipi profilo legge tipi_profili, non una lista fissa.
--
-- E' sicuro rieseguirlo piu' volte.

-- ------------------------------------------------------------
-- 1. Anagrafica
-- ------------------------------------------------------------

INSERT INTO public.tipi_profili (codice, nome, descrizione, protetto, attivo)
VALUES (
  'utente_esterno',
  'Utente esterno',
  'Accesso in sola consultazione, riservato a chi non fa parte dello staff del club.',
  false,
  true
)
ON CONFLICT (codice) DO UPDATE
SET attivo = true,
    nome = EXCLUDED.nome,
    descrizione = EXCLUDED.descrizione;

-- ------------------------------------------------------------
-- 2. Pagine visibili
-- ------------------------------------------------------------
-- Punto di partenza volutamente MINIMO — dashboard, calendario e
-- comunicazioni, cioe' le sole pagine informative — perche' per un ruolo
-- "esterno" e' piu' facile aggiungere un permesso in seguito che
-- accorgersi di averne dato uno di troppo. Tutto il resto si regola da
-- "Utenti e permessi".
--
-- Il blocco e' condizionato all'esistenza della tabella: se un domani
-- permessi_pagine_tipo_profilo venisse rimossa (vedi
-- rimuovi-permessi-pagine-tipo-profilo.sql, che pero' NON va eseguito
-- finche' il codice la usa), lo script non fallisce.

DO $$
BEGIN
  IF to_regclass('public.permessi_pagine_tipo_profilo') IS NULL THEN
    RAISE NOTICE 'Tabella permessi_pagine_tipo_profilo assente: imposta le pagine visibili da "Utenti e permessi".';
    RETURN;
  END IF;

  INSERT INTO public.permessi_pagine_tipo_profilo (
    club_id, tipo_profilo, pagina_key, can_view, updated_at
  )
  SELECT c.id, 'utente_esterno', p.pagina, true, now()
  FROM public.club AS c
  CROSS JOIN (VALUES
    ('dashboard'),
    ('calendario'),
    ('comunicazioni')
  ) AS p(pagina)
  ON CONFLICT (club_id, tipo_profilo, pagina_key)
  DO UPDATE SET can_view = true, updated_at = now();
END $$;

-- ------------------------------------------------------------
-- Verifica
-- ------------------------------------------------------------

-- 'utente_esterno' deve comparire fra i valori dell'enum (e' la verifica
-- della parte 1, che li' non si poteva fare).
SELECT unnest(enum_range(NULL::public.tipo_profilo_enum))::text AS ruoli_enum;

-- La riga deve esserci con attivo = true: e' cio' che fa apparire il
-- ruolo nel menu a tendina di "Aggiungi utente".
SELECT codice, nome, attivo FROM public.tipi_profili ORDER BY nome;

-- Una riga per club per ognuna delle tre pagine.
SELECT club_id, pagina_key, can_view
FROM public.permessi_pagine_tipo_profilo
WHERE tipo_profilo = 'utente_esterno'
ORDER BY club_id, pagina_key;

-- Per disattivare il ruolo in futuro (sparisce dalla UI e non e' piu'
-- assegnabile, ma gli utenti che ce l'hanno restano validi):
--   UPDATE public.tipi_profili SET attivo = false WHERE codice = 'utente_esterno';
