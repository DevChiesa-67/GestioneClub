import { createClient } from "@/lib/supabase-server";
import GiocateClient from "@/components/giocate/GiocateClient";

export default async function GiocatePage() {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    throw new Error("Utente non autenticato");
  }

  const { data: profilo, error: profiloError } = await supabase
    .from("profili")
    .select("id, last_club_id, last_squadra_id")
    .eq("auth_user_id", user.id)
    .single();

  if (profiloError || !profilo?.last_club_id) {
    throw new Error("Profilo o club attivo non trovato");
  }

  const { data: club } = await supabase
    .from("club")
    .select("id, nome, colore_flag")
    .eq("id", profilo.last_club_id)
    .single();

  let giocateQuery = supabase
    .from("rugby_giocate")
    .select("*")
    .eq("club_id", profilo.last_club_id)
    .order("sezione", { ascending: true })
    .order("ordine", { ascending: true });

  if (profilo.last_squadra_id) {
    giocateQuery = giocateQuery.eq("squadra_id", profilo.last_squadra_id);
  }

  const { data: giocate, error } = await giocateQuery;

  if (error) {
    throw new Error("Errore caricamento giocate");
  }

  return (
    <GiocateClient
      giocate={giocate ?? []}
      coloreClub={club?.colore_flag ?? "#E3A71E"}
    />
  );
}