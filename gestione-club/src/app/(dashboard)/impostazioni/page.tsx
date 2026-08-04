
import { createClient } from "@/lib/supabase-server";
import ProfiloImpostazioniClient from "@/components/impostazioni/ProfiloImpostazioniClient";

export default async function Page() {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) return null;

  const { data: profilo, error } = await supabase
    .from("profili")
    .select(`
      id,
      nome,
      cognome,
      email,
      tipo_profilo,
      club_id,
      last_club_id
    `)
    .eq("auth_user_id", user.id)
    .single();

  if (error || !profilo) {
    return <p className="text-zinc-400">Profilo non trovato.</p>;
  }

  // Il club "attivo" è normalmente last_club_id, ma se per qualche motivo
  // non è valorizzato (o punta a un club che non esiste più) ripieghiamo
  // sul primo club presente nell'array club_id del profilo.
  const idCandidati = Array.from(
    new Set(
      [
        profilo.last_club_id,
        ...(Array.isArray(profilo.club_id) ? profilo.club_id : []),
      ].filter((id): id is string => Boolean(id))
    )
  );

  let clubBase: {
    id: string;
    nome: string;
    logo_url: string | null;
    colore_flag: string | null;
    color_flag: string | null;
  } | null = null;

  let debugClubQuery: unknown = null;

  if (idCandidati.length > 0) {
    const { data: clubs, error: clubsError } = await supabase
      .from("club")
      .select("id, nome, logo_url, colore_flag, color_flag")
      .in("id", idCandidati);

    debugClubQuery = { clubsError, clubsCount: clubs?.length ?? null };

    if (clubs && clubs.length > 0) {
      clubBase =
        clubs.find((c) => c.id === profilo.last_club_id) || clubs[0];
    }
  }

  // DEBUG TEMPORANEO: rimuovere una volta capito perché clubBase risulta
  // null per questo profilo.
  console.log("[impostazioni/page] debug", {
    profiloId: profilo.id,
    lastClubId: profilo.last_club_id,
    clubIdArray: profilo.club_id,
    idCandidati,
    debugClubQuery,
    clubBase,
  });

  // Campo separato e "best effort": se la colonna preferenza_vista_lavori
  // non esiste ancora (migrazione non eseguita) questa query fallisce da
  // sola, senza far cadere il resto della pagina.
  let preferenzaVistaLavori: "card" | "tabella" = "card";

  if (clubBase) {
    const { data: preferenzaData } = await supabase
      .from("club")
      .select("preferenza_vista_lavori")
      .eq("id", clubBase.id)
      .maybeSingle();

    if (preferenzaData?.preferenza_vista_lavori === "tabella") {
      preferenzaVistaLavori = "tabella";
    }
  }

  return (
    <>
      <ProfiloImpostazioniClient
        profilo={{
          id: profilo.id,
          nome: profilo.nome,
          cognome: profilo.cognome,
          email: profilo.email ?? user.email ?? "",
          tipo_profilo: profilo.tipo_profilo,
          club_id: profilo.club_id,
        }}
        club={{
          id: clubBase?.id ?? null,
          nome: clubBase?.nome ?? "Club",
          logo_url: clubBase?.logo_url ?? null,
          colore:
            clubBase?.colore_flag || clubBase?.color_flag || "#3b82f6",
          preferenzaVistaLavori,
        }}
      />
    </>
  );
}
