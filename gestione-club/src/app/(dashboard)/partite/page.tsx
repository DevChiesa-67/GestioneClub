import { AppCard } from "@/components/ui/AppCard";
import { createClient } from "@/lib/supabase-server";
import { CreaPartitaPopup } from "@/components/partite/CreaPartitaPopup";
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

  return (
    <div className="space-y-6">
      <div className="flex justify-end">
        <CreaPartitaPopup squadre={squadrePartite} coloreClub={coloreClub} />
      </div>

      {partiteError ? (
        <AppCard>
          <p className="text-red-400">Errore nel caricamento delle partite.</p>
        </AppCard>
      ) : (
        <PartiteTabs partite={tutteLePartite} coloreClub={coloreClub} />
      )}
    </div>
  );
}