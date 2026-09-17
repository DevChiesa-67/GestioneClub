-- Allegati delle comunicazioni.
--
-- I file NON hanno un bucket nuovo: riusano "file-video", gia' privato,
-- con il limite di 50 MB e le policy che si aspettano il club_id come
-- primo segmento del percorso (vedi correggi-rls-file-video.sql). Un
-- bucket in piu' avrebbe voluto dire duplicare quelle quattro policy per
-- ottenere esattamente lo stesso comportamento.
--
-- Qui serve solo la tabella dei metadati: quale file appartiene a quale
-- comunicazione, con nome originale, tipo e dimensione.

create table if not exists public.comunicazioni_allegati (
  id uuid primary key default gen_random_uuid(),
  comunicazione_id uuid not null
    references public.comunicazioni(id) on delete cascade,
  club_id uuid not null references public.club(id) on delete cascade,
  -- Il nome scelto dall'utente: nello storage il file e' un uuid, quindi
  -- se non lo salviamo qui va perso per sempre.
  nome text not null,
  -- Percorso dentro il bucket file-video: <club_id>/<...>/<uuid>.<ext>
  path text not null,
  mime_type text,
  dimensione bigint,
  created_at timestamptz not null default now(),
  created_by uuid references public.profili(id) on delete set null
);

create index if not exists idx_comunicazioni_allegati_comunicazione
  on public.comunicazioni_allegati (comunicazione_id);

create index if not exists idx_comunicazioni_allegati_club
  on public.comunicazioni_allegati (club_id);

alter table public.comunicazioni_allegati enable row level security;

-- Lettura: chiunque appartenga al club. La visibilita' della singola
-- comunicazione e' gia' filtrata lato applicazione
-- (comunicazioneVisibilePerProfilo), come per la comunicazione stessa.
drop policy if exists "allegati comunicazioni club select"
  on public.comunicazioni_allegati;
create policy "allegati comunicazioni club select"
on public.comunicazioni_allegati for select to authenticated
using (
  exists (
    select 1 from public.profili p
    where p.auth_user_id = auth.uid()
      and p.last_club_id = comunicazioni_allegati.club_id
  )
);

drop policy if exists "allegati comunicazioni admin insert"
  on public.comunicazioni_allegati;
create policy "allegati comunicazioni admin insert"
on public.comunicazioni_allegati for insert to authenticated
with check (
  exists (
    select 1 from public.profili p
    where p.auth_user_id = auth.uid()
      and lower(p.tipo_profilo::text) = 'admin'
      and p.last_club_id = comunicazioni_allegati.club_id
  )
);

drop policy if exists "allegati comunicazioni admin update"
  on public.comunicazioni_allegati;
create policy "allegati comunicazioni admin update"
on public.comunicazioni_allegati for update to authenticated
using (
  exists (
    select 1 from public.profili p
    where p.auth_user_id = auth.uid()
      and lower(p.tipo_profilo::text) = 'admin'
      and p.last_club_id = comunicazioni_allegati.club_id
  )
)
with check (
  exists (
    select 1 from public.profili p
    where p.auth_user_id = auth.uid()
      and lower(p.tipo_profilo::text) = 'admin'
      and p.last_club_id = comunicazioni_allegati.club_id
  )
);

drop policy if exists "allegati comunicazioni admin delete"
  on public.comunicazioni_allegati;
create policy "allegati comunicazioni admin delete"
on public.comunicazioni_allegati for delete to authenticated
using (
  exists (
    select 1 from public.profili p
    where p.auth_user_id = auth.uid()
      and lower(p.tipo_profilo::text) = 'admin'
      and p.last_club_id = comunicazioni_allegati.club_id
  )
);

-- Verifica
select column_name, data_type, is_nullable
from information_schema.columns
where table_schema = 'public' and table_name = 'comunicazioni_allegati'
order by ordinal_position;

select polname
from pg_policy
where polrelid = 'public.comunicazioni_allegati'::regclass;
