
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
      club:club_id (
        nome,
        logo_url,
        colore_flag,
        color_flag
      )
    `)
    .eq("auth_user_id", user.id)
    .single();

  if (error || !profilo) {
    return <p className="text-zinc-400">Profilo non trovato.</p>;
  }

  const club = Array.isArray(profilo.club) ? profilo.club[0] : profilo.club;

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
          nome: club?.nome ?? "Club",
          logo_url: club?.logo_url ?? null,
          colore: club?.colore_flag || club?.color_flag || "#3b82f6",
        }}
      />
    </>
  );
}