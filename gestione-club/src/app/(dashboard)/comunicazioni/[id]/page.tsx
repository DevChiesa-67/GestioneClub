import { notFound, redirect } from "next/navigation";
import {
  ArrowLeft,
  CalendarDays,
  Clock3,
  Megaphone,
  Send,
  Users,
} from "lucide-react";

import { createClient } from "@/lib/supabase-server";
import { comunicazioneVisibilePerProfilo } from "@/lib/comunicazioni/destinatari";

type PageProps = {
  params: Promise<{
    id: string;
  }>;
};



function formatData(value: string | null) {
  if (!value) return "—";

  return new Intl.DateTimeFormat("it-IT", {
    day: "2-digit",
    month: "long",
    year: "numeric",
  }).format(new Date(value));
}

function formatOra(value: string | null) {
  if (!value) return "—";

  return new Intl.DateTimeFormat("it-IT", {
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(value));
}

export default async function ComunicazionePage({ params }: PageProps) {
  const { id } = await params;

  const supabase = await createClient();

  const {
    data: { user },
    error: userError,
  } = await supabase.auth.getUser();

  if (userError || !user) {
    redirect("/login");
  }

  // 1. Profilo corrente
  const { data: profilo, error: profiloError } = await supabase
    .from("profili")
    .select("id,tipo_profilo,last_club_id,last_squadra_id")
    .eq("auth_user_id", user.id)
    .single();

  if (profiloError || !profilo?.last_club_id) {
    notFound();
  }

  // 2. Club attivo + branding dinamico
  const { data: club } = await supabase
    .from("club")
    .select("id,nome,colore_flag")
    .eq("id", profilo.last_club_id)
    .single();

  const coloreClub = club?.colore_flag ?? "#ffffff";

  // 3. Comunicazione
const { data: comunicazione, error: comunicazioneError } = await supabase
  .from("comunicazioni")
  .select(`
    id,
    club_id,
    titolo,
    descrizione,
    destinatari_tipo,
    destinatari_profili,
    destinatari_giocatori,
    created_at,
    updated_at,
    created_by
  `)
  .eq("id", id)
  .eq("club_id", profilo.last_club_id)
  .single();

  if (comunicazioneError || !comunicazione) {
    notFound();
  }

  if (
    !comunicazioneVisibilePerProfilo(comunicazione, {
      id: profilo.id,
      tipoProfilo: profilo.tipo_profilo,
    })
  ) {
    notFound();
  }

  // 4. Destinatari reali della comunicazione
  const destinatariProfili = comunicazione.destinatari_profili ?? [];
const destinatariGiocatori = comunicazione.destinatari_giocatori ?? [];

const isTutti = comunicazione.destinatari_tipo?.includes("Tutti");

const numeroDestinatari = isTutti
  ? "Tutti"
  : destinatariProfili.length + destinatariGiocatori.length;

  // Numero utenti unici
 
  return (
    <div className="space-y-6">
      {/* HEADER */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-3">
          <a
            href="/comunicazioni"
            className="flex h-10 w-10 items-center justify-center rounded-xl border border-zinc-800 bg-zinc-900 text-zinc-400 transition hover:border-zinc-700 hover:text-white"
          >
            <ArrowLeft size={18} />
          </a>

          <div>
            <p className="text-sm text-zinc-500">Comunicazione</p>

            <h1 className="text-2xl font-semibold tracking-tight text-white">
              {comunicazione.titolo}
            </h1>
          </div>
        </div>

        <div
          className="inline-flex items-center gap-2 rounded-xl px-4 py-2 text-sm font-medium"
          style={{
            backgroundColor: `${coloreClub}18`,
            color: coloreClub,
            border: `1px solid ${coloreClub}35`,
          }}
        >
          <Send size={16} />
          Inviata
        </div>
      </div>

      {/* INDICATORI */}
      <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard
          icon={<Users size={20} />}
          label="Destinatari"
          value={String(numeroDestinatari)}
          coloreClub={coloreClub}
        />

        <StatCard
          icon={<CalendarDays size={20} />}
          label="Data invio"
          value={formatData(comunicazione.created_at)}
          coloreClub={coloreClub}
        />

        <StatCard
          icon={<Clock3 size={20} />}
          label="Ora invio"
          value={formatOra(comunicazione.created_at)}
          coloreClub={coloreClub}
        />

        <StatCard
          icon={<Megaphone size={20} />}
          label="Stato"
          value="Inviata"
          coloreClub={coloreClub}
        />
      </section>

      {/* CONTENUTO */}
      <section className="rounded-2xl border border-zinc-800 bg-zinc-950 p-6">
        <div className="mb-5 flex items-center gap-3">
          <div
            className="flex h-10 w-10 items-center justify-center rounded-xl"
            style={{
              backgroundColor: `${coloreClub}18`,
              color: coloreClub,
            }}
          >
            <Megaphone size={20} />
          </div>

          <div>
            <h2 className="font-semibold text-white">
              Contenuto comunicazione
            </h2>

            <p className="text-sm text-zinc-500">
              Messaggio inviato ai destinatari
            </p>
          </div>
        </div>

        <div className="whitespace-pre-wrap text-sm leading-7 text-zinc-300">
{comunicazione.descrizione || "Nessun contenuto disponibile."}        </div>
      </section>

      {/* DESTINATARI */}
     {/* DESTINATARI */}
<section className="overflow-hidden rounded-2xl border border-zinc-800 bg-zinc-950">
  <div className="flex items-center justify-between border-b border-zinc-800 px-6 py-5">
    <div>
      <h2 className="font-semibold text-white">Destinatari</h2>

      <p className="mt-1 text-sm text-zinc-500">
        {isTutti
          ? "La comunicazione è stata inviata a tutti."
          : `${numeroDestinatari} utenti hanno ricevuto la comunicazione`}
      </p>
    </div>

    <div
      className="flex h-10 min-w-10 items-center justify-center rounded-xl px-3 text-sm font-semibold"
      style={{
        backgroundColor: `${coloreClub}18`,
        color: coloreClub,
      }}
    >
      {numeroDestinatari}
    </div>
  </div>

  <div className="p-6">
    <div className="flex flex-wrap gap-2">
      {comunicazione.destinatari_tipo?.map((tipo: string) => (
        <span
          key={tipo}
          className="rounded-full border border-zinc-800 bg-zinc-900 px-3 py-1.5 text-xs text-zinc-300"
        >
          {tipo}
        </span>
      ))}
    </div>

    {!isTutti && numeroDestinatari === 0 && (
      <p className="mt-4 text-sm text-zinc-500">
        Nessun destinatario specifico selezionato.
      </p>
    )}
  </div>
</section>
    </div>
  );
}

function StatCard({
  icon,
  label,
  value,
  coloreClub,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
  coloreClub: string;
}) {
  return (
    <div className="rounded-2xl border border-zinc-800 bg-zinc-950 p-5">
      <div className="flex items-start justify-between gap-4">
        <div className="min-w-0">
          <p className="text-sm text-zinc-500">{label}</p>

          <p className="mt-2 truncate text-xl font-semibold text-white">
            {value}
          </p>
        </div>

        <div
          className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl"
          style={{
            backgroundColor: `${coloreClub}18`,
            color: coloreClub,
          }}
        >
          {icon}
        </div>
      </div>
    </div>
  );
}