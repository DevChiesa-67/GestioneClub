-- Aggiunge alla tabella lavori_allenamento i campi necessari per gestire
-- i "lavori in contemporanea": più lavori (fatti da gruppi diversi della
-- stessa squadra) che condividono sezione, tempo di lavoro, ripetizioni,
-- tempo di recupero e tempo totale, ma hanno descrizione/obiettivo/tag/
-- rango/immagine propri. Sicuro da rieseguire più volte.

ALTER TABLE public.lavori_allenamento
  ADD COLUMN IF NOT EXISTS contemporaneo boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS gruppo_contemporaneo text;

-- Indice per velocizzare il recupero dei lavori appartenenti allo stesso
-- gruppo di contemporaneità.
CREATE INDEX IF NOT EXISTS idx_lavori_allenamento_gruppo_contemporaneo
  ON public.lavori_allenamento (gruppo_contemporaneo)
  WHERE gruppo_contemporaneo IS NOT NULL;
