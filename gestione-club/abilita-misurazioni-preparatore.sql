-- =====================================================================
-- Misurazioni visibili allo staff (preparatore, medico, fisioterapista,
-- allenatore, direttore tecnico... e chiunque abiliterai domani)
-- =====================================================================
-- Invece di elencare i ruoli in una policy, la lettura segue
-- permessi_pagine_tipo_profilo: chi ha can_view = true sulla pagina
-- "misurazioni" nel proprio club legge antropometria e questionari
-- benessere di quel club. Stessa fonte di verita' che usa la pagina
-- "Utenti e permessi", quindi abilitare un ruolo nuovo non richiede piu'
-- di toccare ne' il database ne' il codice.
--
-- Il GIOCATORE e' escluso di proposito: ha can_view = true perche' gli
-- serve la sua scheda personale, ma non deve vedere i dati degli altri.
-- La sua vista personale passa da altre policy e non viene toccata.
--
-- La scrittura resta all'admin.
--
-- Da eseguire nel SQL editor di Supabase. E' sicuro rieseguirlo.
--
-- Nota sui tipi: permessi_pagine_tipo_profilo.tipo_profilo e' TEXT,
-- profili.tipo_profilo e' l'enum tipo_profilo_enum. Confrontarli
-- direttamente da' "42883: operator does not exist: text =
-- tipo_profilo_enum", quindi la join passa da lower(...::text) su
-- entrambi i lati: risolve il tipo e insieme le differenze di
-- maiuscole.
-- =====================================================================

-- ---------------------------------------------------------------------
-- 0. Diagnostica
-- ---------------------------------------------------------------------
SELECT
  c.relname                               AS tabella,
  c.relrowsecurity                        AS rls_attiva,
  COALESCE(p.polname, '(nessuna policy)') AS policy,
  CASE p.polcmd
    WHEN 'r' THEN 'SELECT' WHEN 'a' THEN 'INSERT'
    WHEN 'w' THEN 'UPDATE' WHEN 'd' THEN 'DELETE'
    WHEN '*' THEN 'ALL'
  END                                     AS comando
FROM pg_class c
LEFT JOIN pg_policy p ON p.polrelid = c.oid
WHERE c.relname IN ('misurazioni_antropometriche', 'misurazioni_benessere')
ORDER BY c.relname, p.polname;

-- ---------------------------------------------------------------------
-- 1. Permesso di pagina per il preparatore
-- ---------------------------------------------------------------------
-- Gli altri ruoli ce l'hanno gia'; questa riga completa il quadro. Da
-- qui in avanti si gestisce tutto da "Utenti e permessi".

INSERT INTO public.permessi_pagine_tipo_profilo (
  club_id, tipo_profilo, pagina_key, can_view, updated_at
)
SELECT c.id, 'preparatore'::public.tipo_profilo_enum, 'misurazioni', true, now()
FROM public.club AS c
ON CONFLICT (club_id, tipo_profilo, pagina_key)
DO UPDATE SET can_view = true, updated_at = now();

-- ---------------------------------------------------------------------
-- 2. Policy di lettura guidata dai permessi di pagina
-- ---------------------------------------------------------------------
DO $$
DECLARE
  t text;
  condizione text;
BEGIN
  condizione :=
       ' EXISTS ('
    || '   SELECT 1'
    || '   FROM public.profili p'
    || '   JOIN public.permessi_pagine_tipo_profilo pp'
    || '     ON pp.club_id = p.last_club_id'
    || '    AND lower(pp.tipo_profilo::text) = lower(p.tipo_profilo::text)'
    || '   WHERE p.auth_user_id = auth.uid()'
    || '     AND p.last_club_id = %2$I.club_id'
    || '     AND pp.pagina_key = ''misurazioni'''
    || '     AND pp.can_view'
    || '     AND lower(p.tipo_profilo::text) <> ''giocatore'''
    || ' )';

  FOREACH t IN ARRAY ARRAY[
    'misurazioni_antropometriche',
    'misurazioni_benessere'
  ]
  LOOP
    IF to_regclass('public.' || t) IS NULL THEN
      RAISE NOTICE 'tabella % assente, saltata', t;
      CONTINUE;
    END IF;

    IF NOT (SELECT relrowsecurity FROM pg_class
            WHERE oid = ('public.' || t)::regclass) THEN
      RAISE WARNING 'RLS spenta su %: la policy viene creata ma non filtra nulla (oggi la tabella e'' gia'' leggibile da chiunque sia autenticato).', t;
    END IF;

    EXECUTE format('DROP POLICY IF EXISTS %I ON public.%I',
                   left(t || '_select_staff_abilitato', 63), t);

    -- format() non ammette di mescolare segnaposto posizionali e non:
    -- essendoci %2$I dentro la condizione, tutta la stringa e' posizionale.
    EXECUTE format(
      'CREATE POLICY %1$I ON public.%2$I FOR SELECT USING (' || condizione || ')',
      left(t || '_select_staff_abilitato', 63), t
    );

    RAISE NOTICE 'policy di lettura creata su %', t;
  END LOOP;
END $$;

-- ---------------------------------------------------------------------
-- 3. La pagina legge anche la rosa
-- ---------------------------------------------------------------------
-- MisurazioniAdminClient associa ogni misurazione al suo atleta: senza
-- lettura su giocatori la pagina si apre ma resta vuota.

SELECT
  p.polname AS policy_select_su_giocatori,
  pg_get_expr(p.polqual, p.polrelid) AS condizione
FROM pg_policy p
JOIN pg_class c ON c.oid = p.polrelid
WHERE c.relname = 'giocatori' AND p.polcmd = 'r'
ORDER BY p.polname;

-- ---------------------------------------------------------------------
-- 4. Verifica
-- ---------------------------------------------------------------------
SELECT
  c.relname AS tabella,
  p.polname AS policy
FROM pg_policy p
JOIN pg_class c ON c.oid = p.polrelid
WHERE p.polname LIKE '%_select_staff_abilitato'
ORDER BY c.relname;

-- Chi, di fatto, vedra' le misurazioni club per club.
SELECT club_id, tipo_profilo, can_view
FROM public.permessi_pagine_tipo_profilo
WHERE pagina_key = 'misurazioni'
  AND can_view
  AND lower(tipo_profilo::text) <> 'giocatore'
ORDER BY club_id, tipo_profilo;
