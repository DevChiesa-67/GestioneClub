import { createClient } from "@supabase/supabase-js";

export const BUCKET_DOCUMENTI_MEDICI = "documenti-medici";

export function createStorageAdminClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!url || !serviceRoleKey) {
    throw new Error(
      "Configurazione storage mancante: verifica SUPABASE_SERVICE_ROLE_KEY."
    );
  }

  return createClient(url, serviceRoleKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

export async function assicuraBucketDocumentiMedici() {
  const admin = createStorageAdminClient();
  const { data: bucket, error: letturaError } = await admin.storage.getBucket(
    BUCKET_DOCUMENTI_MEDICI
  );

  if (!bucket && letturaError) {
    const { error: creazioneError } = await admin.storage.createBucket(
      BUCKET_DOCUMENTI_MEDICI,
      {
        public: false,
        fileSizeLimit: 50 * 1024 * 1024,
        allowedMimeTypes: [
          "application/pdf",
          "image/*",
          "video/*",
        ],
      }
    );

    if (creazioneError) {
      throw new Error(`Impossibile creare il bucket documenti: ${creazioneError.message}`);
    }
  }

  if (bucket) {
    const { error: aggiornamentoError } = await admin.storage.updateBucket(
      BUCKET_DOCUMENTI_MEDICI,
      {
        public: false,
        fileSizeLimit: 50 * 1024 * 1024,
        allowedMimeTypes: ["application/pdf", "image/*", "video/*"],
      }
    );
    if (aggiornamentoError) {
      throw new Error(
        `Impossibile aggiornare il bucket documenti: ${aggiornamentoError.message}`
      );
    }
  }

  return admin;
}
