-- =====================================================================
-- Nuovi tipi profilo: MEDICO e FISIOTERAPISTA
-- =====================================================================
-- Regola voluta:
--   * leggono TUTTO (filtrato per club come nel resto del progetto)
--   * scrivono SOLO gli infortuni e le relative valutazioni
--
-- Come per gli altri ruoli, il filtro per SQUADRA resta a livello di
-- applicazione (le query passano last_squadra_id): in RLS il progetto
-- filtra sempre e solo per club_id, e qui si mantiene la convenzione.
--
-- Da eseguire nel SQL editor di Supabase (Dashboard -> SQL Editor).
-- E' sicuro rieseguirlo piu' volte.
--
-- !!! IMPORTANTE: ESEGUI LA PARTE 1 DA SOLA, POI LA PARTE 2 !!!
-- Un valore appena aggiunto a un enum non e' utilizzabile nella stessa
-- transazione che lo ha creato (errore "unsafe use of new value").
-- =====================================================================


-- #####################################################################
-- PARTE 1 - da selezionare ed eseguire DA SOLA
-- #####################################################################
-- Attenzione: i valori di un enum si aggiungono ma non si rimuovono.
-- Per "togliere" un ruolo si disattiva la riga in tipi_profili (in fondo).

ALTER TYPE public.tipo_profilo_enum ADD VALUE IF NOT EXISTS 'medico';
ALTER TYPE public.tipo_profilo_enum ADD VALUE IF NOT EXISTS 'fisioterapista';


-- #####################################################################
-- PARTE 2 - tutto il resto (da qui in giu')
-- #####################################################################

-- ---------------------------------------------------------------------
-- 1. Anagrafica dei ruoli (alimenta il menu di "Utenti e permessi")
-- ---------------------------------------------------------------------
INSERT INTO public.tipi_profili (codice, nome, descrizione, protetto, attivo)
VALUES
  ('medico', 'Medico',
   'Consulta tutti i dati del club e gestisce gli infortuni.', false, true),
  ('fisioterapista', 'Fisioterapista',
   'Consulta tutti i dati del club e gestisce gli infortuni.', false, true)
ON CONFLICT (codice) DO UPDATE
SET attivo = true,
    nome = EXCLUDED.nome,
    descrizione = EXCLUDED.descrizione;


-- ---------------------------------------------------------------------
-- 2. Pagine visibili: tutte tranne "Utenti e permessi"
-- ---------------------------------------------------------------------
-- Un ruolo nuovo parte senza permessi e non vedrebbe nessuna voce di
-- menu. L'elenco corrisponde a PAGINE_GESTIONALE in
-- src/lib/permessi/pagine-gestionale.ts.

INSERT INTO public.permessi_pagine_tipo_profilo (
  club_id, tipo_profilo, pagina_key, can_view, updated_at
)
SELECT
  c.id,
  r.ruolo::public.tipo_profilo_enum,
  p.pagina,
  true,
  now()
FROM public.club AS c
CROSS JOIN (VALUES ('medico'), ('fisioterapista')) AS r(ruolo)
CROSS JOIN (VALUES
  ('dashboard'),
  ('calendario'),
  ('giocatori'),
  ('squadre'),
  ('allenamenti'),
  ('programmazione'),
  ('partite'),
  ('convocazioni'),
  ('presenze'),
  ('misurazioni'),
  ('test'),
  ('infortuni'),
  ('performance'),
  ('report'),
  ('file'),
  ('comunicazioni')
) AS p(pagina)
ON CONFLICT (club_id, tipo_profilo, pagina_key)
DO UPDATE SET can_view = true, updated_at = now();

-- "Utenti e permessi" resta esplicitamente negata.
INSERT INTO public.permessi_pagine_tipo_profilo (
  club_id, tipo_profilo, pagina_key, can_view, updated_at
)
SELECT c.id, r.ruolo::public.tipo_profilo_enum, 'utenti_permessi', false, now()
FROM public.club AS c
CROSS JOIN (VALUES ('medico'), ('fisioterapista')) AS r(ruolo)
ON CONFLICT (club_id, tipo_profilo, pagina_key)
DO UPDATE SET can_view = false, updated_at = now();


-- ---------------------------------------------------------------------
-- 3. LETTURA su tutte le tabelle del club
-- ---------------------------------------------------------------------
-- Invece di scrivere a mano una policy per ogni tabella, si scorrono
-- tutte le tabelle di public che hanno una colonna club_id e su cui la
-- RLS e' attiva, creando su ciascuna la stessa policy di sola lettura.
--
-- Nota: il confronto e' su tipo_profilo::text, non sull'enum, cosi' il
-- blocco funziona anche se la PARTE 1 e' stata eseguita poco fa nella
-- stessa sessione.
--
-- Le tabelle con RLS disattivata vengono saltate: li' la lettura e' gia'
-- libera per chiunque sia autenticato, una policy non cambierebbe nulla.
--
-- Due dettagli imparati sul campo:
--
--   * club_id non e' sempre un uuid singolo. Su profili e' un uuid[] (un
--     utente puo' appartenere a piu' club), quindi il confronto diventa
--     "... = ANY(club_id)". Il blocco lo riconosce dal catalogo e genera
--     la forma giusta, altrimenti l'errore e' 42883 "operator does not
--     exist: uuid[] = uuid".
--   * profili viene ESCLUSA. Una policy su profili che a sua volta
--     interroga profili manda PostgreSQL in "infinite recursion detected
--     in policy" al primo SELECT. In ogni caso il profilo proprio e' gia'
--     leggibile dalle policy esistenti, ed e' l'unico che serve per
--     entrare nel gestionale. Se in futuro servisse leggere gli altri
--     profili del club, vedi il blocco 3-bis qui sotto.

DO $$
DECLARE
  t record;
  nome_policy text;
  cond_club text;
BEGIN
  FOR t IN
    SELECT
      c.relname,
      -- typcategory 'A' = tipo array: club_id uuid[] invece di uuid
      (tp.typcategory = 'A') AS club_id_array
    FROM pg_class c
    JOIN pg_namespace n ON n.oid = c.relnamespace
    JOIN pg_attribute a
      ON a.attrelid = c.oid
     AND a.attname = 'club_id'
     AND a.attnum > 0
     AND NOT a.attisdropped
    JOIN pg_type tp ON tp.oid = a.atttypid
    WHERE n.nspname = 'public'
      AND c.relkind = 'r'
      AND c.relrowsecurity
      AND c.relname <> 'profili'
    ORDER BY c.relname
  LOOP
    nome_policy := left(t.relname || '_select_sanitari', 63);

    IF t.club_id_array THEN
      cond_club :=
        ' (SELECT p.last_club_id FROM public.profili p'
        || '  WHERE p.auth_user_id = auth.uid()) = ANY(club_id)';
    ELSE
      cond_club :=
        ' club_id = (SELECT p.last_club_id FROM public.profili p'
        || '           WHERE p.auth_user_id = auth.uid())';
    END IF;

    EXECUTE format(
      'DROP POLICY IF EXISTS %I ON public.%I', nome_policy, t.relname
    );

    EXECUTE format(
      'CREATE POLICY %I ON public.%I FOR SELECT USING (%s'
      || ' AND lower((SELECT p.tipo_profilo::text FROM public.profili p'
      || '            WHERE p.auth_user_id = auth.uid()))'
      || '     IN (''medico'', ''fisioterapista''))',
      nome_policy, t.relname, cond_club
    );

    RAISE NOTICE 'policy di lettura creata su % (club_id array: %)',
      t.relname, t.club_id_array;
  END LOOP;
END $$;

-- ---------------------------------------------------------------------
-- 3-bis. (OPZIONALE) Far leggere a medico e fisioterapista gli ALTRI
--        profili del proprio club
-- ---------------------------------------------------------------------
-- Serve solo se ti accorgi che una pagina ha bisogno dell'elenco utenti
-- (per esempio i destinatari delle comunicazioni). Non si puo' fare con
-- una policy normale, perche' interrogare profili dentro una policy su
-- profili e' ricorsivo: si passa da due funzioni SECURITY DEFINER, che
-- leggono la tabella scavalcando la RLS e spezzano il ciclo.
--
-- Togli i commenti per usarlo.
--
-- CREATE OR REPLACE FUNCTION public.club_attivo_utente()
-- RETURNS uuid LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $fn$
--   SELECT last_club_id FROM public.profili WHERE auth_user_id = auth.uid()
-- $fn$;
--
-- CREATE OR REPLACE FUNCTION public.ruolo_utente()
-- RETURNS text LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $fn$
--   SELECT lower(tipo_profilo::text) FROM public.profili WHERE auth_user_id = auth.uid()
-- $fn$;
--
-- GRANT EXECUTE ON FUNCTION public.club_attivo_utente() TO authenticated;
-- GRANT EXECUTE ON FUNCTION public.ruolo_utente() TO authenticated;
--
-- DROP POLICY IF EXISTS profili_select_sanitari ON public.profili;
-- CREATE POLICY profili_select_sanitari
--   ON public.profili
--   FOR SELECT
--   USING (
--     public.club_attivo_utente() = ANY(club_id)
--     AND public.ruolo_utente() IN ('medico', 'fisioterapista')
--   );

-- Tabelle senza club_id che servono comunque alle join delle pagine
-- (anagrafiche condivise). Si creano solo se la tabella esiste e ha la
-- RLS attiva.
DO $$
DECLARE
  t text;
  nome_policy text;
BEGIN
  FOREACH t IN ARRAY ARRAY[
    'test_atletici_forza',
    'tipi_profili',
    'tipi_eventi',
    'tipi_allenamento',
    'tipi_partita'
  ]
  LOOP
    IF to_regclass('public.' || t) IS NULL THEN
      CONTINUE;
    END IF;

    IF NOT (SELECT relrowsecurity FROM pg_class WHERE oid = ('public.' || t)::regclass) THEN
      CONTINUE;
    END IF;

    nome_policy := left(t || '_select_autenticati', 63);

    EXECUTE format('DROP POLICY IF EXISTS %I ON public.%I', nome_policy, t);
    EXECUTE format(
      'CREATE POLICY %I ON public.%I FOR SELECT USING (auth.uid() IS NOT NULL)',
      nome_policy, t
    );

    RAISE NOTICE 'policy di lettura (anagrafica) creata su %', t;
  END LOOP;
END $$;

-- La tabella club usa "id", non "club_id": va trattata a parte,
-- altrimenti il nome del club non si carica.
DO $$
BEGIN
  IF (SELECT relrowsecurity FROM pg_class WHERE oid = 'public.club'::regclass) THEN
    DROP POLICY IF EXISTS club_select_proprio_club ON public.club;
    CREATE POLICY club_select_proprio_club
      ON public.club
      FOR SELECT
      USING (
        id = (SELECT p.last_club_id FROM public.profili p
              WHERE p.auth_user_id = auth.uid())
      );
  END IF;
END $$;


-- ---------------------------------------------------------------------
-- 4. SCRITTURA: solo infortuni e valutazioni collegate
-- ---------------------------------------------------------------------
-- Ambito: infortuni + le tre tabelle di valutazione. Medico e
-- fisioterapista possono scrivere su tutte e tre perche' l'interfaccia
-- espone un unico permesso; se vuoi che ciascuno tocchi solo la propria
-- scheda, restringi l'elenco qui sotto e crea due blocchi separati.
--
-- Le policy per l'admin vengono (ri)create insieme alle altre: se la RLS
-- su queste tabelle fosse ancora disattivata e la attivassi in seguito,
-- l'admin continuerebbe a funzionare.
--
-- ATTENZIONE: qui la RLS NON viene attivata d'ufficio. Se su queste
-- tabelle fosse spenta, accenderla di colpo toglierebbe la lettura a
-- tutti i ruoli che oggi la vedono solo perche' non c'e' nessun filtro
-- (allenatore, preparatore...). Il blocco stampa un avviso e in fondo
-- alla sezione trovi lo snippet per accenderla in modo controllato.

DO $$
DECLARE
  t text;
  cond_sanitari text;
  cond_admin text;
BEGIN
  cond_sanitari :=
    ' club_id = (SELECT p.last_club_id FROM public.profili p'
    || '            WHERE p.auth_user_id = auth.uid())'
    || ' AND lower((SELECT p.tipo_profilo::text FROM public.profili p'
    || '            WHERE p.auth_user_id = auth.uid()))'
    || '     IN (''medico'', ''fisioterapista'')';

  cond_admin :=
    ' club_id = (SELECT p.last_club_id FROM public.profili p'
    || '            WHERE p.auth_user_id = auth.uid())'
    || ' AND lower((SELECT p.tipo_profilo::text FROM public.profili p'
    || '            WHERE p.auth_user_id = auth.uid())) = ''admin''';

  FOREACH t IN ARRAY ARRAY[
    'infortuni',
    'infortuni_medico_valutazioni',
    'infortuni_fisioterapista_valutazioni',
    'infortuni_preparatore_valutazioni'
  ]
  LOOP
    IF to_regclass('public.' || t) IS NULL THEN
      RAISE NOTICE 'tabella % assente, saltata', t;
      CONTINUE;
    END IF;

    IF NOT (SELECT relrowsecurity FROM pg_class
            WHERE oid = ('public.' || t)::regclass) THEN
      RAISE WARNING 'RLS SPENTA su %: le policy vengono create ma non filtrano nulla (oggi la tabella e'' leggibile e scrivibile da qualunque utente autenticato). Vedi lo snippet in fondo alla sezione 4.', t;
    END IF;

    -- lettura
    EXECUTE format('DROP POLICY IF EXISTS %I ON public.%I',
                   left(t || '_select_sanitari', 63), t);
    EXECUTE format(
      'CREATE POLICY %I ON public.%I FOR SELECT USING (%s)',
      left(t || '_select_sanitari', 63), t, cond_sanitari
    );

    EXECUTE format('DROP POLICY IF EXISTS %I ON public.%I',
                   left(t || '_select_admin', 63), t);
    EXECUTE format(
      'CREATE POLICY %I ON public.%I FOR SELECT USING (%s)',
      left(t || '_select_admin', 63), t, cond_admin
    );

    -- scrittura sanitari
    EXECUTE format('DROP POLICY IF EXISTS %I ON public.%I',
                   left(t || '_insert_sanitari', 63), t);
    EXECUTE format(
      'CREATE POLICY %I ON public.%I FOR INSERT WITH CHECK (%s)',
      left(t || '_insert_sanitari', 63), t, cond_sanitari
    );

    EXECUTE format('DROP POLICY IF EXISTS %I ON public.%I',
                   left(t || '_update_sanitari', 63), t);
    EXECUTE format(
      'CREATE POLICY %I ON public.%I FOR UPDATE USING (%s) WITH CHECK (%s)',
      left(t || '_update_sanitari', 63), t, cond_sanitari, cond_sanitari
    );

    EXECUTE format('DROP POLICY IF EXISTS %I ON public.%I',
                   left(t || '_delete_sanitari', 63), t);
    EXECUTE format(
      'CREATE POLICY %I ON public.%I FOR DELETE USING (%s)',
      left(t || '_delete_sanitari', 63), t, cond_sanitari
    );

    -- scrittura admin
    EXECUTE format('DROP POLICY IF EXISTS %I ON public.%I',
                   left(t || '_insert_admin', 63), t);
    EXECUTE format(
      'CREATE POLICY %I ON public.%I FOR INSERT WITH CHECK (%s)',
      left(t || '_insert_admin', 63), t, cond_admin
    );

    EXECUTE format('DROP POLICY IF EXISTS %I ON public.%I',
                   left(t || '_update_admin', 63), t);
    EXECUTE format(
      'CREATE POLICY %I ON public.%I FOR UPDATE USING (%s) WITH CHECK (%s)',
      left(t || '_update_admin', 63), t, cond_admin, cond_admin
    );

    EXECUTE format('DROP POLICY IF EXISTS %I ON public.%I',
                   left(t || '_delete_admin', 63), t);
    EXECUTE format(
      'CREATE POLICY %I ON public.%I FOR DELETE USING (%s)',
      left(t || '_delete_admin', 63), t, cond_admin
    );

    RAISE NOTICE 'policy infortuni create su %', t;
  END LOOP;
END $$;


-- ---------------------------------------------------------------------
-- 4-bis. (OPZIONALE) Accendere la RLS sugli infortuni senza rompere nulla
-- ---------------------------------------------------------------------
-- Da eseguire SOLO se la verifica in fondo elenca le tabelle infortuni
-- fra quelle "senza RLS" e vuoi chiudere il buco. Prima si crea una
-- policy di lettura per tutti i profili del club che hanno la pagina
-- "infortuni" abilitata (cioe' esattamente chi la vede oggi nel menu),
-- poi si accende la RLS: nessun ruolo perde l'accesso.
--
-- Togli i commenti per usarlo.
--
-- DO $$
-- DECLARE t text;
-- BEGIN
--   FOREACH t IN ARRAY ARRAY[
--     'infortuni',
--     'infortuni_medico_valutazioni',
--     'infortuni_fisioterapista_valutazioni',
--     'infortuni_preparatore_valutazioni'
--   ]
--   LOOP
--     EXECUTE format('DROP POLICY IF EXISTS %I ON public.%I',
--                    left(t || '_select_pagina_abilitata', 63), t);
--     EXECUTE format(
--       'CREATE POLICY %I ON public.%I FOR SELECT USING ('
--       || ' EXISTS (SELECT 1 FROM public.profili p'
--       || '   JOIN public.permessi_pagine_tipo_profilo pp'
--       || '     ON pp.club_id = p.last_club_id'
--       || '    AND pp.tipo_profilo = p.tipo_profilo'
--       || '   WHERE p.auth_user_id = auth.uid()'
--       || '     AND p.last_club_id = %I.club_id'
--       || '     AND pp.pagina_key = ''infortuni'''
--       || '     AND pp.can_view))',
--       left(t || '_select_pagina_abilitata', 63), t, t
--     );
--     EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY', t);
--   END LOOP;
-- END $$;


-- ---------------------------------------------------------------------
-- 5. Allegati medici: lettura del bucket privato documenti-medici
-- ---------------------------------------------------------------------
-- La policy di SELECT del bucket e' gia' aperta a tutti i profili del
-- club (vedi crea-bucket-documenti-medici.sql), quindi medico e
-- fisioterapista vedono gli allegati senza modifiche.
-- L'upload passa dal client service-role (assicuraBucketDocumentiMedici),
-- che bypassa la RLS: nessuna policy aggiuntiva necessaria.


-- ---------------------------------------------------------------------
-- 6. VERIFICA
-- ---------------------------------------------------------------------
SELECT unnest(enum_range(NULL::public.tipo_profilo_enum))::text AS ruoli_enum;

SELECT codice, nome, attivo FROM public.tipi_profili ORDER BY nome;

SELECT tipo_profilo, pagina_key, can_view
FROM public.permessi_pagine_tipo_profilo
WHERE tipo_profilo::text IN ('medico', 'fisioterapista')
ORDER BY tipo_profilo, pagina_key;

-- Tutte le policy create da questo script.
SELECT
  c.relname AS tabella,
  p.polname AS policy,
  CASE p.polcmd
    WHEN 'r' THEN 'SELECT'
    WHEN 'a' THEN 'INSERT'
    WHEN 'w' THEN 'UPDATE'
    WHEN 'd' THEN 'DELETE'
    WHEN '*' THEN 'ALL'
  END AS comando
FROM pg_policy p
JOIN pg_class c ON c.oid = p.polrelid
WHERE p.polname LIKE '%_sanitari'
   OR p.polname LIKE '%_select_autenticati'
   OR p.polname = 'club_select_proprio_club'
ORDER BY c.relname, p.polname;

-- Stato della RLS sulle tabelle degli infortuni: se qui vedi "f",
-- valuta il blocco 4-bis.
SELECT c.relname AS tabella, c.relrowsecurity AS rls_attiva
FROM pg_class c
JOIN pg_namespace n ON n.oid = c.relnamespace
WHERE n.nspname = 'public' AND c.relname LIKE 'infortuni%'
ORDER BY c.relname;

-- Tabelle con club_id rimaste SENZA RLS (li' la lettura e' gia' libera:
-- controlla che vada bene).
SELECT c.relname AS tabella_senza_rls
FROM pg_class c
JOIN pg_namespace n ON n.oid = c.relnamespace
JOIN pg_attribute a
  ON a.attrelid = c.oid AND a.attname = 'club_id'
 AND a.attnum > 0 AND NOT a.attisdropped
WHERE n.nspname = 'public' AND c.relkind = 'r' AND NOT c.relrowsecurity
ORDER BY c.relname;


-- Per disattivare un ruolo in futuro (sparisce dalla UI e non e' piu'
-- assegnabile, ma gli utenti che ce l'hanno restano validi):
--   UPDATE public.tipi_profili SET attivo = false WHERE codice = 'medico';
