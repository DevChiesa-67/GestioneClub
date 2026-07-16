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

  const { data: club } = await supabase
    .from("club")
    .select("id,nome,colore_flag,color_flag,colore")
    .eq("id", profilo.last_club_id)
    .single();

  const coloreClub =
    club?.colore_flag || club?.color_flag || club?.colore || "#d71920";

 

 const { data: partita, error: partitaError } = await supabase
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
  .single();

  if (partitaError || !partita) {
    return <AppCard>Partita non trovata.</AppCard>;
  }

  const { data: statistiche } = await supabase
  .from("partite_statistiche")
  .select("*")
  .eq("partita_id", id)
  .eq("club_id", profilo.last_club_id)
  .maybeSingle();

const { data: convocazioni } = await supabase
  .from("partite_convocazioni")
  .select(
    `
    id,
    partita_id,
    giocatore_id,
    convocato,
    titolare,
    capitano,
    posizione,
    numero_maglia,
    ordine,
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
  .order("numero_maglia", { ascending: true });

const partitaHaGiaConvocati = (convocazioni ?? []).length > 0;

function formatDate(date: Date) {
  return date.toISOString().slice(0, 10);
}

const dataPartita = new Date(`${partita.data_partita}T00:00:00`);

const giornoPrima = new Date(dataPartita);
giornoPrima.setDate(giornoPrima.getDate() - 1);

const giornoDopo = new Date(dataPartita);
giornoDopo.setDate(giornoDopo.getDate() + 1);

let giocatoriGiaConvocatiIds: string[] = [];

if (!partitaHaGiaConvocati) {
  let partiteVicinoQuery = supabase
    .from("partite")
    .select("id")
    .eq("club_id", profilo.last_club_id)
    .neq("id", id)
    .gte("data_partita", formatDate(giornoPrima))
    .lte("data_partita", formatDate(giornoDopo));

  if (profilo.last_squadra_id) {
    partiteVicinoQuery = partiteVicinoQuery.eq(
      "squadra_id",
      profilo.last_squadra_id
    );
  }

  const { data: partiteVicino } = await partiteVicinoQuery;

  const partiteVicinoIds = (partiteVicino ?? []).map(
    (partitaVicino) => partitaVicino.id
  );

  if (partiteVicinoIds.length > 0) {
    const { data: convocazioniVicino } = await supabase
      .from("partite_convocazioni")
      .select("giocatore_id")
      .eq("club_id", profilo.last_club_id)
      .eq("convocato", true)
      .in("partita_id", partiteVicinoIds);

    giocatoriGiaConvocatiIds = Array.from(
      new Set(
        (convocazioniVicino ?? []).map(
          (convocazione) => convocazione.giocatore_id
        )
      )
    );
  }
}

let giocatoriQuery = supabase
  .from("giocatori")
  .select("id,nome,cognome,ruolo_1,ruolo_2,reparto,numero_maglia,attivo")
  .eq("club_id", profilo.last_club_id)
  .eq("attivo", true)
  .order("cognome", { ascending: true });

if (profilo.last_squadra_id) {
  giocatoriQuery = giocatoriQuery.eq("squadra_id", profilo.last_squadra_id);
}

if (!partitaHaGiaConvocati && giocatoriGiaConvocatiIds.length > 0) {
  giocatoriQuery = giocatoriQuery.not(
    "id",
    "in",
    `(${giocatoriGiaConvocatiIds.join(",")})`
  );
}

const { data: giocatori } = await giocatoriQuery;

const { data: squadreDisponibili } = await supabase
  .from("squadre_partite")
  .select("id,nome,abbreviazione,logo_path")
  .eq("club_id", profilo.last_club_id)
  .order("nome", { ascending: true });

  return (
    <PartitaEditorClient
      partita={partita}
      statistiche={statistiche}
      giocatori={giocatori ?? []}
      convocazioni={convocazioni ?? []}
      squadreDisponibili={squadreDisponibili ?? []}
      coloreClub={coloreClub}
      isAdmin={isAdmin}
    />
  );
}