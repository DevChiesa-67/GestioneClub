import { createClient } from "@/lib/supabase-server";
import TestPageClient from "@/components/test/TestPageClient";

export default async function TestPage() {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return null;
  }

  const { data: profilo } = await supabase
    .from("profili")
    .select("id,tipo_profilo,last_club_id,last_squadra_id")
    .eq("auth_user_id", user.id)
    .single();

  const isAdmin = String(profilo?.tipo_profilo || "").toLowerCase() === "admin";

  if (!profilo?.last_club_id || !profilo?.last_squadra_id) {
    return (
      <main className="min-h-screen px-4 py-6 sm:px-6 lg:px-8">
        <div className="rounded-2xl border border-white/10 bg-zinc-950/60 p-5 text-sm text-zinc-400 shadow-xl">
          Seleziona prima un club e una squadra.
        </div>
      </main>
    );
  }

  const { data: club } = await supabase
    .from("club")
    .select("id,nome,colore_flag")
    .eq("id", profilo.last_club_id)
    .single();

  const { data: tests } = await supabase
    .from("test_atletici_forza")
    .select("*")
    .order("nome", { ascending: true });

  const { data: misurazioni } = await supabase
    .from("test_misurazioni")
    .select(`
      id,
      club_id,
      squadra_id,
      giocatore_id,
      test_id,
      data_test,
      valore,
      obiettivo,
      note,
      giocatori (
        id,
        nome,
        cognome,
        foto_url
      ),
      test_atletici_forza (
        id,
        nome,
        tipo_test,
        unita_misura
      )
    `)
    .eq("club_id", profilo.last_club_id)
    .eq("squadra_id", profilo.last_squadra_id)
    .order("data_test", { ascending: false });

  return (
    <main className="min-h-screen overflow-x-hidden px-3 py-4 sm:px-6 lg:px-8">
      <div className="mx-auto w-full max-w-7xl">
        <TestPageClient
          club={{
            id: club?.id ?? profilo.last_club_id,
            nome: club?.nome ?? "",
            colore_flag: club?.colore_flag ?? "#d71920",
          }}
          profilo={{
            id: profilo.id,
            last_club_id: profilo.last_club_id,
            last_squadra_id: profilo.last_squadra_id,
          }}
          tests={tests ?? []}
          misurazioni={misurazioni ?? []}
          isAdmin={isAdmin}
        />
      </div>
    </main>
  );
}