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

  /*
   * Tipo seduta, Nome evento e Tempo/Split vanno presi direttamente
   * da Catapult (colonne tags, session_title, split_name su
   * catapult_data), non dal calendario interno allenamenti/partite:
   * quest'ultimo può non corrispondere 1:1 alle sedute effettivamente
   * registrate dal dispositivo GPS.
   */
  let sessioniQuery = supabase
    .from("catapult_data")
    .select("session_title, date, tags")
    .eq("club_id", profilo.last_club_id)
    .not("session_title", "is", null);

  if (profilo.last_squadra_id) {
    sessioniQuery = sessioniQuery.or(
      `squadra_id.eq.${profilo.last_squadra_id},squadra_id.is.null`
    );
  }

  const { data: sessioniRows } = await sessioniQuery;

  const sessioniMap = new Map<
    string,
    { titolo: string; data: string | null; tags: string | null }
  >();

  for (const row of sessioniRows ?? []) {
    if (!row.session_title) continue;

    const chiave = `${row.session_title}__${row.date ?? ""}`;

    if (!sessioniMap.has(chiave)) {
      sessioniMap.set(chiave, {
        titolo: row.session_title,
        data: row.date,
        tags: row.tags,
      });
    }
  }

  const sessioniCatapult = Array.from(sessioniMap.values()).sort((a, b) =>
    (b.data ?? "").localeCompare(a.data ?? "")
  );

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
        sessioni={sessioniCatapult}
      />
    </div>
  );
}