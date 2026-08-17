-- Aggiunge i totali alle statistiche di touche e mischia.
-- Eseguire nel SQL Editor di Supabase prima di usare i nuovi campi.

alter table public.partite_statistiche
  add column if not exists touche_totali integer not null default 0,
  add column if not exists mischie_totali integer not null default 0;

alter table public.partite_statistiche
  drop constraint if exists partite_statistiche_touche_totali_check,
  drop constraint if exists partite_statistiche_mischie_totali_check;

alter table public.partite_statistiche
  add constraint partite_statistiche_touche_totali_check
    check (touche_totali >= 0),
  add constraint partite_statistiche_mischie_totali_check
    check (mischie_totali >= 0);

notify pgrst, 'reload schema';
