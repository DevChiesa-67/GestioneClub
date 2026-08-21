-- Loghi delle squadre invisibili in produzione (in locale si vedono).
--
-- CAUSA
-- Il bucket "loghi-squadre" e' privato e le sue policy non permettono la
-- lettura agli utenti normali. Per questo getLogoSignedUrl()
-- (src/lib/services/dashboard.service.ts) genera lo signed URL con un
-- client service-role, che bypassa RLS. In locale la variabile
-- SUPABASE_SERVICE_ROLE_KEY e' presente in .env.local, in produzione no:
-- li' il codice ripiega sul client della sessione utente, la lettura
-- viene negata dalle policy e la funzione restituisce null, cioe'
-- nessun logo.
--
-- Questo script toglie del tutto la dipendenza dal service role per una
-- cosa che sensibile non e': il logo di una squadra e' gia' visibile a
-- chiunque veda la partita. Dopo averlo eseguito i loghi si vedono anche
-- senza la chiave service role configurata.
--
-- NON tocca le policy di scrittura: il caricamento di un logo resta
-- riservato agli admin, esattamente come adesso. Viene creata (o
-- ricreata) solo la policy di LETTURA, con un nome suo, quindi le altre
-- policy gia' presenti sul bucket restano dove sono.
--
-- Struttura dei path: "{club_id}/{uuid}.{estensione}", la stessa usata
-- da src/app/api/squadre-partite/crea/route.ts.

-- Il bucket dovrebbe gia' esistere (creato dal pannello Supabase):
-- questa INSERT serve solo a non far fallire lo script su un progetto
-- nuovo. Resta privato: la lettura passa comunque dagli signed URL.
INSERT INTO storage.buckets (id, name, public)
VALUES ('loghi-squadre', 'loghi-squadre', false)
ON CONFLICT (id) DO NOTHING;

-- Lettura: qualsiasi utente autenticato collegato allo stesso club a cui
-- appartiene la cartella. Stesso schema gia' usato per il bucket
-- "minutaggi-partite" in crea-tabelle-minutaggi-partite.sql.
DROP POLICY IF EXISTS loghi_squadre_storage_select ON storage.objects;
CREATE POLICY loghi_squadre_storage_select
  ON storage.objects
  FOR SELECT
  TO authenticated
  USING (
    bucket_id = 'loghi-squadre'
    AND (storage.foldername(name))[1] = (
      SELECT last_club_id::text
      FROM public.profili
      WHERE auth_user_id = auth.uid()
    )
  );

-- VERIFICA 1: le policy attive sul bucket dopo l'esecuzione.
-- Deve comparire loghi_squadre_storage_select con cmd = SELECT.
SELECT policyname, cmd, roles
FROM pg_policies
WHERE schemaname = 'storage'
  AND tablename = 'objects'
  AND (qual ILIKE '%loghi-squadre%' OR with_check ILIKE '%loghi-squadre%')
ORDER BY cmd, policyname;

-- VERIFICA 2: i loghi registrati sulle squadre e se il file esiste
-- davvero nel bucket. Una riga con file_presente = false significa che
-- il record punta a un file mai caricato o cancellato: in quel caso il
-- problema non e' di permessi ma di dato mancante.
SELECT
  s.nome AS squadra,
  s.logo_path,
  (o.id IS NOT NULL) AS file_presente
FROM public.squadre_partite s
LEFT JOIN storage.objects o
  ON o.bucket_id = 'loghi-squadre'
 AND o.name = s.logo_path
WHERE s.logo_path IS NOT NULL
ORDER BY s.nome;
