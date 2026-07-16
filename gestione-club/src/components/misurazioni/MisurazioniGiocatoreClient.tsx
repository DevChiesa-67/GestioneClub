// src/components/misurazioni/MisurazioniGiocatoreClient.tsx

"use client";

import { useMemo, useState, type ReactNode } from "react";
import {
  Activity,
  BedDouble,
  CalendarDays,
  ChevronRight,
  Frown,
  HeartPulse,
  Meh,
  Plus,
  Scale,
  Smile,
  X,
} from "lucide-react";

import { creaPostAllenamentoAction } from "@/app/(dashboard)/misurazioni/actions";

import type {
  GiocatoreMisurazioni,
  MisurazioneAntropometrica,
  MisurazionePostAllenamento,
} from "@/app/(dashboard)/misurazioni/page";

type Props = {
  coloreClub: string;
  giocatore: GiocatoreMisurazioni;
  antropometria: MisurazioneAntropometrica[];
  postAllenamento: MisurazionePostAllenamento[];
};

type Tab = "benessere" | "antropometria";

const SCALA_MIN = 1;
const SCALA_MAX = 5;

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

/*
 * Colore/icona indicativi in base al valore 1-5: usati solo per dare
 * un colpo d'occhio visivo nelle card storiche, il dato salvato resta
 * sempre il numero puro.
 */
function getUmoreVisual(valore: number) {
  if (valore <= 2) return { Icon: Frown, color: "#f87171" };
  if (valore === 3) return { Icon: Meh, color: "#f59e0b" };
  return { Icon: Smile, color: "#34d399" };
}

function getDoloreColore(valore: number) {
  if (valore <= 1) return "#34d399";
  if (valore <= 3) return "#f59e0b";
  return "#f87171";
}

export default function MisurazioniGiocatoreClient({
  coloreClub,
  giocatore,
  antropometria,
  postAllenamento,
}: Props) {
  const [tab, setTab] = useState<Tab>("benessere");
  const [modalAperta, setModalAperta] = useState(false);
  const [salvataggio, setSalvataggio] = useState(false);

  const [sonno, setSonno] = useState(3);
  const [umore, setUmore] = useState(3);
  const [doloreMuscolare, setDoloreMuscolare] = useState(1);
  const [zonaDolore, setZonaDolore] = useState("");

  const [messaggio, setMessaggio] = useState<{
    tipo: "success" | "error";
    testo: string;
  } | null>(null);

  const ultimaAntropometria = antropometria.length > 0 ? antropometria[0] : null;
  const ultimoBenessere = postAllenamento.length > 0 ? postAllenamento[0] : null;

  const sonnoMedio = useMemo(() => {
    const valori = postAllenamento
      .map((m) => m.qualita_sonno)
      .filter((v): v is number => v !== null);

    if (valori.length === 0) return null;

    return valori.reduce((somma, v) => somma + v, 0) / valori.length;
  }, [postAllenamento]);

  function resetForm() {
    setSonno(3);
    setUmore(3);
    setDoloreMuscolare(1);
    setZonaDolore("");
  }

  async function handleSubmit() {
    setSalvataggio(true);
    setMessaggio(null);

    const formData = new FormData();
    formData.set("data_compilazione", getToday());
    formData.set("qualita_sonno", String(sonno));
    formData.set("umore", String(umore));
    formData.set("dolore_muscolare", String(doloreMuscolare));

    if (doloreMuscolare > 1) {
      formData.set("zona_dolore", zonaDolore);
    }

    const result = await creaPostAllenamentoAction(formData);

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

    resetForm();

    window.setTimeout(() => {
      setModalAperta(false);
      setMessaggio(null);
    }, 800);
  }

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
            Come stai dopo l’allenamento?
          </button>
        </div>
      </section>

      <section className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <PlayerStat
          icon={<Activity className="h-5 w-5" />}
          label="Compilazioni"
          value={String(postAllenamento.length)}
        />

        <PlayerStat
          icon={<BedDouble className="h-5 w-5" />}
          label="Sonno medio"
          value={sonnoMedio !== null ? `${sonnoMedio.toFixed(1)}/5` : "—"}
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
          Post allenamento
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
          {postAllenamento.map((misurazione) => {
            const { Icon: UmoreIcon, color: umoreColore } = getUmoreVisual(
              misurazione.umore
            );
            const doloreColore = getDoloreColore(misurazione.dolore_muscolare);

            return (
              <article
                key={misurazione.id}
                className="rounded-2xl border border-zinc-800 bg-zinc-950 p-4 sm:p-5"
              >
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <p className="text-sm font-semibold text-white">
                      Stato post allenamento
                    </p>

                    <p className="mt-1 text-xs text-zinc-500">
                      {formatDate(misurazione.data_compilazione)}
                    </p>
                  </div>

                  <ChevronRight className="h-5 w-5 text-zinc-700" />
                </div>

                <div className="mt-4 grid grid-cols-3 gap-2">
                  <WellnessValue
                    label="Sonno"
                    value={
                      misurazione.qualita_sonno !== null
                        ? `${misurazione.qualita_sonno}/5`
                        : "—"
                    }
                  />

                  <div className="rounded-xl bg-zinc-900 p-3">
                    <p className="text-[10px] font-semibold uppercase tracking-wide text-zinc-500">
                      Come ti senti
                    </p>

                    <div className="mt-1 flex items-center gap-1.5">
                      <UmoreIcon
                        className="h-4 w-4 shrink-0"
                        style={{ color: umoreColore }}
                      />
                      <p className="text-sm font-bold text-white">
                        {misurazione.umore}/5
                      </p>
                    </div>
                  </div>

                  <div className="rounded-xl bg-zinc-900 p-3">
                    <p className="text-[10px] font-semibold uppercase tracking-wide text-zinc-500">
                      Dolori muscolari
                    </p>

                    <p
                      className="mt-1 text-sm font-bold"
                      style={{ color: doloreColore }}
                    >
                      {misurazione.dolore_muscolare}/5
                    </p>
                  </div>
                </div>

                {misurazione.dolore_presente && (
                  <div className="mt-3 rounded-xl border border-amber-500/20 bg-amber-500/10 p-3">
                    <p className="text-xs font-semibold uppercase tracking-wide text-amber-300">
                      Dolore segnalato
                    </p>

                    <p className="mt-1 text-sm text-amber-100">
                      {misurazione.zona_dolore || "Zona non specificata"}
                    </p>
                  </div>
                )}
              </article>
            );
          })}

          {postAllenamento.length === 0 && (
            <EmptyPlayerState
              icon={<HeartPulse className="h-10 w-10" />}
              title="Nessuna compilazione"
              description="Dopo il prossimo allenamento registra come ti senti."
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
              <div>
                <h2 className="text-lg font-bold text-white">Come stai?</h2>

                <p className="text-sm text-zinc-500">
                  Registra il tuo stato dopo l’allenamento.
                </p>
              </div>

              <button
                type="button"
                onClick={() => setModalAperta(false)}
                className="flex h-10 w-10 items-center justify-center rounded-xl bg-zinc-900 text-zinc-400"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <div className="space-y-6 p-4 sm:p-5">
              <ScaleField1a5
                icon={<BedDouble className="h-5 w-5" />}
                label="Come hai dormito?"
                leftLabel="Male"
                rightLabel="Benissimo"
                value={sonno}
                onChange={setSonno}
                accentColor={coloreClub}
              />

              <ScaleField1a5
                icon={<Smile className="h-5 w-5" />}
                label="Come ti senti?"
                leftLabel="Male"
                rightLabel="Benissimo"
                value={umore}
                onChange={setUmore}
                accentColor={coloreClub}
              />

              <ScaleField1a5
                icon={<HeartPulse className="h-5 w-5" />}
                label="Hai dolori muscolari?"
                leftLabel="Nessun dolore"
                rightLabel="Dolore forte"
                value={doloreMuscolare}
                onChange={setDoloreMuscolare}
                accentColor={coloreClub}
              />

              {doloreMuscolare > 1 && (
                <input
                  value={zonaDolore}
                  onChange={(event) => setZonaDolore(event.target.value)}
                  placeholder="Dove? Es. spalla destra, ginocchio..."
                  className={inputClass}
                />
              )}

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

              <button
                type="button"
                onClick={() => void handleSubmit()}
                disabled={salvataggio}
                className="min-h-12 w-full rounded-2xl px-5 text-sm font-semibold text-white transition hover:brightness-110 disabled:opacity-60"
                style={{ backgroundColor: coloreClub }}
              >
                {salvataggio ? "Salvataggio..." : "Salva il mio stato"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

const inputClass =
  "min-h-11 w-full rounded-xl border border-zinc-800 bg-zinc-900 px-3 text-sm text-white outline-none transition placeholder:text-zinc-600 focus:border-zinc-600";

function ScaleField1a5({
  icon,
  label,
  leftLabel,
  rightLabel,
  value,
  onChange,
  accentColor,
}: {
  icon: ReactNode;
  label: string;
  leftLabel: string;
  rightLabel: string;
  value: number;
  onChange: (value: number) => void;
  accentColor: string;
}) {
  return (
    <div className="rounded-2xl border border-zinc-800 bg-zinc-900/40 p-4">
      <div className="flex items-start gap-3">
        <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-zinc-900 text-zinc-400">
          {icon}
        </div>

        <div className="flex-1">
          <p className="text-sm font-semibold text-white">{label}</p>

          <div className="mt-3 grid grid-cols-5 gap-2">
            {Array.from(
              { length: SCALA_MAX - SCALA_MIN + 1 },
              (_, i) => SCALA_MIN + i,
            ).map((valore) => {
              const selezionato = value === valore;

              return (
                <button
                  key={valore}
                  type="button"
                  onClick={() => onChange(valore)}
                  className="flex h-11 items-center justify-center rounded-xl text-sm font-bold transition"
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

function WellnessValue({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl bg-zinc-900 p-3">
      <p className="text-[10px] font-semibold uppercase tracking-wide text-zinc-500">
        {label}
      </p>

      <p className="mt-1 text-sm font-bold text-white">{value}</p>
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
