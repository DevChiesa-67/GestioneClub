-- Bucket privato per PDF e immagini allegati alle valutazioni mediche.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'documenti-medici',
  'documenti-medici',
  false,
  10485760,
  array['application/pdf', 'image/jpeg', 'image/png', 'image/webp']
)
on conflict (id) do update set
  public = excluded.public,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

-- Il primo segmento del percorso è il club_id. Possono accedere soltanto
-- utenti autenticati che appartengono a quel club.
drop policy if exists "documenti medici club select" on storage.objects;
create policy "documenti medici club select"
on storage.objects for select to authenticated
using (
  bucket_id = 'documenti-medici'
  and exists (
    select 1 from public.profili p
    where p.auth_user_id = auth.uid()
      and p.last_club_id::text = (storage.foldername(name))[1]
  )
);

drop policy if exists "documenti medici admin insert" on storage.objects;
create policy "documenti medici admin insert"
on storage.objects for insert to authenticated
with check (
  bucket_id = 'documenti-medici'
  and exists (
    select 1 from public.profili p
    where p.auth_user_id = auth.uid()
      and lower(p.tipo_profilo::text) = 'admin'
      and p.last_club_id::text = (storage.foldername(name))[1]
  )
);

drop policy if exists "documenti medici admin delete" on storage.objects;
create policy "documenti medici admin delete"
on storage.objects for delete to authenticated
using (
  bucket_id = 'documenti-medici'
  and exists (
    select 1 from public.profili p
    where p.auth_user_id = auth.uid()
      and lower(p.tipo_profilo::text) = 'admin'
      and p.last_club_id::text = (storage.foldername(name))[1]
  )
);
