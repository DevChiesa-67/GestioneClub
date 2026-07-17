import { createClient } from "@/lib/supabase-server";
import Link from "next/link";
import Image from "next/image";
import { ArrowLeft, Pencil, User } from "lucide-react";

import { GiocatorePresenzeCharts } from "@/components/giocatori/GiocatorePresenzeCharts";
import { DeleteGiocatoreButton } from "@/components/giocatori/DeleteGiocatoreButton";
import ReportAcwrClient from "@/components/charts/ReportAcwrClient";
import PerformanceDashboardChartsClient from "@/components/charts/PerformanceDashboardChartsClient";

type TipoSeduta = "tutte" | "allenamento" | "partita";

type PageProps = {
  params: Promise<{
    id: string;
  }>;

  searchParams?: Promise<{
    dataDa?: string;
    dataA?: string;
    tipoSeduta?: string;
    eventoId?: string;
  }>;
};

export default async function GiocatoreDetailPage({
  params,
  searchParams,
}: PageProps) {
  const { id } = await params;
  const filtri = searchParams ? await searchParams : {};

  const supabase = await createClient();

  /*
   * Utente autenticato
   */
  const {
    data: { user },
    error: userError,
  } = await supabase.auth.getUser();

  if (userError || !user) {
    return (
      <div className="rounded-2xl border border-white/10 bg-[#171717] p-6 shadow-2xl shadow-black/20 md:p-8">
        <h1 className="text-2xl font-black text-white">
          Utente non autenticato
        </h1>
      </div>
    );
  }

  /*
   * Profilo corrente.
   *
   * Club e squadra vengono sempre ricavati lato server:
   * - last_club_id
   * - last_squadra_id
   */
  const { data: profilo, error: profiloError } = await supabase
    .from("profili")
    .select("id, last_club_id, last_squadra_id, tipo_profilo")
    .eq("auth_user_id", user.id)
    .single();

  if (profiloError || !profilo?.last_club_id) {
    return (
      <div className="rounded-2xl border border-white/10 bg-[#171717] p-6 shadow-2xl shadow-black/20 md:p-8">
        <h1 className="text-2xl font-black text-white">
          Nessun club selezionato
        </h1>

        <p className="mt-2 text-zinc-400">
          Seleziona prima un club attivo.
        </p>
      </div>
    );
  }

  const clubId = profilo.last_club_id;
  const squadraId = profilo.last_squadra_id ?? null;
  const isAdmin =
    typeof profilo.tipo_profilo === "string" &&
    profilo.tipo_profilo.trim().toLowerCase() === "admin";

  /*
   * Branding dinamico del club.
   */
  const { data: club } = await supabase
    .from("club")
    .select("id, nome, colore_flag")
    .eq("id", clubId)
    .single();

  const coloreFlag = club?.colore_flag || "#d71920";

  /*
   * Filtri opzionali provenienti dalla query string.
   */
  const dataDa = filtri.dataDa || undefined;
  const dataA = filtri.dataA || undefined;
  const eventoIdFiltro = filtri.eventoId || null;

  const tipoSeduta: TipoSeduta =
    filtri.tipoSeduta === "allenamento" ||
    filtri.tipoSeduta === "partita"
      ? filtri.tipoSeduta
      : "tutte";

  /*
   * Recupero del giocatore.
   *
   * Il giocatore deve appartenere:
   * - al club attivo;
   * - alla squadra attiva, quando presente.
   */
  let giocatoreQuery = supabase
    .from("giocatori")
    .select(`
      id,
      club_id,
      squadra_id,
      id_atleta,
      nome,
      cognome,
      foto_url,
      data_nascita,
      categoria,
      ruolo_1,
      ruolo_2,
      reparto,
      mano_piede_dominante,
      telefono,
      email,
      genitore,
      telefono_genitore,
      influenza_squadra,
      importanza_giocatore,
      note,
      attivo,
      presenze_allenamenti (
        id,
        stato,
        allenamenti (
          data_allenamento
        )
      )
    `)
    .eq("id", id)
    .eq("club_id", clubId);

  if (squadraId) {
    giocatoreQuery = giocatoreQuery.eq("squadra_id", squadraId);
  }

  const { data: giocatore, error: giocatoreError } =
    await giocatoreQuery.single();

  if (giocatoreError || !giocatore) {
    return (
      <div className="rounded-2xl border border-white/10 bg-[#171717] p-6 shadow-2xl shadow-black/20 md:p-8">
        <h1 className="text-2xl font-black text-white">
          Giocatore non trovato
        </h1>

        <Link
          href="/giocatori"
          className="mt-4 inline-flex items-center gap-2 text-sm font-bold transition hover:opacity-80"
          style={{ color: coloreFlag }}
        >
          <ArrowLeft size={16} />
          Torna ai giocatori
        </Link>
      </div>
    );
  }

  /*
   * Supabase può tipizzare la relazione allenamenti come oggetto oppure array.
   * La normalizziamo per GiocatorePresenzeCharts.
   */
  const presenzeNormalizzate =
    giocatore.presenze_allenamenti?.map((presenza) => ({
      ...presenza,
      allenamenti: Array.isArray(presenza.allenamenti)
        ? presenza.allenamenti[0] ?? { data_allenamento: "" }
        : presenza.allenamenti,
    })) ?? [];

  return (
    <div className="space-y-6 pb-8">
      <Link
        href="/giocatori"
        className="inline-flex items-center gap-2 text-sm font-semibold transition hover:opacity-80"
        style={{ color: coloreFlag }}
      >
        <ArrowLeft size={16} />
        Torna ai giocatori
      </Link>

      <section className="overflow-hidden rounded-3xl border border-white/10 bg-[#171717] shadow-2xl shadow-black/20">
        <div className="grid gap-0 lg:grid-cols-[360px_1fr]">
          <div className="relative h-[320px] bg-zinc-900 sm:h-[420px] lg:h-full lg:min-h-[520px]">
            {giocatore.foto_url ? (
              <Image
                src={giocatore.foto_url}
                alt={`${giocatore.nome} ${giocatore.cognome}`}
                className="object-cover"
                fill
                sizes="(max-width: 1024px) 100vw, 360px"
                priority
              />
            ) : (
              <div
                className="flex h-full w-full items-center justify-center"
                style={{
                  color: coloreFlag,
                  backgroundColor: `${coloreFlag}18`,
                }}
              >
                <User size={90} />
              </div>
            )}

            <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/90 via-black/50 to-transparent p-5 lg:hidden">
              <p
                className="text-xs font-bold uppercase tracking-[0.25em]"
                style={{ color: coloreFlag }}
              >
                {giocatore.id_atleta ?? "ID atleta non impostato"}
              </p>

              <h1 className="mt-2 text-3xl font-black leading-tight text-white">
                {giocatore.nome} {giocatore.cognome}
              </h1>
            </div>
          </div>

          <div className="p-5 sm:p-6 md:p-8">
            <div className="flex flex-col gap-5 md:flex-row md:items-start md:justify-between">
              <div className="hidden lg:block">
                <p
                  className="text-sm font-bold uppercase tracking-[0.25em]"
                  style={{ color: coloreFlag }}
                >
                  {giocatore.id_atleta ?? "ID atleta non impostato"}
                </p>

                <h1 className="mt-3 text-5xl font-black leading-tight text-white">
                  {giocatore.nome} {giocatore.cognome}
                </h1>
              </div>

              <div className="lg:hidden">
                <p className="text-lg font-bold text-white">
                  {giocatore.categoria ?? "Categoria non impostata"}
                </p>

                <p className="mt-1 text-sm text-zinc-400">
                  {giocatore.reparto ?? "Reparto non impostato"}
                </p>
              </div>

              <div className="flex flex-wrap items-center gap-3">
                <span
                  className={`w-fit rounded-full px-4 py-2 text-sm font-bold ${
                    giocatore.attivo
                      ? "bg-emerald-500/15 text-emerald-400"
                      : "bg-zinc-500/15 text-zinc-400"
                  }`}
                >
                  {giocatore.attivo ? "Attivo" : "Non attivo"}
                </span>

                {isAdmin && (
                  <Link
                    href={`/giocatori/${giocatore.id}/modifica`}
                    className="inline-flex items-center justify-center gap-2 rounded-xl border border-white/10 bg-white/5 px-4 py-2 text-sm font-bold text-zinc-300 transition hover:bg-white/10 hover:text-white"
                  >
                    <Pencil size={16} />
                    Modifica
                  </Link>
                )}

                {isAdmin && (
                  <DeleteGiocatoreButton
                    giocatoreId={giocatore.id}
                    fotoUrl={giocatore.foto_url}
                    isAdmin={isAdmin}
                  />
                )}
              </div>
            </div>

            <p className="mt-4 hidden text-lg text-zinc-400 lg:block">
              {giocatore.categoria ?? "Categoria non impostata"} ·{" "}
              {giocatore.reparto ?? "Reparto non impostato"}
            </p>

            <div className="mt-7 grid gap-4 sm:grid-cols-2">
              <InfoCard title="Ruolo 1°" value={giocatore.ruolo_1} />
              <InfoCard title="Ruolo 2°" value={giocatore.ruolo_2} />
              <InfoCard
                title="Data nascita"
                value={giocatore.data_nascita}
              />
              <InfoCard
                title="Mano/Piede dominante"
                value={giocatore.mano_piede_dominante}
              />
              <InfoCard title="Telefono" value={giocatore.telefono} />
              <InfoCard title="Email" value={giocatore.email} />
              <InfoCard title="Genitore" value={giocatore.genitore} />
              <InfoCard
                title="Telefono genitore"
                value={giocatore.telefono_genitore}
              />

              {isAdmin && (
                <>
                  <InfoCard
                    title="Influenza sulla Squadra"
                    value={
                      giocatore.influenza_squadra
                        ? `${giocatore.influenza_squadra}/10`
                        : null
                    }
                  />
                  <InfoCard
                    title="Importanza Giocatore"
                    value={
                      giocatore.importanza_giocatore
                        ? `${giocatore.importanza_giocatore}/10`
                        : null
                    }
                  />
                </>
              )}
            </div>
          </div>
        </div>
      </section>

      <section className="rounded-2xl border border-white/10 bg-[#171717] p-5 shadow-2xl shadow-black/20 md:p-6">
        <h2 className="text-xl font-black text-white">Note</h2>

        <p className="mt-3 whitespace-pre-wrap leading-7 text-zinc-400">
          {giocatore.note || "Nessuna nota inserita."}
        </p>
      </section>

      <GiocatorePresenzeCharts presenze={presenzeNormalizzate} />

      {/*
       * ACWR filtrato esclusivamente sul giocatore della pagina.
       */}
      <ReportAcwrClient
        mode="chart"
        clubId={clubId}
        squadraId={squadraId}
        giocatoreId={giocatore.id}
        dataDa={dataDa}
        dataA={dataA}
        coloreFlag={coloreFlag}
      />

      {/*
       * Performance filtrate esclusivamente sul giocatore della pagina.
       */}
      <PerformanceDashboardChartsClient
        clubId={clubId}
        squadraId={squadraId}
        giocatoreId={giocatore.id}
        dataDa={dataDa}
        dataA={dataA}
        tipoSeduta={tipoSeduta}
        eventoId={eventoIdFiltro}
        coloreFlag={coloreFlag}
      />
    </div>
  );
}

function InfoCard({
  title,
  value,
}: {
  title: string;
  value: string | null;
}) {
  return (
    <div className="rounded-2xl border border-white/10 bg-black/20 p-4 transition hover:border-white/20 hover:bg-black/30 md:p-5">
      <p className="text-xs font-bold uppercase tracking-[0.2em] text-zinc-500">
        {title}
      </p>

      <p className="mt-2 break-words text-base font-bold text-white md:text-lg">
        {value || "-"}
      </p>
    </div>
  );
}