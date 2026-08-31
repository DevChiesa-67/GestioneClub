-- Alza il limite di dimensione per singolo file del bucket "file-video".
--
-- QUANDO SERVE
-- Il caricamento dei video dalla pagina File ora avviene direttamente dal
-- browser a Supabase Storage (non passa piu' da Vercel, che rifiutava
-- qualsiasi richiesta oltre ~4,5 MB). L'unico tetto rimasto e' quello del
-- bucket: 50 MB, impostato in correggi-rls-file-video.sql.
--
-- PRIMA DI LANCIARLO
-- 1. Il piano Supabase Free ha un limite GLOBALE di 50 MB per file: su Free
--    questo script non ha effetto utile. Sui piani a pagamento il limite
--    globale si alza da Dashboard > Storage > Settings ("Upload file size
--    limit"): va alzato LI' prima, altrimenti l'update qui sotto fallisce.
-- 2. Dopo averlo lanciato, allinea LIMITE_FILE_MB in src/lib/file-video.ts
--    allo stesso valore, altrimenti l'app continua a bloccare i file grandi
--    prima ancora di provare a caricarli.

update storage.buckets
set file_size_limit = 500 * 1024 * 1024  -- 500 MB
where id = 'file-video';

select id, file_size_limit, allowed_mime_types
from storage.buckets
where id = 'file-video';
