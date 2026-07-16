import { createClient } from "@/lib/supabase-server";
import ProgrammazioneClient from "@/components/allenamenti/ProgrammazioneClient";

export default async function ProgrammazionePage() {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    throw new Error("Utente non autenticato");
  }

  const { data: profilo } = await supabase
    .from("profili")
    .select("id,tipo_profilo,last_club_id,last_squadra_id")
    .eq("auth_user_id", user.id)
    .single();

  if (!profilo?.last_club_id) {
    throw new Error("Nessun club attivo selezionato");
  }

  const isAdmin = String(profilo.tipo_profilo ?? "").toLowerCase() === "admin";

  const { data: club } = await supabase
    .from("club")
    .select("id,nome,colore_flag")
    .eq("id", profilo.last_club_id)
    .single();

  let programmazioniQuery = supabase
  .from("programmazioni")
  .select(`
    id,
    titolo,
    stagione,
    descrizione,
    data_inizio,
    data_fine,
    programmazione_fasi (
      id,
      nome,
      colore,
      data_inizio,
      data_fine,
      obiettivo,
      ordine,
      programmazione_settimane (
        id,
        numero_settimana,
        data_inizio,
        data_fine,
        focus_settimana,
        obiettivo_settimana,
        note,
        programmazione_sedute (
          id,
          data_seduta,
          tipo_sessione,
          tema,
          volume_min,
          durata_min,
          intensita,
          carico,
          note
        )
      )
    )
  `)
  .eq("club_id", profilo.last_club_id)
  .order("data_inizio", { ascending: false });

  if (profilo.last_squadra_id) {
    programmazioniQuery = programmazioniQuery.eq(
      "squadra_id",
      profilo.last_squadra_id
    );
  }

  const { data: programmazioni, error } = await programmazioniQuery;

  return (
    <ProgrammazioneClient
      club={club}
      profilo={profilo}
      programmazioni={programmazioni ?? []}
      isAdmin={isAdmin}
    />
  );
}