// src/components/misurazioni/MisurazioniAdminClient.tsx

"use client";
import Image from "next/image";
import { FormEvent, useMemo, useState ,useEffect,useRef} from "react";
import {
  Activity,
  CalendarDays,
  ChevronDown,
  Plus,
  Ruler,
  Search,Check,
  Scale,UsersRound,
  UserRound,
  X,
} from "lucide-react";

import {
  creaMisurazioneAntropometricaAction,
} from "@/app/(dashboard)/misurazioni/actions";

import type {
  GiocatoreMisurazioni,
  MisurazioneAntropometrica,
} from "@/app/(dashboard)/misurazioni/page";

type Props = {
  coloreClub: string;
  nomeClub: string;
  giocatori: GiocatoreMisurazioni[];
  misurazioni: MisurazioneAntropometrica[];
};

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
}: Props) {
  const [modalAperta, setModalAperta] = useState(false);
  const [ricerca, setRicerca] = useState("");
  const [giocatoreFiltro, setGiocatoreFiltro] =
    useState("tutti");
  const [dataDa, setDataDa] = useState("");
  const [dataA, setDataA] = useState("");
  const [salvataggio, setSalvataggio] = useState(false);
  const [messaggio, setMessaggio] = useState<{
    tipo: "success" | "error";
    testo: string;
  } | null>(null);
  const [giocatoriSelezionatiIds, setGiocatoriSelezionatiIds] =
  useState<string[]>([]);

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
  const misurazioniFiltrate = useMemo(() => {
    const termine = ricerca.trim().toLowerCase();

    return misurazioni.filter((misurazione) => {
      const giocatore = misurazione.giocatore;

      const nomeCompleto =
        `${giocatore?.nome || ""} ${
          giocatore?.cognome || ""
        }`.toLowerCase();

      const idAtleta = (
        giocatore?.id_atleta || ""
      ).toLowerCase();

      const matchRicerca =
        !termine ||
        nomeCompleto.includes(termine) ||
        idAtleta.includes(termine);

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
        matchRicerca &&
        matchGiocatore &&
        matchDataDa &&
        matchDataA
      );
    });
  }, [
    misurazioni,
    ricerca,
    giocatoreFiltro,
    dataDa,
    dataA,
  ]);

  const ultimaMisurazione =
    misurazioni.length > 0 ? misurazioni[0] : null;

  const atletiMisurati = new Set(
    misurazioni.map((misurazione) => misurazione.giocatore_id),
  ).size;

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
              Misurazioni antropometriche
            </h1>

            <p className="mt-1 text-sm text-zinc-400">
              Controlla peso, altezza e composizione corporea
              degli atleti della squadra attiva.
            </p>
          </div>

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
        </div>
      </section>

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

      <section className="rounded-3xl border border-zinc-800 bg-zinc-950 p-4 sm:p-5">
        <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
          <label className="relative block">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-zinc-500" />

            <input
              value={ricerca}
              onChange={(event) =>
                setRicerca(event.target.value)
              }
              placeholder="Cerca atleta o ID..."
              className="min-h-11 w-full rounded-xl border border-zinc-800 bg-zinc-900 pl-10 pr-3 text-sm text-white outline-none transition placeholder:text-zinc-600 focus:border-zinc-600"
            />
          </label>

          <label className="relative block">
            <select
              value={giocatoreFiltro}
              onChange={(event) =>
                setGiocatoreFiltro(event.target.value)
              }
              className="min-h-11 w-full appearance-none rounded-xl border border-zinc-800 bg-zinc-900 px-3 pr-10 text-sm text-white outline-none focus:border-zinc-600"
            >
              <option value="tutti">Tutti gli atleti</option>

              {giocatori.map((giocatore) => (
                <option
                  key={giocatore.id}
                  value={giocatore.id}
                >
                  {giocatore.cognome} {giocatore.nome}
                </option>
              ))}
            </select>

            <ChevronDown className="pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-zinc-500" />
          </label>

          <label className="block">
            <span className="mb-1 block text-xs text-zinc-500">
              Dal
            </span>

            <input
              type="date"
              value={dataDa}
              onChange={(event) =>
                setDataDa(event.target.value)
              }
              className="min-h-11 w-full rounded-xl border border-zinc-800 bg-zinc-900 px-3 text-sm text-white outline-none focus:border-zinc-600"
            />
          </label>

          <label className="block">
            <span className="mb-1 block text-xs text-zinc-500">
              Al
            </span>

            <input
              type="date"
              value={dataA}
              onChange={(event) =>
                setDataA(event.target.value)
              }
              className="min-h-11 w-full rounded-xl border border-zinc-800 bg-zinc-900 px-3 text-sm text-white outline-none focus:border-zinc-600"
            />
          </label>
        </div>
      </section>

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
            </div>
          </article>
        ))}

        {misurazioniFiltrate.length === 0 && (
          <div className="rounded-2xl border border-zinc-800 bg-zinc-950">
            <EmptyState />
          </div>
        )}
      </section>

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
      <input
        name="data_misurazione"
        type="date"
        required
        defaultValue={getToday()}
        className={inputClass}
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
  giocatore: GiocatoreMisurazioni;
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