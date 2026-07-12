// src/components/allenamenti/ProgrammazioneClient.tsx

"use client";

import { useMemo, useState } from "react";
import {
  CalendarDays,
  Plus,
  Dumbbell,
  Activity,ChevronDown,
  BarChart3,
} from "lucide-react";

import NuovaProgrammazioneModal from "@/components/allenamenti/NuovaProgrammazioneModal";
import NuovaFaseProgrammazioneModal from "@/components/allenamenti/NuovaFaseProgrammazioneModal";
import NuovaSedutaProgrammazioneModal from "@/components/allenamenti/NuovaSedutaProgrammazioneModal";

type Club = {
  id: string;
  nome: string;
  colore_flag: string | null;
};

type Profilo = {
  id: string;
  last_club_id: string | null;
  last_squadra_id: string | null;
};

type Seduta = {
  id: string;
  data_seduta: string | null;
  tipo_sessione: string | null;
  tema: string | null;
  volume_min: number | null;
  rpe: number | null;
  carico: number | null;
  note: string | null;
};

type Settimana = {
  id: string;
  numero_settimana: number;
  data_inizio: string;
  data_fine: string;
  focus_settimana: string | null;
  obiettivo_settimana: string | null;
  note: string | null;
  programmazione_sedute?: Seduta[] | null;
};

type Fase = {
  id: string;
  nome: string;
  colore: string | null;
  data_inizio: string;
  data_fine: string;
  obiettivo: string | null;
  ordine: number;
  programmazione_settimane?: Settimana[] | null;
};

type Programmazione = {
  id: string;
  titolo: string;
  stagione: string | null;
  descrizione: string | null;
  data_inizio: string;
  data_fine: string;
  programmazione_fasi?: Fase[] | null;
};

type Props = {
  club: Club | null;
  profilo: Profilo;
  programmazioni: Programmazione[];
};

export default function ProgrammazioneClient({ club, programmazioni }: Props) {
  const coloreClub = club?.colore_flag ?? "#0f3b68";
  const hasProgrammazioni = programmazioni.length > 0;

  const [openNuovaProgrammazione, setOpenNuovaProgrammazione] =
    useState(!hasProgrammazioni);
  const [openNuovaFase, setOpenNuovaFase] = useState(false);
  const [openNuovaSeduta, setOpenNuovaSeduta] = useState(false);

  const [programmazioneAttiva, setProgrammazioneAttiva] =
    useState<Programmazione | null>(programmazioni[0] ?? null);

  const fasi = useMemo(() => {
    return [...(programmazioneAttiva?.programmazione_fasi ?? [])].sort(
      (a, b) => Number(a.ordine ?? 0) - Number(b.ordine ?? 0)
    );
  }, [programmazioneAttiva]);

  const settimane = useMemo(() => {
    return fasi.flatMap((fase) =>
      [...(fase.programmazione_settimane ?? [])].map((settimana) => ({
        id: settimana.id,
        numero_settimana: settimana.numero_settimana,
        data_inizio: settimana.data_inizio,
        data_fine: settimana.data_fine,
        fase_nome: fase.nome,
      }))
    );
  }, [fasi]);

  const totaleSedute = useMemo(() => {
    return fasi.reduce((totale, fase) => {
      return (
        totale +
        [...(fase.programmazione_settimane ?? [])].reduce(
          (sum, settimana) =>
            sum + [...(settimana.programmazione_sedute ?? [])].length,
          0
        )
      );
    }, 0);
  }, [fasi]);

  const totaleCarico = useMemo(() => {
    return fasi.reduce((totale, fase) => {
      return (
        totale +
        [...(fase.programmazione_settimane ?? [])].reduce(
          (sumSettimane, settimana) =>
            sumSettimane +
            [...(settimana.programmazione_sedute ?? [])].reduce(
              (sumSedute, seduta) => sumSedute + Number(seduta.carico ?? 0),
              0
            ),
          0
        )
      );
    }, 0);
  }, [fasi]);

  return (
    <>
      <div className="space-y-6">
        <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          <div className="rounded-3xl border border-zinc-800 bg-zinc-950/70 p-5">
  <div className=" h-full items-center gap-4 ">
    <div
      className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl "
      style={{
        backgroundColor: `${coloreClub}`,
        color: "white",
      }}
    >
      <CalendarDays size={20} />
    </div>

    <div className="min-w-0 flex-1">
      <p className="mb-1 text-xs font-medium uppercase tracking-[0.16em] text-zinc-500">
        Programmazione
      </p>

      <div className="relative">
        <select
          className="
            block w-full
            appearance-none
            cursor-pointer
            truncate
            border-0
            bg-transparent
            py-0 pr-8
            text-lg font-semibold leading-6 text-white
            outline-none
            focus:ring-0
          "
          value={programmazioneAttiva?.id ?? ""}
          onChange={(event) => {
            const value = event.target.value;

            if (value === "__new__") {
              setOpenNuovaProgrammazione(true);
              return;
            }

            const selected = programmazioni.find(
              (item) => item.id === value
            );

            setProgrammazioneAttiva(selected ?? null);
          }}
        >
          {programmazioni.length === 0 && (
            <option value="" className="bg-zinc-900 text-white">
              Nessuna programmazione
            </option>
          )}

          {programmazioni.map((item) => (
            <option
              key={item.id}
              value={item.id}
              className="bg-zinc-900 text-white"
            >
              {item.titolo}
              {item.stagione ? ` · ${item.stagione}` : ""}
            </option>
          ))}

          <option
            value="__new__"
            className="bg-zinc-900 text-white"
          >
            + Aggiungi nuova programmazione
          </option>
        </select>

        <ChevronDown
          size={18}
          className="
            pointer-events-none
            absolute right-0 top-1/2
            -translate-y-1/2
            text-zinc-500
          "
        />
      </div>
    </div>
  </div>
</div>

          <StatCard
            icon={<Dumbbell size={20} />}
            label="Fasi"
            value={String(fasi.length)}
            coloreClub={coloreClub}
          />

          <StatCard
            icon={<Activity size={20} />}
            label="Sedute"
            value={String(totaleSedute)}
            coloreClub={coloreClub}
          />

          <StatCard
            icon={<BarChart3 size={20} />}
            label="Carico totale"
            value={String(totaleCarico)}
            coloreClub={coloreClub}
          />
        </section>

        

        <section className="rounded-3xl border border-zinc-800 bg-zinc-950 p-4 shadow-sm">
  {fasi.length > 0 ? (
    <div className="space-y-4">
      {fasi.map((fase) => (
        <FaseProspetto
          key={fase.id}
          fase={fase}
          coloreClub={coloreClub}
          onAddSeduta={() => setOpenNuovaSeduta(true)}
        />
      ))}

      <button
        type="button"
        onClick={() => setOpenNuovaFase(true)}
        className="inline-flex items-center justify-center gap-2 rounded-2xl px-5 py-2.5 text-sm font-semibold text-white transition hover:opacity-90"
        style={{ backgroundColor: coloreClub }}
      >
        <Plus size={17} />
        Aggiungi fase
      </button>
    </div>
  ) : (
    <EmptyFasi
      hasProgrammazione={Boolean(programmazioneAttiva)}
      coloreClub={coloreClub}
      onCreateProgrammazione={() => setOpenNuovaProgrammazione(true)}
      onCreateFase={() => setOpenNuovaFase(true)}
    />
  )}
</section>
      </div>

      <NuovaProgrammazioneModal
        open={openNuovaProgrammazione}
        onClose={() => setOpenNuovaProgrammazione(false)}
        brand={coloreClub}
      />

      <NuovaFaseProgrammazioneModal
        open={openNuovaFase}
        onClose={() => setOpenNuovaFase(false)}
        brand={coloreClub}
        programmazione={
          programmazioneAttiva
            ? {
                id: programmazioneAttiva.id,
                titolo: programmazioneAttiva.titolo,
              }
            : null
        }
      />

      <NuovaSedutaProgrammazioneModal
        open={openNuovaSeduta}
        onClose={() => setOpenNuovaSeduta(false)}
        brand={coloreClub}
        settimane={settimane}
      />
    </>
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
    <div className="rounded-3xl border border-zinc-800 bg-zinc-950 p-5 shadow-sm">
      <div
        className="mb-4 flex h-10 w-10 items-center justify-center rounded-2xl text-white"
        style={{ backgroundColor: coloreClub }}
      >
        {icon}
      </div>

      <p className="text-sm text-zinc-400">{label}</p>

      <p className="mt-1 truncate text-xl font-bold text-white">
        {value}
      </p>
    </div>
  );
}

function FaseProspetto({
  fase,
  coloreClub,
  onAddSeduta,
}: {
  fase: Fase;
  coloreClub: string;
  onAddSeduta: () => void;
}) {
  const [open, setOpen] = useState(false);

  const settimaneOrdinate = [...(fase.programmazione_settimane ?? [])].sort(
    (a, b) => Number(a.numero_settimana ?? 0) - Number(b.numero_settimana ?? 0)
  );

  return (
    <div className="overflow-hidden rounded-3xl border border-zinc-800 bg-zinc-900">
      <button
        type="button"
        onClick={() => setOpen((value) => !value)}
        className="flex w-full items-center justify-between gap-4 px-5 py-4 text-left text-white"
        style={{ backgroundColor: fase.colore ?? coloreClub }}
      >
        <div>
          <h3 className="text-lg font-bold">
            {fase.nome}
          </h3>

          <p className="text-sm text-white/75">
            {fase.data_inizio} → {fase.data_fine}
          </p>

          {fase.obiettivo && (
            <p className="mt-2 text-sm text-white/85">{fase.obiettivo}</p>
          )}
        </div>

        <span className="text-2xl font-bold">{open ? "−" : "+"}</span>
      </button>

      {open && (
        <div className="grid gap-4 p-4 lg:grid-cols-2 xl:grid-cols-4">
          {settimaneOrdinate.length > 0 ? (
            settimaneOrdinate.map((settimana) => (
              <SettimanaCard
                key={settimana.id}
                settimana={settimana}
                coloreClub={coloreClub}
                onAddSeduta={onAddSeduta}
              />
            ))
          ) : (
            <div className="rounded-2xl border border-dashed border-zinc-700 bg-zinc-950 p-5 text-sm text-zinc-400">
              Nessuna settimana generata per questa fase.
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function SettimanaCard({
  settimana,
  coloreClub,
  onAddSeduta,
}: {
  settimana: Settimana;
  coloreClub: string;
  onAddSeduta: () => void;
}) {
  const sedute = settimana.programmazione_sedute ?? [];

  const caricoSettimana = sedute.reduce(
    (sum, seduta) => sum + Number(seduta.carico ?? 0),
    0
  );

  return (
    <div className="flex min-h-80 flex-col rounded-3xl border border-zinc-800 bg-zinc-950 p-4 shadow-sm">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h4 className="font-bold text-white">
            Settimana {settimana.numero_settimana}
          </h4>

          <p className="text-xs text-zinc-400">
            {settimana.data_inizio} → {settimana.data_fine}
          </p>
        </div>

        <span
          className="rounded-full px-3 py-1 text-xs font-bold text-white"
          style={{ backgroundColor: coloreClub }}
        >
          {caricoSettimana}
        </span>
      </div>

      <div className="mt-4 flex-1 space-y-3">
        {sedute.length > 0 ? (
          sedute.map((seduta) => (
            <SedutaItem key={seduta.id} seduta={seduta} />
          ))
        ) : (
          <div className="flex h-32 items-center justify-center rounded-2xl border border-dashed border-zinc-700 bg-zinc-900 p-4 text-center text-sm text-zinc-500">
            Nessuna seduta inserita.
          </div>
        )}
      </div>

      <button
        type="button"
        onClick={onAddSeduta}
        className="mt-4 inline-flex items-center justify-center gap-2 rounded-2xl border border-zinc-700 px-4 py-2 text-sm font-semibold transition hover:bg-zinc-900"
        style={{ color: coloreClub }}
      >
        <Plus size={16} />
        Aggiungi seduta
      </button>
    </div>
  );
}

function SedutaItem({ seduta }: { seduta: Seduta }) {
  const carico = Number(seduta.carico ?? 0);

  return (
    <div className="rounded-2xl border border-zinc-800 bg-zinc-900 p-3">
      <div className="flex items-start justify-between gap-2">
        <div>
          <p className="text-sm font-bold text-white">
            {seduta.data_seduta ?? "Tutta la settimana"}
          </p>

          <p className="text-xs text-zinc-400">
            {seduta.tipo_sessione ?? "Sessione"} ·{" "}
            {seduta.tema ?? "Tema libero"}
          </p>
        </div>

        <span className="rounded-full bg-white/10 px-2 py-1 text-xs font-bold text-white">
          {carico}
        </span>
      </div>

      <div className="mt-2 grid grid-cols-2 gap-2 text-xs text-zinc-400">
        <span>Volume: {seduta.volume_min ?? "—"} min</span>
        <span>RPE: {seduta.rpe ?? "—"}</span>
      </div>

      {seduta.note && (
        <p className="mt-2 text-xs text-zinc-500">{seduta.note}</p>
      )}
    </div>
  );
}

function EmptyFasi({
  hasProgrammazione,
  coloreClub,
  onCreateProgrammazione,
  onCreateFase,
}: {
  hasProgrammazione: boolean;
  coloreClub: string;
  onCreateProgrammazione: () => void;
  onCreateFase: () => void;
}) {
  return (
    <div className="flex min-h-52 flex-col items-center justify-center rounded-3xl border border-dashed border-zinc-800 bg-zinc-900 p-8 text-center">
      <div
        className="flex h-12 w-12 items-center justify-center rounded-2xl text-white"
        style={{ backgroundColor: coloreClub }}
      >
        <CalendarDays size={22} />
      </div>

      <h3 className="mt-4 font-bold text-white">
        {hasProgrammazione
          ? "Nessuna fase configurata"
          : "Nessuna programmazione"}
      </h3>

      <p className="mt-1 max-w-md text-sm text-zinc-400">
        {hasProgrammazione
          ? "Crea una fase per generare automaticamente settimane e sedute."
          : "Crea prima una programmazione, poi potrai aggiungere fasi, settimane e sedute."}
      </p>

      <button
        type="button"
        onClick={hasProgrammazione ? onCreateFase : onCreateProgrammazione}
        className="mt-5 inline-flex items-center gap-2 rounded-2xl px-5 py-2.5 text-sm font-semibold text-white"
        style={{ backgroundColor: coloreClub }}
      >
        <Plus size={17} />
        {hasProgrammazione ? "Crea fase" : "Crea programmazione"}
      </button>
    </div>
  );
}