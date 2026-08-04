-- Preferenza a livello di club per la vista di creazione seduta:
-- "card" (una card per lavoro) oppure "tabella" (griglia stile foglio di
-- calcolo). Impostabile solo dall'admin, in Impostazioni club, e valida per
-- tutti gli utenti del club (non è più una scelta libera dentro il singolo
-- form di creazione).

ALTER TABLE public.club
  ADD COLUMN IF NOT EXISTS preferenza_vista_lavori text DEFAULT 'card';

ALTER TABLE public.club
  DROP CONSTRAINT IF EXISTS club_preferenza_vista_lavori_check;

ALTER TABLE public.club
  ADD CONSTRAINT club_preferenza_vista_lavori_check
  CHECK (preferenza_vista_lavori IN ('card', 'tabella'));
