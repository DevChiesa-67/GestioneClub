import { createClient } from "@/lib/supabase-server";
import InfortunioDetailClient from "@/components/infortuni/InfortunioDetailClient";

type PageProps = {
  params: Promise<{
    id: string;
  }>;
};

export default async function InfortunioDetailPage({ params }: PageProps) {
  const { id } = await params;
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    throw new Error("Utente non autenticato.");
  }

  const { data: profilo } = await supabase
    .from("profili")
    .select("tipo_profilo,last_club_id")
    .eq("auth_user_id", user.id)
    .single();

  if (!profilo?.last_club_id) {
    throw new Error("Club attivo non trovato.");
  }

  const isAdmin = String(profilo.tipo_profilo || "").toLowerCase() === "admin";

  const [
    { data: infortunio },
    { data: medico },
    { data: fisioterapista },
    { data: preparatore },
  ] = await Promise.all([
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
      .eq("id", id)
      .eq("club_id", profilo.last_club_id)
      .single(),

    supabase
      .from("infortuni_medico_valutazioni")
      .select("*")
      .eq("infortunio_id", id)
      .eq("club_id", profilo.last_club_id)
      .order("medico_data_valutazione", { ascending: false }),

    supabase
      .from("infortuni_fisioterapista_valutazioni")
      .select("*")
      .eq("infortunio_id", id)
      .eq("club_id", profilo.last_club_id)
      .order("fisioterapista_data_visita", { ascending: false }),

    supabase
      .from("infortuni_preparatore_valutazioni")
      .select("*")
      .eq("infortunio_id", id)
      .eq("club_id", profilo.last_club_id)
      .order("preparatore_data_valutazione", { ascending: false }),
  ]);

  if (!infortunio) {
    throw new Error("Infortunio non trovato.");
  }

  /*
   * Le relazioni FK singole (giocatore_id, squadra_id) vengono
   * restituite da Supabase come oggetto singolo, ma senza i tipi
   * generati dal Database lo string-based select le tipizza come
   * array: normalizziamo qui prendendo il primo elemento.
   */
  const infortunioNormalizzato = {
    ...infortunio,
    giocatori: Array.isArray(infortunio.giocatori)
      ? (infortunio.giocatori[0] ?? null)
      : infortunio.giocatori,
    squadre: Array.isArray(infortunio.squadre)
      ? (infortunio.squadre[0] ?? null)
      : infortunio.squadre,
  };

  return (
    <InfortunioDetailClient
      infortunio={infortunioNormalizzato}
      medico={medico ?? []}
      fisioterapista={fisioterapista ?? []}
      preparatore={preparatore ?? []}
      isAdmin={isAdmin}
    />
  );
}