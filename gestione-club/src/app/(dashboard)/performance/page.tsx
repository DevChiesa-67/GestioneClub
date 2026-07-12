import Link from "next/link";
import { Upload } from "lucide-react";
import { createClient } from "@/lib/supabase-server";
import ReportTabsClient from "@/components/charts/ReportTabsClient";

export default async function Page() {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) return null;

  const { data: profilo } = await supabase
    .from("profili")
    .select("id, last_club_id, last_squadra_id")
    .eq("auth_user_id", user.id)
    .single();

  if (!profilo?.last_club_id) {
    return (
      <div className="p-6 text-zinc-400">
        Nessun club selezionato. Seleziona prima un club.
      </div>
    );
  }

  const { data: club } = await supabase
    .from("club")
    .select("id, colore_flag")
    .eq("id", profilo.last_club_id)
    .single();

  const coloreFlag = club?.colore_flag ?? "#d71920";

  const { data: splitRows } = await supabase
    .from("catapult_data")
    .select("split_name")
    .eq("club_id", profilo.last_club_id)
    .not("split_name", "is", null);

  const splitNames = Array.from(
    new Set(
      (splitRows ?? [])
        .map((row) => row.split_name)
        .filter(Boolean)
    )
  ).sort();

  let giocatoriQuery = supabase
    .from("giocatori")
    .select("id, nome, cognome, foto_url")
    .eq("club_id", profilo.last_club_id)
    .order("cognome", { ascending: true })
    .order("nome", { ascending: true });

  if (profilo.last_squadra_id) {
    giocatoriQuery = giocatoriQuery.eq(
      "squadra_id",
      profilo.last_squadra_id
    );
  }

  const { data: giocatori } = await giocatoriQuery;

  let allenamentiQuery = supabase
    .from("allenamenti")
    .select("id, titolo, data_allenamento")
    .eq("club_id", profilo.last_club_id)
    .order("data_allenamento", { ascending: false });

  if (profilo.last_squadra_id) {
    allenamentiQuery = allenamentiQuery.eq(
      "squadra_id",
      profilo.last_squadra_id
    );
  }

  const { data: allenamenti } = await allenamentiQuery;

  let partiteQuery = supabase
    .from("partite")
    .select(`
      id,
      avversario,
      data_partita,
      squadra_casa:squadre_partite!partite_squadra_casa_id_fkey(nome),
      squadra_fuori:squadre_partite!partite_squadra_fuori_id_fkey(nome)
    `)
    .eq("club_id", profilo.last_club_id)
    .order("data_partita", { ascending: false });

  if (profilo.last_squadra_id) {
    partiteQuery = partiteQuery.eq(
      "squadra_id",
      profilo.last_squadra_id
    );
  }

  const { data: partite } = await partiteQuery;

  const eventi = [
  ...(allenamenti ?? []).map((item) => ({
    id: item.id,
    tipo: "allenamento" as const,
    nome: item.titolo,
    data: item.data_allenamento,
  })),
  ...(partite ?? []).map((item) => ({
    id: item.id,
    tipo: "partita" as const,
    nome:
      item.avversario ||
      item.squadra_casa?.[0]?.nome ||
      item.squadra_fuori?.[0]?.nome ||
      "Partita senza nome",
    data: item.data_partita,
  })),
];

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <p className="text-sm text-zinc-400">Performance</p>
          <h1 className="text-2xl font-semibold text-white">
            Report performance
          </h1>
        </div>

        <Link
          href="/performance/importa-dati"
          className="inline-flex items-center justify-center gap-2 rounded-xl px-4 py-2 text-sm font-semibold text-white transition hover:opacity-90"
          style={{ backgroundColor: coloreFlag }}
        >
          <Upload className="h-4 w-4" />
          Importa dati
        </Link>
      </div>

      <ReportTabsClient
        clubId={profilo.last_club_id}
        squadraId={profilo.last_squadra_id}
        coloreFlag={coloreFlag}
        giocatori={giocatori ?? []}
        splitNames={splitNames}
        eventi={eventi}
      />
    </div>
  );
}