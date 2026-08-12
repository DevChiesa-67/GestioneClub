-- Rende visibile la nuova pagina "Calendario" (/calendario) a TUTTI i
-- tipi profilo di TUTTI i club.
--
-- L'admin vede sempre tutte le pagine (vedi use-page-permissions.ts), ma
-- gli altri ruoli sono filtrati da permessi_pagine_tipo_profilo: senza
-- questa riga con can_view = true la voce non comparirebbe nella sidebar
-- né nel menu mobile.
--
-- Da eseguire nel SQL editor di Supabase (Dashboard -> SQL Editor).
-- È sicuro rieseguirlo più volte.

INSERT INTO public.permessi_pagine_tipo_profilo (
  club_id,
  tipo_profilo,
  pagina_key,
  can_view,
  updated_at
)
SELECT
  c.id,
  t.tipo_profilo,
  'calendario',
  true,
  now()
FROM public.club AS c
CROSS JOIN (
  SELECT unnest(enum_range(NULL::public.tipo_profilo_enum)) AS tipo_profilo
) AS t
ON CONFLICT (club_id, tipo_profilo, pagina_key)
DO UPDATE SET
  can_view = true,
  updated_at = now();

-- Verifica: deve comparire una riga per ogni club/tipo profilo.
SELECT
  club_id,
  tipo_profilo,
  pagina_key,
  can_view
FROM public.permessi_pagine_tipo_profilo
WHERE pagina_key = 'calendario'
ORDER BY club_id, tipo_profilo;
