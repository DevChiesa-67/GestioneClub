-- ============================================================
-- Rimuove le assenze ingiustificate sulle sedute non ancora avvenute
-- ============================================================
--
-- Il vecchio comportamento segnava l'intera rosa come "assenza
-- ingiustificata" al momento della creazione della seduta. Quelle righe
-- sono state portate dentro presenze_giornaliere dalla migrazione, e per
-- gli allenamenti ancora da svolgere sono semplicemente sbagliate:
-- nessuno puo' essere assente a una seduta di domani.
--
-- Da qui in avanti il problema non si ripresenta: il codice non
-- pre-inserisce piu' nulla e deduce le assenze solo per le giornate gia'
-- concluse (vedi giornataConclusa in src/lib/presenze/presenze-giornaliere.ts).
-- Questo script serve solo a ripulire lo storico.
--
-- Da eseguire nel SQL editor di Supabase (Dashboard -> SQL Editor).
-- E' sicuro rieseguirlo piu' volte.

-- ------------------------------------------------------------
-- 1. Anteprima: cosa verra' cancellato
-- ------------------------------------------------------------

SELECT
  pg.data,
  count(*) AS assenze_da_rimuovere
FROM public.presenze_giornaliere pg
WHERE pg.stato::text = 'assenza_ingiustificata'
  AND pg.data > CURRENT_DATE
GROUP BY pg.data
ORDER BY pg.data;

-- ------------------------------------------------------------
-- 2. Cancellazione
-- ------------------------------------------------------------
--
-- Si limita alle date STRETTAMENTE future. Il giorno corrente e' escluso
-- di proposito: CURRENT_DATE e LOCALTIME su Supabase sono in UTC, mentre
-- gli orari delle sedute sono pensati in ora italiana, e con due ore di
-- scarto si rischierebbe di cancellare assenze legittime registrate oggi.
-- Per la giornata di oggi ci pensa gia' il codice, che non deduce assenze
-- finche' almeno una seduta non e' iniziata.

DO $$
DECLARE
  rimosse bigint;
BEGIN
  DELETE FROM public.presenze_giornaliere
  WHERE stato::text = 'assenza_ingiustificata'
    AND data > CURRENT_DATE;

  GET DIAGNOSTICS rimosse = ROW_COUNT;

  RAISE NOTICE 'Assenze ingiustificate rimosse da sedute future: %', rimosse;
END $$;

-- ------------------------------------------------------------
-- 3. Verifica: non deve restare nulla
-- ------------------------------------------------------------

SELECT count(*) AS assenze_future_residue
FROM public.presenze_giornaliere
WHERE stato::text = 'assenza_ingiustificata'
  AND data > CURRENT_DATE;

-- Le presenze VERE su date future (un giocatore gia' segnato presente per
-- un allenamento programmato, o un'assenza giustificata comunicata in
-- anticipo) restano intatte: qui si tocca solo l'assenza ingiustificata.
SELECT
  stato,
  count(*) AS righe_future_conservate
FROM public.presenze_giornaliere
WHERE data > CURRENT_DATE
GROUP BY stato
ORDER BY stato;
