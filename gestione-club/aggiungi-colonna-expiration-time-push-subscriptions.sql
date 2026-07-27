-- Allinea lo schema della tabella push_subscriptions a tutte le
-- colonne che il codice dell'app si aspetta di poter leggere/scrivere
-- (src/app/api/push/subscribe/route.ts e src/app/api/push/send/route.ts).
--
-- La tabella era stata creata a mano su Supabase senza tenerla
-- sincronizzata col codice: ogni colonna mancante fa fallire l'intero
-- upsert della subscription con un errore PostgREST del tipo
--   "Could not find the '<colonna>' column of 'push_subscriptions'
--    in the schema cache"
-- e nessun dispositivo risulta mai registrato per le notifiche push.
-- Finora sono emerse così, una alla volta, 'expiration_time' e poi
-- 'squadra_id': questo script aggiunge in un colpo solo tutte le
-- colonne referenziate dal codice, per evitare ulteriori giri.
--
-- Da eseguire nel SQL editor di Supabase (Dashboard -> SQL Editor).

alter table public.push_subscriptions
  add column if not exists profilo_id uuid,
  add column if not exists club_id uuid,
  add column if not exists squadra_id uuid,
  add column if not exists endpoint text,
  add column if not exists p256dh text,
  add column if not exists auth text,
  add column if not exists expiration_time bigint,
  add column if not exists user_agent text,
  add column if not exists created_at timestamptz default now(),
  add column if not exists updated_at timestamptz default now();

-- Necessario perché l'upsert del codice usa
-- .upsert(..., { onConflict: "profilo_id,endpoint" }):
-- senza un vincolo di unicità esatto su queste due colonne,
-- Postgres rifiuta l'ON CONFLICT con un altro errore.
create unique index if not exists push_subscriptions_profilo_endpoint_key
  on public.push_subscriptions (profilo_id, endpoint);
