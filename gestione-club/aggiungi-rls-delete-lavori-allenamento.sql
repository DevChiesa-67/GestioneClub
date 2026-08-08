-- Assicura che i membri del club possano cancellare e aggiornare i lavori
-- delle sedute del proprio club. Serve per l'import da Excel: quando si
-- reimporta la stessa seduta, l'app cancella i lavori vecchi e ne inserisce
-- di nuovi al posto di sommarli. Se manca il permesso di DELETE, Supabase
-- non segnala errore ma non cancella nulla (le RLS filtrano la query in
-- silenzio) e i lavori vecchi restano duplicati insieme ai nuovi ad ogni
-- reimport.
--
-- Usa lo stesso pattern last_club_id (scalare) già impiegato con successo
-- per allenamenti/lavori_allenamento nel resto dell'app, non l'array
-- profili.club_id (rivelatosi non corrispondente allo schema reale: vedi
-- correggi-rls-drill-bank.sql).
--
-- Da eseguire nel SQL editor di Supabase (Dashboard -> SQL Editor).

DROP POLICY IF EXISTS lavori_allenamento_delete ON public.lavori_allenamento;
CREATE POLICY lavori_allenamento_delete
  ON public.lavori_allenamento
  FOR DELETE
  USING (
    allenamento_id IN (
      SELECT id FROM public.allenamenti
      WHERE club_id = (
        SELECT last_club_id FROM public.profili WHERE auth_user_id = auth.uid()
      )
    )
  );

DROP POLICY IF EXISTS lavori_allenamento_update ON public.lavori_allenamento;
CREATE POLICY lavori_allenamento_update
  ON public.lavori_allenamento
  FOR UPDATE
  USING (
    allenamento_id IN (
      SELECT id FROM public.allenamenti
      WHERE club_id = (
        SELECT last_club_id FROM public.profili WHERE auth_user_id = auth.uid()
      )
    )
  );

-- Verifica: ti aspetti due righe, "lavori_allenamento_delete" e
-- "lavori_allenamento_update".
SELECT polname, polcmd
FROM pg_policy
WHERE polrelid = 'public.lavori_allenamento'::regclass;
