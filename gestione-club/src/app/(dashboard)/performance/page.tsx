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
    .select("id, colore_flag, logo_url")
    .eq("id", profilo.last_club_id)
    .single();

  const coloreFlag = club?.colore_flag ?? "#d71920";

  /*
   * Gli split di un allenamento (es. blocchi di lavoro) e i "tempi" di
   * una partita condividono la stessa colonna split_name, ma sono
   * concettualmente diversi: recuperiamo anche tags in modo che il
   * client possa proporre solo gli split effettivamente presenti per
   * il tipo seduta selezionato, invece di mescolarli tutti insieme.
   */
  const { data: splitRows } = await supabase
    .from("catapult_data")
    .select("split_name, tags")
    .eq("club_id", profilo.last_club_id)
    .not("split_name", "is", null);

  const splitOptionsMap = new Map<
    string,
    { nome: string; tags: string | null }
  >();

  for (const row of splitRows ?? []) {
    if (!row.split_name) continue;

    const chiave = `${row.split_name}__${row.tags ?? ""}`;

    if (!splitOptionsMap.has(chiave)) {
      splitOptionsMap.set(chiave, { nome: row.split_name, tags: row.tags });
    }
  }

  const splitOptions = Array.from(splitOptionsMap.values()).sort((a, b) =>
    a.nome.localeCompare(b.nome)
  );

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
    <ReportTabsClient
      clubId={profilo.last_club_id}
      squadraId={profilo.last_squadra_id}
      coloreFlag={coloreFlag}
      clubLogoUrl={club?.logo_url ?? null}
      giocatori={giocatori ?? []}
      splitOptions={splitOptions}
      sessioni={sessioniCatapult}
    />
  );
}