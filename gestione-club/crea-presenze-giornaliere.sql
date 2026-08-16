-- ============================================================
-- Presenze per GIORNATA invece che per SEDUTA
-- ============================================================
--
-- Problema che risolve:
-- oggi presenze_allenamenti ha una riga per (allenamento, giocatore).
-- Quando in un giorno ci sono due sedute (Seduta Mattutina + Seduta
-- Serale) lo stesso giocatore produce DUE righe, quindi tutti i conteggi
-- di presenze/assenze risultano raddoppiati. Inoltre gli stati
-- "presente_mattina" / "presente_pomeriggio" / "presente_entrambe" sono
-- gia' concettualmente giornalieri: descrivono la giornata, non la
-- singola seduta.
--
-- Soluzione: una riga per (giocatore, giornata) nella nuova tabella
-- presenze_giornaliere. Per sapere chi c'era a una seduta si guarda lo
-- stato della giornata (mattina / pomeriggio / entrambe).
--
-- presenze_allenamenti NON viene eliminata: resta come storico e
-- permette di tornare indietro. Eliminala solo quando avrai verificato
-- che i nuovi numeri tornano.
--
-- Da eseguire nel SQL editor di Supabase (Dashboard -> SQL Editor).
-- E' sicuro rieseguirlo piu' volte.

-- ------------------------------------------------------------
-- 1. Tabella
-- ------------------------------------------------------------

CREATE TABLE IF NOT EXISTS public.presenze_giornaliere (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  club_id uuid NOT NULL REFERENCES public.club(id) ON DELETE CASCADE,
  squadra_id uuid,
  giocatore_id uuid NOT NULL REFERENCES public.giocatori(id) ON DELETE CASCADE,
  data date NOT NULL,
  stato text NOT NULL,
  note text,
  registrato_da uuid REFERENCES auth.users(id),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  -- Una sola riga per giocatore al giorno: e' questo il vincolo che
  -- impedisce strutturalmente il doppio conteggio.
  UNIQUE (club_id, giocatore_id, data)
);

-- La colonna "stato" deve avere ESATTAMENTE lo stesso tipo di
-- presenze_allenamenti.stato (che nel tuo database potrebbe essere un
-- enum tipo stato_presenza_enum oppure un text con CHECK). Invece di
-- indovinarlo lo leggiamo dal catalogo e allineiamo la nuova colonna:
-- cosi' questo script funziona in entrambi i casi.
DO $$
DECLARE
  tipo_stato text;
BEGIN
  SELECT format_type(a.atttypid, a.atttypmod)
    INTO tipo_stato
  FROM pg_attribute a
  WHERE a.attrelid = 'public.presenze_allenamenti'::regclass
    AND a.attname = 'stato'
    AND NOT a.attisdropped;

  IF tipo_stato IS NULL THEN
    RAISE EXCEPTION
      'Colonna presenze_allenamenti.stato non trovata: verifica il nome della tabella di origine.';
  END IF;

  IF tipo_stato <> 'text' THEN
    EXECUTE format(
      'ALTER TABLE public.presenze_giornaliere ALTER COLUMN stato TYPE %s USING stato::text::%s',
      tipo_stato, tipo_stato
    );

    RAISE NOTICE 'presenze_giornaliere.stato allineata al tipo %', tipo_stato;
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_presenze_giornaliere_club_data
  ON public.presenze_giornaliere (club_id, data);

CREATE INDEX IF NOT EXISTS idx_presenze_giornaliere_giocatore_data
  ON public.presenze_giornaliere (giocatore_id, data);

CREATE INDEX IF NOT EXISTS idx_presenze_giornaliere_squadra
  ON public.presenze_giornaliere (squadra_id);

-- ------------------------------------------------------------
-- 2. Migrazione dei dati esistenti
-- ------------------------------------------------------------
--
-- Regola di collasso quando un giocatore ha piu' righe nello stesso
-- giorno (concordata: "la presenza vince"):
--
--   presente_entrambe                        -> Presente
--   presente_mattina + presente_pomeriggio   -> Presente
--   solo presente_mattina                    -> Presente mattina
--   solo presente_pomeriggio                 -> Presente pomeriggio
--   nessuna presenza, ma infortunato         -> Infortunato
--   nessuna presenza, ma ass. giustificata   -> Assenza giustificata
--   altrimenti                               -> Assenza ingiustificata
--
-- Nota: una presenza a una seduta batte sempre un'assenza all'altra,
-- perche' in quel giorno il giocatore si e' comunque allenato.

-- L'INSERT e' dinamico perche' lo stato va castato al tipo reale della
-- colonna: se e' un enum, Postgres non accetta un'espressione text senza
-- cast esplicito, e il tipo lo scopriamo solo a runtime.
DO $$
DECLARE
  tipo_stato text;
  righe_inserite bigint;
BEGIN
  SELECT format_type(a.atttypid, a.atttypmod)
    INTO tipo_stato
  FROM pg_attribute a
  WHERE a.attrelid = 'public.presenze_giornaliere'::regclass
    AND a.attname = 'stato'
    AND NOT a.attisdropped;

  EXECUTE format($sql$
    INSERT INTO public.presenze_giornaliere (
      club_id, squadra_id, giocatore_id, data, stato, registrato_da
    )
    SELECT
      g.club_id,
      g.squadra_id,
      g.giocatore_id,
      g.data,
      (
        CASE
          WHEN g.ha_entrambe OR (g.ha_mattina AND g.ha_pomeriggio)
            THEN 'presente_entrambe'
          WHEN g.ha_mattina      THEN 'presente_mattina'
          WHEN g.ha_pomeriggio   THEN 'presente_pomeriggio'
          WHEN g.ha_infortunato  THEN 'infortunato'
          WHEN g.ha_giustificata THEN 'assenza_giustificata'
          ELSE 'assenza_ingiustificata'
        END
      )::%1$s,
      g.registrato_da
    FROM (
      SELECT
        p.club_id,
        (array_agg(p.squadra_id    ORDER BY p.id))[1]   AS squadra_id,
        p.giocatore_id,
        a.data_allenamento                              AS data,
        bool_or(p.stato::text = 'presente_entrambe')    AS ha_entrambe,
        bool_or(p.stato::text = 'presente_mattina')     AS ha_mattina,
        bool_or(p.stato::text = 'presente_pomeriggio')  AS ha_pomeriggio,
        bool_or(p.stato::text = 'infortunato')          AS ha_infortunato,
        bool_or(p.stato::text = 'assenza_giustificata') AS ha_giustificata,
        (array_agg(p.registrato_da ORDER BY p.id))[1]   AS registrato_da
      FROM public.presenze_allenamenti p
      JOIN public.allenamenti a ON a.id = p.allenamento_id
      GROUP BY p.club_id, p.giocatore_id, a.data_allenamento
    ) AS g
    ON CONFLICT (club_id, giocatore_id, data) DO NOTHING
  $sql$, tipo_stato);

  GET DIAGNOSTICS righe_inserite = ROW_COUNT;

  RAISE NOTICE 'presenze_giornaliere: % righe migrate', righe_inserite;
END $$;

-- ------------------------------------------------------------
-- 3. RLS
-- ------------------------------------------------------------
-- Lettura: chiunque sia collegato al club (serve ai giocatori per
-- vedere le proprie statistiche). Scrittura: solo admin, coerente con
-- il gate isAdmin gia' presente nella pagina Allenamenti. Se in futuro
-- vorrai far registrare le presenze anche ad allenatore/preparatore,
-- basta allargare la condizione sul tipo_profilo qui sotto.

ALTER TABLE public.presenze_giornaliere ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS presenze_giornaliere_select ON public.presenze_giornaliere;
CREATE POLICY presenze_giornaliere_select
  ON public.presenze_giornaliere
  FOR SELECT
  USING (
    club_id = (
      SELECT last_club_id FROM public.profili WHERE auth_user_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS presenze_giornaliere_insert ON public.presenze_giornaliere;
CREATE POLICY presenze_giornaliere_insert
  ON public.presenze_giornaliere
  FOR INSERT
  WITH CHECK (
    club_id = (
      SELECT last_club_id FROM public.profili WHERE auth_user_id = auth.uid()
    )
    AND (
      SELECT tipo_profilo::text FROM public.profili WHERE auth_user_id = auth.uid()
    ) = 'admin'
  );

DROP POLICY IF EXISTS presenze_giornaliere_update ON public.presenze_giornaliere;
CREATE POLICY presenze_giornaliere_update
  ON public.presenze_giornaliere
  FOR UPDATE
  USING (
    club_id = (
      SELECT last_club_id FROM public.profili WHERE auth_user_id = auth.uid()
    )
    AND (
      SELECT tipo_profilo::text FROM public.profili WHERE auth_user_id = auth.uid()
    ) = 'admin'
  );

DROP POLICY IF EXISTS presenze_giornaliere_delete ON public.presenze_giornaliere;
CREATE POLICY presenze_giornaliere_delete
  ON public.presenze_giornaliere
  FOR DELETE
  USING (
    club_id = (
      SELECT last_club_id FROM public.profili WHERE auth_user_id = auth.uid()
    )
    AND (
      SELECT tipo_profilo::text FROM public.profili WHERE auth_user_id = auth.uid()
    ) = 'admin'
  );

-- ------------------------------------------------------------
-- 4. Verifica: quanto pesava il doppio conteggio
-- ------------------------------------------------------------
-- "righe_vecchie" e' quello che il gestionale conta oggi,
-- "righe_nuove" quello che contera' dopo. La differenza sono le
-- giornate con piu' di una seduta.

SELECT
  (SELECT count(*) FROM public.presenze_allenamenti)  AS righe_vecchie_per_seduta,
  (SELECT count(*) FROM public.presenze_giornaliere)  AS righe_nuove_per_giornata,
  (SELECT count(*) FROM public.presenze_allenamenti)
    - (SELECT count(*) FROM public.presenze_giornaliere) AS righe_duplicate_rimosse;

-- Dettaglio delle giornate che avevano piu' sedute (le piu' a rischio
-- di numeri gonfiati prima della migrazione):
SELECT
  a.data_allenamento,
  count(DISTINCT a.id)  AS sedute_nel_giorno,
  count(*)              AS righe_presenza_vecchie
FROM public.presenze_allenamenti p
JOIN public.allenamenti a ON a.id = p.allenamento_id
GROUP BY a.data_allenamento
HAVING count(DISTINCT a.id) > 1
ORDER BY a.data_allenamento DESC
LIMIT 30;
