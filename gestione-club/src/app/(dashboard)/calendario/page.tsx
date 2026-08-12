// src/app/(dashboard)/calendario/page.tsx

import { AppCard } from "@/components/ui/AppCard";
import { createClient } from "@/lib/supabase-server";
import CalendarioClient from "@/components/calendario/CalendarioClient";

/*
 * Pagina "Calendario": vista unica di allenamenti, partite ed eventi
 * (tornei, raduni, team building...) del club/squadra attivi, con
 * possibilità di passare tra vista giornaliera, settimanale e mensile.
 *
 * I dati vengono caricati qui lato server una sola volta e normalizzati
 * in un tipo comune (EventoCalendario), così il componente client può
 * cambiare vista e navigare tra i periodi senza ulteriori query.
 */

export const dynamic = "force-dynamic";

export type TipoEventoCalendario = "allenamento" | "partita" | "evento";

export type EventoCalendario = {
  id: string;
  tipo: TipoEventoCalendario;
  titolo: string;
  /** Sottotitolo: tipo seduta, tipo partita o nome della tipologia evento. */
  sottotitolo: string | null;
  /** Data in formato ISO YYYY-MM-DD. */
  dataInizio: string;
  /** Uguale a dataInizio per gli impegni di un solo giorno. */
  dataFine: string;
  oraInizio: string | null;
  oraFine: string | null;
  luogo: string | null;
  /** Colore della tipologia evento; se assente si usa il colore di default del tipo. */
  colore: string | null;
  /** Link al dettaglio, se esiste una pagina dedicata. */
  href: string | null;
  /** Info extra mostrata nella vista giornaliera (es. risultato partita). */
  dettaglio: string | null;
};

type ProfiloCorrente = {
  last_club_id: string | null;
  last_squadra_id: string | null;
  tipo_profilo: string | null;
};

type ClubAttivo = {
  id: string;
  nome: string | null;
  colore_flag: string | null;
};

type SquadraPartitaJoin = {
  nome: string | null;
  abbreviazione: string | null;
};

type TipoEventoJoin = {
  nome: string | null;
  colore: string | null;
};

type AllenamentoRaw = {
  id: string;
  titolo: string | null;
  tipo_allenamento: string | null;
  data_allenamento: string;
  ora_inizio: string | null;
  ora_fine: string | null;
  luogo: string | null;
};

type PartitaRaw = {
  id: string;
  data_partita: string;
  ora_partita: string | null;
  luogo: string | null;
  risultato: string | null;
  tipo_partita: string | null;
  avversario: string | null;
  squadra_casa: SquadraPartitaJoin | SquadraPartitaJoin[] | null;
  squadra_fuori: SquadraPartitaJoin | SquadraPartitaJoin[] | null;
};

type EventoRaw = {
  id: string;
  titolo: string | null;
  data_inizio: string;
  data_fine: string | null;
  ora_inizio: string | null;
  ora_fine: string | null;
  luogo: string | null;
  tipo_evento: TipoEventoJoin | TipoEventoJoin[] | null;
};

function firstJoin<T>(value: T | T[] | null | undefined): T | null {
  if (Array.isArray(value)) return value[0] ?? null;
  return value ?? null;
}

function orarioBreve(value: string | null | undefined): string | null {
  if (!value) return null;
  return value.slice(0, 5);
}

const ETICHETTE_TIPO_PARTITA: Record<string, string> = {
  amichevole: "Amichevole",
  campionato: "Campionato",
  barrage: "Barrage",
};

export default async function CalendarioPage() {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return (
      <AppCard>
        <p className="text-zinc-400">
          Devi effettuare il login per vedere il calendario.
        </p>
      </AppCard>
    );
  }

  const { data: profilo, error: profiloError } = await supabase
    .from("profili")
    .select("last_club_id, last_squadra_id, tipo_profilo")
    .eq("auth_user_id", user.id)
    .single<ProfiloCorrente>();

  if (profiloError || !profilo?.last_club_id) {
    return (
      <AppCard>
        <p className="text-zinc-400">Nessun club attivo selezionato.</p>
      </AppCard>
    );
  }

  const clubId = profilo.last_club_id;
  const squadraId = profilo.last_squadra_id;

  const { data: clubAttivo } = await supabase
    .from("club")
    .select("id, nome, colore_flag")
    .eq("id", clubId)
    .single<ClubAttivo>();

  const coloreClub = clubAttivo?.colore_flag || "#d71920";

  let allenamentiQuery = supabase
    .from("allenamenti")
    .select(
      "id, titolo, tipo_allenamento, data_allenamento, ora_inizio, ora_fine, luogo"
    )
    .eq("club_id", clubId)
    .order("data_allenamento", { ascending: true });

  let partiteQuery = supabase
    .from("partite")
    .select(
      `
      id,
      data_partita,
      ora_partita,
      luogo,
      risultato,
      tipo_partita,
      avversario,
      squadra_casa:squadre_partite!partite_squadra_casa_id_fkey (
        nome,
        abbreviazione
      ),
      squadra_fuori:squadre_partite!partite_squadra_fuori_id_fkey (
        nome,
        abbreviazione
      )
    `
    )
    .eq("club_id", clubId)
    .order("data_partita", { ascending: true });

  let eventiQuery = supabase
    .from("eventi")
    .select(
      `
      id,
      titolo,
      data_inizio,
      data_fine,
      ora_inizio,
      ora_fine,
      luogo,
      tipo_evento:tipo_evento_id (
        nome,
        colore
      )
    `
    )
    .eq("club_id", clubId)
    .order("data_inizio", { ascending: true });

  if (squadraId) {
    allenamentiQuery = allenamentiQuery.eq("squadra_id", squadraId);
    partiteQuery = partiteQuery.eq("squadra_id", squadraId);
    eventiQuery = eventiQuery.eq("squadra_id", squadraId);
  }

  const [
    { data: allenamentiRaw, error: allenamentiError },
    { data: partiteRaw, error: partiteError },
    { data: eventiRaw, error: eventiError },
  ] = await Promise.all([allenamentiQuery, partiteQuery, eventiQuery]);

  if (allenamentiError) {
    console.error(
      "Errore caricamento allenamenti calendario:",
      allenamentiError
    );
  }

  if (partiteError) {
    console.error("Errore caricamento partite calendario:", partiteError);
  }

  if (eventiError) {
    console.error("Errore caricamento eventi calendario:", eventiError);
  }

  const allenamenti: EventoCalendario[] = (
    (allenamentiRaw ?? []) as AllenamentoRaw[]
  ).map((allenamento) => ({
    id: allenamento.id,
    tipo: "allenamento",
    titolo:
      allenamento.titolo?.trim() ||
      allenamento.tipo_allenamento?.trim() ||
      "Allenamento",
    sottotitolo: allenamento.tipo_allenamento,
    dataInizio: allenamento.data_allenamento,
    dataFine: allenamento.data_allenamento,
    oraInizio: orarioBreve(allenamento.ora_inizio),
    oraFine: orarioBreve(allenamento.ora_fine),
    luogo: allenamento.luogo,
    colore: null,
    href: "/allenamenti",
    dettaglio: null,
  }));

  const partite: EventoCalendario[] = ((partiteRaw ?? []) as PartitaRaw[]).map(
    (partita) => {
      const casa = firstJoin(partita.squadra_casa);
      const fuori = firstJoin(partita.squadra_fuori);

      const titolo =
        casa?.nome && fuori?.nome
          ? `${casa.nome} - ${fuori.nome}`
          : `vs ${partita.avversario ?? "avversario"}`;

      return {
        id: partita.id,
        tipo: "partita",
        titolo,
        sottotitolo: partita.tipo_partita
          ? ETICHETTE_TIPO_PARTITA[partita.tipo_partita] ?? partita.tipo_partita
          : null,
        dataInizio: partita.data_partita,
        dataFine: partita.data_partita,
        oraInizio: orarioBreve(partita.ora_partita),
        oraFine: null,
        luogo: partita.luogo,
        colore: null,
        href: `/partite/${partita.id}`,
        dettaglio: partita.risultato,
      };
    }
  );

  const eventi: EventoCalendario[] = ((eventiRaw ?? []) as EventoRaw[]).map(
    (evento) => {
      const tipo = firstJoin(evento.tipo_evento);

      return {
        id: evento.id,
        tipo: "evento",
        titolo: evento.titolo?.trim() || "Evento",
        sottotitolo: tipo?.nome ?? null,
        dataInizio: evento.data_inizio,
        dataFine: evento.data_fine ?? evento.data_inizio,
        oraInizio: orarioBreve(evento.ora_inizio),
        oraFine: orarioBreve(evento.ora_fine),
        luogo: evento.luogo,
        colore: tipo?.colore ?? null,
        href: `/eventi/${evento.id}`,
        dettaglio: null,
      };
    }
  );

  return (
    <CalendarioClient
      eventi={[...allenamenti, ...partite, ...eventi]}
      coloreClub={coloreClub}
      nomeClub={clubAttivo?.nome ?? null}
      dataOdierna={new Date().toISOString().slice(0, 10)}
    />
  );
}
