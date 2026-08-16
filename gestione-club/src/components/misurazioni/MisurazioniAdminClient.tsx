// src/components/misurazioni/MisurazioniAdminClient.tsx

"use client";
import Image from "next/image";
import { useRouter } from "next/navigation";
import { FormEvent, useMemo, useState ,useEffect,useRef} from "react";
import {
  Activity,
  CalendarDays,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  Dumbbell,
  Gauge,
  HeartPulse,
  Loader2,
  Pencil,
  Plus,
  Ruler,
  Search,Check,
  Scale,Sunrise,Trash2,UsersRound,
  UserRound,
  X,
} from "lucide-react";

import {
  creaMisurazioneAntropometricaAction,
  aggiornaMisurazioneAntropometricaAction,
  eliminaMisurazioneAntropometricaAction,
  creaMisurazioneBenessereAction,
} from "@/app/(dashboard)/misurazioni/actions";
import { DateInput } from "@/components/ui/DateInput";

import type {
  GiocatoreMisurazioni,
  MisurazioneAntropometrica,
  MisurazioneBenessereAdmin,
} from "@/app/(dashboard)/misurazioni/page";

type Props = {
  coloreClub: string;
  nomeClub: string;
  giocatori: GiocatoreMisurazioni[];
  misurazioni: MisurazioneAntropometrica[];
  benessere: MisurazioneBenessereAdmin[];
};

type TabPrincipale = "antropometria" | "benessere";

type Fastidio = "no" | "leggero" | "preoccupante";

// RPE 1-10: più è alto più il carico percepito è duro.
function getRpeColore(valore: number) {
  if (valore <= 4) return "#34d399";
  if (valore <= 7) return "#f59e0b";
  return "#f87171";
}

// Hooper 1-7: 1 = buono, 7 = cattivo, stessa direzione per tutte le domande.
function getHooperColore(valore: number) {
  if (valore <= 2) return "#34d399";
  if (valore <= 4) return "#f59e0b";
  return "#f87171";
}

function getFastidioBadge(fastidio: Fastidio | null) {
  if (fastidio === "preoccupante") {
    return { label: "Da monitorare", color: "#f87171" };
  }

  if (fastidio === "leggero") {
    return { label: "Fastidio leggero", color: "#f59e0b" };
  }

  return { label: "Tutto bene", color: "#34d399" };
}

function tipoCompilazioneLabel(
  tipo: MisurazioneBenessereAdmin["tipo_compilazione"],
) {
  if (tipo === "campo") return "Allenamento in campo";
  if (tipo === "palestra") return "Allenamento in palestra";
  return "Questionario del mattino";
}

type StepBenessere = "tipo" | "campo" | "palestra" | "mattino";

const SEDUTE_CAMPO = ["Mattino", "Sera"];
const SEDUTE_PALESTRA = ["Forza (A)", "Potenza (B)", "Richiamo (C)"];

const FASTIDIO_OPZIONI: { value: Fastidio; label: string }[] = [
  { value: "no", label: "No, tutto bene" },
  { value: "leggero", label: "Sì, un fastidio leggero" },
  { value: "preoccupante", label: "Sì, qualcosa che preoccupa" },
];

const ANCORAGGI_RPE_CAMPO = [
  { valore: 3, testo: "riscaldamento, respiri ma parli normalmente" },
  { valore: 5, testo: "respiro pesante, parli a frasi corte" },
  { valore: 7, testo: "molto duro, parli a parole singole" },
  { valore: 9, testo: "come gli ultimi dieci minuti di una partita vera" },
];

const ANCORAGGI_RPE_PALESTRA = [
  { valore: 3, testo: "riscaldamento e mobilità, nessuno sforzo" },
  { valore: 5, testo: "carichi leggeri, potrebbe farne molte di più" },
  { valore: 7, testo: "pesante, alla fine della serie ne avrebbe fatte altre tre" },
  { valore: 9, testo: "quasi il massimo, alla fine ne avrebbe fatta forse una" },
];

function formatNumber(
  value: number | null,
  suffix = "",
): string {
  if (value === null || value === undefined) {
    return "—";
  }

  return `${new Intl.NumberFormat("it-IT", {
    maximumFractionDigits: 2,
  }).format(value)}${suffix}`;
}

function formatDate(value: string): string {
  return new Intl.DateTimeFormat("it-IT", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  }).format(new Date(`${value}T12:00:00`));
}

function getToday(): string {
  return new Date().toISOString().slice(0, 10);
}

export default function MisurazioniAdminClient({
  coloreClub,
  nomeClub,
  giocatori,
  misurazioni,
  benessere,
}: Props) {
  const [tabPrincipale, setTabPrincipale] =
    useState<TabPrincipale>("antropometria");
  const [modalAperta, setModalAperta] = useState(false);
  const [giocatoreFiltro, setGiocatoreFiltro] =
    useState("tutti");
  const [tipoBenessereFiltro, setTipoBenessereFiltro] =
    useState<"tutti" | "campo" | "palestra" | "mattino">("tutti");
  const [dataDa, setDataDa] = useState("");
  const [dataA, setDataA] = useState("");
  const [salvataggio, setSalvataggio] = useState(false);
  const [messaggio, setMessaggio] = useState<{
    tipo: "success" | "error";
    testo: string;
  } | null>(null);
  const [giocatoriSelezionatiIds, setGiocatoriSelezionatiIds] =
  useState<string[]>([]);

  const router = useRouter();
  const [misurazioneInModifica, setMisurazioneInModifica] =
    useState<MisurazioneAntropometrica | null>(null);
  const [salvataggioModifica, setSalvataggioModifica] = useState(false);
  const [messaggioModifica, setMessaggioModifica] = useState<{
    tipo: "success" | "error";
    testo: string;
  } | null>(null);
  const [eliminazioneInCorsoId, setEliminazioneInCorsoId] = useState<
    string | null
  >(null);

  // Modulo "Come va" compilato dallo staff per conto di un atleta.
  const [modalBenessereAperta, setModalBenessereAperta] = useState(false);
  const [stepBenessere, setStepBenessere] = useState<StepBenessere>("tipo");
  const [giocatoreIdBenessere, setGiocatoreIdBenessere] = useState("");
  const [sedutaBenessere, setSedutaBenessere] = useState("");
  const [minutaggioBenessere, setMinutaggioBenessere] = useState("");
  const [rpeBenessere, setRpeBenessere] = useState<number | null>(null);
  const [fastidioBenessere, setFastidioBenessere] = useState<Fastidio | null>(
    null,
  );
  const [fastidioDettaglioBenessere, setFastidioDettaglioBenessere] =
    useState("");
  const [sonnoBenessere, setSonnoBenessere] = useState<number | null>(null);
  const [stanchezzaBenessere, setStanchezzaBenessere] = useState<
    number | null
  >(null);
  const [indolenzimentoBenessere, setIndolenzimentoBenessere] = useState<
    number | null
  >(null);
  const [stressBenessere, setStressBenessere] = useState<number | null>(
    null,
  );
  const [salvataggioBenessere, setSalvataggioBenessere] = useState(false);
  const [messaggioBenessere, setMessaggioBenessere] = useState<{
    tipo: "success" | "error";
    testo: string;
  } | null>(null);

  function resetFormBenessere() {
    setStepBenessere("tipo");
    setGiocatoreIdBenessere("");
    setSedutaBenessere("");
    setMinutaggioBenessere("");
    setRpeBenessere(null);
    setFastidioBenessere(null);
    setFastidioDettaglioBenessere("");
    setSonnoBenessere(null);
    setStanchezzaBenessere(null);
    setIndolenzimentoBenessere(null);
    setStressBenessere(null);
  }

  function apriStepBenessere(nuovoStep: "campo" | "palestra" | "mattino") {
    setSedutaBenessere("");
    setMinutaggioBenessere("");
    setRpeBenessere(null);
    setFastidioBenessere(null);
    setFastidioDettaglioBenessere("");
    setSonnoBenessere(null);
    setStanchezzaBenessere(null);
    setIndolenzimentoBenessere(null);
    setStressBenessere(null);
    setStepBenessere(nuovoStep);
  }

  function chiudiModalBenessere() {
    setModalBenessereAperta(false);
    setMessaggioBenessere(null);
    resetFormBenessere();
  }

  async function handleSubmitBenessere() {
    setMessaggioBenessere(null);

    if (!giocatoreIdBenessere) {
      setMessaggioBenessere({
        tipo: "error",
        testo: "Seleziona per quale atleta stai compilando il modulo.",
      });
      return;
    }

    const formData = new FormData();
    formData.set("giocatore_id", giocatoreIdBenessere);
    formData.set("data_compilazione", getToday());
    formData.set("tipo_compilazione", stepBenessere);

    if (stepBenessere === "campo" || stepBenessere === "palestra") {
      if (!sedutaBenessere) {
        setMessaggioBenessere({
          tipo: "error",
          testo: "Indica quale seduta.",
        });
        return;
      }

      if (rpeBenessere === null) {
        setMessaggioBenessere({
          tipo: "error",
          testo: "Indica quanto è stata dura questa seduta.",
        });
        return;
      }

      const minutaggio = Number(minutaggioBenessere);
      if (!Number.isInteger(minutaggio) || minutaggio < 1 || minutaggio > 600) {
        setMessaggioBenessere({
          tipo: "error",
          testo: "Indica il minutaggio di lavoro (da 1 a 600 minuti).",
        });
        return;
      }

      if (!fastidioBenessere) {
        setMessaggioBenessere({
          tipo: "error",
          testo: "Indica se ha qualche fastidio o dolore.",
        });
        return;
      }

      formData.set("seduta", sedutaBenessere);
      formData.set("rpe", String(rpeBenessere));
      formData.set("minutaggio_lavoro", String(minutaggio));
      formData.set("fastidio", fastidioBenessere);

      if (fastidioBenessere !== "no") {
        formData.set("fastidio_dettaglio", fastidioDettaglioBenessere);
      }
    } else if (stepBenessere === "mattino") {
      if (
        sonnoBenessere === null ||
        stanchezzaBenessere === null ||
        indolenzimentoBenessere === null ||
        stressBenessere === null
      ) {
        setMessaggioBenessere({
          tipo: "error",
          testo: "Rispondi a tutte e quattro le domande.",
        });
        return;
      }

      formData.set("sonno", String(sonnoBenessere));
      formData.set("stanchezza", String(stanchezzaBenessere));
      formData.set("indolenzimento", String(indolenzimentoBenessere));
      formData.set("stress", String(stressBenessere));
    } else {
      return;
    }

    setSalvataggioBenessere(true);

    const result = await creaMisurazioneBenessereAction(formData);

    setSalvataggioBenessere(false);

    if (!result.success) {
      setMessaggioBenessere({ tipo: "error", testo: result.message });
      return;
    }

    setMessaggioBenessere({ tipo: "success", testo: result.message });
    router.refresh();

    window.setTimeout(() => {
      chiudiModalBenessere();
    }, 800);
  }

const giocatoriSelezionati = useMemo(() => {
  const ids = new Set(giocatoriSelezionatiIds);

  return giocatori.filter((giocatore) =>
    ids.has(giocatore.id),
  );
}, [giocatori, giocatoriSelezionatiIds]);

function toggleGiocatore(giocatoreId: string) {
  setGiocatoriSelezionatiIds((current) => {
    if (current.includes(giocatoreId)) {
      return current.filter((id) => id !== giocatoreId);
    }

    return [...current, giocatoreId];
  });
}

function selezionaTuttiGiocatori() {
  setGiocatoriSelezionatiIds(
    giocatori.map((giocatore) => giocatore.id),
  );
}

function deselezionaTuttiGiocatori() {
  setGiocatoriSelezionatiIds([]);
}

function chiudiModal() {
  setModalAperta(false);
  setMessaggio(null);
  setGiocatoriSelezionatiIds([]);
}

function apriModifica(misurazione: MisurazioneAntropometrica) {
  setMessaggioModifica(null);
  setMisurazioneInModifica(misurazione);
}

function chiudiModifica() {
  setMisurazioneInModifica(null);
  setMessaggioModifica(null);
}

async function handleSubmitModifica(
  event: FormEvent<HTMLFormElement>,
) {
  event.preventDefault();

  if (!misurazioneInModifica) return;

  setSalvataggioModifica(true);
  setMessaggioModifica(null);

  const formData = new FormData(event.currentTarget);

  const result = await aggiornaMisurazioneAntropometricaAction(formData);

  setSalvataggioModifica(false);

  if (!result.success) {
    setMessaggioModifica({ tipo: "error", testo: result.message });
    return;
  }

  setMessaggioModifica({ tipo: "success", testo: result.message });
  router.refresh();

  window.setTimeout(() => {
    setMisurazioneInModifica(null);
    setMessaggioModifica(null);
  }, 800);
}

async function handleElimina(misurazione: MisurazioneAntropometrica) {
  const nomeAtleta = misurazione.giocatore
    ? `${misurazione.giocatore.nome} ${misurazione.giocatore.cognome}`
    : "questo atleta";

  const confermato = window.confirm(
    `Eliminare la misurazione del ${formatDate(
      misurazione.data_misurazione,
    )} per ${nomeAtleta}? L'operazione non è reversibile.`,
  );

  if (!confermato) return;

  setEliminazioneInCorsoId(misurazione.id);

  const result = await eliminaMisurazioneAntropometricaAction(
    misurazione.id,
  );

  setEliminazioneInCorsoId(null);

  if (!result.success) {
    window.alert(result.message);
    return;
  }

  router.refresh();
}
  const misurazioniFiltrate = useMemo(() => {
    return misurazioni.filter((misurazione) => {
      const matchGiocatore =
        giocatoreFiltro === "tutti" ||
        misurazione.giocatore_id === giocatoreFiltro;

      const matchDataDa =
        !dataDa ||
        misurazione.data_misurazione >= dataDa;

      const matchDataA =
        !dataA ||
        misurazione.data_misurazione <= dataA;

      return (
        matchGiocatore &&
        matchDataDa &&
        matchDataA
      );
    });
  }, [
    misurazioni,
    giocatoreFiltro,
    dataDa,
    dataA,
  ]);

  const benessereFiltrato = useMemo(() => {

    return benessere.filter((compilazione) => {
      const matchGiocatore =
        giocatoreFiltro === "tutti" ||
        compilazione.giocatore_id === giocatoreFiltro;

      const matchDataDa =
        !dataDa || compilazione.data_compilazione >= dataDa;

      const matchDataA =
        !dataA || compilazione.data_compilazione <= dataA;

      const matchTipo =
        tipoBenessereFiltro === "tutti" ||
        compilazione.tipo_compilazione === tipoBenessereFiltro;

      return (
        matchGiocatore &&
        matchDataDa &&
        matchDataA &&
        matchTipo
      );
    });
  }, [
    benessere,
    giocatoreFiltro,
    tipoBenessereFiltro,
    dataDa,
    dataA,
  ]);

  const ultimaMisurazione =
    misurazioni.length > 0 ? misurazioni[0] : null;

  const atletiMisurati = new Set(
    misurazioni.map((misurazione) => misurazione.giocatore_id),
  ).size;

  const ultimaCompilazioneBenessere =
    benessere.length > 0 ? benessere[0] : null;

  const rpeMedioSquadra7gg = useMemo(() => {
    const settePriodni = Date.now() - 7 * 24 * 60 * 60 * 1000;

    const valori = benessere
      .filter(
        (m) =>
          m.rpe !== null &&
          new Date(`${m.data_compilazione}T12:00:00`).getTime() >=
            settePriodni,
      )
      .map((m) => m.rpe as number);

    if (valori.length === 0) return null;

    return valori.reduce((somma, v) => somma + v, 0) / valori.length;
  }, [benessere]);

  async function handleSubmit(
  event: FormEvent<HTMLFormElement>,
) {
  event.preventDefault();

  if (giocatoriSelezionatiIds.length === 0) {
    setMessaggio({
      tipo: "error",
      testo: "Seleziona almeno un giocatore.",
    });
    return;
  }

  setSalvataggio(true);
  setMessaggio(null);

  const form = event.currentTarget;
  const formData = new FormData(form);

  formData.set(
    "giocatori_ids",
    JSON.stringify(giocatoriSelezionatiIds),
  );

  const result =
    await creaMisurazioneAntropometricaAction(formData);

  setSalvataggio(false);

  if (!result.success) {
    setMessaggio({
      tipo: "error",
      testo: result.message,
    });
    return;
  }

  setMessaggio({
    tipo: "success",
    testo: result.message,
  });

  form.reset();
  setGiocatoriSelezionatiIds([]);

  window.setTimeout(() => {
    setModalAperta(false);
    setMessaggio(null);
  }, 1000);
}

  return (
    <div className="min-h-full space-y-4 p-4 sm:space-y-6 sm:p-6">
      <section className="overflow-hidden rounded-3xl border border-zinc-800 bg-zinc-950">
        <div
          className="h-1.5 w-full"
          style={{ backgroundColor: coloreClub }}
        />

        <div className="flex flex-col gap-4 p-4 sm:flex-row sm:items-center sm:justify-between sm:p-6">
          <div>
            <div className="mb-2 flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.16em] text-zinc-500">
              <Activity className="h-4 w-4" />
              {nomeClub}
            </div>

            <h1 className="text-2xl font-bold text-white sm:text-3xl">
              {tabPrincipale === "antropometria"
                ? "Misurazioni antropometriche"
                : "Benessere · RPE"}
            </h1>

            <p className="mt-1 text-sm text-zinc-400">
              {tabPrincipale === "antropometria"
                ? "Controlla peso, altezza e composizione corporea degli atleti della squadra attiva."
                : "Le compilazioni “Come va” inviate dagli atleti: RPE seduta e questionario del mattino."}
            </p>
          </div>

          {tabPrincipale === "antropometria" ? (
            <button
              type="button"
              onClick={() => {
                setMessaggio(null);
                setModalAperta(true);
              }}
              className="flex min-h-12 w-full items-center justify-center gap-2 rounded-2xl px-4 py-3 text-sm font-semibold text-white transition hover:brightness-110 sm:w-auto"
              style={{ backgroundColor: coloreClub }}
            >
              <Plus className="h-5 w-5" />
              Nuova misurazione
            </button>
          ) : (
            <button
              type="button"
              onClick={() => {
                setMessaggioBenessere(null);
                resetFormBenessere();
                setModalBenessereAperta(true);
              }}
              className="flex min-h-12 w-full items-center justify-center gap-2 rounded-2xl px-4 py-3 text-sm font-semibold text-white transition hover:brightness-110 sm:w-auto"
              style={{ backgroundColor: coloreClub }}
            >
              <Plus className="h-5 w-5" />
              Nuova compilazione
            </button>
          )}
        </div>
      </section>

      <section className="flex rounded-2xl border border-zinc-800 bg-zinc-950 p-1.5">
        <button
          type="button"
          onClick={() => setTabPrincipale("antropometria")}
          className="min-h-11 flex-1 rounded-xl px-3 text-sm font-semibold transition"
          style={
            tabPrincipale === "antropometria"
              ? { backgroundColor: coloreClub, color: "#ffffff" }
              : { color: "#a1a1aa" }
          }
        >
          Antropometria
        </button>

        <button
          type="button"
          onClick={() => setTabPrincipale("benessere")}
          className="min-h-11 flex-1 rounded-xl px-3 text-sm font-semibold transition"
          style={
            tabPrincipale === "benessere"
              ? { backgroundColor: coloreClub, color: "#ffffff" }
              : { color: "#a1a1aa" }
          }
        >
          Benessere · RPE
        </button>
      </section>

      {tabPrincipale === "antropometria" ? (
        <section className="grid grid-cols-2 gap-3 lg:grid-cols-4">
          <StatCard
            icon={<Scale className="h-5 w-5" />}
            label="Misurazioni"
            value={String(misurazioni.length)}
          />

          <StatCard
            icon={<UserRound className="h-5 w-5" />}
            label="Atleti misurati"
            value={String(atletiMisurati)}
          />

          <StatCard
            icon={<Ruler className="h-5 w-5" />}
            label="Atleti attivi"
            value={String(giocatori.length)}
          />

          <StatCard
            icon={<CalendarDays className="h-5 w-5" />}
            label="Ultimo controllo"
            value={
              ultimaMisurazione
                ? formatDate(
                    ultimaMisurazione.data_misurazione,
                  )
                : "—"
            }
          />
        </section>
      ) : (
        <section className="grid grid-cols-2 gap-3 lg:grid-cols-4">
          <StatCard
            icon={<HeartPulse className="h-5 w-5" />}
            label="Compilazioni"
            value={String(benessere.length)}
          />

          <StatCard
            icon={<Gauge className="h-5 w-5" />}
            label="RPE medio squadra (7gg)"
            value={
              rpeMedioSquadra7gg !== null
                ? `${rpeMedioSquadra7gg.toFixed(1)}/10`
                : "—"
            }
          />

          <StatCard
            icon={<UserRound className="h-5 w-5" />}
            label="Atleti attivi"
            value={String(giocatori.length)}
          />

          <StatCard
            icon={<CalendarDays className="h-5 w-5" />}
            label="Ultima compilazione"
            value={
              ultimaCompilazioneBenessere
                ? formatDate(
                    ultimaCompilazioneBenessere.data_compilazione,
                  )
                : "—"
            }
          />
        </section>
      )}

      <section className="rounded-3xl border border-zinc-800 bg-zinc-950 p-4 sm:p-5">
        <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
          <GiocatoreFiltroSelect
            giocatori={giocatori}
            value={giocatoreFiltro}
            onChange={setGiocatoreFiltro}
          />

          {tabPrincipale === "benessere" && (
            <label className="relative block">
              <select
                value={tipoBenessereFiltro}
                onChange={(event) =>
                  setTipoBenessereFiltro(
                    event.target.value as
                      | "tutti"
                      | "campo"
                      | "palestra"
                      | "mattino",
                  )
                }
                className="min-h-11 w-full appearance-none rounded-xl border border-zinc-800 bg-zinc-900 px-3 pr-10 text-sm text-white outline-none focus:border-zinc-600"
              >
                <option value="tutti">Tutti i moduli</option>
                <option value="campo">Campo</option>
                <option value="palestra">Palestra</option>
                <option value="mattino">Risveglio</option>
              </select>
              <ChevronDown className="pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-zinc-500" />
            </label>
          )}

          <DateInput
            label="Dal"
            value={dataDa}
            onChange={setDataDa}
            wrapperClassName="min-h-11 rounded-xl border-zinc-800 bg-zinc-900 focus-within:border-zinc-600"
          />

          <DateInput
            label="Al"
            value={dataA}
            onChange={setDataA}
            wrapperClassName="min-h-11 rounded-xl border-zinc-800 bg-zinc-900 focus-within:border-zinc-600"
          />
        </div>
      </section>

      {tabPrincipale === "antropometria" && (
        <>
      {/* Desktop */}
      <section className="hidden overflow-hidden rounded-3xl border border-zinc-800 bg-zinc-950 lg:block">
        <div className="overflow-x-auto">
          <table className="min-w-[1250px] w-full">
            <thead className="border-b border-zinc-800 bg-zinc-900/70">
              <tr className="text-left text-xs font-semibold uppercase tracking-wider text-zinc-500">
                <th className="px-4 py-4">Data</th>
                <th className="px-4 py-4">ID atleta</th>
                <th className="px-4 py-4">Atleta</th>
                <th className="px-4 py-4">Peso</th>
                <th className="px-4 py-4">Altezza</th>
                <th className="px-4 py-4">BMI</th>
                <th className="px-4 py-4">Massa grassa</th>
                <th className="px-4 py-4">Massa magra</th>
                <th className="px-4 py-4">Vita</th>
                <th className="px-4 py-4">Note</th>
                <th className="px-4 py-4 text-right">Azioni</th>
              </tr>
            </thead>

            <tbody className="divide-y divide-zinc-900">
              {misurazioniFiltrate.map((misurazione) => (
                <tr
                  key={misurazione.id}
                  className="text-sm text-zinc-300 transition hover:bg-zinc-900/60"
                >
                  <td className="whitespace-nowrap px-4 py-4">
                    {formatDate(
                      misurazione.data_misurazione,
                    )}
                  </td>

                  <td className="px-4 py-4 text-zinc-400">
                    {misurazione.giocatore?.id_atleta ||
                      "—"}
                  </td>

                  <td className="px-4 py-4 font-medium text-white">
                    {misurazione.giocatore
                      ? `${misurazione.giocatore.nome} ${misurazione.giocatore.cognome}`
                      : "Atleta non disponibile"}
                  </td>

                  <td className="px-4 py-4">
                    {formatNumber(
                      misurazione.peso_kg,
                      " kg",
                    )}
                  </td>

                  <td className="px-4 py-4">
                    {formatNumber(
                      misurazione.altezza_cm,
                      " cm",
                    )}
                  </td>

                  <td className="px-4 py-4 font-semibold text-white">
                    {formatNumber(misurazione.bmi)}
                  </td>

                  <td className="px-4 py-4">
                    {formatNumber(
                      misurazione.massa_grassa_percentuale,
                      "%",
                    )}
                  </td>

                  <td className="px-4 py-4">
                    {formatNumber(
                      misurazione.massa_magra_kg,
                      " kg",
                    )}
                  </td>

                  <td className="px-4 py-4">
                    {formatNumber(
                      misurazione.circonferenza_vita_cm,
                      " cm",
                    )}
                  </td>

                  <td className="max-w-64 truncate px-4 py-4 text-zinc-400">
                    {misurazione.note || "—"}
                  </td>

                  <td className="px-4 py-4">
                    <div className="flex items-center justify-end gap-2">
                      <button
                        type="button"
                        onClick={() => apriModifica(misurazione)}
                        className="flex h-9 w-9 items-center justify-center rounded-xl border border-zinc-800 bg-zinc-900 text-zinc-400 transition hover:border-zinc-600 hover:text-white"
                        aria-label="Modifica misurazione"
                        title="Modifica"
                      >
                        <Pencil className="h-4 w-4" />
                      </button>

                      <button
                        type="button"
                        onClick={() => handleElimina(misurazione)}
                        disabled={eliminazioneInCorsoId === misurazione.id}
                        className="flex h-9 w-9 items-center justify-center rounded-xl border border-zinc-800 bg-zinc-900 text-zinc-400 transition hover:border-red-500/40 hover:text-red-400 disabled:cursor-not-allowed disabled:opacity-50"
                        aria-label="Elimina misurazione"
                        title="Elimina"
                      >
                        {eliminazioneInCorsoId === misurazione.id ? (
                          <Loader2 className="h-4 w-4 animate-spin" />
                        ) : (
                          <Trash2 className="h-4 w-4" />
                        )}
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {misurazioniFiltrate.length === 0 && (
          <EmptyState />
        )}
      </section>

      {/* Mobile */}
      <section className="space-y-3 lg:hidden">
        {misurazioniFiltrate.map((misurazione) => (
          <article
            key={misurazione.id}
            className="overflow-hidden rounded-2xl border border-zinc-800 bg-zinc-950"
          >
            <div
              className="h-1 w-full"
              style={{ backgroundColor: coloreClub }}
            />

            <div className="p-4">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <h2 className="font-semibold text-white">
                    {misurazione.giocatore
                      ? `${misurazione.giocatore.nome} ${misurazione.giocatore.cognome}`
                      : "Atleta"}
                  </h2>

                  <p className="mt-1 text-xs text-zinc-500">
                    ID:{" "}
                    {misurazione.giocatore?.id_atleta ||
                      "non disponibile"}
                  </p>
                </div>

                <span className="shrink-0 rounded-lg bg-zinc-900 px-2.5 py-1.5 text-xs text-zinc-300">
                  {formatDate(
                    misurazione.data_misurazione,
                  )}
                </span>
              </div>

              <div className="mt-4 grid grid-cols-2 gap-2">
                <MobileValue
                  label="Peso"
                  value={formatNumber(
                    misurazione.peso_kg,
                    " kg",
                  )}
                />

                <MobileValue
                  label="Altezza"
                  value={formatNumber(
                    misurazione.altezza_cm,
                    " cm",
                  )}
                />

                <MobileValue
                  label="BMI"
                  value={formatNumber(misurazione.bmi)}
                />

                <MobileValue
                  label="Massa grassa"
                  value={formatNumber(
                    misurazione.massa_grassa_percentuale,
                    "%",
                  )}
                />

                <MobileValue
                  label="Massa magra"
                  value={formatNumber(
                    misurazione.massa_magra_kg,
                    " kg",
                  )}
                />

                <MobileValue
                  label="Circonf. vita"
                  value={formatNumber(
                    misurazione.circonferenza_vita_cm,
                    " cm",
                  )}
                />
              </div>

              {misurazione.note && (
                <div className="mt-3 rounded-xl bg-zinc-900 p-3">
                  <p className="text-xs font-medium text-zinc-500">
                    Note
                  </p>
                  <p className="mt-1 text-sm text-zinc-300">
                    {misurazione.note}
                  </p>
                </div>
              )}

              <div className="mt-4 flex gap-2 border-t border-zinc-900 pt-3">
                <button
                  type="button"
                  onClick={() => apriModifica(misurazione)}
                  className="flex min-h-10 flex-1 items-center justify-center gap-2 rounded-xl border border-zinc-800 bg-zinc-900 text-sm font-medium text-zinc-300 transition hover:border-zinc-600 hover:text-white"
                >
                  <Pencil className="h-4 w-4" />
                  Modifica
                </button>

                <button
                  type="button"
                  onClick={() => handleElimina(misurazione)}
                  disabled={eliminazioneInCorsoId === misurazione.id}
                  className="flex min-h-10 flex-1 items-center justify-center gap-2 rounded-xl border border-zinc-800 bg-zinc-900 text-sm font-medium text-zinc-300 transition hover:border-red-500/40 hover:text-red-400 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  {eliminazioneInCorsoId === misurazione.id ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <Trash2 className="h-4 w-4" />
                  )}
                  Elimina
                </button>
              </div>
            </div>
          </article>
        ))}

        {misurazioniFiltrate.length === 0 && (
          <div className="rounded-2xl border border-zinc-800 bg-zinc-950">
            <EmptyState />
          </div>
        )}
      </section>
        </>
      )}

      {tabPrincipale === "benessere" && (
        <>
          {/* Desktop */}
          <section className="hidden overflow-hidden rounded-3xl border border-zinc-800 bg-zinc-950 lg:block">
            <div className="overflow-x-auto">
              <table className="min-w-[1300px] w-full">
                <thead className="border-b border-zinc-800 bg-zinc-900/70">
                  <tr className="text-left text-xs font-semibold uppercase tracking-wider text-zinc-500">
                    <th className="px-4 py-4">Data</th>
                    <th className="px-4 py-4">Atleta</th>
                    <th className="px-4 py-4">Tipo</th>
                    <th className="px-4 py-4">Seduta</th>
                    <th className="px-4 py-4">RPE</th>
                    <th className="px-4 py-4">Minuti</th>
                    <th className="px-4 py-4">sRPE</th>
                    <th className="px-4 py-4">Sonno</th>
                    <th className="px-4 py-4">Stanchezza</th>
                    <th className="px-4 py-4">Indolenzimento</th>
                    <th className="px-4 py-4">Stress</th>
                    <th className="px-4 py-4">Fastidio</th>
                  </tr>
                </thead>

                <tbody className="divide-y divide-zinc-900">
                  {benessereFiltrato.map((compilazione) => {
                    const fastidioBadge = getFastidioBadge(
                      compilazione.fastidio,
                    );

                    return (
                      <tr
                        key={compilazione.id}
                        className="text-sm text-zinc-300 transition hover:bg-zinc-900/60"
                      >
                        <td className="whitespace-nowrap px-4 py-4">
                          {formatDate(compilazione.data_compilazione)}
                        </td>

                        <td className="px-4 py-4 font-medium text-white">
                          {compilazione.giocatore
                            ? `${compilazione.giocatore.nome} ${compilazione.giocatore.cognome}`
                            : "Atleta non disponibile"}
                        </td>

                        <td className="px-4 py-4">
                          {tipoCompilazioneLabel(
                            compilazione.tipo_compilazione,
                          )}
                        </td>

                        <td className="px-4 py-4">
                          {compilazione.seduta || "—"}
                        </td>

                        <td
                          className="px-4 py-4 font-semibold"
                          style={{
                            color:
                              compilazione.rpe !== null
                                ? getRpeColore(compilazione.rpe)
                                : undefined,
                          }}
                        >
                          {compilazione.rpe !== null
                            ? `${compilazione.rpe}/10`
                            : "—"}
                        </td>

                        <td className="px-4 py-4">
                          {compilazione.minutaggio_lavoro !== null
                            ? `${compilazione.minutaggio_lavoro} min`
                            : "—"}
                        </td>

                        <td className="px-4 py-4 font-semibold text-white">
                          {compilazione.rpe !== null &&
                          compilazione.minutaggio_lavoro !== null
                            ? compilazione.rpe * compilazione.minutaggio_lavoro
                            : "—"}
                        </td>

                        <td
                          className="px-4 py-4"
                          style={{
                            color:
                              compilazione.sonno !== null
                                ? getHooperColore(compilazione.sonno)
                                : undefined,
                          }}
                        >
                          {compilazione.sonno !== null
                            ? `${compilazione.sonno}/7`
                            : "—"}
                        </td>

                        <td
                          className="px-4 py-4"
                          style={{
                            color:
                              compilazione.stanchezza !== null
                                ? getHooperColore(compilazione.stanchezza)
                                : undefined,
                          }}
                        >
                          {compilazione.stanchezza !== null
                            ? `${compilazione.stanchezza}/7`
                            : "—"}
                        </td>

                        <td
                          className="px-4 py-4"
                          style={{
                            color:
                              compilazione.indolenzimento !== null
                                ? getHooperColore(compilazione.indolenzimento)
                                : undefined,
                          }}
                        >
                          {compilazione.indolenzimento !== null
                            ? `${compilazione.indolenzimento}/7`
                            : "—"}
                        </td>

                        <td
                          className="px-4 py-4"
                          style={{
                            color:
                              compilazione.stress !== null
                                ? getHooperColore(compilazione.stress)
                                : undefined,
                          }}
                        >
                          {compilazione.stress !== null
                            ? `${compilazione.stress}/7`
                            : "—"}
                        </td>

                        <td className="px-4 py-4">
                          <span
                            className="font-semibold"
                            style={{ color: fastidioBadge.color }}
                          >
                            {fastidioBadge.label}
                          </span>

                          {compilazione.fastidio &&
                            compilazione.fastidio !== "no" &&
                            compilazione.fastidio_dettaglio && (
                              <p className="mt-0.5 max-w-56 truncate text-xs text-zinc-500">
                                {compilazione.fastidio_dettaglio}
                              </p>
                            )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            {benessereFiltrato.length === 0 && (
              <EmptyStateBenessere />
            )}
          </section>

          {/* Mobile */}
          <section className="space-y-3 lg:hidden">
            {benessereFiltrato.map((compilazione) => {
              const fastidioBadge = getFastidioBadge(compilazione.fastidio);

              return (
                <article
                  key={compilazione.id}
                  className="overflow-hidden rounded-2xl border border-zinc-800 bg-zinc-950"
                >
                  <div
                    className="h-1 w-full"
                    style={{ backgroundColor: coloreClub }}
                  />

                  <div className="p-4">
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <h2 className="font-semibold text-white">
                          {compilazione.giocatore
                            ? `${compilazione.giocatore.nome} ${compilazione.giocatore.cognome}`
                            : "Atleta"}
                        </h2>

                        <p className="mt-1 text-xs text-zinc-500">
                          {tipoCompilazioneLabel(
                            compilazione.tipo_compilazione,
                          )}
                          {compilazione.seduta
                            ? ` · ${compilazione.seduta}`
                            : ""}
                        </p>
                      </div>

                      <span className="shrink-0 rounded-lg bg-zinc-900 px-2.5 py-1.5 text-xs text-zinc-300">
                        {formatDate(compilazione.data_compilazione)}
                      </span>
                    </div>

                    {compilazione.tipo_compilazione === "mattino" ? (
                      <div className="mt-4 grid grid-cols-2 gap-2 sm:grid-cols-4">
                        <MobileValueColorata
                          label="Sonno"
                          value={
                            compilazione.sonno !== null
                              ? `${compilazione.sonno}/7`
                              : "—"
                          }
                          color={
                            compilazione.sonno !== null
                              ? getHooperColore(compilazione.sonno)
                              : undefined
                          }
                        />

                        <MobileValueColorata
                          label="Stanchezza"
                          value={
                            compilazione.stanchezza !== null
                              ? `${compilazione.stanchezza}/7`
                              : "—"
                          }
                          color={
                            compilazione.stanchezza !== null
                              ? getHooperColore(compilazione.stanchezza)
                              : undefined
                          }
                        />

                        <MobileValueColorata
                          label="Indolenzimento"
                          value={
                            compilazione.indolenzimento !== null
                              ? `${compilazione.indolenzimento}/7`
                              : "—"
                          }
                          color={
                            compilazione.indolenzimento !== null
                              ? getHooperColore(compilazione.indolenzimento)
                              : undefined
                          }
                        />

                        <MobileValueColorata
                          label="Stress"
                          value={
                            compilazione.stress !== null
                              ? `${compilazione.stress}/7`
                              : "—"
                          }
                          color={
                            compilazione.stress !== null
                              ? getHooperColore(compilazione.stress)
                              : undefined
                          }
                        />
                      </div>
                    ) : (
                      <div className="mt-4 grid grid-cols-2 gap-2 sm:grid-cols-4">
                        <MobileValueColorata
                          label="RPE"
                          value={
                            compilazione.rpe !== null
                              ? `${compilazione.rpe}/10`
                              : "—"
                          }
                          color={
                            compilazione.rpe !== null
                              ? getRpeColore(compilazione.rpe)
                              : undefined
                          }
                        />

                        <MobileValueColorata
                          label="Minutaggio"
                          value={
                            compilazione.minutaggio_lavoro !== null
                              ? `${compilazione.minutaggio_lavoro} min`
                              : "—"
                          }
                        />

                        <MobileValueColorata
                          label="sRPE"
                          value={
                            compilazione.rpe !== null &&
                            compilazione.minutaggio_lavoro !== null
                              ? String(
                                  compilazione.rpe *
                                    compilazione.minutaggio_lavoro,
                                )
                              : "—"
                          }
                        />

                        <div className="rounded-xl bg-zinc-900 p-3">
                          <p className="text-[11px] uppercase tracking-wide text-zinc-500">
                            Fastidio
                          </p>
                          <p
                            className="mt-1 text-sm font-semibold"
                            style={{ color: fastidioBadge.color }}
                          >
                            {fastidioBadge.label}
                          </p>
                        </div>
                      </div>
                    )}

                    {compilazione.fastidio &&
                      compilazione.fastidio !== "no" &&
                      compilazione.fastidio_dettaglio && (
                        <div className="mt-3 rounded-xl border border-amber-500/20 bg-amber-500/10 p-3">
                          <p className="text-xs font-semibold uppercase tracking-wide text-amber-300">
                            Fastidio segnalato
                          </p>

                          <p className="mt-1 text-sm text-amber-100">
                            {compilazione.fastidio_dettaglio}
                          </p>
                        </div>
                      )}
                  </div>
                </article>
              );
            })}

            {benessereFiltrato.length === 0 && (
              <div className="rounded-2xl border border-zinc-800 bg-zinc-950">
                <EmptyStateBenessere />
              </div>
            )}
          </section>
        </>
      )}

      {modalAperta && (
        <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/70 p-0 backdrop-blur-sm sm:items-center sm:p-4">
          <div className="max-h-[92vh] w-full overflow-y-auto rounded-t-3xl border border-zinc-800 bg-zinc-950 sm:max-w-2xl sm:rounded-3xl">
            <div className="sticky top-0 z-10 flex items-center justify-between border-b border-zinc-800 bg-zinc-950/95 p-4 backdrop-blur sm:p-5">
              <div>
                <h2 className="text-lg font-bold text-white">
                  Nuova misurazione
                </h2>
                <p className="text-sm text-zinc-500">
                  Inserisci i valori rilevati per l’atleta.
                </p>
              </div>

              <button
                type="button"
                onClick={() => setModalAperta(false)}
                className="flex h-10 w-10 items-center justify-center rounded-xl bg-zinc-900 text-zinc-400 transition hover:text-white"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <form
  onSubmit={handleSubmit}
  className="space-y-5 p-4 sm:p-5"
>
  <input
    type="hidden"
    name="giocatori_ids"
    value={JSON.stringify(giocatoriSelezionatiIds)}
    readOnly
  />

  <div className="grid gap-4 sm:grid-cols-2">
    <div className="sm:col-span-2">
      <Field label="Giocatori" required>
        <GiocatoriMultiSelect
          giocatori={giocatori}
          selectedIds={giocatoriSelezionatiIds}
          coloreClub={coloreClub}
          onToggle={toggleGiocatore}
          onSelectAll={selezionaTuttiGiocatori}
          onClear={deselezionaTuttiGiocatori}
        />
      </Field>
    </div>

    <Field label="Data misurazione" required>
      <DateInput
        name="data_misurazione"
        required
        defaultValue={getToday()}
        wrapperClassName={inputClass}
      />
    </Field>

    <div className="flex items-end">
      <div className="min-h-11 w-full rounded-xl border border-zinc-800 bg-zinc-900 px-3 py-2.5 text-sm text-zinc-400">
        <span className="font-semibold text-white">
          {giocatoriSelezionatiIds.length}
        </span>{" "}
        {giocatoriSelezionatiIds.length === 1
          ? "giocatore selezionato"
          : "giocatori selezionati"}
      </div>
    </div>
  </div>

  {giocatoriSelezionati.length > 0 ? (
    <div className="space-y-4">
      <div className="flex items-center gap-2 border-b border-zinc-800 pb-3">
        <UsersRound className="h-5 w-5 text-zinc-500" />

        <div>
          <h3 className="text-sm font-semibold text-white">
            Valori individuali
          </h3>

          <p className="text-xs text-zinc-500">
            Inserisci misure diverse per ciascun atleta.
          </p>
        </div>
      </div>

      {giocatoriSelezionati.map((giocatore, index) => (
        <div
          key={giocatore.id}
          className="overflow-hidden rounded-2xl border border-zinc-800 bg-zinc-900/40"
        >
          <div
            className="h-1 w-full"
            style={{ backgroundColor: coloreClub }}
          />

          <div className="p-4">
            <div className="mb-4 flex items-center justify-between gap-3">
              <div className="flex min-w-0 items-center gap-3">
                <GiocatoreAvatar
                  giocatore={giocatore}
                  size="large"
                />

                <div className="min-w-0">
                  <p className="truncate font-semibold text-white">
                    {giocatore.nome} {giocatore.cognome}
                  </p>

                  <p className="truncate text-xs text-zinc-500">
                    {giocatore.id_atleta
                      ? `ID atleta: ${giocatore.id_atleta}`
                      : "ID atleta non disponibile"}
                  </p>
                </div>
              </div>

              <button
                type="button"
                onClick={() =>
                  toggleGiocatore(giocatore.id)
                }
                className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl border border-zinc-800 bg-zinc-950 text-zinc-500 transition hover:border-red-500/30 hover:text-red-400"
                aria-label={`Rimuovi ${giocatore.nome} ${giocatore.cognome}`}
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              <Field label="Peso">
                <div className="relative">
                  <input
                    name={`peso_kg__${giocatore.id}`}
                    type="number"
                    min="20"
                    max="300"
                    step="0.01"
                    placeholder="es. 82.50"
                    className={`${inputClass} pr-12`}
                    autoFocus={index === 0}
                  />

                  <span className={suffixClass}>
                    kg
                  </span>
                </div>
              </Field>

              <Field label="Altezza">
                <div className="relative">
                  <input
                    name={`altezza_cm__${giocatore.id}`}
                    type="number"
                    min="80"
                    max="250"
                    step="0.01"
                    placeholder="es. 182"
                    className={`${inputClass} pr-12`}
                  />

                  <span className={suffixClass}>
                    cm
                  </span>
                </div>
              </Field>

              <Field label="Massa grassa">
                <div className="relative">
                  <input
                    name={`massa_grassa_percentuale__${giocatore.id}`}
                    type="number"
                    min="0"
                    max="70"
                    step="0.01"
                    placeholder="es. 14.5"
                    className={`${inputClass} pr-12`}
                  />

                  <span className={suffixClass}>
                    %
                  </span>
                </div>
              </Field>

              <Field label="Circonferenza vita">
                <div className="relative">
                  <input
                    name={`circonferenza_vita_cm__${giocatore.id}`}
                    type="number"
                    min="20"
                    max="250"
                    step="0.01"
                    placeholder="es. 88"
                    className={`${inputClass} pr-12`}
                  />

                  <span className={suffixClass}>
                    cm
                  </span>
                </div>
              </Field>

              <div className="sm:col-span-2">
                <Field label="Note">
                  <textarea
                    name={`note__${giocatore.id}`}
                    rows={3}
                    placeholder={`Note per ${giocatore.nome} ${giocatore.cognome}...`}
                    className={`${inputClass} resize-none py-3`}
                  />
                </Field>
              </div>
            </div>
          </div>
        </div>
      ))}
    </div>
  ) : (
    <div className="flex flex-col items-center justify-center rounded-2xl border border-dashed border-zinc-800 bg-zinc-900/30 px-4 py-10 text-center">
      <UsersRound className="h-9 w-9 text-zinc-700" />

      <p className="mt-3 text-sm font-semibold text-white">
        Nessun giocatore selezionato
      </p>

      <p className="mt-1 max-w-sm text-xs text-zinc-500">
        Apri il menu e seleziona uno o più giocatori
        per inserire le misurazioni.
      </p>
    </div>
  )}

  <div className="rounded-xl border border-zinc-800 bg-zinc-900/60 p-3 text-xs leading-5 text-zinc-400">
    BMI e massa magra vengono calcolati
    automaticamente dal database per ciascun giocatore.
  </div>

  {messaggio && (
    <div
      className={`rounded-xl border p-3 text-sm ${
        messaggio.tipo === "success"
          ? "border-emerald-500/20 bg-emerald-500/10 text-emerald-300"
          : "border-red-500/20 bg-red-500/10 text-red-300"
      }`}
    >
      {messaggio.testo}
    </div>
  )}

  <div className="flex flex-col-reverse gap-2 border-t border-zinc-800 pt-4 sm:flex-row sm:justify-end">
    <button
      type="button"
      onClick={chiudiModal}
      className="min-h-11 rounded-xl border border-zinc-800 px-4 text-sm font-semibold text-zinc-300 transition hover:bg-zinc-900"
    >
      Annulla
    </button>

    <button
      type="submit"
      disabled={
        salvataggio ||
        giocatoriSelezionatiIds.length === 0
      }
      className="min-h-11 rounded-xl px-5 text-sm font-semibold text-white transition hover:brightness-110 disabled:cursor-not-allowed disabled:opacity-50"
      style={{ backgroundColor: coloreClub }}
    >
      {salvataggio
        ? "Salvataggio..."
        : `Salva ${
            giocatoriSelezionatiIds.length || ""
          } ${
            giocatoriSelezionatiIds.length === 1
              ? "misurazione"
              : "misurazioni"
          }`}
    </button>
  </div>
</form>
          </div>
        </div>
      )}

      {misurazioneInModifica && (
        <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/70 p-0 backdrop-blur-sm sm:items-center sm:p-4">
          <div className="max-h-[92vh] w-full overflow-y-auto rounded-t-3xl border border-zinc-800 bg-zinc-950 sm:max-w-lg sm:rounded-3xl">
            <div className="sticky top-0 z-10 flex items-center justify-between border-b border-zinc-800 bg-zinc-950/95 p-4 backdrop-blur sm:p-5">
              <div className="flex min-w-0 items-center gap-3">
                <GiocatoreAvatar
                  giocatore={{
                    nome:
                      misurazioneInModifica.giocatore?.nome || "?",
                    cognome:
                      misurazioneInModifica.giocatore?.cognome || "",
                    foto_url:
                      misurazioneInModifica.giocatore?.foto_url || null,
                  }}
                  size="medium"
                />

                <div className="min-w-0">
                  <h2 className="truncate text-lg font-bold text-white">
                    {misurazioneInModifica.giocatore
                      ? `${misurazioneInModifica.giocatore.nome} ${misurazioneInModifica.giocatore.cognome}`
                      : "Modifica misurazione"}
                  </h2>
                  <p className="truncate text-sm text-zinc-500">
                    Misurazione del{" "}
                    {formatDate(misurazioneInModifica.data_misurazione)}
                  </p>
                </div>
              </div>

              <button
                type="button"
                onClick={chiudiModifica}
                className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-zinc-900 text-zinc-400 transition hover:text-white"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <form
              onSubmit={handleSubmitModifica}
              className="space-y-5 p-4 sm:p-5"
            >
              <input
                type="hidden"
                name="id"
                value={misurazioneInModifica.id}
                readOnly
              />

              <Field label="Data misurazione" required>
                <DateInput
                  name="data_misurazione"
                  required
                  defaultValue={misurazioneInModifica.data_misurazione}
                  wrapperClassName={inputClass}
                />
              </Field>

              <div className="grid gap-4 sm:grid-cols-2">
                <Field label="Peso">
                  <div className="relative">
                    <input
                      name="peso_kg"
                      type="number"
                      min="20"
                      max="300"
                      step="0.01"
                      placeholder="es. 82.50"
                      defaultValue={
                        misurazioneInModifica.peso_kg ?? undefined
                      }
                      className={`${inputClass} pr-12`}
                      autoFocus
                    />
                    <span className={suffixClass}>kg</span>
                  </div>
                </Field>

                <Field label="Altezza">
                  <div className="relative">
                    <input
                      name="altezza_cm"
                      type="number"
                      min="80"
                      max="250"
                      step="0.01"
                      placeholder="es. 182"
                      defaultValue={
                        misurazioneInModifica.altezza_cm ?? undefined
                      }
                      className={`${inputClass} pr-12`}
                    />
                    <span className={suffixClass}>cm</span>
                  </div>
                </Field>

                <Field label="Massa grassa">
                  <div className="relative">
                    <input
                      name="massa_grassa_percentuale"
                      type="number"
                      min="0"
                      max="70"
                      step="0.01"
                      placeholder="es. 14.5"
                      defaultValue={
                        misurazioneInModifica.massa_grassa_percentuale ??
                        undefined
                      }
                      className={`${inputClass} pr-12`}
                    />
                    <span className={suffixClass}>%</span>
                  </div>
                </Field>

                <Field label="Circonferenza vita">
                  <div className="relative">
                    <input
                      name="circonferenza_vita_cm"
                      type="number"
                      min="20"
                      max="250"
                      step="0.01"
                      placeholder="es. 88"
                      defaultValue={
                        misurazioneInModifica.circonferenza_vita_cm ??
                        undefined
                      }
                      className={`${inputClass} pr-12`}
                    />
                    <span className={suffixClass}>cm</span>
                  </div>
                </Field>
              </div>

              <Field label="Note">
                <textarea
                  name="note"
                  rows={3}
                  placeholder="Note..."
                  defaultValue={misurazioneInModifica.note ?? ""}
                  className={`${inputClass} resize-none py-3`}
                />
              </Field>

              <div className="rounded-xl border border-zinc-800 bg-zinc-900/60 p-3 text-xs leading-5 text-zinc-400">
                BMI e massa magra vengono ricalcolati automaticamente
                dal database in base ai nuovi valori.
              </div>

              {messaggioModifica && (
                <div
                  className={`rounded-xl border p-3 text-sm ${
                    messaggioModifica.tipo === "success"
                      ? "border-emerald-500/20 bg-emerald-500/10 text-emerald-300"
                      : "border-red-500/20 bg-red-500/10 text-red-300"
                  }`}
                >
                  {messaggioModifica.testo}
                </div>
              )}

              <div className="flex flex-col-reverse gap-2 border-t border-zinc-800 pt-4 sm:flex-row sm:justify-end">
                <button
                  type="button"
                  onClick={chiudiModifica}
                  className="min-h-11 rounded-xl border border-zinc-800 px-4 text-sm font-semibold text-zinc-300 transition hover:bg-zinc-900"
                >
                  Annulla
                </button>

                <button
                  type="submit"
                  disabled={salvataggioModifica}
                  className="min-h-11 rounded-xl px-5 text-sm font-semibold text-white transition hover:brightness-110 disabled:cursor-not-allowed disabled:opacity-50"
                  style={{ backgroundColor: coloreClub }}
                >
                  {salvataggioModifica ? "Salvataggio..." : "Salva modifiche"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {modalBenessereAperta && (
        <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/70 backdrop-blur-sm sm:items-center sm:p-4">
          <div className="max-h-[94vh] w-full overflow-y-auto rounded-t-3xl border border-zinc-800 bg-zinc-950 sm:max-w-xl sm:rounded-3xl">
            <div className="sticky top-0 z-10 flex items-center justify-between border-b border-zinc-800 bg-zinc-950/95 p-4 backdrop-blur">
              <div className="flex items-center gap-2">
                {stepBenessere !== "tipo" && (
                  <button
                    type="button"
                    onClick={() => {
                      setMessaggioBenessere(null);
                      setStepBenessere("tipo");
                    }}
                    className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-zinc-900 text-zinc-400"
                  >
                    <ChevronLeft className="h-5 w-5" />
                  </button>
                )}

                <div>
                  <h2 className="text-lg font-bold text-white">
                    Nuova compilazione
                  </h2>

                  <p className="text-sm text-zinc-500">
                    Compila il modulo “Come va” per conto di un atleta.
                  </p>
                </div>
              </div>

              <button
                type="button"
                onClick={chiudiModalBenessere}
                className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-zinc-900 text-zinc-400"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <div className="space-y-6 p-4 sm:p-5">
              <Field label="Atleta" required>
                <select
                  value={giocatoreIdBenessere}
                  onChange={(event) =>
                    setGiocatoreIdBenessere(event.target.value)
                  }
                  className={inputClass}
                >
                  <option value="">Seleziona un atleta</option>

                  {giocatori.map((giocatore) => (
                    <option key={giocatore.id} value={giocatore.id}>
                      {giocatore.cognome} {giocatore.nome}
                    </option>
                  ))}
                </select>
              </Field>

              {stepBenessere === "tipo" && (
                <>
                  <p className="text-sm leading-relaxed text-zinc-400">
                    Scegli cosa sta compilando l&apos;atleta.
                  </p>

                  <div className="space-y-3">
                    <TipoCompilazioneButton
                      icon={<Activity className="h-5 w-5" />}
                      titolo="Allenamento in campo"
                      accentColor={coloreClub}
                      onClick={() => apriStepBenessere("campo")}
                    />

                    <TipoCompilazioneButton
                      icon={<Dumbbell className="h-5 w-5" />}
                      titolo="Allenamento in palestra"
                      accentColor={coloreClub}
                      onClick={() => apriStepBenessere("palestra")}
                    />

                    <TipoCompilazioneButton
                      icon={<Sunrise className="h-5 w-5" />}
                      titolo="Questionario del mattino"
                      accentColor={coloreClub}
                      onClick={() => apriStepBenessere("mattino")}
                    />
                  </div>
                </>
              )}

              {(stepBenessere === "campo" || stepBenessere === "palestra") && (
                <>
                  <div>
                    <p className="mb-2 text-sm font-semibold text-white">
                      Quale seduta
                    </p>

                    <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
                      {(stepBenessere === "palestra"
                        ? SEDUTE_PALESTRA
                        : SEDUTE_CAMPO
                      ).map((opzione) => {
                        const selezionata = sedutaBenessere === opzione;

                        return (
                          <button
                            key={opzione}
                            type="button"
                            onClick={() => setSedutaBenessere(opzione)}
                            className="min-h-11 rounded-xl px-3 text-sm font-semibold transition"
                            style={
                              selezionata
                                ? { backgroundColor: coloreClub, color: "#fff" }
                                : { backgroundColor: "#18181b", color: "#a1a1aa" }
                            }
                          >
                            {opzione}
                          </button>
                        );
                      })}
                    </div>
                  </div>

                  <ScalaField
                    icon={<Gauge className="h-5 w-5" />}
                    label="Quanto è stata dura questa seduta?"
                    min={1}
                    max={10}
                    leftLabel="1 = molto leggero"
                    rightLabel="10 = massimo assoluto"
                    value={rpeBenessere}
                    onChange={setRpeBenessere}
                    accentColor={coloreClub}
                  >
                    <ul className="mt-2 space-y-0.5 text-[11px] text-zinc-500">
                      {(stepBenessere === "palestra"
                        ? ANCORAGGI_RPE_PALESTRA
                        : ANCORAGGI_RPE_CAMPO
                      ).map((ancora) => (
                        <li key={ancora.valore}>
                          <span className="font-semibold text-zinc-400">
                            {ancora.valore} =
                          </span>{" "}
                          {ancora.testo}
                        </li>
                      ))}
                    </ul>
                  </ScalaField>

                  <div>
                    <label className="mb-2 block text-sm font-semibold text-white">
                      Minutaggio lavoro
                    </label>
                    <input
                      type="number"
                      min={1}
                      max={600}
                      step={1}
                      inputMode="numeric"
                      value={minutaggioBenessere}
                      onChange={(event) => setMinutaggioBenessere(event.target.value)}
                      placeholder="Es. 90"
                      className={inputClass}
                    />
                    {rpeBenessere !== null && Number(minutaggioBenessere) > 0 && (
                      <p className="mt-2 text-xs font-semibold text-zinc-400">
                        sRPE: {rpeBenessere * Number(minutaggioBenessere)}
                      </p>
                    )}
                  </div>

                  <div>
                    <p className="mb-2 text-sm font-semibold text-white">
                      Ha qualche fastidio o dolore?
                    </p>

                    <div className="space-y-2">
                      {FASTIDIO_OPZIONI.map((opzione) => {
                        const selezionata = fastidioBenessere === opzione.value;

                        return (
                          <button
                            key={opzione.value}
                            type="button"
                            onClick={() => setFastidioBenessere(opzione.value)}
                            className="min-h-11 w-full rounded-xl px-4 text-left text-sm font-semibold transition"
                            style={
                              selezionata
                                ? { backgroundColor: coloreClub, color: "#fff" }
                                : { backgroundColor: "#18181b", color: "#a1a1aa" }
                            }
                          >
                            {opzione.label}
                          </button>
                        );
                      })}
                    </div>
                  </div>

                  {fastidioBenessere && fastidioBenessere !== "no" && (
                    <input
                      value={fastidioDettaglioBenessere}
                      onChange={(event) =>
                        setFastidioDettaglioBenessere(event.target.value)
                      }
                      placeholder="Dove e cosa? (facoltativo)"
                      className={inputClass}
                    />
                  )}

                  {messaggioBenessere && (
                    <div
                      className={`rounded-xl border p-3 text-sm ${
                        messaggioBenessere.tipo === "success"
                          ? "border-emerald-500/20 bg-emerald-500/10 text-emerald-300"
                          : "border-red-500/20 bg-red-500/10 text-red-300"
                      }`}
                    >
                      {messaggioBenessere.testo}
                    </div>
                  )}

                  <button
                    type="button"
                    onClick={() => void handleSubmitBenessere()}
                    disabled={salvataggioBenessere}
                    className="min-h-12 w-full rounded-2xl px-5 text-sm font-semibold text-white transition hover:brightness-110 disabled:opacity-60"
                    style={{ backgroundColor: coloreClub }}
                  >
                    {salvataggioBenessere ? "Invio in corso..." : "Invia il modulo"}
                  </button>
                </>
              )}

              {stepBenessere === "mattino" && (
                <>
                  <ScalaField
                    icon={<Sunrise className="h-5 w-5" />}
                    label="Come ha dormito?"
                    min={1}
                    max={7}
                    leftLabel="1 = benissimo"
                    rightLabel="7 = malissimo"
                    value={sonnoBenessere}
                    onChange={setSonnoBenessere}
                    accentColor={coloreClub}
                  />

                  <ScalaField
                    icon={<Gauge className="h-5 w-5" />}
                    label="Quanto è stanco?"
                    min={1}
                    max={7}
                    leftLabel="1 = pieno di energia"
                    rightLabel="7 = distrutto"
                    value={stanchezzaBenessere}
                    onChange={setStanchezzaBenessere}
                    accentColor={coloreClub}
                  />

                  <ScalaField
                    icon={<HeartPulse className="h-5 w-5" />}
                    label="Quanto ha i muscoli indolenziti?"
                    min={1}
                    max={7}
                    leftLabel="1 = per niente"
                    rightLabel="7 = molto dolenti"
                    value={indolenzimentoBenessere}
                    onChange={setIndolenzimentoBenessere}
                    accentColor={coloreClub}
                  />

                  <ScalaField
                    icon={<Activity className="h-5 w-5" />}
                    label="Quanto è stressato o nervoso?"
                    min={1}
                    max={7}
                    leftLabel="1 = tranquillo"
                    rightLabel="7 = molto teso"
                    value={stressBenessere}
                    onChange={setStressBenessere}
                    accentColor={coloreClub}
                  />

                  {messaggioBenessere && (
                    <div
                      className={`rounded-xl border p-3 text-sm ${
                        messaggioBenessere.tipo === "success"
                          ? "border-emerald-500/20 bg-emerald-500/10 text-emerald-300"
                          : "border-red-500/20 bg-red-500/10 text-red-300"
                      }`}
                    >
                      {messaggioBenessere.testo}
                    </div>
                  )}

                  <button
                    type="button"
                    onClick={() => void handleSubmitBenessere()}
                    disabled={salvataggioBenessere}
                    className="min-h-12 w-full rounded-2xl px-5 text-sm font-semibold text-white transition hover:brightness-110 disabled:opacity-60"
                    style={{ backgroundColor: coloreClub }}
                  >
                    {salvataggioBenessere ? "Invio in corso..." : "Invia il modulo"}
                  </button>
                </>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

const inputClass =
  "min-h-11 w-full rounded-xl border border-zinc-800 bg-zinc-900 px-3 text-sm text-white outline-none transition placeholder:text-zinc-600 focus:border-zinc-600";

const suffixClass =
  "pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-xs font-medium text-zinc-500";

function Field({
  label,
  required = false,
  children,
}: {
  label: string;
  required?: boolean;
  children: React.ReactNode;
}) {
  return (
    <label className="block">
      <span className="mb-1.5 block text-sm font-medium text-zinc-300">
        {label}
        {required && (
          <span className="ml-1 text-red-400">*</span>
        )}
      </span>

      {children}
    </label>
  );
}

function StatCard({
  icon,
  label,
  value,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
}) {
  return (
    <div className="rounded-2xl border border-zinc-800 bg-zinc-950 p-3 sm:p-4">
      <div className="mb-3 flex h-9 w-9 items-center justify-center rounded-xl bg-zinc-900 text-zinc-400">
        {icon}
      </div>

      <p className="text-xl font-bold text-white sm:text-2xl">
        {value}
      </p>

      <p className="mt-1 text-xs text-zinc-500 sm:text-sm">
        {label}
      </p>
    </div>
  );
}

function MobileValue({
  label,
  value,
}: {
  label: string;
  value: string;
}) {
  return (
    <div className="rounded-xl bg-zinc-900 p-3">
      <p className="text-[11px] uppercase tracking-wide text-zinc-500">
        {label}
      </p>
      <p className="mt-1 text-sm font-semibold text-white">
        {value}
      </p>
    </div>
  );
}

function MobileValueColorata({
  label,
  value,
  color,
}: {
  label: string;
  value: string;
  color?: string;
}) {
  return (
    <div className="rounded-xl bg-zinc-900 p-3">
      <p className="text-[11px] uppercase tracking-wide text-zinc-500">
        {label}
      </p>
      <p
        className={`mt-1 text-sm font-semibold ${color ? "" : "text-white"}`}
        style={color ? { color } : undefined}
      >
        {value}
      </p>
    </div>
  );
}

function TipoCompilazioneButton({
  icon,
  titolo,
  accentColor,
  onClick,
}: {
  icon: React.ReactNode;
  titolo: string;
  accentColor: string;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="flex min-h-14 w-full items-center gap-3 rounded-2xl border border-zinc-800 bg-zinc-900/40 px-4 text-left transition hover:border-zinc-600"
    >
      <div
        className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl"
        style={{ backgroundColor: `${accentColor}20`, color: accentColor }}
      >
        {icon}
      </div>

      <p className="flex-1 text-sm font-bold text-white">{titolo}</p>

      <ChevronRight className="h-5 w-5 shrink-0 text-zinc-600" />
    </button>
  );
}

function ScalaField({
  icon,
  label,
  min,
  max,
  leftLabel,
  rightLabel,
  value,
  onChange,
  accentColor,
  children,
}: {
  icon: React.ReactNode;
  label: string;
  min: number;
  max: number;
  leftLabel: string;
  rightLabel: string;
  value: number | null;
  onChange: (value: number) => void;
  accentColor: string;
  children?: React.ReactNode;
}) {
  const opzioni = Array.from({ length: max - min + 1 }, (_, i) => min + i);

  return (
    <div className="rounded-2xl border border-zinc-800 bg-zinc-900/40 p-4">
      <div className="flex items-start gap-3">
        <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-zinc-900 text-zinc-400">
          {icon}
        </div>

        <div className="flex-1">
          <p className="text-sm font-semibold text-white">{label}</p>

          <div
            className="mt-3 grid gap-1.5 sm:gap-2"
            style={{
              gridTemplateColumns: `repeat(${opzioni.length}, minmax(0, 1fr))`,
            }}
          >
            {opzioni.map((valore) => {
              const selezionato = value === valore;

              return (
                <button
                  key={valore}
                  type="button"
                  onClick={() => onChange(valore)}
                  className="flex h-10 items-center justify-center rounded-lg text-xs font-bold transition sm:h-11 sm:text-sm"
                  style={
                    selezionato
                      ? { backgroundColor: accentColor, color: "#fff" }
                      : { backgroundColor: "#18181b", color: "#a1a1aa" }
                  }
                >
                  {valore}
                </button>
              );
            })}
          </div>

          <div className="mt-1.5 flex justify-between text-[11px] text-zinc-600">
            <span>{leftLabel}</span>
            <span>{rightLabel}</span>
          </div>

          {children}
        </div>
      </div>
    </div>
  );
}

function GiocatoreFiltroSelect({
  giocatori,
  value,
  onChange,
}: {
  giocatori: GiocatoreMisurazioni[];
  value: string;
  onChange: (value: string) => void;
}) {
  const [aperto, setAperto] = useState(false);
  const [ricerca, setRicerca] = useState("");
  const containerRef = useRef<HTMLDivElement | null>(null);
  const selezionato = giocatori.find((giocatore) => giocatore.id === value);

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (
        containerRef.current &&
        !containerRef.current.contains(event.target as Node)
      ) {
        setAperto(false);
      }
    }

    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const opzioni = useMemo(() => {
    const termine = ricerca.trim().toLowerCase();
    if (!termine) return giocatori;

    return giocatori.filter((giocatore) =>
      `${giocatore.nome} ${giocatore.cognome}`
        .toLowerCase()
        .includes(termine) ||
      `${giocatore.cognome} ${giocatore.nome}`
        .toLowerCase()
        .includes(termine),
    );
  }, [giocatori, ricerca]);

  return (
    <div ref={containerRef} className="relative">
      <button
        type="button"
        onClick={() => setAperto((current) => !current)}
        className="flex min-h-11 w-full items-center justify-between gap-3 rounded-xl border border-zinc-800 bg-zinc-900 px-3 text-left text-sm text-white outline-none transition hover:border-zinc-600"
      >
        <div className="flex min-w-0 items-center gap-2">
          {selezionato ? (
            <GiocatoreAvatar giocatore={selezionato} size="small" />
          ) : (
            <UsersRound className="h-4 w-4 shrink-0 text-zinc-500" />
          )}
          <span className="truncate">
            {selezionato
              ? `${selezionato.nome} ${selezionato.cognome}`
              : "Tutti gli atleti"}
          </span>
        </div>
        <ChevronDown className={`h-4 w-4 shrink-0 text-zinc-500 transition ${aperto ? "rotate-180" : ""}`} />
      </button>

      {aperto && (
        <div className="absolute left-0 right-0 top-[calc(100%+8px)] z-40 overflow-hidden rounded-2xl border border-zinc-700 bg-zinc-950 shadow-2xl shadow-black/50">
          <div className="border-b border-zinc-800 p-3">
            <div className="relative">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-zinc-500" />
              <input
                value={ricerca}
                onChange={(event) => setRicerca(event.target.value)}
                placeholder="Cerca nome o cognome..."
                className="min-h-10 w-full rounded-xl border border-zinc-800 bg-zinc-900 pl-9 pr-3 text-sm text-white outline-none placeholder:text-zinc-600 focus:border-zinc-600"
                autoFocus
              />
            </div>
          </div>

          <div className="max-h-80 overflow-y-auto p-2">
            <button
              type="button"
              onClick={() => {
                onChange("tutti");
                setAperto(false);
                setRicerca("");
              }}
              className="flex w-full items-center gap-3 rounded-xl p-2.5 text-left text-sm text-white transition hover:bg-zinc-900"
            >
              <div className="flex h-10 w-10 items-center justify-center rounded-full bg-zinc-800">
                <UsersRound className="h-5 w-5 text-zinc-400" />
              </div>
              Tutti gli atleti
            </button>

            {opzioni.map((giocatore) => (
              <button
                key={giocatore.id}
                type="button"
                onClick={() => {
                  onChange(giocatore.id);
                  setAperto(false);
                  setRicerca("");
                }}
                className="flex w-full items-center gap-3 rounded-xl p-2.5 text-left transition hover:bg-zinc-900"
                style={
                  value === giocatore.id
                    ? { backgroundColor: "rgba(255,255,255,0.06)" }
                    : undefined
                }
              >
                <GiocatoreAvatar giocatore={giocatore} size="medium" />
                <p className="truncate text-sm font-semibold text-white">
                  {giocatore.nome} {giocatore.cognome}
                </p>
              </button>
            ))}

            {opzioni.length === 0 && (
              <p className="px-4 py-8 text-center text-sm text-zinc-500">
                Nessun atleta trovato.
              </p>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

type GiocatoriMultiSelectProps = {
  giocatori: GiocatoreMisurazioni[];
  selectedIds: string[];
  coloreClub: string;
  onToggle: (giocatoreId: string) => void;
  onSelectAll: () => void;
  onClear: () => void;
};

function GiocatoriMultiSelect({
  giocatori,
  selectedIds,
  coloreClub,
  onToggle,
  onSelectAll,
  onClear,
}: GiocatoriMultiSelectProps) {
  const [aperto, setAperto] = useState(false);
  const [ricerca, setRicerca] = useState("");
  const containerRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (
        containerRef.current &&
        !containerRef.current.contains(
          event.target as Node,
        )
      ) {
        setAperto(false);
      }
    }

    document.addEventListener(
      "mousedown",
      handleClickOutside,
    );

    return () => {
      document.removeEventListener(
        "mousedown",
        handleClickOutside,
      );
    };
  }, []);

  const selectedSet = useMemo(
    () => new Set(selectedIds),
    [selectedIds],
  );

  const giocatoriFiltrati = useMemo(() => {
    const termine = ricerca.trim().toLowerCase();

    if (!termine) {
      return giocatori;
    }

    return giocatori.filter((giocatore) => {
      const nomeCompleto =
        `${giocatore.nome} ${giocatore.cognome}`.toLowerCase();

      const cognomeNome =
        `${giocatore.cognome} ${giocatore.nome}`.toLowerCase();

      const idAtleta = (
        giocatore.id_atleta || ""
      ).toLowerCase();

      return (
        nomeCompleto.includes(termine) ||
        cognomeNome.includes(termine) ||
        idAtleta.includes(termine)
      );
    });
  }, [giocatori, ricerca]);

  return (
    <div
      ref={containerRef}
      className="relative"
    >
      <button
        type="button"
        onClick={() => setAperto((current) => !current)}
        className="flex min-h-12 w-full items-center justify-between gap-3 rounded-xl border border-zinc-800 bg-zinc-900 px-3 text-left text-sm outline-none transition hover:border-zinc-700"
      >
        <div className="flex min-w-0 items-center gap-2">
          <UsersRound className="h-4 w-4 shrink-0 text-zinc-500" />

          <span
            className={
              selectedIds.length > 0
                ? "truncate text-white"
                : "truncate text-zinc-500"
            }
          >
            {selectedIds.length === 0
              ? "Seleziona uno o più giocatori"
              : `${selectedIds.length} ${
                  selectedIds.length === 1
                    ? "giocatore selezionato"
                    : "giocatori selezionati"
                }`}
          </span>
        </div>

        <ChevronDown
          className={`h-4 w-4 shrink-0 text-zinc-500 transition ${
            aperto ? "rotate-180" : ""
          }`}
        />
      </button>

      {selectedIds.length > 0 && (
        <div className="mt-2 flex flex-wrap gap-2">
          {giocatori
            .filter((giocatore) =>
              selectedSet.has(giocatore.id),
            )
            .map((giocatore) => (
              <button
                key={giocatore.id}
                type="button"
                onClick={() => onToggle(giocatore.id)}
                className="flex max-w-full items-center gap-2 rounded-full border border-zinc-800 bg-zinc-900 py-1 pl-1 pr-2 text-xs text-zinc-300 transition hover:border-red-500/30"
              >
                <GiocatoreAvatar
                  giocatore={giocatore}
                  size="small"
                />

                <span className="max-w-40 truncate">
                  {giocatore.nome} {giocatore.cognome}
                </span>

                <X className="h-3.5 w-3.5 text-zinc-500" />
              </button>
            ))}
        </div>
      )}

      {aperto && (
        <div className="absolute left-0 right-0 top-[calc(100%+8px)] z-40 overflow-hidden rounded-2xl border border-zinc-700 bg-zinc-950 shadow-2xl shadow-black/50">
          <div className="border-b border-zinc-800 p-3">
            <div className="relative">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-zinc-500" />

              <input
                type="text"
                value={ricerca}
                onChange={(event) =>
                  setRicerca(event.target.value)
                }
                placeholder="Cerca nome, cognome o ID..."
                className="min-h-10 w-full rounded-xl border border-zinc-800 bg-zinc-900 pl-9 pr-3 text-sm text-white outline-none placeholder:text-zinc-600 focus:border-zinc-600"
                autoFocus
              />
            </div>

            <div className="mt-2 flex items-center justify-between gap-2">
              <button
                type="button"
                onClick={onSelectAll}
                className="text-xs font-semibold transition hover:brightness-125"
                style={{ color: coloreClub }}
              >
                Seleziona tutti
              </button>

              <button
                type="button"
                onClick={onClear}
                className="text-xs font-semibold text-zinc-500 transition hover:text-white"
              >
                Deseleziona tutti
              </button>
            </div>
          </div>

          <div className="max-h-80 overflow-y-auto p-2">
            {giocatoriFiltrati.map((giocatore) => {
              const selezionato = selectedSet.has(
                giocatore.id,
              );

              return (
                <button
                  key={giocatore.id}
                  type="button"
                  onClick={() => onToggle(giocatore.id)}
                  className="flex w-full items-center gap-3 rounded-xl p-2.5 text-left transition hover:bg-zinc-900"
                  style={
                    selezionato
                      ? {
                          backgroundColor: `${coloreClub}18`,
                        }
                      : undefined
                  }
                >
                  <GiocatoreAvatar
                    giocatore={giocatore}
                    size="medium"
                  />

                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-semibold text-white">
                      {giocatore.nome}{" "}
                      {giocatore.cognome}
                    </p>

                    <p className="truncate text-xs text-zinc-500">
                      {giocatore.id_atleta
                        ? `ID: ${giocatore.id_atleta}`
                        : "ID atleta non disponibile"}
                    </p>
                  </div>

                  <span
                    className="flex h-6 w-6 shrink-0 items-center justify-center rounded-lg border transition"
                    style={
                      selezionato
                        ? {
                            borderColor: coloreClub,
                            backgroundColor: coloreClub,
                          }
                        : {
                            borderColor: "#3f3f46",
                          }
                    }
                  >
                    {selezionato && (
                      <Check className="h-4 w-4 text-white" />
                    )}
                  </span>
                </button>
              );
            })}

            {giocatoriFiltrati.length === 0 && (
              <div className="px-4 py-10 text-center">
                <UserRound className="mx-auto h-8 w-8 text-zinc-700" />

                <p className="mt-2 text-sm text-zinc-500">
                  Nessun giocatore trovato.
                </p>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

function GiocatoreAvatar({
  giocatore,
  size,
}: {
  giocatore: Pick<GiocatoreMisurazioni, "nome" | "cognome" | "foto_url">;
  size: "small" | "medium" | "large";
}) {
  const sizeClass = {
    small: "h-6 w-6 text-[9px]",
    medium: "h-10 w-10 text-xs",
    large: "h-12 w-12 text-sm",
  }[size];

  const initials =
    `${giocatore.nome.charAt(0)}${giocatore.cognome.charAt(
      0,
    )}`.toUpperCase();

  if (giocatore.foto_url) {
    return (
      <div
        className={`relative shrink-0 overflow-hidden rounded-full border border-zinc-700 bg-zinc-800 ${sizeClass}`}
      >
        <Image
          src={giocatore.foto_url}
          alt={`${giocatore.nome} ${giocatore.cognome}`}
          fill
          sizes={
            size === "large"
              ? "48px"
              : size === "medium"
                ? "40px"
                : "24px"
          }
          className="object-cover"
        />
      </div>
    );
  }

  return (
    <div
      className={`flex shrink-0 items-center justify-center rounded-full border border-zinc-700 bg-zinc-800 font-bold text-zinc-300 ${sizeClass}`}
    >
      {initials}
    </div>
  );
}
function EmptyState() {
  return (
    <div className="flex flex-col items-center justify-center px-4 py-14 text-center">
      <Scale className="mb-3 h-10 w-10 text-zinc-700" />

      <h3 className="font-semibold text-white">
        Nessuna misurazione trovata
      </h3>

      <p className="mt-1 max-w-sm text-sm text-zinc-500">
        Modifica i filtri oppure inserisci una nuova
        misurazione.
      </p>
    </div>
  );
}

function EmptyStateBenessere() {
  return (
    <div className="flex flex-col items-center justify-center px-4 py-14 text-center">
      <HeartPulse className="mb-3 h-10 w-10 text-zinc-700" />

      <h3 className="font-semibold text-white">
        Nessuna compilazione trovata
      </h3>

      <p className="mt-1 max-w-sm text-sm text-zinc-500">
        Modifica i filtri, oppure aspetta che gli atleti
        compilino il modulo “Come va” dalla loro pagina Misurazioni.
      </p>
    </div>
  );
}
