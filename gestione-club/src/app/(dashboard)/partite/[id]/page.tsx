import { createClient } from "@/lib/supabase-server";
import { AppCard } from "@/components/ui/AppCard";
import PartitaEditorClient from "@/components/partite/PartitaEditorClient";

type PageProps = {
  params: Promise<{ id: string }>;
};

export default async function PartitaDetailPage({ params }: PageProps) {
  const { id } = await params;
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return <AppCard>Accesso non autorizzato.</AppCard>;
  }

  const { data: profilo } = await supabase
    .from("profili")
    .select("id,tipo_profilo,last_club_id,last_squadra_id")
    .eq("auth_user_id", user.id)
    .single();

  if (!profilo?.last_club_id) {
    return <AppCard>Nessun club attivo selezionato.</AppCard>;
  }

  const isAdmin = String(profilo.tipo_profilo || "").toLowerCase() === "admin";

  /*
   * Tutte le query seguenti dipendono solo dal profilo (club/squadra) e
   * dall'id della partita, non l'una dall'altra: vengono lanciate in
   * parallelo per ridurre drasticamente il tempo di caricamento della
   * pagina (prima erano in sequenza, una dopo l'altra).
   */
  let giocatoriQuery = supabase
    .from("giocatori")
    .select("id,nome,cognome,ruolo_1,ruolo_2,reparto,attivo")
    .eq("club_id", profilo.last_club_id)
    .eq("attivo", true)
    .order("cognome", { ascending: true });

  if (profilo.last_squadra_id) {
    giocatoriQuery = giocatoriQuery.eq("squadra_id", profilo.last_squadra_id);
  }

  const [
    { data: club },
    { data: partita, error: partitaError },
    { data: statistiche },
    { data: convocazioni },
    { data: giocatori },
    { data: squadreDisponibili },
  ] = await Promise.all([
    supabase
      .from("club")
      .select("id,nome,colore_flag,color_flag,colore")
      .eq("id", profilo.last_club_id)
      .single(),
    supabase
      .from("partite")
      .select(
        `
        id,
        club_id,
        squadra_id,
        avversario,
        data_partita,
        ora_partita,
        luogo,
        casa_fuori,
        risultato,
        tipo_partita,
        note,
        stato_partita,
        punti_fatti,
        punti_subiti,
        squadra_casa_id,
        squadra_fuori_id,
        squadre:squadra_id (
          nome
        ),
        squadra_casa:squadre_partite!partite_squadra_casa_id_fkey (
          id,
          nome,
          abbreviazione,
          logo_path
        ),
        squadra_fuori:squadre_partite!partite_squadra_fuori_id_fkey (
          id,
          nome,
          abbreviazione,
          logo_path
        )
      `
      )
      .eq("id", id)
      .eq("club_id", profilo.last_club_id)
      .single(),
    supabase
      .from("partite_statistiche")
      .select("*")
      .eq("partita_id", id)
      .eq("club_id", profilo.last_club_id)
      .maybeSingle(),
    supabase
      .from("partite_convocazioni")
      .select(
        `
        id,
        partita_id,
        giocatore_id,
        convocato,
        titolare,
        capitano,
        vicecapitano,
        posizione,
        numero_maglia,
        ordine,
        ruolo_panchina,
        note,
        giocatori:giocatore_id (
          id,
          nome,
          cognome
        )
      `
      )
      .eq("partita_id", id)
      .eq("club_id", profilo.last_club_id)
      .order("ordine", { ascending: true })
      .order("numero_maglia", { ascending: true }),
    giocatoriQuery,
    supabase
      .from("squadre_partite")
      .select("id,nome,abbreviazione,logo_path")
      .eq("club_id", profilo.last_club_id)
      .order("nome", { ascending: true }),
  ]);

  const coloreClub =
    club?.colore_flag || club?.color_flag || club?.colore || "#d71920";

  if (partitaError || !partita) {
    return <AppCard>Partita non trovata.</AppCard>;
  }

  /*
   * La query principale filtra per squadra interna + attivo = true.
   * Se un giocatore non è ancora stato assegnato a una squadra interna,
   * il filtro per squadra lo escluderebbe: in quel caso ripieghiamo su
   * tutti i giocatori attivi del club.
   */
  let giocatoriEffettivi = giocatori ?? [];

  if (giocatoriEffettivi.length === 0 && profilo.last_squadra_id) {
    const { data: soloAttivi } = await supabase
      .from("giocatori")
      .select("id,nome,cognome,ruolo_1,ruolo_2,reparto,attivo")
      .eq("club_id", profilo.last_club_id)
      .eq("attivo", true)
      .order("cognome", { ascending: true });

    giocatoriEffettivi = soloAttivi ?? [];
  }

  return (
    <PartitaEditorClient
      partita={partita}
      statistiche={statistiche}
      giocatori={giocatoriEffettivi}
      convocazioni={convocazioni ?? []}
      squadreDisponibili={squadreDisponibili ?? []}
      coloreClub={coloreClub}
      isAdmin={isAdmin}
    />
  );
}