-- Protegge comunicazioni e relativi allegati direttamente nel database.
-- La UI continua a filtrare per comodita', ma la RLS impedisce che un utente
-- possa scaricare dal browser messaggi non destinati a lui.
-- Script idempotente: puo' essere rieseguito.

ALTER TABLE public.comunicazioni ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.comunicazioni_allegati ENABLE ROW LEVEL SECURITY;

-- Le policy PostgreSQL sono normalmente permissive (OR): una vecchia policy
-- "tutto il club" renderebbe inutile quella nuova. Rimuoviamo quindi tutte le
-- policy delle due tabelle e le sostituiamo con regole complete.
DO $$
DECLARE
  politica record;
BEGIN
  FOR politica IN
    SELECT policyname, tablename
    FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename IN ('comunicazioni', 'comunicazioni_allegati')
  LOOP
    EXECUTE format(
      'DROP POLICY IF EXISTS %I ON public.%I',
      politica.policyname,
      politica.tablename
    );
  END LOOP;
END $$;

DROP POLICY IF EXISTS comunicazioni_select_destinatari
  ON public.comunicazioni;
CREATE POLICY comunicazioni_select_destinatari
ON public.comunicazioni
FOR SELECT TO authenticated
USING (
  EXISTS (
    SELECT 1
    FROM public.profili AS profilo
    WHERE profilo.auth_user_id::text = auth.uid()::text
      AND profilo.last_club_id::text = comunicazioni.club_id::text
      AND (
        lower(profilo.tipo_profilo::text) = 'admin'

        -- to_jsonb rende la verifica compatibile sia con text[]/uuid[]
        -- sia con colonne json/jsonb presenti nei database storici.
        OR coalesce(to_jsonb(comunicazioni.destinatari_profili), '[]'::jsonb)
             ? profilo.id::text

        OR EXISTS (
          SELECT 1
          FROM public.giocatori AS giocatore
          WHERE giocatore.club_id::text = comunicazioni.club_id::text
            -- In alcuni database storici id_atleta e' text, mentre
            -- profili.id e' uuid: il confronto esplicito evita 42883.
            AND giocatore.id_atleta::text = profilo.id::text
            AND coalesce(
                  to_jsonb(comunicazioni.destinatari_giocatori),
                  '[]'::jsonb
                ) ? giocatore.id::text
        )

        OR coalesce(to_jsonb(comunicazioni.destinatari_tipo), '[]'::jsonb)
             ? 'Tutti'

        OR coalesce(to_jsonb(comunicazioni.destinatari_tipo), '[]'::jsonb)
             ? (CASE
            WHEN lower(profilo.tipo_profilo::text) = 'giocatore'
              THEN 'Giocatori'
            WHEN lower(profilo.tipo_profilo::text) = 'allenatore'
              THEN 'Allenatori'
            WHEN lower(profilo.tipo_profilo::text) = 'preparatore'
              THEN 'Preparatori'
            WHEN lower(profilo.tipo_profilo::text) = 'medico'
              THEN 'Medici'
            WHEN lower(profilo.tipo_profilo::text) = 'fisioterapista'
              THEN 'Fisioterapisti'
            WHEN lower(profilo.tipo_profilo::text) = 'accompagnatore'
              THEN 'Accompagnatori'
            WHEN lower(profilo.tipo_profilo::text) = 'utente_esterno'
              THEN 'Utenti esterni'
            ELSE '__nessuna_categoria__'
          END)
      )
  )
);

-- Gli allegati sono leggibili soltanto se la comunicazione padre e'
-- leggibile. La SELECT sulla tabella comunicazioni applica automaticamente
-- la policy appena creata.
DROP POLICY IF EXISTS comunicazioni_allegati_select_destinatari
  ON public.comunicazioni_allegati;
CREATE POLICY comunicazioni_allegati_select_destinatari
ON public.comunicazioni_allegati
FOR SELECT TO authenticated
USING (
  EXISTS (
    SELECT 1
    FROM public.comunicazioni AS comunicazione
    WHERE comunicazione.id::text =
          comunicazioni_allegati.comunicazione_id::text
      AND comunicazione.club_id::text =
          comunicazioni_allegati.club_id::text
  )
);

-- Se una precedente policy ALL e' stata rimossa, garantiamo esplicitamente
-- la gestione agli amministratori del club senza riaprire l'accesso agli
-- altri ruoli.
DROP POLICY IF EXISTS comunicazioni_insert_admin ON public.comunicazioni;
CREATE POLICY comunicazioni_insert_admin
ON public.comunicazioni FOR INSERT TO authenticated
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.profili AS profilo
    WHERE profilo.auth_user_id::text = auth.uid()::text
      AND profilo.last_club_id::text = comunicazioni.club_id::text
      AND lower(profilo.tipo_profilo::text) = 'admin'
  )
);

DROP POLICY IF EXISTS comunicazioni_update_admin ON public.comunicazioni;
CREATE POLICY comunicazioni_update_admin
ON public.comunicazioni FOR UPDATE TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.profili AS profilo
    WHERE profilo.auth_user_id::text = auth.uid()::text
      AND profilo.last_club_id::text = comunicazioni.club_id::text
      AND lower(profilo.tipo_profilo::text) = 'admin'
  )
)
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.profili AS profilo
    WHERE profilo.auth_user_id::text = auth.uid()::text
      AND profilo.last_club_id::text = comunicazioni.club_id::text
      AND lower(profilo.tipo_profilo::text) = 'admin'
  )
);

DROP POLICY IF EXISTS comunicazioni_delete_admin ON public.comunicazioni;
CREATE POLICY comunicazioni_delete_admin
ON public.comunicazioni FOR DELETE TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.profili AS profilo
    WHERE profilo.auth_user_id::text = auth.uid()::text
      AND profilo.last_club_id::text = comunicazioni.club_id::text
      AND lower(profilo.tipo_profilo::text) = 'admin'
  )
);

DROP POLICY IF EXISTS comunicazioni_allegati_insert_admin
  ON public.comunicazioni_allegati;
CREATE POLICY comunicazioni_allegati_insert_admin
ON public.comunicazioni_allegati FOR INSERT TO authenticated
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.profili AS profilo
    WHERE profilo.auth_user_id::text = auth.uid()::text
      AND profilo.last_club_id::text = comunicazioni_allegati.club_id::text
      AND lower(profilo.tipo_profilo::text) = 'admin'
  )
);

DROP POLICY IF EXISTS comunicazioni_allegati_update_admin
  ON public.comunicazioni_allegati;
CREATE POLICY comunicazioni_allegati_update_admin
ON public.comunicazioni_allegati FOR UPDATE TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.profili AS profilo
    WHERE profilo.auth_user_id::text = auth.uid()::text
      AND profilo.last_club_id::text = comunicazioni_allegati.club_id::text
      AND lower(profilo.tipo_profilo::text) = 'admin'
  )
)
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.profili AS profilo
    WHERE profilo.auth_user_id::text = auth.uid()::text
      AND profilo.last_club_id::text = comunicazioni_allegati.club_id::text
      AND lower(profilo.tipo_profilo::text) = 'admin'
  )
);

DROP POLICY IF EXISTS comunicazioni_allegati_delete_admin
  ON public.comunicazioni_allegati;
CREATE POLICY comunicazioni_allegati_delete_admin
ON public.comunicazioni_allegati FOR DELETE TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.profili AS profilo
    WHERE profilo.auth_user_id::text = auth.uid()::text
      AND profilo.last_club_id::text = comunicazioni_allegati.club_id::text
      AND lower(profilo.tipo_profilo::text) = 'admin'
  )
);

NOTIFY pgrst, 'reload schema';

SELECT tablename, policyname, cmd
FROM pg_policies
WHERE schemaname = 'public'
  AND tablename IN ('comunicazioni', 'comunicazioni_allegati')
ORDER BY tablename, cmd, policyname;
