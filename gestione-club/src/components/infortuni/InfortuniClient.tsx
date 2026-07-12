"use client";

import Link from "next/link";
import { useState, useTransition } from "react";
import {
Plus,
Loader2,
Search,
HeartPulse,
CalendarDays,
Users,
Stethoscope,
ArrowRight,
} from "lucide-react";

import { creaInfortunio } from "@/app/(dashboard)/infortuni/actions";
import { AppCard } from "@/components/ui/AppCard";

type Giocatore = {
id: string;
nome: string | null;
cognome: string | null;
squadra_id: string | null;
stato_salute: string | null;
data_rientro: string | null;
};

type Infortunio = {
id: string;
data_infortunio: string;
tipo_infortunio: string;
data_rientro: string | null;
stato: string;
giocatori: {
id: string;
nome: string | null;
cognome: string | null;
} | null;
squadre: {
id: string;
nome: string | null;
} | null;
};

type Props = {
infortuni: Infortunio[];
giocatori: Giocatore[];
isAdmin: boolean;
};

const stati = [
{ value: "infortunato", label: "Infortunato" },
{ value: "in_valutazione", label: "In valutazione" },
{ value: "riabilitazione", label: "Riabilitazione" },
{ value: "recupero", label: "Recupero" },
{ value: "rientrato", label: "Rientrato" },
];

function formatDate(value: string | null) {
if (!value) return "-";

const [year, month, day] = value.split("-");

if (!year || !month || !day) {
return value;
}

return `${day}/${month}/${year}`;
}

function getStatoLabel(value: string) {
return (
stati.find((stato) => stato.value === value)?.label ??
value.replaceAll("_", " ")
);
}

export default function InfortuniClient({
infortuni,
giocatori,
isAdmin,
}: Props) {
const [search, setSearch] = useState("");
const [open, setOpen] = useState(false);
const [isPending, startTransition] = useTransition();

const filtered = infortuni.filter((item) => {
const nome = `${item.giocatori?.nome ?? ""} ${
      item.giocatori?.cognome ?? ""
    } ${item.tipo_infortunio}`.toLowerCase();


return nome.includes(search.toLowerCase());


});

function handleSubmit(formData: FormData) {
startTransition(async () => {
await creaInfortunio(formData);
setOpen(false);
});
}

return ( <div className="space-y-4 sm:space-y-6">
{/* HEADER */} <div className="flex flex-col justify-between gap-4 md:flex-row md:items-center"> <div className="min-w-0"> <h1 className="text-2xl font-semibold text-white">
Infortuni </h1>

```
      <p className="mt-1 text-sm leading-5 text-zinc-400">
        Gestione giocatori infortunati, stato clinico e data di
        rientro.
      </p>
    </div>

    {isAdmin && (
      <button
        type="button"
        onClick={() => setOpen((value) => !value)}
        className="inline-flex w-full items-center justify-center gap-2 rounded-xl bg-white px-4 py-3 text-sm font-semibold text-zinc-950 transition hover:bg-zinc-200 sm:w-auto sm:py-2"
      >
        <Plus className="h-4 w-4 shrink-0" />
        Nuovo infortunio
      </button>
    )}
  </div>

  {/* FORM NUOVO INFORTUNIO */}
  {isAdmin && open && (
    <AppCard>
      <form
        action={handleSubmit}
        className="grid gap-4 md:grid-cols-2"
      >
        <div className="min-w-0">
          <label className="mb-1.5 block text-sm text-zinc-300">
            Giocatore
          </label>

          <select
            name="giocatore_id"
            required
            className="min-h-11 w-full rounded-xl border border-zinc-700 bg-zinc-950 px-3 py-2.5 text-base text-white outline-none transition focus:border-zinc-500 sm:text-sm"
          >
            <option value="">Seleziona giocatore</option>

            {giocatori.map((g) => (
              <option key={g.id} value={g.id}>
                {g.cognome} {g.nome}
              </option>
            ))}
          </select>
        </div>

        <div className="min-w-0">
          <label className="mb-1.5 block text-sm text-zinc-300">
            Tipo infortunio
          </label>

          <input
            name="tipo_infortunio"
            required
            placeholder="Es. Distorsione caviglia"
            className="min-h-11 w-full rounded-xl border border-zinc-700 bg-zinc-950 px-3 py-2.5 text-base text-white outline-none transition placeholder:text-zinc-600 focus:border-zinc-500 sm:text-sm"
          />
        </div>

        <div className="min-w-0">
          <label className="mb-1.5 block text-sm text-zinc-300">
            Data infortunio
          </label>

          <input
            type="date"
            name="data_infortunio"
            required
            className="min-h-11 w-full rounded-xl border border-zinc-700 bg-zinc-950 px-3 py-2.5 text-base text-white outline-none transition focus:border-zinc-500 sm:text-sm"
          />
        </div>

        <div className="min-w-0">
          <label className="mb-1.5 block text-sm text-zinc-300">
            Data rientro prevista
          </label>

          <input
            type="date"
            name="data_rientro"
            className="min-h-11 w-full rounded-xl border border-zinc-700 bg-zinc-950 px-3 py-2.5 text-base text-white outline-none transition focus:border-zinc-500 sm:text-sm"
          />
        </div>

        <div className="min-w-0">
          <label className="mb-1.5 block text-sm text-zinc-300">
            Stato
          </label>

          <select
            name="stato"
            defaultValue="infortunato"
            className="min-h-11 w-full rounded-xl border border-zinc-700 bg-zinc-950 px-3 py-2.5 text-base text-white outline-none transition focus:border-zinc-500 sm:text-sm"
          >
            {stati.map((stato) => (
              <option key={stato.value} value={stato.value}>
                {stato.label}
              </option>
            ))}
          </select>
        </div>

        <div className="flex items-end justify-end">
          <button
            disabled={isPending}
            className="inline-flex min-h-11 w-full items-center justify-center gap-2 rounded-xl bg-emerald-500 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-emerald-400 disabled:cursor-not-allowed disabled:opacity-60 sm:w-auto"
          >
            {isPending && (
              <Loader2 className="h-4 w-4 animate-spin" />
            )}

            Salva infortunio
          </button>
        </div>
      </form>
    </AppCard>
  )}

  {/* ELENCO */}
  <AppCard>
    {/* SEARCH */}
    <div className="mb-4 flex min-h-11 items-center gap-2 rounded-xl border border-zinc-800 bg-zinc-950 px-3 py-2">
      <Search className="h-4 w-4 shrink-0 text-zinc-500" />

      <input
        value={search}
        onChange={(event) => setSearch(event.target.value)}
        placeholder="Cerca giocatore o tipo infortunio..."
        className="min-w-0 w-full bg-transparent text-base text-white outline-none placeholder:text-zinc-500 sm:text-sm"
      />
    </div>

    {/* MOBILE */}
    <div className="space-y-3 md:hidden">
      {filtered.map((item) => (
        <div
          key={item.id}
          className="overflow-hidden rounded-xl border border-zinc-800 bg-zinc-950"
        >
          <div className="p-4">
            {/* GIOCATORE + STATO */}
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0 flex-1">
                <p className="truncate text-base font-semibold text-white">
                  {item.giocatori?.cognome}{" "}
                  {item.giocatori?.nome}
                </p>

                <div className="mt-1 flex items-center gap-1.5 text-xs text-zinc-500">
                  <Users className="h-3.5 w-3.5 shrink-0" />
                  <span className="truncate">
                    {item.squadre?.nome ?? "-"}
                  </span>
                </div>
              </div>

              <span className="shrink-0 rounded-full bg-red-500/10 px-2.5 py-1 text-[11px] font-medium text-red-300">
                {getStatoLabel(item.stato)}
              </span>
            </div>

            {/* INFORTUNIO */}
            <div className="mt-4 flex items-start gap-2">
              <Stethoscope className="mt-0.5 h-4 w-4 shrink-0 text-zinc-500" />

              <div className="min-w-0">
                <p className="text-[11px] font-medium uppercase tracking-wide text-zinc-500">
                  Infortunio
                </p>

                <p className="mt-0.5 break-words text-sm font-medium text-zinc-200">
                  {item.tipo_infortunio}
                </p>
              </div>
            </div>

            {/* DATE */}
            <div className="mt-4 grid grid-cols-2 gap-3">
              <div className="rounded-lg border border-zinc-800 bg-zinc-900/60 p-3">
                <div className="flex items-center gap-1.5 text-zinc-500">
                  <CalendarDays className="h-3.5 w-3.5" />
                  <span className="text-[10px] font-medium uppercase tracking-wide">
                    Data
                  </span>
                </div>

                <p className="mt-1.5 text-sm font-medium text-white">
                  {formatDate(item.data_infortunio)}
                </p>
              </div>

              <div className="rounded-lg border border-zinc-800 bg-zinc-900/60 p-3">
                <div className="flex items-center gap-1.5 text-zinc-500">
                  <CalendarDays className="h-3.5 w-3.5" />
                  <span className="text-[10px] font-medium uppercase tracking-wide">
                    Rientro
                  </span>
                </div>

                <p className="mt-1.5 text-sm font-medium text-white">
                  {formatDate(item.data_rientro)}
                </p>
              </div>
            </div>
          </div>

          {/* AZIONE */}
          <Link
            href={`/infortuni/${item.id}`}
            className="flex min-h-11 items-center justify-between border-t border-zinc-800 px-4 py-3 text-sm font-medium text-emerald-400 transition hover:bg-zinc-900 hover:text-emerald-300"
          >
            <span>Gestisci</span>
            <ArrowRight className="h-4 w-4" />
          </Link>
        </div>
      ))}

      {filtered.length === 0 && (
        <div className="rounded-xl border border-zinc-800 px-4 py-10 text-center text-zinc-500">
          <HeartPulse className="mx-auto mb-2 h-8 w-8" />
          <p className="text-sm">
            Nessun infortunio attivo trovato.
          </p>
        </div>
      )}
    </div>

    {/* DESKTOP - LAYOUT ORIGINALE INVARIATO */}
    <div className="hidden overflow-hidden rounded-xl border border-zinc-800 md:block">
      <table className="w-full text-left text-sm">
        <thead className="bg-zinc-900 text-zinc-400">
          <tr>
            <th className="px-4 py-3">Giocatore</th>
            <th className="px-4 py-3">Squadra</th>
            <th className="px-4 py-3">Infortunio</th>
            <th className="px-4 py-3">Data</th>
            <th className="px-4 py-3">Rientro</th>
            <th className="px-4 py-3">Stato</th>
            <th className="px-4 py-3 text-right">
              Azioni
            </th>
          </tr>
        </thead>

        <tbody>
          {filtered.map((item) => (
            <tr
              key={item.id}
              className="border-t border-zinc-800 text-zinc-200"
            >
              <td className="px-4 py-3 font-medium text-white">
                {item.giocatori?.cognome}{" "}
                {item.giocatori?.nome}
              </td>

              <td className="px-4 py-3">
                {item.squadre?.nome ?? "-"}
              </td>

              <td className="px-4 py-3">
                {item.tipo_infortunio}
              </td>

              <td className="px-4 py-3">
                {item.data_infortunio}
              </td>

              <td className="px-4 py-3">
                {item.data_rientro ?? "-"}
              </td>

              <td className="px-4 py-3">
                <span className="rounded-full bg-red-500/10 px-3 py-1 text-xs font-medium text-red-300">
                  {item.stato.replaceAll("_", " ")}
                </span>
              </td>

              <td className="px-4 py-3 text-right">
                <Link
                  href={`/infortuni/${item.id}`}
                  className="text-sm font-medium text-emerald-400 hover:text-emerald-300"
                >
                  Gestisci
                </Link>
              </td>
            </tr>
          ))}

          {filtered.length === 0 && (
            <tr>
              <td
                colSpan={7}
                className="px-4 py-10 text-center text-zinc-500"
              >
                <HeartPulse className="mx-auto mb-2 h-8 w-8" />
                Nessun infortunio attivo trovato.
              </td>
            </tr>
          )}
        </tbody>
      </table>
    </div>
  </AppCard>
</div>



);
}