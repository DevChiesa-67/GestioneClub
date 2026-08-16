-- Eseguire nel SQL Editor di Supabase prima di pubblicare il nuovo form.
-- sRPE viene calcolato nell'app come RPE * minutaggio_lavoro.

alter table public.misurazioni_benessere
  add column if not exists minutaggio_lavoro integer;

alter table public.misurazioni_benessere
  drop constraint if exists misurazioni_benessere_minutaggio_lavoro_check;

alter table public.misurazioni_benessere
  add constraint misurazioni_benessere_minutaggio_lavoro_check
  check (
    minutaggio_lavoro is null
    or minutaggio_lavoro between 1 and 600
  );

comment on column public.misurazioni_benessere.minutaggio_lavoro is
  'Durata in minuti della seduta Campo/Palestra; sRPE = RPE * minutaggio_lavoro.';

notify pgrst, 'reload schema';
