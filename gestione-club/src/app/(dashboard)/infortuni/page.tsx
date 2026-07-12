import { createClient } from "@/lib/supabase-server";
import InfortuniClient from "@/components/infortuni/InfortuniClient";

export default async function InfortuniPage() {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    throw new Error("Utente non autenticato.");
  }

  const { data: profilo } = await supabase
    .from("profili")
    .select("tipo_profilo,last_club_id,last_squadra_id")
    .eq("auth_user_id", user.id)
    .single();

  if (!profilo?.last_club_id) {
    throw new Error("Club attivo non trovato.");
  }

  const isAdmin = String(profilo.tipo_profilo || "").toLowerCase() === "admin";

  let giocatoriQuery = supabase
    .from("giocatori")
    .select("id,nome,cognome,squadra_id,stato_salute,data_rientro")
    .eq("club_id", profilo.last_club_id)
    .eq("attivo", true)
    .order("cognome", { ascending: true });

  if (profilo.last_squadra_id) {
    giocatoriQuery = giocatoriQuery.eq("squadra_id", profilo.last_squadra_id);
  }

  const [{ data: infortuni }, { data: giocatori }] = await Promise.all([
    supabase
      .from("infortuni")
      .select(`
        id,
        data_infortunio,
        tipo_infortunio,
        data_rientro,
        stato,
        giocatori:giocatore_id (
          id,
          nome,
          cognome
        ),
        squadre:squadra_id (
          id,
          nome
        )
      `)
      .eq("club_id", profilo.last_club_id)
      .neq("stato", "rientrato")
      .order("data_infortunio", { ascending: false }),

    giocatoriQuery,
  ]);

  /*
   * Le relazioni FK singole (giocatore_id, squadra_id) vengono
   * restituite da Supabase come oggetto singolo, ma senza i tipi
   * generati dal Database lo string-based select le tipizza come
   * array: normalizziamo qui prendendo il primo elemento.
   */
  const infortuniNormalizzati = (infortuni ?? []).map((infortunio) => ({
    ...infortunio,
    giocatori: Array.isArray(infortunio.giocatori)
      ? (infortunio.giocatori[0] ?? null)
      : infortunio.giocatori,
    squadre: Array.isArray(infortunio.squadre)
      ? (infortunio.squadre[0] ?? null)
      : infortunio.squadre,
  }));

  return (
    <InfortuniClient
      infortuni={infortuniNormalizzati}
      giocatori={giocatori ?? []}
      isAdmin={isAdmin}
    />
  );
}