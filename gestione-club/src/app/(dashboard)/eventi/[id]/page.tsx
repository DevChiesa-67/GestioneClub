import { AppCard } from "@/components/ui/AppCard";
import { createClient } from "@/lib/supabase-server";
import EventoEditorClient from "@/components/eventi/EventoEditorClient";

type PageProps = {
  params: Promise<{ id: string }>;
};

export type GiocatoreEvento = {
  id: string;
  nome: string;
  cognome: string;
  foto_url: string | null;
};

export type TipoEventoOption = {
  id: string;
  nome: string;
  colore: string | null;
};

type TipoEventoRel = TipoEventoOption | TipoEventoOption[] | null;

export type EventoDettaglio = {
  id: string;
  titolo: string;
  data_inizio: string;
  data_fine: string | null;
  ora_inizio: string | null;
  luogo: string | null;
  note: string | null;
  tipo_evento_id: string;
  tipo_evento: TipoEventoOption | null;
};

export type ConvocazioneEvento = {
  id: string;
  giocatore_id: string;
  convocato: boolean;
  note: string | null;
};

function normalizeTipoEvento(valore: TipoEventoRel): TipoEventoOption | null {
  if (Array.isArray(valore)) return valore[0] ?? null;
  return valore;
}

export default async function EventoDetailPage({ params }: PageProps) {
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

  let giocatoriQuery = supabase
    .from("giocatori")
    .select("id,nome,cognome,foto_url")
    .eq("club_id", profilo.last_club_id)
    .eq("attivo", true)
    .order("cognome", { ascending: true });

  if (profilo.last_squadra_id) {
    giocatoriQuery = giocatoriQuery.eq("squadra_id", profilo.last_squadra_id);
  }

  const [
    { data: club },
    { data: evento, error: eventoError },
    { data: convocazioni },
    { data: giocatori },
    { data: tipiEventi },
  ] = await Promise.all([
    supabase
      .from("club")
      .select("id,nome,colore_flag")
      .eq("id", profilo.last_club_id)
      .single(),
    supabase
      .from("eventi")
      .select(
        `
        id,
        titolo,
        data_inizio,
        data_fine,
        ora_inizio,
        luogo,
        note,
        tipo_evento_id,
        tipo_evento:tipo_evento_id (
          id,
          nome,
          colore
        )
      `
      )
      .eq("id", id)
      .eq("club_id", profilo.last_club_id)
      .single(),
    supabase
      .from("eventi_convocazioni")
      .select("id, giocatore_id, convocato, note")
      .eq("evento_id", id)
      .eq("club_id", profilo.last_club_id),
    giocatoriQuery,
    supabase
      .from("tipi_eventi")
      .select("id, nome, colore")
      .eq("club_id", profilo.last_club_id)
      .eq("attivo", true)
      .order("nome", { ascending: true }),
  ]);

  const coloreClub = club?.colore_flag || "#d71920";

  if (eventoError || !evento) {
    return <AppCard>Evento non trovato.</AppCard>;
  }

  const eventoNormalizzato: EventoDettaglio = {
    ...evento,
    tipo_evento: normalizeTipoEvento(
      evento.tipo_evento as TipoEventoRel
    ),
  };

  return (
    <EventoEditorClient
      evento={eventoNormalizzato}
      giocatori={(giocatori ?? []) as GiocatoreEvento[]}
      convocazioni={(convocazioni ?? []) as ConvocazioneEvento[]}
      tipiEventi={(tipiEventi ?? []) as TipoEventoOption[]}
      coloreClub={coloreClub}
      isAdmin={isAdmin}
    />
  );
}
