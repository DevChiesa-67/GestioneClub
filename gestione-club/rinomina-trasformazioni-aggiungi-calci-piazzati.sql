-- =====================================================================
-- Statistiche partita: "Calci piazzati" diventa "Trasformazioni",
-- e nasce un nuovo "Calci piazzati" (totali / fatti)
-- =====================================================================
-- Le colonne calci_fatti / calci_subiti contenevano in realta' le
-- trasformazioni: vengono rinominate (RENAME COLUMN conserva i dati,
-- non li ricrea da zero). Al loro posto entrano due colonne nuove per i
-- calci piazzati veri e propri, riferiti alla nostra squadra.
--
-- Da eseguire nel SQL editor di Supabase (Dashboard -> SQL Editor).
-- E' sicuro rieseguirlo piu' volte: ogni passaggio controlla prima se
-- e' gia' stato fatto.
-- =====================================================================

-- ---------------------------------------------------------------------
-- 1. Rinomina (idempotente)
-- ---------------------------------------------------------------------
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'partite_statistiche'
      AND column_name = 'calci_fatti'
  ) THEN
    ALTER TABLE public.partite_statistiche
      RENAME COLUMN calci_fatti TO trasformazioni_fatte;
    RAISE NOTICE 'calci_fatti -> trasformazioni_fatte';
  ELSE
    RAISE NOTICE 'calci_fatti gia'' rinominata, salto';
  END IF;

  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'partite_statistiche'
      AND column_name = 'calci_subiti'
  ) THEN
    ALTER TABLE public.partite_statistiche
      RENAME COLUMN calci_subiti TO trasformazioni_subite;
    RAISE NOTICE 'calci_subiti -> trasformazioni_subite';
  ELSE
    RAISE NOTICE 'calci_subiti gia'' rinominata, salto';
  END IF;
END $$;

-- ---------------------------------------------------------------------
-- 2. Nuove colonne per i calci piazzati
-- ---------------------------------------------------------------------
-- Stesso stile delle altre statistiche: integer NOT NULL DEFAULT 0, cosi'
-- le partite gia' registrate partono da zero invece che da NULL e i
-- conteggi non devono gestire il caso "manca il dato".

ALTER TABLE public.partite_statistiche
  ADD COLUMN IF NOT EXISTS calci_piazzati_totali integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS calci_piazzati_fatti integer NOT NULL DEFAULT 0;

-- ---------------------------------------------------------------------
-- 3. Verifica
-- ---------------------------------------------------------------------
-- Attese: trasformazioni_fatte, trasformazioni_subite,
-- calci_piazzati_totali, calci_piazzati_fatti.
-- NON devono comparire calci_fatti / calci_subiti.

SELECT column_name, data_type, column_default, is_nullable
FROM information_schema.columns
WHERE table_schema = 'public'
  AND table_name = 'partite_statistiche'
  AND (column_name LIKE 'calci%' OR column_name LIKE 'trasformazioni%')
ORDER BY column_name;
