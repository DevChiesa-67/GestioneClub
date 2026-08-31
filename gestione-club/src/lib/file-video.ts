// Costanti condivise fra la pagina File (client) e le sue Server Action.
// Vivono qui e non in actions.ts perche' un file "use server" puo'
// esportare solo funzioni asincrone.

// Limite per singolo file. Deve restare allineato al file_size_limit del
// bucket "file-video" (vedi correggi-rls-file-video.sql): alzarlo qui senza
// alzarlo sul bucket fa rifiutare l'upload da Supabase.
export const LIMITE_FILE_MB = 50;

export const TIPI_FILE_CONSENTITI = ["application/pdf", "image/", "video/"];

export function tipoFileConsentito(tipo: string) {
  return TIPI_FILE_CONSENTITI.some(
    (consentito) => tipo === consentito || tipo.startsWith(consentito)
  );
}
