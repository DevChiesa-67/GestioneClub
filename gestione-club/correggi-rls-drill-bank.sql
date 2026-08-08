-- Le policy originali di drill_bank (crea-tabella-drill-bank.sql) usano
--   club_id IN (SELECT unnest(club_id) FROM public.profili WHERE auth_user_id = auth.uid())
-- cioè un campo array "club_id" su profili. Nel resto dell'app il club
-- attivo dell'utente è invece lo scalare "profili.last_club_id" (usato ad
-- es. per allenamenti/lavori_allenamento, che infatti funzionano): la
-- policy sull'array non trova corrispondenza e blocca l'insert con:
--   new row violates row-level security policy for table "drill_bank"
--
-- Le riallineiamo allo stesso pattern last_club_id già usato altrove.
--
-- Da eseguire nel SQL editor di Supabase (Dashboard -> SQL Editor).

DROP POLICY IF EXISTS drill_bank_select ON public.drill_bank;
CREATE POLICY drill_bank_select
  ON public.drill_bank
  FOR SELECT
  USING (
    club_id = (
      SELECT last_club_id FROM public.profili WHERE auth_user_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS drill_bank_insert ON public.drill_bank;
CREATE POLICY drill_bank_insert
  ON public.drill_bank
  FOR INSERT
  WITH CHECK (
    club_id = (
      SELECT last_club_id FROM public.profili WHERE auth_user_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS drill_bank_update ON public.drill_bank;
CREATE POLICY drill_bank_update
  ON public.drill_bank
  FOR UPDATE
  USING (
    club_id = (
      SELECT last_club_id FROM public.profili WHERE auth_user_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS drill_bank_delete ON public.drill_bank;
CREATE POLICY drill_bank_delete
  ON public.drill_bank
  FOR DELETE
  USING (
    club_id = (
      SELECT last_club_id FROM public.profili WHERE auth_user_id = auth.uid()
    )
  );

-- Verifica: ti aspetti 4 righe (select/insert/update/delete).
SELECT polname, polcmd
FROM pg_policy
WHERE polrelid = 'public.drill_bank'::regclass;
