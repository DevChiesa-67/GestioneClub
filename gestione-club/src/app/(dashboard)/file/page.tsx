import { PageHeader } from "@/components/layout/PageHeader";
import FileVideoClient from "@/components/file/FileVideoClient";
import { createClient } from "@/lib/supabase-server";

export default async function Page() {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) return null;

  const { data: profilo } = await supabase
    .from("profili")
    .select("id,last_club_id,last_squadra_id,tipo_profilo")
    .eq("auth_user_id", user.id)
    .single();

  if (!profilo?.last_club_id) {
    return <div className="p-6 text-zinc-400">Seleziona prima un club.</div>;
  }

  const isAdmin = profilo.tipo_profilo === "admin";

  let giocatoriQuery = supabase
    .from("giocatori")
    .select("id,nome,cognome,foto_url")
    .eq("club_id", profilo.last_club_id)
    .eq("attivo", true)
    .order("cognome");

  if (profilo.last_squadra_id) {
    giocatoriQuery = giocatoriQuery.eq("squadra_id", profilo.last_squadra_id);
  }

  const { data: giocatori } = await giocatoriQuery;

  let partiteQuery = supabase
    .from("partite")
    .select("id,avversario,data_partita")
    .eq("club_id", profilo.last_club_id)
    .order("data_partita", { ascending: false });

  if (profilo.last_squadra_id) {
    partiteQuery = partiteQuery.eq("squadra_id", profilo.last_squadra_id);
  }

  const { data: partite } = await partiteQuery;

  let allenamentiQuery = supabase
    .from("allenamenti")
    .select("id,titolo,data_allenamento")
    .eq("club_id", profilo.last_club_id)
    .order("data_allenamento", { ascending: false });

  if (profilo.last_squadra_id) {
    allenamentiQuery = allenamentiQuery.eq(
      "squadra_id",
      profilo.last_squadra_id
    );
  }

  const { data: allenamenti } = await allenamentiQuery;

  const { data: persone } = await supabase
    .from("profili")
    .select("id,nome_completo,email,tipo_profilo")
    .eq("last_club_id", profilo.last_club_id)
    .order("nome_completo");

  let query = supabase
  .from("file_video")
  .select(`
    id,
    titolo,
    video_path,
    tipo_evento,
    partita_id,
    allenamento_id,
    note,
    visibilita,
    created_at,
    partite (
      id,
      avversario,
      data_partita
    ),
    allenamenti (
      id,
      titolo,
      data_allenamento
    ),
    file_video_destinatari (
      profilo_id,
      giocatore_id
    )
  `)
  .eq("club_id", profilo.last_club_id)
  .order("created_at", { ascending: false });

if (profilo.last_squadra_id) {
  query = query.eq("squadra_id", profilo.last_squadra_id);
}

const { data: videoRaw } = await query;

const videoVisibili =
  videoRaw?.filter((video) => {
    if (isAdmin) return true;
    if (video.visibilita === "tutti") return true;

    if (video.visibilita === "persona") {
      return video.file_video_destinatari?.some(
        (d) => d.profilo_id === profilo.id
      );
    }

    return video.visibilita === profilo.tipo_profilo;
  }) ?? [];

const videoConUrl = await Promise.all(
  videoVisibili.map(async (v) => {
    const { data } = await supabase.storage
      .from("file-video")
      .createSignedUrl(v.video_path, 60 * 60);

   return {
  ...v,
  partite: Array.isArray(v.partite) ? v.partite[0] ?? null : v.partite,
  allenamenti: Array.isArray(v.allenamenti)
    ? v.allenamenti[0] ?? null
    : v.allenamenti,
  signedUrl: data?.signedUrl ?? null,
};
  })
);

 

  return (
    <><div className="md:hidden">
      <PageHeader
        title="File Video"
        description="Video di partite e allenamenti condivisi con staff e giocatori."
      />
    </div>

      <FileVideoClient
        isAdmin={isAdmin}
        video={videoConUrl}
        partite={partite ?? []}
        allenamenti={allenamenti ?? []}
        persone={persone ?? []}
        giocatori={giocatori ?? []}
      />
    </>
  );
}