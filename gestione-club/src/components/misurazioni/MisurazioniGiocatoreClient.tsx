// src/components/misurazioni/MisurazioniGiocatoreClient.tsx

"use client";

import { useMemo, useState, type ReactNode } from "react";
import {
  Activity,
  CalendarDays,
  ChevronLeft,
  ChevronRight,
  Dumbbell,
  Gauge,
  HeartPulse,
  Plus,
  Scale,
  Sunrise,
  X,
} from "lucide-react";

import { creaMisurazioneBenessereAction } from "@/app/(dashboard)/misurazioni/actions";

import type {
  GiocatoreMisurazioni,
  MisurazioneAntropometrica,
  MisurazioneBenessere,
} from "@/app/(dashboard)/misurazioni/page";

type Props = {
  coloreClub: string;
  giocatore: GiocatoreMisurazioni;
  antropometria: MisurazioneAntropometrica[];
  benessere: MisurazioneBenessere[];
};

type Tab = "benessere" | "antropometria";

type Step = "tipo" | "campo" | "palestra" | "mattino";

type Fastidio = "no" | "leggero" | "preoccupante";

const SEDUTE_CAMPO = ["Mattino", "Sera"];
const SEDUTE_PALESTRA = ["Forza (A)", "Potenza (B)", "Richiamo (C)"];

const FASTIDIO_OPZIONI: { value: Fastidio; label: string }[] = [
  { value: "no", label: "No, tutto bene" },
  { value: "leggero", label: "Sì, un fastidio leggero" },
  { value: "preoccupante", label: "Sì, qualcosa che mi preoccupa" },
];

const ANCORAGGI_RPE_CAMPO = [
  { valore: 3, testo: "riscaldamento, respiri ma parli normalmente" },
  { valore: 5, testo: "respiro pesante, parli a frasi corte" },
  { valore: 7, testo: "molto duro, parli a parole singole" },
  { valore: 9, testo: "come gli ultimi dieci minuti di una partita vera" },
];

const ANCORAGGI_RPE_PALESTRA = [
  { valore: 3, testo: "riscaldamento e mobilità, nessuno sforzo" },
  { valore: 5, testo: "carichi leggeri, potresti farne molte di più" },
  { valore: 7, testo: "pesante, alla fine della serie ne avresti fatte altre tre" },
  { valore: 9, testo: "quasi il massimo, alla fine ne avresti fatta forse una" },
];

function getToday(): string {
  return new Date().toISOString().slice(0, 10);
}

function formatDate(value: string): string {
  return new Intl.DateTimeFormat("it-IT", {
    day: "2-digit",
    month: "long",
    year: "numeric",
  }).format(new Date(`${value}T12:00:00`));
}

function formatNumber(value: number | null, suffix = ""): string {
  if (value === null || value === undefined) {
    return "—";
  }

  return `${new Intl.NumberFormat("it-IT", {
    maximumFractionDigits: 2,
  }).format(value)}${suffix}`;
}

// RPE 1-10: più è alto più il carico percepito è duro.
function getRpeColore(valore: number) {
  if (valore <= 4) return "#34d399";
  if (valore <= 7) return "#f59e0b";
  return "#f87171";
}

// Hooper 1-7: stessa direzione per tutte e quattro le domande,
// 1 = buono, 7 = cattivo.
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

function tipoLabel(tipo: MisurazioneBenessere["tipo_compilazione"]) {
  if (tipo === "campo") return "Allenamento in campo";
  if (tipo === "palestra") return "Allenamento in palestra";
  return "Questionario del mattino";
}

export default function MisurazioniGiocatoreClient({
  coloreClub,
  giocatore,
  antropometria,
  benessere,
}: Props) {
  const [tab, setTab] = useState<Tab>("benessere");
  const [modalAperta, setModalAperta] = useState(false);
  const [salvataggio, setSalvataggio] = useState(false);
  const [step, setStep] = useState<Step>("tipo");

  // Campo / palestra
  const [seduta, setSeduta] = useState("");
  const [rpe, setRpe] = useState<number | null>(null);
  const [fastidio, setFastidio] = useState<Fastidio | null>(null);
  const [fastidioDettaglio, setFastidioDettaglio] = useState("");

  // Mattino (indice di Hooper)
  const [sonno, setSonno] = useState<number | null>(null);
  const [stanchezza, setStanchezza] = useState<number | null>(null);
  const [indolenzimento, setIndolenzimento] = useState<number | null>(null);
  const [stress, setStress] = useState<number | null>(null);

  const [messaggio, setMessaggio] = useState<{
    tipo: "success" | "error";
    testo: string;
  } | null>(null);

  const ultimaAntropometria = antropometria.length > 0 ? antropometria[0] : null;
  const ultimoBenessere = benessere.length > 0 ? benessere[0] : null;

  const rpeMedio7gg = useMemo(() => {
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

  function resetForm() {
    setStep("tipo");
    setSeduta("");
    setRpe(null);
    setFastidio(null);
    setFastidioDettaglio("");
    setSonno(null);
    setStanchezza(null);
    setIndolenzimento(null);
    setStress(null);
  }

  function apriStep(nuovoStep: "campo" | "palestra" | "mattino") {
    setSeduta("");
    setRpe(null);
    setFastidio(null);
    setFastidioDettaglio("");
    setSonno(null);
    setStanchezza(null);
    setIndolenzimento(null);
    setStress(null);
    setStep(nuovoStep);
  }

  async function handleSubmit() {
    setMessaggio(null);

    const formData = new FormData();
    formData.set("data_compilazione", getToday());
    formData.set("tipo_compilazione", step);

    if (step === "campo" || step === "palestra") {
      if (!seduta) {
        setMessaggio({ tipo: "error", testo: "Indica quale seduta." });
        return;
      }

      if (rpe === null) {
        setMessaggio({
          tipo: "error",
          testo: "Indica quanto è stata dura questa seduta.",
        });
        return;
      }

      if (!fastidio) {
        setMessaggio({
          tipo: "error",
          testo: "Indica se hai qualche fastidio o dolore.",
        });
        return;
      }

      formData.set("seduta", seduta);
      formData.set("rpe", String(rpe));
      formData.set("fastidio", fastidio);

      if (fastidio !== "no") {
        formData.set("fastidio_dettaglio", fastidioDettaglio);
      }
    } else if (step === "mattino") {
      if (
        sonno === null ||
        stanchezza === null ||
        indolenzimento === null ||
        stress === null
      ) {
        setMessaggio({
          tipo: "error",
          testo: "Rispondi a tutte e quattro le domande.",
        });
        return;
      }

      formData.set("sonno", String(sonno));
      formData.set("stanchezza", String(stanchezza));
      formData.set("indolenzimento", String(indolenzimento));
      formData.set("stress", String(stress));
    } else {
      return;
    }

    setSalvataggio(true);

    const result = await creaMisurazioneBenessereAction(formData);

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

    window.setTimeout(() => {
      setModalAperta(false);
      setMessaggio(null);
      resetForm();
    }, 800);
  }

  const ancoraggiRpe = step === "palestra" ? ANCORAGGI_RPE_PALESTRA : ANCORAGGI_RPE_CAMPO;
  const seduteOpzioni = step === "palestra" ? SEDUTE_PALESTRA : SEDUTE_CAMPO;

  return (
    <div className="min-h-full space-y-4 p-4 sm:space-y-6 sm:p-6">
      <section className="overflow-hidden rounded-3xl border border-zinc-800 bg-zinc-950">
        <div className="h-1.5 w-full" style={{ backgroundColor: coloreClub }} />

        <div className="p-4 sm:p-6">
          <div className="flex items-center gap-3">
            <div
              className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl text-lg font-bold text-white"
              style={{ backgroundColor: coloreClub }}
            >
              {giocatore.nome.charAt(0)}
              {giocatore.cognome.charAt(0)}
            </div>

            <div className="min-w-0">
              <p className="text-xs font-semibold uppercase tracking-[0.15em] text-zinc-500">
                Il tuo stato
              </p>

              <h1 className="truncate text-xl font-bold text-white sm:text-2xl">
                {giocatore.nome} {giocatore.cognome}
              </h1>

              {giocatore.id_atleta && (
                <p className="text-xs text-zinc-500">
                  ID atleta: {giocatore.id_atleta}
                </p>
              )}
            </div>
          </div>

          <button
            type="button"
            onClick={() => {
              setMessaggio(null);
              resetForm();
              setModalAperta(true);
            }}
            className="mt-5 flex min-h-12 w-full items-center justify-center gap-2 rounded-2xl px-4 text-sm font-semibold text-white transition hover:brightness-110 sm:w-auto"
            style={{ backgroundColor: coloreClub }}
          >
            <Plus className="h-5 w-5" />
            Come va?
          </button>
        </div>
      </section>

      <section className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <PlayerStat
          icon={<Activity className="h-5 w-5" />}
          label="Compilazioni"
          value={String(benessere.length)}
        />

        <PlayerStat
          icon={<Gauge className="h-5 w-5" />}
          label="RPE medio (7gg)"
          value={rpeMedio7gg !== null ? `${rpeMedio7gg.toFixed(1)}/10` : "—"}
        />

        <PlayerStat
          icon={<Scale className="h-5 w-5" />}
          label="Ultimo peso"
          value={
            ultimaAntropometria
              ? formatNumber(ultimaAntropometria.peso_kg, " kg")
              : "—"
          }
        />

        <PlayerStat
          icon={<CalendarDays className="h-5 w-5" />}
          label="Ultimo check"
          value={
            ultimoBenessere
              ? new Intl.DateTimeFormat("it-IT", {
                  day: "2-digit",
                  month: "2-digit",
                  year: "numeric",
                }).format(new Date(`${ultimoBenessere.data_compilazione}T12:00:00`))
              : "—"
          }
        />
      </section>

      <section className="flex rounded-2xl border border-zinc-800 bg-zinc-950 p-1.5">
        <button
          type="button"
          onClick={() => setTab("benessere")}
          className="min-h-11 flex-1 rounded-xl px-3 text-sm font-semibold transition"
          style={
            tab === "benessere"
              ? { backgroundColor: coloreClub, color: "#ffffff" }
              : { color: "#a1a1aa" }
          }
        >
          Come va
        </button>

        <button
          type="button"
          onClick={() => setTab("antropometria")}
          className="min-h-11 flex-1 rounded-xl px-3 text-sm font-semibold transition"
          style={
            tab === "antropometria"
              ? { backgroundColor: coloreClub, color: "#ffffff" }
              : { color: "#a1a1aa" }
          }
        >
          Antropometria
        </button>
      </section>

      {tab === "benessere" && (
        <section className="space-y-3">
          {benessere.map((misurazione) => {
            const fastidioBadge = getFastidioBadge(misurazione.fastidio);

            return (
              <article
                key={misurazione.id}
                className="rounded-2xl border border-zinc-800 bg-zinc-950 p-4 sm:p-5"
              >
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <p className="text-sm font-semibold text-white">
                      {tipoLabel(misurazione.tipo_compilazione)}
                      {misurazione.seduta ? ` · ${misurazione.seduta}` : ""}
                    </p>

                    <p className="mt-1 text-xs text-zinc-500">
                      {formatDate(misurazione.data_compilazione)}
                    </p>
                  </div>

                  <ChevronRight className="h-5 w-5 text-zinc-700" />
                </div>

                {misurazione.tipo_compilazione === "mattino" ? (
                  <div className="mt-4 grid grid-cols-2 gap-2 sm:grid-cols-4">
                    <WellnessValue
                      label="Sonno"
                      value={
                        misurazione.sonno !== null
                          ? `${misurazione.sonno}/7`
                          : "—"
                      }
                      color={
                        misurazione.sonno !== null
                          ? getHooperColore(misurazione.sonno)
                          : undefined
                      }
                    />

                    <WellnessValue
                      label="Stanchezza"
                      value={
                        misurazione.stanchezza !== null
                          ? `${misurazione.stanchezza}/7`
                          : "—"
                      }
                      color={
                        misurazione.stanchezza !== null
                          ? getHooperColore(misurazione.stanchezza)
                          : undefined
                      }
                    />

                    <WellnessValue
                      label="Indolenzimento"
                      value={
                        misurazione.indolenzimento !== null
                          ? `${misurazione.indolenzimento}/7`
                          : "—"
                      }
                      color={
                        misurazione.indolenzimento !== null
                          ? getHooperColore(misurazione.indolenzimento)
                          : undefined
                      }
                    />

                    <WellnessValue
                      label="Stress"
                      value={
                        misurazione.stress !== null
                          ? `${misurazione.stress}/7`
                          : "—"
                      }
                      color={
                        misurazione.stress !== null
                          ? getHooperColore(misurazione.stress)
                          : undefined
                      }
                    />
                  </div>
                ) : (
                  <div className="mt-4 grid grid-cols-2 gap-2">
                    <WellnessValue
                      label="RPE"
                      value={
                        misurazione.rpe !== null ? `${misurazione.rpe}/10` : "—"
                      }
                      color={
                        misurazione.rpe !== null
                          ? getRpeColore(misurazione.rpe)
                          : undefined
                      }
                    />

                    <div className="rounded-xl bg-zinc-900 p-3">
                      <p className="text-[10px] font-semibold uppercase tracking-wide text-zinc-500">
                        Fastidio
                      </p>

                      <p
                        className="mt-1 text-sm font-bold"
                        style={{ color: fastidioBadge.color }}
                      >
                        {fastidioBadge.label}
                      </p>
                    </div>
                  </div>
                )}

                {misurazione.fastidio &&
                  misurazione.fastidio !== "no" &&
                  misurazione.fastidio_dettaglio && (
                    <div className="mt-3 rounded-xl border border-amber-500/20 bg-amber-500/10 p-3">
                      <p className="text-xs font-semibold uppercase tracking-wide text-amber-300">
                        Fastidio segnalato
                      </p>

                      <p className="mt-1 text-sm text-amber-100">
                        {misurazione.fastidio_dettaglio}
                      </p>
                    </div>
                  )}
              </article>
            );
          })}

          {benessere.length === 0 && (
            <EmptyPlayerState
              icon={<HeartPulse className="h-10 w-10" />}
              title="Nessuna compilazione"
              description="Dopo il prossimo allenamento, o appena sveglio, dicci come va."
            />
          )}
        </section>
      )}

      {tab === "antropometria" && (
        <section className="space-y-3">
          {antropometria.map((misurazione) => (
            <article
              key={misurazione.id}
              className="overflow-hidden rounded-2xl border border-zinc-800 bg-zinc-950"
            >
              <div className="h-1 w-full" style={{ backgroundColor: coloreClub }} />

              <div className="p-4">
                <div className="flex items-center justify-between">
                  <h2 className="font-semibold text-white">Misurazione</h2>

                  <span className="text-xs text-zinc-500">
                    {formatDate(misurazione.data_misurazione)}
                  </span>
                </div>

                <div className="mt-4 grid grid-cols-2 gap-2 sm:grid-cols-3">
                  <WellnessValue
                    label="Peso"
                    value={formatNumber(misurazione.peso_kg, " kg")}
                  />

                  <WellnessValue
                    label="Altezza"
                    value={formatNumber(misurazione.altezza_cm, " cm")}
                  />

                  <WellnessValue label="BMI" value={formatNumber(misurazione.bmi)} />

                  <WellnessValue
                    label="Massa grassa"
                    value={formatNumber(misurazione.massa_grassa_percentuale, "%")}
                  />

                  <WellnessValue
                    label="Massa magra"
                    value={formatNumber(misurazione.massa_magra_kg, " kg")}
                  />

                  <WellnessValue
                    label="Vita"
                    value={formatNumber(misurazione.circonferenza_vita_cm, " cm")}
                  />
                </div>
              </div>
            </article>
          ))}

          {antropometria.length === 0 && (
            <EmptyPlayerState
              icon={<Scale className="h-10 w-10" />}
              title="Nessuna misurazione antropometrica"
              description="Le misurazioni inserite dallo staff compariranno qui."
            />
          )}
        </section>
      )}

      {modalAperta && (
        <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/70 backdrop-blur-sm sm:items-center sm:p-4">
          <div className="max-h-[94vh] w-full overflow-y-auto rounded-t-3xl border border-zinc-800 bg-zinc-950 sm:max-w-xl sm:rounded-3xl">
            <div className="sticky top-0 z-10 flex items-center justify-between border-b border-zinc-800 bg-zinc-950/95 p-4 backdrop-blur">
              <div className="flex items-center gap-2">
                {step !== "tipo" && (
                  <button
                    type="button"
                    onClick={() => {
                      setMessaggio(null);
                      setStep("tipo");
                    }}
                    className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-zinc-900 text-zinc-400"
                  >
                    <ChevronLeft className="h-5 w-5" />
                  </button>
                )}

                <div>
                  <h2 className="text-lg font-bold text-white">Come va</h2>

                  <p className="text-sm text-zinc-500">
                    Trenta secondi, il numero lo dai tu.
                  </p>
                </div>
              </div>

              <button
                type="button"
                onClick={() => setModalAperta(false)}
                className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-zinc-900 text-zinc-400"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <div className="space-y-6 p-4 sm:p-5">
              {step === "tipo" && (
                <>
                  <p className="text-sm leading-relaxed text-zinc-400">
                    Trenta secondi. Non è un voto sull&apos;allenamento e non
                    c&apos;è una risposta giusta.
                    <br />
                    Serve a noi per decidere quanto caricare la settimana
                    prossima: se il numero è vero, ci alleniamo giusto.
                    <br />
                    Il numero lo dai tu.
                  </p>

                  <div className="space-y-3">
                    <TipoCompilazioneButton
                      icon={<Activity className="h-5 w-5" />}
                      titolo="Allenamento in campo"
                      accentColor={coloreClub}
                      onClick={() => apriStep("campo")}
                    />

                    <TipoCompilazioneButton
                      icon={<Dumbbell className="h-5 w-5" />}
                      titolo="Allenamento in palestra"
                      accentColor={coloreClub}
                      onClick={() => apriStep("palestra")}
                    />

                    <TipoCompilazioneButton
                      icon={<Sunrise className="h-5 w-5" />}
                      titolo="Questionario del mattino"
                      accentColor={coloreClub}
                      onClick={() => apriStep("mattino")}
                    />
                  </div>
                </>
              )}

              {(step === "campo" || step === "palestra") && (
                <>
                  <div>
                    <p className="mb-2 text-sm font-semibold text-white">
                      Quale seduta
                    </p>

                    <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
                      {seduteOpzioni.map((opzione) => {
                        const selezionata = seduta === opzione;

                        return (
                          <button
                            key={opzione}
                            type="button"
                            onClick={() => setSeduta(opzione)}
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
                    value={rpe}
                    onChange={setRpe}
                    accentColor={coloreClub}
                  >
                    <ul className="mt-2 space-y-0.5 text-[11px] text-zinc-500">
                      {ancoraggiRpe.map((ancora) => (
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
                    <p className="mb-2 text-sm font-semibold text-white">
                      Hai qualche fastidio o dolore?
                    </p>

                    <div className="space-y-2">
                      {FASTIDIO_OPZIONI.map((opzione) => {
                        const selezionata = fastidio === opzione.value;

                        return (
                          <button
                            key={opzione.value}
                            type="button"
                            onClick={() => setFastidio(opzione.value)}
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

                  {fastidio && fastidio !== "no" && (
                    <input
                      value={fastidioDettaglio}
                      onChange={(event) =>
                        setFastidioDettaglio(event.target.value)
                      }
                      placeholder="Dove e cosa? (facoltativo)"
                      className={inputClass}
                    />
                  )}

                  {messaggio && <Messaggio messaggio={messaggio} />}

                  <button
                    type="button"
                    onClick={() => void handleSubmit()}
                    disabled={salvataggio}
                    className="min-h-12 w-full rounded-2xl px-5 text-sm font-semibold text-white transition hover:brightness-110 disabled:opacity-60"
                    style={{ backgroundColor: coloreClub }}
                  >
                    {salvataggio ? "Invio in corso..." : "Invia il modulo"}
                  </button>
                </>
              )}

              {step === "mattino" && (
                <>
                  <p className="text-sm leading-relaxed text-zinc-400">
                    Quattro domande, trenta secondi, appena sveglio e prima di
                    colazione.
                    <br />
                    Non è un test e non c&apos;è una risposta giusta.
                    <br />
                    Se dormite male per tre notti vogliamo saperlo: vuol dire
                    che dobbiamo cambiare qualcosa noi, non che vi alleniamo
                    di più.
                  </p>

                  <ScalaField
                    icon={<Sunrise className="h-5 w-5" />}
                    label="Come hai dormito?"
                    min={1}
                    max={7}
                    leftLabel="1 = benissimo"
                    rightLabel="7 = malissimo"
                    value={sonno}
                    onChange={setSonno}
                    accentColor={coloreClub}
                  />

                  <ScalaField
                    icon={<Gauge className="h-5 w-5" />}
                    label="Quanto sei stanco?"
                    min={1}
                    max={7}
                    leftLabel="1 = pieno di energia"
                    rightLabel="7 = distrutto"
                    value={stanchezza}
                    onChange={setStanchezza}
                    accentColor={coloreClub}
                  />

                  <ScalaField
                    icon={<HeartPulse className="h-5 w-5" />}
                    label="Quanto hai i muscoli indolenziti?"
                    min={1}
                    max={7}
                    leftLabel="1 = per niente"
                    rightLabel="7 = molto dolenti"
                    value={indolenzimento}
                    onChange={setIndolenzimento}
                    accentColor={coloreClub}
                  />

                  <ScalaField
                    icon={<Activity className="h-5 w-5" />}
                    label="Quanto sei stressato o nervoso?"
                    min={1}
                    max={7}
                    leftLabel="1 = tranquillo"
                    rightLabel="7 = molto teso"
                    value={stress}
                    onChange={setStress}
                    accentColor={coloreClub}
                  />

                  {messaggio && <Messaggio messaggio={messaggio} />}

                  <button
                    type="button"
                    onClick={() => void handleSubmit()}
                    disabled={salvataggio}
                    className="min-h-12 w-full rounded-2xl px-5 text-sm font-semibold text-white transition hover:brightness-110 disabled:opacity-60"
                    style={{ backgroundColor: coloreClub }}
                  >
                    {salvataggio ? "Invio in corso..." : "Invia il modulo"}
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

function Messaggio({
  messaggio,
}: {
  messaggio: { tipo: "success" | "error"; testo: string };
}) {
  return (
    <div
      className={`rounded-xl border p-3 text-sm ${
        messaggio.tipo === "success"
          ? "border-emerald-500/20 bg-emerald-500/10 text-emerald-300"
          : "border-red-500/20 bg-red-500/10 text-red-300"
      }`}
    >
      {messaggio.testo}
    </div>
  );
}

function TipoCompilazioneButton({
  icon,
  titolo,
  accentColor,
  onClick,
}: {
  icon: ReactNode;
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
  icon: ReactNode;
  label: string;
  min: number;
  max: number;
  leftLabel: string;
  rightLabel: string;
  value: number | null;
  onChange: (value: number) => void;
  accentColor: string;
  children?: ReactNode;
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

function PlayerStat({
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

      <p className="text-lg font-bold text-white sm:text-xl">{value}</p>

      <p className="mt-1 text-xs text-zinc-500">{label}</p>
    </div>
  );
}

function WellnessValue({
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
      <p className="text-[10px] font-semibold uppercase tracking-wide text-zinc-500">
        {label}
      </p>

      <p
        className={`mt-1 text-sm font-bold ${color ? "" : "text-white"}`}
        style={color ? { color } : undefined}
      >
        {value}
      </p>
    </div>
  );
}

function EmptyPlayerState({
  icon,
  title,
  description,
}: {
  icon: React.ReactNode;
  title: string;
  description: string;
}) {
  return (
    <div className="flex flex-col items-center justify-center rounded-2xl border border-zinc-800 bg-zinc-950 px-5 py-14 text-center text-zinc-700">
      {icon}

      <h3 className="mt-3 font-semibold text-white">{title}</h3>

      <p className="mt-1 max-w-sm text-sm text-zinc-500">{description}</p>
    </div>
  );
}
