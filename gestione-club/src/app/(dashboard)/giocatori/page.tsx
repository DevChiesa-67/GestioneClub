import Link from "next/link";
import { createClient } from "@/lib/supabase-server";
import { Plus, User, ChevronRight } from "lucide-react";

function getGoogleDriveImageUrl(url: string | null) {
  if (!url) return null;

  const match = url.match(/\/d\/([^/]+)/);
  if (!match?.[1]) return url;

  return `https://drive.google.com/uc?export=view&id=${match[1]}`;
}

function getAnnoNascita(dataNascita: string | null) {
  if (!dataNascita) return null;

  const anno = Number(dataNascita.slice(0, 4));

  return Number.isFinite(anno) ? anno : null;
}

async function getPageContext() {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return {
      supabase,
      clubId: null,
      squadraId: null,
      themeColor: "#d71920",
    };
  }

  const { data: profile } = await supabase
    .from("profili")
    .select("last_club_id, last_squadra_id")
    .eq("auth_user_id", user.id)
    .single();

  const clubId = profile?.last_club_id ?? null;
  const squadraId = profile?.last_squadra_id ?? null;

  let themeColor = "#d71920";

  if (clubId) {
    const { data: club } = await supabase
      .from("club")
      .select("colore_flag")
      .eq("id", clubId)
      .single();

    themeColor = club?.colore_flag || "#d71920";
  }

  return {
    supabase,
    clubId,
    squadraId,
    themeColor,
  };
}

export default async function GiocatoriPage() {
  const { supabase, clubId, squadraId, themeColor } = await getPageContext();

  if (!clubId) {
    return (
      <div className="rounded-2xl border border-white/10 bg-[#171717] p-8 text-zinc-400">
        Nessun club selezionato.
      </div>
    );
  }

  let query = supabase
    .from("giocatori")
    .select(
      `
      id,
      nome,
      cognome,
      foto_url,
      data_nascita,
      categoria,
      ruolo_1,
      ruolo_2,
      reparto,
      email,
      telefono,
      attivo,
      club_id,
      squadra_id
    `
    )
    .eq("club_id", clubId)
    .order("cognome", { ascending: true })
    .order("nome", { ascending: true });

  if (squadraId) {
    query = query.eq("squadra_id", squadraId);
  }

  const { data: giocatori, error } = await query;

  if (error) {
    return (
      <pre className="rounded-xl bg-red-950 p-6 text-red-200">
        {JSON.stringify(error, null, 2)}
      </pre>
    );
  }

  return (
    <div className="space-y-8">
      <div className="flex items-center justify-between gap-4">
        <div>
          
         
        </div>

        <Link
          href="/giocatori/nuovo"
          className="flex items-center gap-2 rounded-xl px-5 py-3 font-bold text-white transition"
          style={{
            backgroundColor: themeColor,
            boxShadow: `0 12px 30px ${themeColor}33`,
          }}
        >
          <Plus size={18} />
          Nuovo giocatore
        </Link>
      </div>

      {(!giocatori || giocatori.length === 0) && (
        <div className="rounded-2xl border border-white/10 bg-[#171717] p-8 text-zinc-400">
          Nessun giocatore trovato.
        </div>
      )}

      <div className="grid gap-6 md:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4">
        {giocatori?.map((g) => {
          const imageUrl = getGoogleDriveImageUrl(g.foto_url);
          const annoNascita = getAnnoNascita(g.data_nascita);

          return (
            <Link
              key={g.id}
              href={`/giocatori/${g.id}`}
              className="group overflow-hidden rounded-2xl border border-white/10 bg-[#171717] transition hover:bg-[#1f1f1f]"
              style={{
                ["--hover-border" as string]: `${themeColor}99`,
              }}
            >
              <div className="relative h-80 w-full overflow-hidden bg-zinc-900">
                {imageUrl ? (
                  <img
                    src={imageUrl}
                    alt={`${g.nome} ${g.cognome}`}
                    className="h-full w-full object-cover transition duration-300 group-hover:scale-105"
                  />
                ) : (
                  <div
                    className="flex h-full w-full items-center justify-center"
                    style={{
                      backgroundColor: `${themeColor}1A`,
                      color: themeColor,
                    }}
                  >
                    <User size={72} />
                  </div>
                )}

                <span
                  className={`absolute right-4 top-4 rounded-full px-3 py-1 text-xs font-bold ${
                    g.attivo
                      ? "bg-emerald-500/90 text-white"
                      : "bg-zinc-600/90 text-white"
                  }`}
                >
                  {g.attivo ? "Attivo" : "Non attivo"}
                </span>
              </div>

              <div className="p-5">
                <div className="flex items-start justify-between gap-2">
                  <h2 className="text-xl font-black text-white">
                    {g.nome} {g.cognome}
                  </h2>

                  {annoNascita && (
                    <span className="shrink-0 rounded-full bg-white/10 px-2.5 py-1 text-xs font-bold text-zinc-300">
                      {annoNascita}
                    </span>
                  )}
                </div>

                <p className="mt-1 text-sm text-zinc-400">
                  {g.ruolo_1 || "Ruolo non impostato"}
                  {g.ruolo_2 ? ` / ${g.ruolo_2}` : ""}
                </p>

                <p className="mt-3 text-sm text-zinc-400">
                  {g.categoria ?? "-"} · {g.reparto ?? "-"}
                </p>

                <div
                  className="mt-5 flex items-center justify-between border-t border-white/10 pt-4 text-sm font-bold"
                  style={{ color: themeColor }}
                >
                  Apri scheda
                  <ChevronRight
                    size={18}
                    className="transition group-hover:translate-x-1"
                  />
                </div>
              </div>
            </Link>
          );
        })}
      </div>
    </div>
  );
}