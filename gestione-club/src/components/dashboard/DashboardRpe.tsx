// src/components/dashboard/DashboardRpe.tsx
//
// Card RPE/benessere mostrata al posto di "Stato infortuni e rientri
// previsti" quando chi guarda la dashboard è un profilo "giocatore": non ha
// senso mostrargli lo stato infortuni di tutta la squadra (dato sensibile
// di altri atleti), mentre le sue compilazioni RPE/benessere sono utili e
// riguardano solo lui.

import { createClient } from "@/lib/supabase-server";

type TipoCompilazione = "campo" | "palestra" | "mattino";

type MisurazioneBenessereDashboard = {
  id: string;
  data_compilazione: string;
  tipo_compilazione: TipoCompilazione;
  rpe: number | null;
  created_at: string;
};

async function getContesto() {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return {
      supabase,
      clubId: null,
      squadraId: null,
      profiloId: null,
      themeColor: "#d71920",
    };
  }

  const { data: profilo } = await supabase
    .from("profili")
    .select("id, last_club_id, last_squadra_id")
    .eq("auth_user_id", user.id)
    .single();

  if (!profilo?.last_club_id) {
    return {
      supabase,
      clubId: null,
      squadraId: null,
      profiloId: null,
      themeColor: "#d71920",
    };
  }

  const { data: club } = await supabase
    .from("club")
    .select("colore_flag")
    .eq("id", profilo.last_club_id)
    .single();

  return {
    supabase,
    clubId: profilo.last_club_id as string,
    squadraId: (profilo.last_squadra_id as string | null) ?? null,
    profiloId: profilo.id as string,
    themeColor: club?.colore_flag || "#d71920",
  };
}

// RPE 1-10: più è alto più il carico percepito è duro (stessa scala usata
// in Misurazioni > Benessere).
function getRpeColore(valore: number) {
  if (valore <= 4) return "#34d399";
  if (valore <= 7) return "#f59e0b";
  return "#f87171";
}

function tipoLabel(tipo: TipoCompilazione) {
  if (tipo === "campo") return "Allenamento in campo";
  if (tipo === "palestra") return "Allenamento in palestra";
  return "Questionario del mattino";
}

function formatData(data: string) {
  return new Intl.DateTimeFormat("it-IT", {
    day: "2-digit",
    month: "short",
  }).format(new Date(`${data}T12:00:00`));
}

export default async function DashboardRpe() {
  const { supabase, clubId, squadraId, profiloId, themeColor } =
    await getContesto();

  if (!clubId || !profiloId) {
    return (
      <div
        className="rounded-2xl border bg-[#171717] p-6"
        style={{ borderColor: `${themeColor}33` }}
      >
        <h2 className="text-xl font-bold text-white">RPE e benessere</h2>
        <p className="mt-4 text-zinc-500">Nessun club attivo selezionato.</p>
      </div>
    );
  }

  let giocatoreQuery = supabase
    .from("giocatori")
    .select("id")
    .eq("club_id", clubId)
    .eq("id_atleta", profiloId);

  if (squadraId) {
    giocatoreQuery = giocatoreQuery.eq("squadra_id", squadraId);
  }

  const { data: giocatore, error: giocatoreError } =
    await giocatoreQuery.maybeSingle();

  if (giocatoreError) {
    console.error("Errore recupero giocatore collegato (dashboard RPE):", giocatoreError);
  }

  if (!giocatore) {
    return (
      <div
        className="rounded-2xl border bg-[#171717] p-6"
        style={{ borderColor: `${themeColor}33` }}
      >
        <h2 className="text-xl font-bold text-white">RPE e benessere</h2>
        <p className="mt-4 text-zinc-500">
          Il tuo profilo non è ancora collegato a un giocatore della squadra
          attiva.
        </p>
      </div>
    );
  }

  const { data: benessereRaw, error: benessereError } = await supabase
    .from("misurazioni_benessere")
    .select("id, data_compilazione, tipo_compilazione, rpe, created_at")
    .eq("club_id", clubId)
    .eq("giocatore_id", giocatore.id)
    .order("data_compilazione", { ascending: false })
    .order("created_at", { ascending: false })
    .limit(5);

  if (benessereError) {
    console.error("Errore caricamento RPE dashboard:", benessereError);
  }

  const benessere = (benessereRaw ?? []) as MisurazioneBenessereDashboard[];

  const oggi = new Date();
  const settimanaFa = new Date(oggi);
  settimanaFa.setDate(oggi.getDate() - 7);
  const settimanaFaIso = settimanaFa.toISOString().slice(0, 10);

  const valoriRpeSettimana = benessere
    .filter(
      (m) => m.rpe !== null && m.data_compilazione >= settimanaFaIso
    )
    .map((m) => m.rpe as number);

  const rpeMedio7gg =
    valoriRpeSettimana.length > 0
      ? valoriRpeSettimana.reduce((sum, v) => sum + v, 0) /
        valoriRpeSettimana.length
      : null;

  return (
    <div
      className="rounded-2xl border bg-[#171717] p-6"
      style={{ borderColor: `${themeColor}33` }}
    >
      <div className="mb-5 flex items-center justify-between gap-4">
        <h2 className="text-xl font-bold text-white">RPE e benessere</h2>

        <span
          className="h-2.5 w-2.5 rounded-full"
          style={{ backgroundColor: themeColor }}
        />
      </div>

      <div className="mb-5 grid grid-cols-2 gap-3">
        <div className="rounded-xl bg-black/30 p-3">
          <p className="text-xs text-zinc-500">RPE medio (7gg)</p>
          <p
            className="mt-1 text-xl font-black"
            style={{
              color: rpeMedio7gg !== null ? getRpeColore(rpeMedio7gg) : "#ffffff",
            }}
          >
            {rpeMedio7gg !== null ? `${rpeMedio7gg.toFixed(1)}/10` : "—"}
          </p>
        </div>

        <div className="rounded-xl bg-black/30 p-3">
          <p className="text-xs text-zinc-500">Compilazioni registrate</p>
          <p className="mt-1 text-xl font-black text-white">
            {benessere.length}
          </p>
        </div>
      </div>

      <div className="space-y-3">
        {benessere.length === 0 && (
          <p className="text-zinc-500">
            Nessuna compilazione RPE/benessere registrata.
          </p>
        )}

        {benessere.map((misurazione) => (
          <div
            key={misurazione.id}
            className="flex items-center justify-between gap-4 rounded-2xl border border-white/5 bg-white/[0.03] p-3"
          >
            <div className="min-w-0">
              <p className="truncate font-bold text-white">
                {tipoLabel(misurazione.tipo_compilazione)}
              </p>
              <p className="truncate text-sm text-zinc-400">
                {formatData(misurazione.data_compilazione)}
              </p>
            </div>

            <span
              className="shrink-0 rounded-full border px-3 py-1 text-xs font-bold"
              style={{
                backgroundColor:
                  misurazione.rpe !== null
                    ? getRpeColore(misurazione.rpe)
                    : "transparent",
                borderColor:
                  misurazione.rpe !== null
                    ? getRpeColore(misurazione.rpe)
                    : "#3f3f46",
                color: misurazione.rpe !== null ? "#0a0a0a" : "#a1a1aa",
              }}
            >
              {misurazione.rpe !== null ? `RPE ${misurazione.rpe}/10` : "—"}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}
