"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import Image from "next/image";
import {
  ChevronDown,
  ClipboardCheck,
  Pencil,
  Plus,
  X,
} from "lucide-react";

import { AppCard } from "@/components/ui/AppCard";
import { supabase } from "@/lib/supabase-client";
import NuovoAllenamentoModal from "@/components/allenamenti/NuovoAllenamentoModal";

type StatoPresenza = "PM" | "PP" | "P" | "I" | "AG" | "AI";

type StatoPresenzaDb =
  | "presente_mattina"
  | "presente_pomeriggio"
  | "presente_entrambe"
  | "infortunato"
  | "assenza_giustificata"
  | "assenza_ingiustificata";

type Allenamento = {
  id: string;
  club_id: string;
  squadra_id: string | null;
  titolo: string | null;
  tipo_allenamento: string | null;
  data_allenamento: string;
  ora_inizio: string | null;
  ora_fine: string | null;
  luogo: string | null;
  obiettivo: string | null;
  note: string | null;
  durata_minuti: number | null;
  stato: string;
  created_at: string;
};

type Lavoro = {
  id: string;
  allenamento_id: string;
  sezione: string;
  titolo: string | null;
  descrizione: string | null;
  obbiettivo: string | null;
  tempo_lavoro: number | null;
  ripetizione: number | null;
  tempo_recupero: number | null;
  tempo_totale: number | null;
  ordine: number | null;
};

type Giocatore = {
  id: string;
  nome: string;
  cognome: string;
  foto_url: string | null;
};

type Presenza = {
  id: string;
  allenamento_id: string;
  giocatore_id: string;
  club_id: string;
  squadra_id: string | null;
  stato: StatoPresenzaDb;
};

type Profilo = {
  tipo_profilo: string | null;
  last_club_id: string | null;
  last_squadra_id: string | null;
};

type Vista = "odierno" | "resoconto" | "riepilogo" | "elenco";

const STATI_PRESENZA: {
  sigla: StatoPresenza;
  label: string;
  db: StatoPresenzaDb;
}[] = [
  { sigla: "PM", label: "Presente Mattina", db: "presente_mattina" },
  { sigla: "PP", label: "Presente Pomeriggio", db: "presente_pomeriggio" },
  { sigla: "P", label: "Presente", db: "presente_entrambe" },
  { sigla: "I", label: "Infortunio", db: "infortunato" },
  { sigla: "AG", label: "Assente Giustificato", db: "assenza_giustificata" },
  { sigla: "AI", label: "Assente Ingiustificato", db: "assenza_ingiustificata" },
];

const COLORE_STATO: Record<StatoPresenza, string> = {
  P: "bg-green-600 border-green-500 text-white",
  PM: "bg-yellow-400 border-yellow-300 text-black",
  PP: "bg-yellow-400 border-yellow-300 text-black",
  I: "bg-sky-500 border-sky-400 text-white",
  AG: "bg-red-400 border-red-300 text-white",
  AI: "bg-red-800 border-red-700 text-white",
};

function oggiISO() {
  return new Date().toISOString().slice(0, 10);
}

function inizioSettimanaISO() {
  const oggi = new Date();
  const giorno = oggi.getDay();
  const diff = giorno === 0 ? -6 : 1 - giorno;

  oggi.setDate(oggi.getDate() + diff);
  oggi.setHours(0, 0, 0, 0);

  return oggi.toISOString().slice(0, 10);
}

function fineSettimanaISO() {
  const inizio = new Date(inizioSettimanaISO());
  inizio.setDate(inizio.getDate() + 6);

  return inizio.toISOString().slice(0, 10);
}

function formattaData(data: string) {
  return new Intl.DateTimeFormat("it-IT", {
    weekday: "long",
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  }).format(new Date(`${data}T00:00:00`));
}

function PieChart({ items }: { items: { label: string; value: number }[] }) {
  const totale = items.reduce((sum, item) => sum + item.value, 0);

  if (totale <= 0) {
    return (
      <div className="flex h-44 items-center justify-center rounded-2xl border border-zinc-800 bg-zinc-950 text-sm text-zinc-500">
        Nessun minutaggio
      </div>
    );
  }

  const colori = [
    "#ef4444",
    "#f97316",
    "#eab308",
    "#22c55e",
    "#06b6d4",
    "#6366f1",
    "#a855f7",
    "#ec4899",
  ];

  const gradient = items
    .map((item, index) => {
      const start = items
        .slice(0, index)
        .reduce((sum, current) => sum + (current.value / totale) * 100, 0);

      const end = start + (item.value / totale) * 100;

      return `${colori[index % colori.length]} ${start}% ${end}%`;
    })
    .join(", ");

  return (
    <div className="space-y-4">
      <div
        className="mx-auto h-44 w-44 rounded-full"
        style={{ background: `conic-gradient(${gradient})` }}
      />

      <div className="space-y-2">
        {items.map((item) => (
          <div
            key={item.label}
            className="flex items-center justify-between gap-3 text-sm"
          >
            <span className="truncate text-zinc-400">{item.label}</span>
            <span className="font-medium text-white">{item.value} min</span>
          </div>
        ))}
      </div>
    </div>
  );
}


function InfoBox({
  label,
  value,
}: {
  label: string;
  value: string;
}) {
  return (
    <div className="rounded-2xl border border-zinc-800 bg-zinc-900/70 p-4">
      <p className="text-xs font-medium uppercase tracking-wide text-zinc-500">
        {label}
      </p>
      <p className="mt-2 font-semibold text-white">{value}</p>
    </div>
  );
}

export default function Page() {
  const [vista, setVista] = useState<Vista>("riepilogo");
  const [allenamenti, setAllenamenti] = useState<Allenamento[]>([]);
  const [lavori, setLavori] = useState<Lavoro[]>([]);
  const [giocatori, setGiocatori] = useState<Giocatore[]>([]);
  const [presenze, setPresenze] = useState<Presenza[]>([]);
  const [profilo, setProfilo] = useState<Profilo | null>(null);
  const [userId, setUserId] = useState<string | null>(null);
  const [themeColor, setThemeColor] = useState("#d71920");

  const [loading, setLoading] = useState(true);
  const [openId, setOpenId] = useState<string | null>(null);
  const [openNuovoAllenamento, setOpenNuovoAllenamento] = useState(false);
  const [modalPresenzeAllenamento, setModalPresenzeAllenamento] =
    useState<Allenamento | null>(null);

  const [dataDa, setDataDa] = useState(inizioSettimanaISO());
  const [dataA, setDataA] = useState(fineSettimanaISO());

  const isAdmin =
    String(profilo?.tipo_profilo ?? "").toLowerCase() === "admin";

  async function caricaDati() {
    setLoading(true);

    const {
      data: { user },
      error: userError,
    } = await supabase.auth.getUser();

    if (userError || !user) {
      console.error(userError);
      setLoading(false);
      return;
    }

    setUserId(user.id);

    const { data: profiloData, error: profiloError } = await supabase
      .from("profili")
      .select("tipo_profilo, last_club_id, last_squadra_id")
      .eq("auth_user_id", user.id)
      .single();

    if (profiloError || !profiloData?.last_club_id) {
      console.error(profiloError);
      setLoading(false);
      return;
    }

    setProfilo(profiloData);

    const { data: clubData } = await supabase
      .from("club")
      .select("colore_flag")
      .eq("id", profiloData.last_club_id)
      .single();

    setThemeColor(clubData?.colore_flag || "#d71920");

    let allenamentiQuery = supabase
      .from("allenamenti")
      .select("*")
      .eq("club_id", profiloData.last_club_id)
      .order("data_allenamento", { ascending: false });

    if (profiloData.last_squadra_id) {
      allenamentiQuery = allenamentiQuery.eq(
        "squadra_id",
        profiloData.last_squadra_id,
      );
    }

    const { data: allenamentiData, error: allenamentiError } =
      await allenamentiQuery;

    if (allenamentiError) {
      console.error(allenamentiError);
      setLoading(false);
      return;
    }

    let giocatoriQuery = supabase
      .from("giocatori")
      .select("id, nome, cognome, foto_url")
      .eq("club_id", profiloData.last_club_id)
      .eq("attivo", true)
      .order("cognome", { ascending: true });

    if (profiloData.last_squadra_id) {
      giocatoriQuery = giocatoriQuery.eq(
        "squadra_id",
        profiloData.last_squadra_id,
      );
    }

    const { data: giocatoriData, error: giocatoriError } =
      await giocatoriQuery;

    if (giocatoriError) {
      console.error(giocatoriError);
    }

    const idsAllenamenti = allenamentiData?.map((a) => a.id) || [];

    let lavoriData: Lavoro[] = [];
    let presenzeData: Presenza[] = [];

    if (idsAllenamenti.length > 0) {
      const { data: lavoriResult, error: lavoriError } = await supabase
        .from("lavori_allenamento")
        .select("*")
        .in("allenamento_id", idsAllenamenti)
        .order("ordine", { ascending: true });

      if (lavoriError) {
        console.error(lavoriError);
      } else {
        lavoriData = lavoriResult || [];
      }

      const { data: presenzeResult, error: presenzeError } = await supabase
        .from("presenze_allenamenti")
        .select("*")
        .in("allenamento_id", idsAllenamenti);

      if (presenzeError) {
        console.error(presenzeError);
      } else {
        presenzeData = presenzeResult || [];
      }
    }

    setAllenamenti(allenamentiData || []);
    setGiocatori(giocatoriData || []);
    setLavori(lavoriData);
    setPresenze(presenzeData);
    setLoading(false);
  }

 useEffect(() => {
  let mounted = true;

  async function init() {
    if (!mounted) return;
    await caricaDati();
  }

  void init();

  return () => {
    mounted = false;
  };

}, []);

  async function salvaPresenza(
    allenamento: Allenamento,
    giocatoreId: string,
    stato: StatoPresenza,
  ) {
    if (!isAdmin) return;
    if (!profilo?.last_club_id || !userId) return;

    const statoDb = STATI_PRESENZA.find((s) => s.sigla === stato)?.db;

    if (!statoDb) return;

    const payload = {
      allenamento_id: allenamento.id,
      giocatore_id: giocatoreId,
      club_id: profilo.last_club_id,
      squadra_id: profilo.last_squadra_id || allenamento.squadra_id,
      stato: statoDb,
      registrato_da: userId,
      updated_at: new Date().toISOString(),
    };

    const { data, error } = await supabase
      .from("presenze_allenamenti")
      .upsert(payload, {
        onConflict: "allenamento_id,giocatore_id",
      })
      .select("*")
      .single();

    if (error) {
      console.error("Errore salvataggio presenza:", error);
      return;
    }

    setPresenze((current) => {
      const senzaVecchia = current.filter(
        (presenza) =>
          !(
            presenza.allenamento_id === allenamento.id &&
            presenza.giocatore_id === giocatoreId
          ),
      );

      return [...senzaVecchia, data as Presenza];
    });
  }

  async function eliminaPresenza(allenamentoId: string, giocatoreId: string) {
    if (!isAdmin) return;

    const { error } = await supabase
      .from("presenze_allenamenti")
      .delete()
      .eq("allenamento_id", allenamentoId)
      .eq("giocatore_id", giocatoreId);

    if (error) {
      console.error("Errore eliminazione presenza:", error);
      return;
    }

    setPresenze((current) =>
      current.filter(
        (presenza) =>
          !(
            presenza.allenamento_id === allenamentoId &&
            presenza.giocatore_id === giocatoreId
          ),
      ),
    );
  }

  const allenamentiSettimana = useMemo(() => {
    const inizio = inizioSettimanaISO();
    const fine = fineSettimanaISO();

    return allenamenti.filter(
      (allenamento) =>
        allenamento.data_allenamento >= inizio &&
        allenamento.data_allenamento <= fine,
    );
  }, [allenamenti]);

  const allenamentiIntervallo = useMemo(() => {
    return allenamenti.filter(
      (allenamento) =>
        allenamento.data_allenamento >= dataDa &&
        allenamento.data_allenamento <= dataA,
    );
  }, [allenamenti, dataDa, dataA]);

  const allenamentiDaMostrare =
    vista === "riepilogo" ? allenamentiSettimana : allenamentiIntervallo;

  const lavoriPerAllenamento = (allenamentoId: string) => {
    return lavori.filter((lavoro) => lavoro.allenamento_id === allenamentoId);
  };

  const minutiAllenamento = (allenamentoId: string) => {
    return lavoriPerAllenamento(allenamentoId).reduce((totale, lavoro) => {
      return totale + (lavoro.tempo_totale || 0);
    }, 0);
  };

  const statoGiocatore = (
    allenamentoId: string,
    giocatoreId: string,
  ): StatoPresenza | undefined => {
    const statoDb = presenze.find(
      (presenza) =>
        presenza.allenamento_id === allenamentoId &&
        presenza.giocatore_id === giocatoreId,
    )?.stato;

    return STATI_PRESENZA.find((stato) => stato.db === statoDb)?.sigla;
  };

  const presentiAllenamento = (allenamentoId: string) => {
    return presenze.filter((presenza) => {
      if (presenza.allenamento_id !== allenamentoId) return false;

      return [
        "presente_mattina",
        "presente_pomeriggio",
        "presente_entrambe",
      ].includes(presenza.stato);
    }).length;
  };

  const datiGrafico = (allenamentoId: string) => {
    const grouped = lavoriPerAllenamento(allenamentoId).reduce<
      Record<string, number>
    >((acc, lavoro) => {
      const sezione = lavoro.sezione || "Altro";
      acc[sezione] = (acc[sezione] || 0) + (lavoro.tempo_totale || 0);
      return acc;
    }, {});

    return Object.entries(grouped).map(([label, value]) => ({
      label,
      value,
    }));
  };

  const totaleAllenamenti = allenamenti.length;

  const minutaggioTotale = lavori.reduce((totale, lavoro) => {
    return totale + (lavoro.tempo_totale || 0);
  }, 0);
  const allenamentoOdiernoOProssimo = useMemo(() => {
  const oggi = new Date();
  oggi.setHours(0, 0, 0, 0);

  const fineSettimana = new Date(oggi);
  const giorno = oggi.getDay();

  fineSettimana.setDate(
    oggi.getDate() + (giorno === 0 ? 0 : 7 - giorno)
  );
  fineSettimana.setHours(23, 59, 59, 999);

  return [...allenamenti]
    .map((allenamento) => ({
      ...allenamento,
      data: new Date(`${allenamento.data_allenamento}T00:00:00`),
    }))
    .filter(
      (allenamento) =>
        allenamento.data >= oggi &&
        allenamento.data <= fineSettimana
    )
    .sort(
      (a, b) =>
        a.data.getTime() - b.data.getTime()
    )[0] ?? null;
}, [allenamenti]);
  const tabButtonStyle = (tab: Vista) =>
    vista === tab
      ? {
          backgroundColor: themeColor,
          color: "#ffffff",
          boxShadow: `0 12px 30px ${themeColor}33`,
        }
      : undefined;

  return (
    <>
      <div className="space-y-5 pb-8 sm:space-y-6">
        <AppCard>
  <div className="flex w-full flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
    <div className="min-w-0">
      <p className="text-xs font-bold uppercase tracking-[0.22em] text-zinc-500">
        Allenamenti
      </p>

      <h1 className="mt-1 text-2xl font-black tracking-tight text-white sm:text-3xl">
        Planning sedute
      </h1>

      <p className="mt-1 text-sm text-zinc-400">
        Gestisci lavori, presenze e riepiloghi della squadra.
      </p>
    </div>

    {/* PULSANTE CREA SEDUTA - SOLO DESKTOP */}
    {isAdmin && (
    <button
      type="button"
      onClick={() => setOpenNuovoAllenamento(true)}
      className="hidden items-center justify-center gap-2 rounded-2xl px-4 py-3 text-sm font-black text-white transition hover:brightness-110 active:scale-[0.98] lg:inline-flex"
      style={{
        backgroundColor: themeColor,
        boxShadow: `0 16px 36px ${themeColor}38`,
      }}
    >
      <Plus className="h-4 w-4" />
      Crea seduta
    </button>
    )}
  </div>

  {/* TAB SCROLLABILI ORIZZONTALMENTE */}
  <div className="mt-5 -mx-4 overflow-x-auto px-4 sm:mx-0 sm:px-0">
    <div className="flex min-w-max items-center gap-2 rounded-2xl border border-zinc-800 bg-zinc-950/80 p-1 shadow-inner shadow-black/30">
      
      <button
        type="button"
        onClick={() => setVista("odierno")}
        className={`shrink-0 rounded-2xl px-4 py-2.5 text-sm font-bold transition ${
          vista === "odierno"
            ? ""
            : "text-zinc-400 hover:bg-zinc-900 hover:text-white"
        }`}
        style={tabButtonStyle("odierno")}
      >
        Odierno
      </button>

      <button
        type="button"
        onClick={() => setVista("riepilogo")}
        className={`shrink-0 rounded-2xl px-4 py-2.5 text-sm font-bold transition ${
          vista === "riepilogo"
            ? ""
            : "text-zinc-400 hover:bg-zinc-900 hover:text-white"
        }`}
        style={tabButtonStyle("riepilogo")}
      >
        Riepilogo Pianificazione
      </button>

      <button
        type="button"
        onClick={() => setVista("elenco")}
        className={`shrink-0 rounded-2xl px-4 py-2.5 text-sm font-bold transition ${
          vista === "elenco"
            ? ""
            : "text-zinc-400 hover:bg-zinc-900 hover:text-white"
        }`}
        style={tabButtonStyle("elenco")}
      >
        Elenco Lavori
      </button>

      <button
        type="button"
        onClick={() => setVista("resoconto")}
        className={`shrink-0 rounded-2xl px-4 py-2.5 text-sm font-bold transition ${
          vista === "resoconto"
            ? ""
            : "text-zinc-400 hover:bg-zinc-900 hover:text-white"
        }`}
        style={tabButtonStyle("resoconto")}
      >
        Resoconto generale
      </button>

      {/* ULTIMA TAB - SOLO MOBILE/TABLET */}
      {isAdmin && (
      <button
        type="button"
        onClick={() => setOpenNuovoAllenamento(true)}
        className="inline-flex shrink-0 items-center justify-center gap-2 rounded-2xl px-4 py-2.5 text-sm font-black text-white transition hover:brightness-110 active:scale-[0.98] lg:hidden"
        style={{
          backgroundColor: themeColor,
          boxShadow: `0 10px 24px ${themeColor}33`,
        }}
      >
        <Plus className="h-4 w-4" />
        Crea seduta
      </button>
      )}
    </div>
  </div>
</AppCard>

        {loading && (
          <AppCard>
            <p className="text-zinc-400">Caricamento allenamenti...</p>
          </AppCard>
        )}
          {vista === "odierno" && (
  <AppCard>
    {allenamentoOdiernoOProssimo ? (
      <div className="space-y-5">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <p
              className="inline-flex rounded-full px-3 py-1 text-xs font-bold text-white"
              style={{ backgroundColor: themeColor }}
            >
              {allenamentoOdiernoOProssimo.data.toDateString() ===
              new Date().toDateString()
                ? "Allenamento di oggi"
                : "Prossimo allenamento"}
            </p>

            <h2 className="mt-3 text-2xl font-bold text-white">
              {allenamentoOdiernoOProssimo.titolo}
            </h2>

            <p className="mt-1 text-sm text-zinc-400">
              {allenamentoOdiernoOProssimo.data.toLocaleDateString("it-IT", {
                weekday: "long",
                day: "2-digit",
                month: "long",
                year: "numeric",
              })}
              {allenamentoOdiernoOProssimo.ora_inizio
                ? ` · ${allenamentoOdiernoOProssimo.ora_inizio.slice(0, 5)}`
                : ""}
              {allenamentoOdiernoOProssimo.ora_fine
                ? ` - ${allenamentoOdiernoOProssimo.ora_fine.slice(0, 5)}`
                : ""}
            </p>
          </div>
        </div>

        <div className="grid gap-3 md:grid-cols-4">
          <InfoBox label="Luogo" value={allenamentoOdiernoOProssimo.luogo ?? "—"} />
          <InfoBox label="Tipo" value={allenamentoOdiernoOProssimo.tipo_allenamento ?? "—"} />
          <InfoBox label="Durata" value={allenamentoOdiernoOProssimo.durata_minuti ? `${allenamentoOdiernoOProssimo.durata_minuti} min` : "—"} />
          <InfoBox label="Stato" value={allenamentoOdiernoOProssimo.stato} />
        </div>

        {allenamentoOdiernoOProssimo.obiettivo && (
          <div
            className="rounded-2xl border p-4"
            style={{
              borderColor: `${themeColor}55`,
              backgroundColor: `${themeColor}12`,
            }}
          >
            <p
              className="text-xs font-bold uppercase tracking-wide"
              style={{ color: themeColor }}
            >
              Obiettivo allenamento
            </p>
            <p className="mt-2 text-sm text-zinc-200">
              {allenamentoOdiernoOProssimo.obiettivo}
            </p>
          </div>
        )}

        <div className="overflow-x-auto rounded-2xl border border-zinc-800">
          <table className="min-w-[820px] w-full border-collapse text-sm">
            <thead style={{ backgroundColor: themeColor }}>
              <tr className="text-left text-white">
                <th className="px-3 py-3">Sezione</th>
                <th className="px-3 py-3">Descrizione</th>
                <th className="px-3 py-3">Obiettivo</th>
                <th className="px-3 py-3 text-right">Tempo lavoro</th>
                <th className="px-3 py-3 text-right">Rip.</th>
                <th className="px-3 py-3 text-right">Rec.</th>
                <th className="px-3 py-3 text-right">Totale</th>
              </tr>
            </thead>

            <tbody>
              {lavoriPerAllenamento(allenamentoOdiernoOProssimo.id)
                .sort((a, b) => (a.ordine ?? 0) - (b.ordine ?? 0))
                .map((lavoro) => (
                  <tr
                    key={lavoro.id}
                    className="border-t border-zinc-800 bg-zinc-950/70 text-zinc-200"
                  >
                    <td className="px-3 py-3 font-semibold text-white">
                      {lavoro.sezione}
                    </td>
                    <td className="px-3 py-3">
                      {lavoro.titolo || lavoro.descrizione || "—"}
                    </td>
                    <td className="px-3 py-3">
                      {lavoro.obbiettivo ?? "—"}
                    </td>
                    <td className="px-3 py-3 text-right">
                      {lavoro.tempo_lavoro ?? "—"}
                    </td>
                    <td className="px-3 py-3 text-right">
                      {lavoro.ripetizione ?? "—"}
                    </td>
                    <td className="px-3 py-3 text-right">
                      {lavoro.tempo_recupero ?? "—"}
                    </td>
                    <td className="px-3 py-3 text-right font-bold">
                      {lavoro.tempo_totale ?? "—"}
                    </td>
                  </tr>
                ))}
            </tbody>
          </table>
        </div>
      </div>
    ) : (
      <div className="flex min-h-[220px] flex-col items-center justify-center text-center">
        <h3 className="text-lg font-bold text-white">
          Nessun allenamento previsto questa settimana
        </h3>
        <p className="mt-2 text-sm text-zinc-400">
          Non ci sono allenamenti da oggi fino alla fine della settimana corrente.
        </p>
      </div>
    )}
  </AppCard>
)}
        {!loading && vista === "resoconto" && (
          <div className="grid gap-4 md:grid-cols-3">
            <AppCard>
              <p className="text-sm text-zinc-400">Allenamenti totali</p>
              <p className="mt-2 text-3xl font-bold text-white">
                {totaleAllenamenti}
              </p>
            </AppCard>

            <AppCard>
              <p className="text-sm text-zinc-400">Minutaggio totale</p>
              <p className="mt-2 text-3xl font-bold text-white">
                {minutaggioTotale} min
              </p>
            </AppCard>

            <AppCard>
              <p className="text-sm text-zinc-400">Ore totali</p>
              <p className="mt-2 text-3xl font-bold text-white">
                {(minutaggioTotale / 60).toFixed(1)} h
              </p>
            </AppCard>
          </div>
        )}

        {!loading && vista === "elenco" && (
          <AppCard>
            <div className="grid gap-3 sm:grid-cols-2 lg:flex lg:flex-wrap lg:items-end">
              <div>
                <label className="text-sm text-zinc-400">Data da</label>
                <input
                  type="date"
                  value={dataDa}
                  onChange={(e) => setDataDa(e.target.value)}
                  className="mt-1 block w-full rounded-2xl border border-zinc-800 bg-zinc-950 px-3 py-2.5 text-white outline-none"
                  style={{ borderColor: `${themeColor}33` }}
                />
              </div>

              <div>
                <label className="text-sm text-zinc-400">Data a</label>
                <input
                  type="date"
                  value={dataA}
                  onChange={(e) => setDataA(e.target.value)}
                  className="mt-1 block w-full rounded-2xl border border-zinc-800 bg-zinc-950 px-3 py-2.5 text-white outline-none"
                  style={{ borderColor: `${themeColor}33` }}
                />
              </div>

              <button
                onClick={() => {
                  setDataDa(oggiISO());
                  setDataA(oggiISO());
                }}
                className="rounded-xl bg-zinc-900 px-4 py-2 text-sm font-medium text-zinc-300 hover:text-white"
              >
                Oggi
              </button>

              <button
                onClick={() => {
                  setDataDa(inizioSettimanaISO());
                  setDataA(fineSettimanaISO());
                }}
                className="rounded-xl bg-zinc-900 px-4 py-2 text-sm font-medium text-zinc-300 hover:text-white"
              >
                Settimana corrente
              </button>
            </div>
          </AppCard>
        )}

        {!loading && vista !== "resoconto" && vista !== "odierno" && (
          <div className="space-y-4">
            {allenamentiDaMostrare.map((allenamento) => {
              const aperto = openId === allenamento.id;
              const listaLavori = lavoriPerAllenamento(allenamento.id);
              const minuti = minutiAllenamento(allenamento.id);
              const presenti = presentiAllenamento(allenamento.id);

              return (
                <AppCard key={allenamento.id}>
                  <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                    <button
                      onClick={() => setOpenId(aperto ? null : allenamento.id)}
                      className="flex flex-1 items-start justify-between gap-3 rounded-2xl text-left"
                    >
                      <div>
                        <h2 className="text-lg font-semibold text-white">
                          {allenamento.titolo || "Allenamento"}
                        </h2>

                        <p className="text-sm capitalize text-zinc-400">
                          {formattaData(allenamento.data_allenamento)}
                          {allenamento.ora_inizio &&
                            ` · ${allenamento.ora_inizio.slice(0, 5)}`}
                          {allenamento.luogo && ` · ${allenamento.luogo}`}
                        </p>
                      </div>

                      <div className="hidden text-right md:block">
                        <p className="text-sm text-zinc-400">
                          {allenamento.tipo_allenamento || "Seduta"}
                        </p>
                        <p className="text-sm font-medium text-white">
                          {minuti} min · {presenti} presenti
                        </p>
                      </div>

                      <ChevronDown
                        className={`h-5 w-5 text-zinc-500 transition ${
                          aperto ? "rotate-180" : ""
                        }`}
                      />
                    </button>

                    <div className="flex items-center justify-end gap-2 sm:justify-start">
                      {isAdmin && (
                        <Link
                          href={`/allenamenti/${allenamento.id}/modifica`}
                          className="rounded-xl border bg-zinc-950 p-2 text-zinc-300 hover:text-white"
                          style={{ borderColor: `${themeColor}33` }}
                          title="Modifica allenamento"
                        >
                          <Pencil className="h-4 w-4" />
                        </Link>
                      )}

                      <button
                        onClick={() => setModalPresenzeAllenamento(allenamento)}
                        className="rounded-xl border bg-zinc-950 p-2 text-zinc-300 hover:text-white"
                        style={{ borderColor: `${themeColor}33` }}
                        title="Segna presenze"
                      >
                        <ClipboardCheck className="h-4 w-4" />
                      </button>
                    </div>
                  </div>

                  {aperto && (
                    <div className="mt-5 grid gap-5 border-t border-zinc-800 pt-5 lg:grid-cols-[1.4fr_0.8fr]">
                      <div className="space-y-4">
                        {allenamento.obiettivo && (
                          <div>
                            <p className="text-sm text-zinc-500">Obiettivo</p>
                            <p className="text-zinc-300">
                              {allenamento.obiettivo}
                            </p>
                          </div>
                        )}

                        {listaLavori.length === 0 && (
                          <p className="text-sm text-zinc-500">
                            Nessun lavoro inserito.
                          </p>
                        )}

                        {listaLavori.map((lavoro) => (
                          <div
                            key={lavoro.id}
                            className="rounded-xl border border-zinc-800 bg-zinc-950 p-4"
                          >
                            <p
                              className="text-sm font-semibold"
                              style={{ color: themeColor }}
                            >
                              {lavoro.sezione}
                            </p>

                            <p className="mt-2 text-white">
                              {lavoro.descrizione || "Senza descrizione"}
                            </p>

                            <div className="mt-3 flex flex-wrap gap-3 text-sm text-zinc-400">
                              {lavoro.tempo_lavoro !== null && (
                                <span>Lavoro: {lavoro.tempo_lavoro} min</span>
                              )}

                              {lavoro.ripetizione !== null && (
                                <span>Ripetizioni: {lavoro.ripetizione}</span>
                              )}

                              {lavoro.tempo_recupero !== null && (
                                <span>
                                  Recupero: {lavoro.tempo_recupero} min
                                </span>
                              )}

                              {lavoro.tempo_totale !== null && (
                                <span>Totale: {lavoro.tempo_totale} min</span>
                              )}
                            </div>
                          </div>
                        ))}
                      </div>

                      <div className="rounded-2xl border border-zinc-800 bg-zinc-950 p-5">
                        <div className="mb-5 grid grid-cols-2 gap-3">
                          <div className="rounded-xl bg-zinc-900 p-3">
                            <p className="text-xs text-zinc-500">Minuti</p>
                            <p className="text-2xl font-bold text-white">
                              {minuti}
                            </p>
                          </div>

                          <div className="rounded-xl bg-zinc-900 p-3">
                            <p className="text-xs text-zinc-500">Presenti</p>
                            <p className="text-2xl font-bold text-white">
                              {presenti}
                            </p>
                          </div>
                        </div>

                        <PieChart items={datiGrafico(allenamento.id)} />
                      </div>
                    </div>
                  )}
                </AppCard>
              );
            })}

            {allenamentiDaMostrare.length === 0 && (
              <AppCard>
                <p className="text-zinc-400">
                  Nessun allenamento trovato per il periodo selezionato.
                </p>
              </AppCard>
            )}
          </div>
        )}
      </div>

      {openNuovoAllenamento && (
        <div className="fixed inset-0 z-[9999] overflow-y-auto bg-black/80 px-3 py-4 backdrop-blur-sm sm:px-6 sm:py-8">
          <div
            className="mx-auto max-w-7xl rounded-3xl border bg-[#090909] p-4 shadow-2xl sm:p-6"
            style={{
              borderColor: `${themeColor}55`,
              boxShadow: `0 30px 80px ${themeColor}22`,
            }}
          >
            <NuovoAllenamentoModal
              themeColor={themeColor}
              isAdmin={isAdmin}
              onClose={() => setOpenNuovoAllenamento(false)}
              onSaved={async () => {
                setOpenNuovoAllenamento(false);
                await caricaDati();
              }}
            />
          </div>
        </div>
      )}

      {modalPresenzeAllenamento && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4">
          <div
            className="max-h-[90vh] w-full max-w-5xl overflow-hidden rounded-2xl border bg-zinc-950 shadow-2xl"
            style={{ borderColor: `${themeColor}55` }}
          >
            <div className="flex items-center justify-between border-b border-zinc-800 p-5">
              <div>
                <h2 className="text-xl font-bold text-white">
                  Presenze allenamento
                </h2>
                <p className="text-sm text-zinc-400">
                  {formattaData(modalPresenzeAllenamento.data_allenamento)}
                </p>
              </div>

              <button
                onClick={() => setModalPresenzeAllenamento(null)}
                className="rounded-xl bg-zinc-900 p-2 text-zinc-400 hover:text-white"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <div className="max-h-[70vh] space-y-3 overflow-y-auto p-5">
              {giocatori.map((giocatore) => {
                const statoAttivo = statoGiocatore(
                  modalPresenzeAllenamento.id,
                  giocatore.id,
                );

                return (
                  <div
                    key={giocatore.id}
                    className="flex flex-wrap items-center justify-between gap-4 rounded-2xl border border-zinc-800 bg-zinc-900/60 p-4"
                  >
                    <div className="flex items-center gap-3">
                      {giocatore.foto_url ? (
                        <Image
                          src={giocatore.foto_url}
                          alt={`${giocatore.nome} ${giocatore.cognome}`}
                          width={48}
                          height={48}
                          className="h-12 w-12 rounded-full object-cover"
                        />
                      ) : (
                        <div
                          className="flex h-12 w-12 items-center justify-center rounded-full text-sm font-bold text-white"
                          style={{ backgroundColor: `${themeColor}66` }}
                        >
                          {giocatore.nome.charAt(0)}
                          {giocatore.cognome.charAt(0)}
                        </div>
                      )}

                      <div>
                        <p className="font-semibold text-white">
                          {giocatore.nome} {giocatore.cognome}
                        </p>
                        <p className="text-sm text-zinc-500">
                          {statoAttivo
                            ? STATI_PRESENZA.find(
                                (stato) => stato.sigla === statoAttivo,
                              )?.label
                            : "Presenza non segnata"}
                        </p>
                      </div>
                    </div>

                    {isAdmin && (
                    <div className="grid grid-cols-3 gap-2 sm:flex sm:flex-wrap">
                      {STATI_PRESENZA.map((stato) => {
                        const active = statoAttivo === stato.sigla;

                        return (
                          <button
                            key={stato.sigla}
                            onClick={() => {
                              if (active) {
                                eliminaPresenza(
                                  modalPresenzeAllenamento.id,
                                  giocatore.id,
                                );
                                return;
                              }

                              salvaPresenza(
                                modalPresenzeAllenamento,
                                giocatore.id,
                                stato.sigla,
                              );
                            }}
                            className={`group flex h-10 w-full items-center justify-center overflow-hidden rounded-xl border px-2 text-sm font-bold transition-all duration-200 disabled:cursor-not-allowed disabled:opacity-50 sm:w-10 sm:hover:w-48 ${
                              active
                                ? COLORE_STATO[stato.sigla]
                                : "border-zinc-700 bg-zinc-950 text-zinc-300 hover:text-white"
                            }`}
                            style={
                              !active
                                ? { borderColor: `${themeColor}33` }
                                : undefined
                            }
                            title={stato.label}
                          >
                            <span className="shrink-0">{stato.sigla}</span>
                            <span className="ml-2 hidden whitespace-nowrap text-xs font-medium sm:group-hover:inline">
                              {stato.label}
                            </span>
                          </button>
                        );
                      })}
                    </div>
                    )}
                  </div>
                );
              })}

              {giocatori.length === 0 && (
                <p className="text-zinc-400">
                  Nessun giocatore trovato per la squadra selezionata.
                </p>
              )}
            </div>
          </div>
        </div>
      )}
    </>
  );
}