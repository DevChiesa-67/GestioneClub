-- Configura il bucket privato usato dalla sezione File e le relative policy RLS.
-- Il primo segmento di ogni percorso deve essere il club_id.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'file-video',
  'file-video',
  false,
  52428800,
  array['application/pdf', 'image/*', 'video/*']
)
on conflict (id) do update set
  public = excluded.public,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

drop policy if exists "file video club select" on storage.objects;
create policy "file video club select"
on storage.objects for select to authenticated
using (
  bucket_id = 'file-video'
  and exists (
    select 1
    from public.profili p
    where p.auth_user_id = auth.uid()
      and p.last_club_id::text = (storage.foldername(name))[1]
  )
);

drop policy if exists "file video admin insert" on storage.objects;
create policy "file video admin insert"
on storage.objects for insert to authenticated
with check (
  bucket_id = 'file-video'
  and exists (
    select 1
    from public.profili p
    where p.auth_user_id = auth.uid()
      and lower(p.tipo_profilo::text) = 'admin'
      and p.last_club_id::text = (storage.foldername(name))[1]
  )
);

drop policy if exists "file video admin update" on storage.objects;
create policy "file video admin update"
on storage.objects for update to authenticated
using (
  bucket_id = 'file-video'
  and exists (
    select 1
    from public.profili p
    where p.auth_user_id = auth.uid()
      and lower(p.tipo_profilo::text) = 'admin'
      and p.last_club_id::text = (storage.foldername(name))[1]
  )
)
with check (
  bucket_id = 'file-video'
  and exists (
    select 1
    from public.profili p
    where p.auth_user_id = auth.uid()
      and lower(p.tipo_profilo::text) = 'admin'
      and p.last_club_id::text = (storage.foldername(name))[1]
  )
);

drop policy if exists "file video admin delete" on storage.objects;
create policy "file video admin delete"
on storage.objects for delete to authenticated
using (
  bucket_id = 'file-video'
  and exists (
    select 1
    from public.profili p
    where p.auth_user_id = auth.uid()
      and lower(p.tipo_profilo::text) = 'admin'
      and p.last_club_id::text = (storage.foldername(name))[1]
  )
);

-- Policy della tabella metadati (separate dalle policy Storage).
alter table public.file_video enable row level security;

drop policy if exists "file video tabella club select" on public.file_video;
create policy "file video tabella club select"
on public.file_video for select to authenticated
using (
  exists (
    select 1 from public.profili p
    where p.auth_user_id = auth.uid()
      and p.last_club_id = file_video.club_id
  )
);

drop policy if exists "file video tabella admin insert" on public.file_video;
create policy "file video tabella admin insert"
on public.file_video for insert to authenticated
with check (
  exists (
    select 1 from public.profili p
    where p.auth_user_id = auth.uid()
      and lower(p.tipo_profilo::text) = 'admin'
      and p.last_club_id = file_video.club_id
  )
);

drop policy if exists "file video tabella admin update" on public.file_video;
create policy "file video tabella admin update"
on public.file_video for update to authenticated
using (
  exists (
    select 1 from public.profili p
    where p.auth_user_id = auth.uid()
      and lower(p.tipo_profilo::text) = 'admin'
      and p.last_club_id = file_video.club_id
  )
)
with check (
  exists (
    select 1 from public.profili p
    where p.auth_user_id = auth.uid()
      and lower(p.tipo_profilo::text) = 'admin'
      and p.last_club_id = file_video.club_id
  )
);

drop policy if exists "file video tabella admin delete" on public.file_video;
create policy "file video tabella admin delete"
on public.file_video for delete to authenticated
using (
  exists (
    select 1 from public.profili p
    where p.auth_user_id = auth.uid()
      and lower(p.tipo_profilo::text) = 'admin'
      and p.last_club_id = file_video.club_id
  )
);
