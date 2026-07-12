-- La tabella permessi_pagine_tipo_profilo era una duplicazione: le pagine
-- visibili sono già gestite dentro permessi_tipo_profilo (colonna
-- pagina_key, con tabella NULL). Il codice ora scrive e legge solo da
-- permessi_tipo_profilo, quindi questa tabella non è più referenziata
-- da nessun file dell'applicazione e può essere rimossa.

DROP TABLE IF EXISTS public.permessi_pagine_tipo_profilo;
