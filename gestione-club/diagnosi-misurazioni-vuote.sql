-- =====================================================================
-- La pagina Misurazioni si apre ma e' vuota: perche'?
-- =====================================================================
-- Cambia l'email nella riga sotto con quella del preparatore. Sono solo
-- SELECT, non modifica niente.
--
-- misurazioni/page.tsx applica DUE filtri indipendenti:
--
--   1. RLS  -> misurazioni_antropometriche e giocatori passano dal
--      client dell'utente, quindi le policy decidono cosa vede.
--   2. SQUADRA -> se profili.last_squadra_id e' valorizzato, tutte e tre
--      le query aggiungono .eq("squadra_id", last_squadra_id). Questo
--      filtro NON dipende dalla RLS.
--
-- Discriminante utile: misurazioni_benessere viene letta con il client
-- service-role (supabaseAdmin), che scavalca la RLS. Quindi:
--
--   * benessere vuoto E antropometria vuota -> il problema e' il filtro
--     SQUADRA (o non ci sono proprio dati per quel club);
--   * benessere pieno e antropometria vuota -> il problema e' la RLS
--     su misurazioni_antropometriche.
-- =====================================================================

-- ---------------------------------------------------------------------
-- 1. Il profilo: club e squadra attivi
-- ---------------------------------------------------------------------
SELECT
  p.id            AS profilo_id,
  p.email,
  p.tipo_profilo,
  p.last_club_id,
  p.last_squadra_id,
  CASE
    WHEN p.last_squadra_id IS NULL
      THEN 'nessun filtro squadra: vede tutto il club'
    ELSE 'filtro squadra attivo'
  END AS effetto_filtro_squadra
FROM public.profili p
WHERE lower(trim(p.email)) = lower(trim('EMAIL_DEL_PREPARATORE'));

-- ---------------------------------------------------------------------
-- 2. Quante righe ci sono, e con quale squadra_id
-- ---------------------------------------------------------------------
-- Se le righe hanno squadra_id NULL (o una squadra diversa da quella
-- attiva sul profilo) il filtro le taglia fuori tutte, RLS o non RLS.

WITH profilo AS (
  SELECT * FROM public.profili
  WHERE lower(trim(email)) = lower(trim('EMAIL_DEL_PREPARATORE'))
)
SELECT
  'misurazioni_antropometriche' AS tabella,
  m.squadra_id,
  count(*) AS righe,
  bool_or(m.squadra_id IS NOT DISTINCT FROM pr.last_squadra_id)
    AS passa_il_filtro_squadra
FROM public.misurazioni_antropometriche m
CROSS JOIN profilo pr
WHERE m.club_id = pr.last_club_id
GROUP BY m.squadra_id, pr.last_squadra_id

UNION ALL

SELECT
  'misurazioni_benessere',
  b.squadra_id,
  count(*),
  bool_or(b.squadra_id IS NOT DISTINCT FROM pr.last_squadra_id)
FROM public.misurazioni_benessere b
CROSS JOIN profilo pr
WHERE b.club_id = pr.last_club_id
GROUP BY b.squadra_id, pr.last_squadra_id

UNION ALL

SELECT
  'giocatori (attivi)',
  g.squadra_id,
  count(*),
  bool_or(g.squadra_id IS NOT DISTINCT FROM pr.last_squadra_id)
FROM public.giocatori g
CROSS JOIN profilo pr
WHERE g.club_id = pr.last_club_id AND g.attivo
GROUP BY g.squadra_id, pr.last_squadra_id

ORDER BY 1, 3 DESC;

-- ---------------------------------------------------------------------
-- 3. Il ruolo passa la policy che ho creato?
-- ---------------------------------------------------------------------
-- Riproduce la condizione della policy *_select_staff_abilitato senza
-- bisogno di autenticarsi: se torna false, la lettura e' bloccata li'.

WITH profilo AS (
  SELECT * FROM public.profili
  WHERE lower(trim(email)) = lower(trim('EMAIL_DEL_PREPARATORE'))
)
SELECT
  pr.tipo_profilo,
  EXISTS (
    SELECT 1
    FROM public.permessi_pagine_tipo_profilo pp
    WHERE pp.club_id = pr.last_club_id
      AND lower(pp.tipo_profilo::text) = lower(pr.tipo_profilo::text)
      AND pp.pagina_key = 'misurazioni'
      AND pp.can_view
  ) AS passa_la_policy,
  EXISTS (
    SELECT 1 FROM pg_policy po
    JOIN pg_class c ON c.oid = po.polrelid
    WHERE c.relname = 'misurazioni_antropometriche'
      AND po.polname = 'misurazioni_antropometriche_select_staff_abilitato'
  ) AS policy_creata
FROM profilo pr;

-- ---------------------------------------------------------------------
-- 4. La rosa: senza lettura su giocatori la pagina resta spoglia
-- ---------------------------------------------------------------------
-- misurazioni_antropometriche fa una join annidata su giocatori: se la
-- RLS di giocatori non lascia passare il preparatore, i nomi arrivano
-- nulli e la tabella sembra vuota anche con le misurazioni leggibili.

SELECT
  c.relrowsecurity AS rls_attiva_su_giocatori,
  po.polname       AS policy,
  pg_get_expr(po.polqual, po.polrelid) AS condizione
FROM pg_class c
LEFT JOIN pg_policy po ON po.polrelid = c.oid AND po.polcmd = 'r'
WHERE c.relname = 'giocatori'
ORDER BY po.polname;

-- ---------------------------------------------------------------------
-- 5. Le policy attualmente sulle due tabelle
-- ---------------------------------------------------------------------
SELECT
  c.relname AS tabella,
  c.relrowsecurity AS rls_attiva,
  po.polname AS policy,
  pg_get_expr(po.polqual, po.polrelid) AS condizione
FROM pg_class c
LEFT JOIN pg_policy po ON po.polrelid = c.oid AND po.polcmd = 'r'
WHERE c.relname IN ('misurazioni_antropometriche', 'misurazioni_benessere')
ORDER BY c.relname, po.polname;


-- =====================================================================
-- SE LA CAUSA E' IL FILTRO SQUADRA
-- =====================================================================
-- Due strade, a seconda di cosa mostra la query 2.
--
-- A. Le righe hanno squadra_id NULL (storico importato prima che il
--    campo esistesse). Si riempie dalla squadra del giocatore:
--
-- UPDATE public.misurazioni_antropometriche m
-- SET squadra_id = g.squadra_id
-- FROM public.giocatori g
-- WHERE m.giocatore_id = g.id AND m.squadra_id IS NULL;
--
-- UPDATE public.misurazioni_benessere b
-- SET squadra_id = g.squadra_id
-- FROM public.giocatori g
-- WHERE b.giocatore_id = g.id AND b.squadra_id IS NULL;
--
-- B. Il preparatore ha semplicemente la squadra sbagliata come attiva:
--    gli basta cambiarla dal selettore in alto nel gestionale, oppure
--
-- UPDATE public.profili
-- SET last_squadra_id = '<ID_SQUADRA_GIUSTA>'
-- WHERE lower(trim(email)) = lower(trim('EMAIL_DEL_PREPARATORE'));
