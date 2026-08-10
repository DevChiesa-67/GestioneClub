import { AppCard } from "@/components/ui/AppCard";
import { createClient } from "@/lib/supabase-server";
import { CreaPartitaPopup } from "@/components/partite/CreaPartitaPopup";
import { CreaEventoPopup } from "@/components/partite/CreaEventoPopup";
import { PartiteTabs } from "@/components/partite/PartiteTabs";

type ClubAttivo = {
  id: string;
  nome: string;
  colore_flag: string | null;
};

type ProfiloCorrente = {
  last_club_id: string | null;
  last_squadra_id: string | null;
};

type SquadraPartitaRel = {
  id: string;
  nome: string;
  abbreviazione: string | null;
  logo_path: string | null;
  colore_1: string | null;
  colore_2: string | null;
};

export type SquadraPartitaVisual = SquadraPartitaRel & {
  logo_url: string | null;
};

type PartitaRaw = {
  id: string;
  data_partita: string;
  ora_partita: string | null;
  luogo: string | null;
  risultato: string | null;
  note: string | null;
  tipo_partita: "amichevole" | "campionato" | "barrage" | null;
  squadra_id: string | null;
  squadra_casa_id: string | null;
  squadra_fuori_id: string | null;
  squadra_casa: SquadraPartitaRel | SquadraPartitaRel[] | null;
  squadra_fuori: SquadraPartitaRel | SquadraPartitaRel[] | null;
};

export type Partita = Omit<PartitaRaw, "squadra_casa" | "squadra_fuori"> & {
  squadra_casa: SquadraPartitaVisual | null;
  squadra_fuori: SquadraPartitaVisual | null;
};

export type GiocatoreMinutaggio = {
  id: string;
  nome: string;
  cognome: string;
  foto_url: string | null;
};

type MinutaggioImportRaw = {
  id: string;
  nome_file: string;
  file_path: string | null;
  avversario_rilevato: string | null;
  data_rilevata: string | null;
  luogo_rilevato: string | null;
  durata_minuti: number;
  stato: "da_associare" | "associato";
  partita_id: string | null;
  created_at: string;
};

export type MinutaggioImport = MinutaggioImportRaw & {
  file_url: string | null;
  partita: Partita | null;
};

export type TipoEvento = {
  id: string;
  nome: string;
  colore: string | null;
};

type TipoEventoRel = TipoEvento | TipoEvento[] | null;

type EventoRaw = {
  id: string;
  titolo: string;
  data_inizio: string;
  data_fine: string | null;
  ora_inizio: string | null;
  luogo: string | null;
  note: string | null;
  tipo_evento_id: string;
  tipo_evento: TipoEventoRel;
};

export type Evento = Omit<EventoRaw, "tipo_evento"> & {
  tipo_evento: TipoEvento | null;
};

function normalizeSquadraPartita(
  squadra: SquadraPartitaRel | SquadraPartitaRel[] | null
): SquadraPartitaRel | null {
  if (Array.isArray(squadra)) {
    return squadra[0] ?? null;
  }

  return squadra;
}

export default async function Page() {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return (
      <AppCard>
        <p className="text-zinc-400">
          Devi effettuare il login per vedere le partite.
        </p>
      </AppCard>
    );
  }

  const { data: profilo, error: profiloError } = await supabase
    .from("profili")
    .select("last_club_id, last_squadra_id")
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

  async function aggiungiLogoUrl(
    squadra: SquadraPartitaRel | null
  ): Promise<SquadraPartitaVisual | null> {
    if (!squadra) return null;

    let logo_url: string | null = null;

    if (squadra.logo_path) {
      const { data: signedLogo } = await supabase.storage
        .from("loghi-squadre")
        .createSignedUrl(squadra.logo_path, 60 * 60);

      logo_url = signedLogo?.signedUrl ?? null;
    }

    return {
      ...squadra,
      logo_url,
    };
  }

  let partiteQuery = supabase
    .from("partite")
    .select(
      `
      id,
      data_partita,
      ora_partita,
      luogo,
      risultato,
      note,
      tipo_partita,
      squadra_id,
      squadra_casa_id,
      squadra_fuori_id,
      squadra_casa:squadra_casa_id (
        id,
        nome,
        abbreviazione,
        logo_path,
        colore_1,
        colore_2
      ),
      squadra_fuori:squadra_fuori_id (
        id,
        nome,
        abbreviazione,
        logo_path,
        colore_1,
        colore_2
      )
    `
    )
    .eq("club_id", clubId)
    .order("data_partita", { ascending: false })
    .order("ora_partita", { ascending: false });

  if (squadraId) {
    partiteQuery = partiteQuery.eq("squadra_id", squadraId);
  }

  const { data: partiteRaw, error: partiteError } = await partiteQuery;

  const { data: squadrePartiteRaw } = await supabase
    .from("squadre_partite")
    .select("id, nome, abbreviazione, logo_path, colore_1, colore_2")
    .eq("club_id", clubId)
    .order("nome", { ascending: true });

  const squadrePartite = (
  await Promise.all(
    ((squadrePartiteRaw ?? []) as SquadraPartitaRel[]).map(async (squadra) => {
      return aggiungiLogoUrl(squadra);
    })
  )
).filter((squadra): squadra is SquadraPartitaVisual => squadra !== null);

  const tutteLePartite: Partita[] = await Promise.all(
    ((partiteRaw ?? []) as PartitaRaw[]).map(async (partita) => {
      const squadraCasa = normalizeSquadraPartita(partita.squadra_casa);
      const squadraFuori = normalizeSquadraPartita(partita.squadra_fuori);

      return {
        ...partita,
        squadra_casa: await aggiungiLogoUrl(squadraCasa),
        squadra_fuori: await aggiungiLogoUrl(squadraFuori),
      };
    })
  );

  /*
   * Giocatori del club (per il matching nomi del file MINUTAGGIO) e
   * import minutaggi già caricati (per l'elenco "Minutaggi" e per
   * risalire alla partita associata).
   */
  let giocatoriMinutaggioQuery = supabase
    .from("giocatori")
    .select("id, nome, cognome, foto_url")
    .eq("club_id", clubId)
    .eq("attivo", true)
    .order("cognome", { ascending: true });

  if (squadraId) {
    giocatoriMinutaggioQuery = giocatoriMinutaggioQuery.eq(
      "squadra_id",
      squadraId
    );
  }

  let tipiEventiQuery = supabase
    .from("tipi_eventi")
    .select("id, nome, colore")
    .eq("club_id", clubId)
    .eq("attivo", true)
    .order("nome", { ascending: true });

  let eventiQuery = supabase
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
    .eq("club_id", clubId)
    .order("data_inizio", { ascending: false });

  if (squadraId) {
    eventiQuery = eventiQuery.eq("squadra_id", squadraId);
  }

  const [
    { data: giocatoriMinutaggio },
    { data: minutaggiRaw },
    { data: tipiEventiRaw },
    { data: eventiRaw },
  ] = await Promise.all([
    giocatoriMinutaggioQuery,
    supabase
      .from("partite_minutaggi_import")
      .select(
        `
        id,
        nome_file,
        file_path,
        avversario_rilevato,
        data_rilevata,
        luogo_rilevato,
        durata_minuti,
        stato,
        partita_id,
        created_at
      `
      )
      .eq("club_id", clubId)
      .order("created_at", { ascending: false }),
    tipiEventiQuery,
    eventiQuery,
  ]);

  const tipiEventi: TipoEvento[] = (tipiEventiRaw ?? []) as TipoEvento[];

  function normalizeTipoEvento(valore: TipoEventoRel): TipoEvento | null {
    if (Array.isArray(valore)) return valore[0] ?? null;
    return valore;
  }

  const eventi: Evento[] = ((eventiRaw ?? []) as EventoRaw[]).map(
    (evento) => ({
      ...evento,
      tipo_evento: normalizeTipoEvento(evento.tipo_evento),
    })
  );

  const partiteById = new Map(tutteLePartite.map((p) => [p.id, p]));

  const minutaggiImport: MinutaggioImport[] = await Promise.all(
    ((minutaggiRaw ?? []) as MinutaggioImportRaw[]).map(async (riga) => {
      let file_url: string | null = null;

      if (riga.file_path) {
        const { data: signed } = await supabase.storage
          .from("minutaggi-partite")
          .createSignedUrl(riga.file_path, 60 * 60);

        file_url = signed?.signedUrl ?? null;
      }

      return {
        ...riga,
        file_url,
        partita: riga.partita_id
          ? partiteById.get(riga.partita_id) ?? null
          : null,
      };
    })
  );

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap justify-end gap-3">
        <CreaEventoPopup tipiEventi={tipiEventi} coloreClub={coloreClub} />
        <CreaPartitaPopup squadre={squadrePartite} coloreClub={coloreClub} />
      </div>

      {partiteError ? (
        <AppCard>
          <p className="text-red-400">Errore nel caricamento delle partite.</p>
        </AppCard>
      ) : (
        <PartiteTabs
          partite={tutteLePartite}
          eventi={eventi}
          tipiEventi={tipiEventi}
          coloreClub={coloreClub}
          giocatori={(giocatoriMinutaggio ?? []) as GiocatoreMinutaggio[]}
          minutaggi={minutaggiImport}
        />
      )}
    </div>
  );
}