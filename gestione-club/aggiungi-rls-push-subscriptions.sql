-- Corregge le policy RLS di push_subscriptions.
--
-- Errore riprodotto dall'app:
--   "new row violates row-level security policy for table
--    push_subscriptions"
--
-- La tabella ha RLS attivo ma nessuna policy permette a un utente
-- autenticato di inserire/aggiornare la PROPRIA subscription tramite
-- src/app/api/push/subscribe/route.ts (che usa il client autenticato
-- normale, non quello service-role). Il collegamento corretto è:
--   push_subscriptions.profilo_id -> profili.id
--   profili.auth_user_id          -> auth.uid()
-- (profili.id NON coincide con auth.uid(): sono due colonne distinte)
--
-- Nota: le API che leggono/cancellano subscription per conto di TUTTI
-- i destinatari di una comunicazione (src/app/api/push/send/route.ts)
-- usano già il client service-role, che bypassa sempre RLS: queste
-- policy servono solo per il salvataggio fatto dal dispositivo stesso.
--
-- Da eseguire nel SQL editor di Supabase (Dashboard -> SQL Editor).

alter table public.push_subscriptions enable row level security;

drop policy if exists "push_subscriptions_select_own" on public.push_subscriptions;
drop policy if exists "push_subscriptions_insert_own" on public.push_subscriptions;
drop policy if exists "push_subscriptions_update_own" on public.push_subscriptions;
drop policy if exists "push_subscriptions_delete_own" on public.push_subscriptions;

create policy "push_subscriptions_select_own"
  on public.push_subscriptions
  for select
  using (
    profilo_id in (select id from public.profili where auth_user_id = auth.uid())
  );

create policy "push_subscriptions_insert_own"
  on public.push_subscriptions
  for insert
  with check (
    profilo_id in (select id from public.profili where auth_user_id = auth.uid())
  );

create policy "push_subscriptions_update_own"
  on public.push_subscriptions
  for update
  using (
    profilo_id in (select id from public.profili where auth_user_id = auth.uid())
  )
  with check (
    profilo_id in (select id from public.profili where auth_user_id = auth.uid())
  );

create policy "push_subscriptions_delete_own"
  on public.push_subscriptions
  for delete
  using (
    profilo_id in (select id from public.profili where auth_user_id = auth.uid())
  );
