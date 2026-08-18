-- =====================================================================
-- Perche' un utente non riesce a inviare l'RPE
-- =====================================================================
-- Da eseguire nel SQL editor di Supabase. Cambia l'email nella riga
-- sotto per controllare un altro utente. Non modifica niente: sono solo
-- SELECT. Le correzioni sono in fondo, commentate.
--
-- L'RPE passa da creaMisurazioneBenessereAction
-- (src/app/(dashboard)/misurazioni/actions.ts). Perche' funzioni devono
-- essere vere TUTTE queste condizioni:
--
--   1. l'utente esiste in auth.users ed e' collegato a una riga profili
--      (profili.auth_user_id);
--   2. profili.tipo_profilo = 'giocatore'  (gli altri ruoli, tranne
--      'admin' che compila per conto terzi, ricevono "Non hai i permessi
--      per registrare questo tipo di stato");
--   3. profili.last_club_id valorizzato ("Nessun club attivo selezionato");
--   4. esiste una riga giocatori con id_atleta = profili.id  E
--      club_id = profili.last_club_id  E (se last_squadra_id e'
--      valorizzato) squadra_id = profili.last_squadra_id
--      -> altrimenti "Il tuo profilo non e' collegato a un giocatore
--         della squadra attiva";
--   5. le policy RLS di misurazioni_benessere permettono l'INSERT.
--
-- Il punto 4 e' il sospetto numero uno: id_atleta si compila a mano
-- nella scheda giocatore e deve contenere l'UUID del profilo.
-- =====================================================================

-- ---------------------------------------------------------------------
-- 1. Profilo e utente Auth
-- ---------------------------------------------------------------------
WITH parametri AS (
  SELECT lower(trim('valzaluca10@gmail.com')) AS email
)
SELECT
  p.id                AS profilo_id,
  p.email,
  p.tipo_profilo,
  p.attivo            AS profilo_attivo,
  p.auth_user_id,
  p.last_club_id,
  p.last_squadra_id,
  u.id                AS auth_user_id_reale,
  u.email_confirmed_at,
  u.last_sign_in_at,
  u.banned_until
FROM parametri par
LEFT JOIN public.profili p ON lower(trim(p.email)) = par.email
LEFT JOIN auth.users   u ON lower(trim(u.email)) = par.email;

-- ---------------------------------------------------------------------
-- 2. Il collegamento profilo -> giocatore
-- ---------------------------------------------------------------------
-- La prima riga (corrispondenza_esatta = true) e' quella che cerca il
-- codice. Le altre servono a capire cosa e' andato storto: un
-- id_atleta con spazi o maiuscole diverse, oppure il giocatore
-- agganciato a un altro club/squadra.

WITH parametri AS (
  SELECT lower(trim('valzaluca10@gmail.com')) AS email
),
profilo AS (
  SELECT p.*
  FROM public.profili p, parametri par
  WHERE lower(trim(p.email)) = par.email
)
SELECT
  g.id                                   AS giocatore_id,
  g.nome,
  g.cognome,
  g.id_atleta,
  g.attivo                               AS giocatore_attivo,
  g.club_id                              AS giocatore_club_id,
  g.squadra_id                           AS giocatore_squadra_id,
  pr.id                                  AS profilo_id,
  pr.last_club_id,
  pr.last_squadra_id,
  (g.id_atleta::text = pr.id::text)      AS id_atleta_esatto,
  (lower(trim(g.id_atleta::text)) = lower(pr.id::text))
                                         AS id_atleta_a_meno_di_spazi,
  (g.club_id = pr.last_club_id)          AS club_coerente,
  (pr.last_squadra_id IS NULL OR g.squadra_id = pr.last_squadra_id)
                                         AS squadra_coerente
FROM profilo pr
LEFT JOIN public.giocatori g
  ON lower(trim(g.id_atleta::text)) = lower(pr.id::text)
  OR (
    lower(trim(g.nome || ' ' || g.cognome)) IN (
      SELECT lower(trim(pr2.nome || ' ' || pr2.cognome)) FROM profilo pr2
    )
  );

-- ---------------------------------------------------------------------
-- 3. VERDETTO
-- ---------------------------------------------------------------------
WITH parametri AS (
  SELECT lower(trim('valzaluca10@gmail.com')) AS email
),
profilo AS (
  SELECT p.* FROM public.profili p, parametri par
  WHERE lower(trim(p.email)) = par.email
),
utente AS (
  SELECT u.* FROM auth.users u, parametri par
  WHERE lower(trim(u.email)) = par.email
),
giocatore AS (
  SELECT g.*
  FROM public.giocatori g, profilo pr
  WHERE g.id_atleta::text = pr.id::text
    AND g.club_id = pr.last_club_id
    AND (pr.last_squadra_id IS NULL OR g.squadra_id = pr.last_squadra_id)
),
giocatore_lasco AS (
  SELECT g.*
  FROM public.giocatori g, profilo pr
  WHERE lower(trim(g.id_atleta::text)) = lower(pr.id::text)
)
SELECT CASE
  WHEN NOT EXISTS (SELECT 1 FROM profilo)
    THEN 'Nessun profilo con questa email: l''utente non e'' mai stato creato in Utenti e permessi.'
  WHEN NOT EXISTS (SELECT 1 FROM utente)
    THEN 'Profilo presente ma nessun utente in auth.users: non ha mai completato la registrazione, quindi non puo'' nemmeno accedere.'
  WHEN (SELECT auth_user_id FROM profilo) IS NULL
    THEN 'Profilo e utente Auth esistono ma non sono collegati (profili.auth_user_id e'' NULL): l''app non trova il profilo dopo il login.'
  WHEN (SELECT auth_user_id FROM profilo) <> (SELECT id FROM utente)
    THEN 'profili.auth_user_id punta a un utente Auth diverso da quello con questa email.'
  WHEN COALESCE((SELECT attivo FROM profilo), true) = false
    THEN 'Il profilo e'' disattivato.'
  WHEN lower((SELECT tipo_profilo::text FROM profilo)) NOT IN ('giocatore', 'admin')
    THEN 'Il tipo profilo e'' "' || (SELECT tipo_profilo::text FROM profilo) ||
         '": l''azione RPE accetta solo "giocatore" (e "admin" che compila per conto di un atleta). Messaggio atteso a schermo: "Non hai i permessi per registrare questo tipo di stato".'
  WHEN (SELECT last_club_id FROM profilo) IS NULL
    THEN 'Nessun club attivo (profili.last_club_id e'' NULL): deve selezionare un club, oppure va impostato a mano.'
  WHEN lower((SELECT tipo_profilo::text FROM profilo)) = 'admin'
    THEN 'Profilo admin: puo'' inviare l''RPE solo scegliendo esplicitamente un atleta nel modulo. Se il problema e'' che non vede il suo modulo personale, il tipo profilo dovrebbe essere "giocatore".'
  WHEN EXISTS (SELECT 1 FROM giocatore)
    THEN 'Tutti i controlli applicativi passano: il blocco non e'' nei dati del profilo. Guarda la sezione 4 (RLS su misurazioni_benessere) e l''errore esatto mostrato a schermo.'
  WHEN EXISTS (SELECT 1 FROM giocatore_lasco)
    THEN 'C''e'' un giocatore collegato, ma non combacia: '
         || CASE
              WHEN (SELECT g.id_atleta::text FROM giocatore_lasco g)
                   <> (SELECT id::text FROM profilo)
                THEN 'id_atleta ha spazi o maiuscole diverse dall''UUID del profilo. '
              ELSE ''
            END
         || CASE
              WHEN (SELECT g.club_id FROM giocatore_lasco g)
                   IS DISTINCT FROM (SELECT last_club_id FROM profilo)
                THEN 'il giocatore appartiene a un club diverso dal club attivo del profilo. '
              ELSE ''
            END
         || CASE
              WHEN (SELECT last_squadra_id FROM profilo) IS NOT NULL
               AND (SELECT g.squadra_id FROM giocatore_lasco g)
                   IS DISTINCT FROM (SELECT last_squadra_id FROM profilo)
                THEN 'il giocatore e'' in una squadra diversa dalla squadra attiva del profilo. '
              ELSE ''
            END
  ELSE 'Nessuna riga giocatori con id_atleta = ' || (SELECT id::text FROM profilo) ||
       '. E'' questo il motivo: apri la scheda del giocatore e scrivi quell''UUID nel campo "ID atleta".'
END AS verdetto;

-- ---------------------------------------------------------------------
-- 4. RLS su misurazioni_benessere
-- ---------------------------------------------------------------------
SELECT
  c.relname                              AS tabella,
  c.relrowsecurity                       AS rls_attiva,
  COALESCE(p.polname, '(nessuna policy)') AS policy,
  CASE p.polcmd
    WHEN 'r' THEN 'SELECT' WHEN 'a' THEN 'INSERT'
    WHEN 'w' THEN 'UPDATE' WHEN 'd' THEN 'DELETE'
    WHEN '*' THEN 'ALL'
  END                                    AS comando,
  pg_get_expr(p.polqual, p.polrelid)     AS using_expr,
  pg_get_expr(p.polwithcheck, p.polrelid) AS with_check_expr
FROM pg_class c
LEFT JOIN pg_policy p ON p.polrelid = c.oid
WHERE c.relname = 'misurazioni_benessere';

-- ---------------------------------------------------------------------
-- 5. Ha mai inviato qualcosa?
-- ---------------------------------------------------------------------
WITH parametri AS (
  SELECT lower(trim('valzaluca10@gmail.com')) AS email
),
profilo AS (
  SELECT p.* FROM public.profili p, parametri par
  WHERE lower(trim(p.email)) = par.email
)
SELECT
  b.data_compilazione,
  b.tipo_compilazione,
  b.seduta,
  b.rpe,
  b.created_at
FROM public.misurazioni_benessere b
JOIN public.giocatori g ON g.id = b.giocatore_id
JOIN profilo pr ON lower(trim(g.id_atleta::text)) = lower(pr.id::text)
ORDER BY b.created_at DESC
LIMIT 10;


-- =====================================================================
-- CORREZIONI (togli il commento solo a quella che serve)
-- =====================================================================

-- A. Manca il collegamento: scrivi l'UUID del profilo nell'ID atleta del
--    giocatore giusto. Sostituisci <GIOCATORE_ID> con l'id preso dalla
--    query 2.
--
-- UPDATE public.giocatori
-- SET id_atleta = (
--       SELECT p.id::text FROM public.profili p
--       WHERE lower(trim(p.email)) = 'valzaluca10@gmail.com'
--     ),
--     updated_at = now()
-- WHERE id = '<GIOCATORE_ID>';

-- B. id_atleta giusto ma con spazi/maiuscole: normalizzalo.
--
-- UPDATE public.giocatori g
-- SET id_atleta = p.id::text, updated_at = now()
-- FROM public.profili p
-- WHERE lower(trim(p.email)) = 'valzaluca10@gmail.com'
--   AND lower(trim(g.id_atleta::text)) = lower(p.id::text)
--   AND g.id_atleta::text <> p.id::text;

-- C. Tipo profilo sbagliato (deve essere giocatore).
--
-- UPDATE public.profili
-- SET tipo_profilo = 'giocatore'::public.tipo_profilo_enum
-- WHERE lower(trim(email)) = 'valzaluca10@gmail.com';

-- D. Club/squadra attivi non impostati: allineali al giocatore.
--
-- UPDATE public.profili p
-- SET last_club_id = g.club_id,
--     last_squadra_id = g.squadra_id
-- FROM public.giocatori g
-- WHERE lower(trim(p.email)) = 'valzaluca10@gmail.com'
--   AND lower(trim(g.id_atleta::text)) = lower(p.id::text);
