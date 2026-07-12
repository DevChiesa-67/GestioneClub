import { createClient } from "@/lib/supabase-server";
import ImportaDatiPerformanceClient from "@/components/performance/ImportaDatiPerformanceClient";

export default async function ImportaDatiPerformancePage() {
  const supabase = await createClient();

  const {
    data: { user },
    error: userError,
  } = await supabase.auth.getUser();

  if (userError || !user) {
    throw new Error("Utente non autenticato.");
  }

  const { data: profilo, error: profiloError } = await supabase
    .from("profili")
    .select("id, tipo_profilo, last_club_id, last_squadra_id")
    .eq("auth_user_id", user.id)
    .single();

  if (profiloError || !profilo?.last_club_id) {
    throw new Error("Profilo o club corrente non trovato.");
  }

  const isAdmin = String(profilo.tipo_profilo || "").toLowerCase() === "admin";

  const { data: club, error: clubError } = await supabase
    .from("club")
    .select("id, nome, colore_flag")
    .eq("id", profilo.last_club_id)
    .single();

  if (clubError || !club) {
    throw new Error("Club corrente non trovato.");
  }

  const { data: squadra } = profilo.last_squadra_id
    ? await supabase
        .from("squadre")
        .select("id, nome")
        .eq("id", profilo.last_squadra_id)
        .eq("club_id", profilo.last_club_id)
        .single()
    : { data: null };

  let importazioniQuery = supabase
    .from("catapult_importazioni")
    .select(`
      id,
      nome,
      filename,
      data_seduta,
      tipo_seduta,
      numero_righe,
      numero_giocatori_trovati,
      numero_giocatori_non_trovati,
      created_at
    `)
    .eq("club_id", profilo.last_club_id)
    .order("created_at", { ascending: false });

  if (profilo.last_squadra_id) {
    importazioniQuery = importazioniQuery.eq(
      "squadra_id",
      profilo.last_squadra_id
    );
  } else {
    importazioniQuery = importazioniQuery.is("squadra_id", null);
  }

  const { data: importazioni, error: importazioniError } =
    await importazioniQuery;

  if (importazioniError) {
    throw new Error("Errore durante il caricamento delle importazioni.");
  }

  const { data: giocatori, error: giocatoriError } =
    profilo.last_squadra_id
      ? await supabase
          .from("giocatori")
          .select("id, nome, cognome")
          .eq("club_id", profilo.last_club_id)
          .eq("squadra_id", profilo.last_squadra_id)
          .eq("attivo", true)
          .order("cognome", { ascending: true })
      : { data: [], error: null };

  if (giocatoriError) {
    throw new Error("Errore durante il caricamento dei giocatori.");
  }

  const { data: definitions, error: definitionsError } =
    await supabase
      .from("performance_import_definitions")
      .select(
        "id, provider, campo_origine, valore_origine, valore_destinazione, categoria, tipo_match, attivo"
      )
      .eq("provider", "catapult")
      .eq("attivo", true);

  if (definitionsError) {
    throw new Error(
      "Errore durante il caricamento delle definizioni Catapult."
    );
  }

  return (
    <div className="w-full min-w-0 max-w-full overflow-hidden">
      <ImportaDatiPerformanceClient
        profilo={profilo}
        isAdmin={isAdmin}
        club={{
          nome: club.nome ?? "Club",
          colore_flag: club.colore_flag ?? "#18181b",
        }}
        squadra={{
          nome: squadra?.nome ?? "Nessuna squadra selezionata",
        }}
        giocatori={giocatori ?? []}
        definitions={definitions ?? []}
        importazioni={importazioni ?? []}
      />
    </div>
  );
}