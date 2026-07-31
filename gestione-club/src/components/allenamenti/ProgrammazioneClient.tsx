// src/components/allenamenti/ProgrammazioneClient.tsx

"use client";

import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import {
  CalendarDays,
  Plus,
  Dumbbell,
  Activity,ChevronDown,
  BarChart3,
  Pencil,
  Save,
  Trash2,
} from "lucide-react";

import { formatDataIT } from "@/lib/date";
import NuovaProgrammazioneModal from "@/components/allenamenti/NuovaProgrammazioneModal";
import NuovaFaseProgrammazioneModal from "@/components/allenamenti/NuovaFaseProgrammazioneModal";
import ModificaFaseModal from "@/components/allenamenti/ModificaFaseModal";
import {
  eliminaProgrammazione,
  eliminaFase,
  modificaDettagliSettimana,
} from "@/app/(dashboard)/allenamenti/programmazione/actions";

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

type Intensita =
  | "bassa"
  | "medio-bassa"
  | "media"
  | "medio-alta"
  | "alta";

const INTENSITA_LABEL: Record<Intensita, string> = {
  bassa: "Bassa",
  "medio-bassa": "Medio-bassa",
  media: "Media",
  "medio-alta": "Medio-alta",
  alta: "Alta",
};

const INTENSITA_COLOR: Record<Intensita, string> = {
  bassa: "#22c55e",
  "medio-bassa": "#84cc16",
  media: "#f59e0b",
  "medio-alta": "#f97316",
  alta: "#ef4444",
};

// Il RPE target è testo libero (un numero secco "5" o un intervallo "5-6"):
// per il calcolo dell'RPE medio della programmazione un intervallo conta
// come la sua media (es. "5-6" -> 5.5).
// Il parametro accetta anche "number" perché, finché la colonna DB
// rpe_target non viene migrata da numeric a text (script
// modifica-rpe-target-testo.sql), le righe salvate prima della migrazione
// arrivano da Supabase come numero, non come stringa: senza String() qui,
// valore.trim() lancerebbe "valore.trim is not a function".
function rpeTargetANumero(valore: string | number | null): number | null {
  if (valore === null || valore === undefined || valore === "") return null;

  const match = String(valore).trim().match(/^(\d+)(?:-(\d+))?$/);
  if (!match) return null;

  const [, daStr, aStr] = match;
  const da = Number(daStr);

  return aStr !== undefined ? (da + Number(aStr)) / 2 : da;
}

type Settimana = {
  id: string;
  numero_settimana: number;
  data_inizio: string;
  data_fine: string;
  focus_settimana: string | null;
  obiettivo_settimana: string | null;
  note: string | null;
  data_seduta: string | null;
  focus_tecnico: string | null;
  intensita: Intensita | null;
  rpe_target: string | null;
  focus_avanti: string | null;
  focus_trequarti: string | null;
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
  isAdmin: boolean;
};

export default function ProgrammazioneClient({
  club,
  programmazioni,
  isAdmin,
}: Props) {
  const router = useRouter();
  const coloreClub = club?.colore_flag ?? "#0f3b68";
  const hasProgrammazioni = programmazioni.length > 0;

  const [openNuovaProgrammazione, setOpenNuovaProgrammazione] =
    useState(!hasProgrammazioni);
  const [openNuovaFase, setOpenNuovaFase] = useState(false);
  const [faseInModifica, setFaseInModifica] = useState<Fase | null>(null);
  const [isDeleting, startDeleteTransition] = useTransition();

  const [programmazioneAttiva, setProgrammazioneAttiva] =
    useState<Programmazione | null>(programmazioni[0] ?? null);

  function handleEliminaProgrammazione() {
    if (!programmazioneAttiva) return;

    const conferma = window.confirm(
      `Eliminare definitivamente la programmazione "${programmazioneAttiva.titolo}"? Verranno eliminati anche tutti i mesocicli e le settimane collegate.`
    );

    if (!conferma) return;

    startDeleteTransition(async () => {
      const res = await eliminaProgrammazione(programmazioneAttiva.id);

      if (!res.success) {
        window.alert(res.message);
        return;
      }

      setProgrammazioneAttiva(null);
      router.refresh();
    });
  }

  function handleEliminaFase(fase: Fase) {
    const conferma = window.confirm(
      `Eliminare definitivamente il mesociclo "${fase.nome}"? Verranno eliminate anche le settimane collegate.`
    );

    if (!conferma) return;

    startDeleteTransition(async () => {
      const res = await eliminaFase(fase.id);

      if (!res.success) {
        window.alert(res.message);
        return;
      }

      router.refresh();
    });
  }

  const fasi = useMemo(() => {
    return [...(programmazioneAttiva?.programmazione_fasi ?? [])].sort(
      (a, b) => Number(a.ordine ?? 0) - Number(b.ordine ?? 0)
    );
  }, [programmazioneAttiva]);

  const totaleSettimane = useMemo(() => {
    return fasi.reduce(
      (totale, fase) =>
        totale + [...(fase.programmazione_settimane ?? [])].length,
      0
    );
  }, [fasi]);

  const rpeMedio = useMemo(() => {
    const valori = fasi
      .flatMap((fase) => [...(fase.programmazione_settimane ?? [])])
      .map((settimana) => rpeTargetANumero(settimana.rpe_target))
      .filter((valore): valore is number => valore !== null);

    if (valori.length === 0) return null;

    return Math.round(
      valori.reduce((sum, valore) => sum + valore, 0) / valori.length
    );
  }, [fasi]);

  return (
    <>
      <div className="space-y-6">
        <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          <div className="rounded-3xl border border-zinc-800 bg-zinc-950/70 p-5">
  <div className="flex h-full items-center gap-4">
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

    {isAdmin && programmazioneAttiva && (
      <button
        type="button"
        onClick={handleEliminaProgrammazione}
        disabled={isDeleting}
        title="Elimina programmazione"
        className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl border border-red-500/30 bg-red-500/10 text-red-300 transition hover:bg-red-500/20 disabled:opacity-50"
      >
        <Trash2 size={16} />
      </button>
    )}
  </div>
</div>

          <StatCard
            icon={<Dumbbell size={20} />}
            label="Mesocicli"
            value={String(fasi.length)}
            coloreClub={coloreClub}
          />

          <StatCard
            icon={<Activity size={20} />}
            label="Settimane"
            value={String(totaleSettimane)}
            coloreClub={coloreClub}
          />

          <StatCard
            icon={<BarChart3 size={20} />}
            label="RPE medio"
            value={rpeMedio === null ? "—" : String(rpeMedio)}
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
          isAdmin={isAdmin}
          onEditFase={() => setFaseInModifica(fase)}
          onDeleteFase={() => handleEliminaFase(fase)}
          onSettimanaSalvata={() => router.refresh()}
        />
      ))}

      <button
        type="button"
        onClick={() => setOpenNuovaFase(true)}
        className="inline-flex items-center justify-center gap-2 rounded-2xl px-5 py-2.5 text-sm font-semibold text-white transition hover:opacity-90"
        style={{ backgroundColor: coloreClub }}
      >
        <Plus size={17} />
        Aggiungi mesociclo
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

      <ModificaFaseModal
        open={Boolean(faseInModifica)}
        onClose={() => {
          setFaseInModifica(null);
          router.refresh();
        }}
        brand={coloreClub}
        fase={faseInModifica}
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
  isAdmin,
  onEditFase,
  onDeleteFase,
  onSettimanaSalvata,
}: {
  fase: Fase;
  coloreClub: string;
  isAdmin: boolean;
  onEditFase: () => void;
  onDeleteFase: () => void;
  onSettimanaSalvata: () => void;
}) {
  const [open, setOpen] = useState(false);

  const settimaneOrdinate = [...(fase.programmazione_settimane ?? [])].sort(
    (a, b) => Number(a.numero_settimana ?? 0) - Number(b.numero_settimana ?? 0)
  );

  return (
    <div className="overflow-hidden rounded-3xl border border-zinc-800 bg-zinc-900">
      <div
        className="flex items-center justify-between gap-4 px-5 py-4 text-white"
        style={{ backgroundColor: fase.colore ?? coloreClub }}
      >
        <button
          type="button"
          onClick={() => setOpen((value) => !value)}
          className="flex-1 text-left"
        >
          <h3 className="text-lg font-bold">
            {fase.nome}
          </h3>

          <p className="text-sm text-white/75">
            {formatDataIT(fase.data_inizio)} → {formatDataIT(fase.data_fine)}
          </p>

          {fase.obiettivo && (
            <p className="mt-2 text-sm text-white/85">{fase.obiettivo}</p>
          )}
        </button>

        <div className="flex shrink-0 items-center gap-2">
          {isAdmin && (
            <>
              <button
                type="button"
                onClick={onEditFase}
                title="Modifica mesociclo"
                className="flex h-9 w-9 items-center justify-center rounded-xl bg-white/10 text-white transition hover:bg-white/20"
              >
                <Pencil size={15} />
              </button>

              <button
                type="button"
                onClick={onDeleteFase}
                title="Elimina mesociclo"
                className="flex h-9 w-9 items-center justify-center rounded-xl bg-white/10 text-white transition hover:bg-red-500/60"
              >
                <Trash2 size={15} />
              </button>
            </>
          )}

          <button
            type="button"
            onClick={() => setOpen((value) => !value)}
            className="text-2xl font-bold"
          >
            {open ? "−" : "+"}
          </button>
        </div>
      </div>

      {open && (
        <div className="grid gap-4 p-4 lg:grid-cols-2 xl:grid-cols-4">
          {settimaneOrdinate.length > 0 ? (
            settimaneOrdinate.map((settimana) => (
              <SettimanaCard
                key={settimana.id}
                settimana={settimana}
                coloreClub={coloreClub}
                isAdmin={isAdmin}
                onSalvata={onSettimanaSalvata}
              />
            ))
          ) : (
            <div className="rounded-2xl border border-dashed border-zinc-700 bg-zinc-950 p-5 text-sm text-zinc-400">
              Nessuna settimana generata per questo mesociclo.
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
  isAdmin,
  onSalvata,
}: {
  settimana: Settimana;
  coloreClub: string;
  isAdmin: boolean;
  onSalvata: () => void;
}) {
  const [focusTecnico, setFocusTecnico] = useState(
    settimana.focus_tecnico ?? ""
  );
  const [intensita, setIntensita] = useState<Intensita | "">(
    settimana.intensita ?? ""
  );
  // String(...) protegge dallo stesso problema di rpeTargetANumero: finché
  // la colonna DB non è migrata a text, un valore legacy arriva come
  // number, e rpeTarget.trim() più sotto lancerebbe un errore.
  const [rpeTarget, setRpeTarget] = useState(
    settimana.rpe_target !== null && settimana.rpe_target !== undefined
      ? String(settimana.rpe_target)
      : ""
  );
  const [focusAvanti, setFocusAvanti] = useState(
    settimana.focus_avanti ?? ""
  );
  const [focusTrequarti, setFocusTrequarti] = useState(
    settimana.focus_trequarti ?? ""
  );
  const [errore, setErrore] = useState<string | null>(null);
  const [salvataggio, startSalvataggio] = useTransition();

  const inputClass =
    "w-full rounded-xl border border-zinc-800 bg-zinc-900 px-3 py-2 text-sm text-white outline-none transition focus:border-zinc-600 disabled:cursor-not-allowed disabled:opacity-60";

  function handleSalva() {
    setErrore(null);

    startSalvataggio(async () => {
      const res = await modificaDettagliSettimana({
        settimana_id: settimana.id,
        focus_tecnico: focusTecnico || null,
        intensita: intensita || null,
        rpe_target: rpeTarget.trim() || null,
        focus_avanti: focusAvanti || null,
        focus_trequarti: focusTrequarti || null,
      });

      if (!res.success) {
        setErrore(res.message);
        return;
      }

      onSalvata();
    });
  }

  return (
    <div className="flex min-h-80 flex-col rounded-3xl border border-zinc-800 bg-zinc-950 p-4 shadow-sm">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h4 className="font-bold text-white">
            Settimana {settimana.numero_settimana}
          </h4>

          <p className="text-xs text-zinc-400">
            {formatDataIT(settimana.data_inizio)} → {formatDataIT(settimana.data_fine)}
          </p>
        </div>

        {intensita && (
          <span
            className="inline-flex shrink-0 items-center gap-1.5 rounded-full px-3 py-1 text-xs font-bold text-white"
            style={{ backgroundColor: INTENSITA_COLOR[intensita] }}
          >
            {INTENSITA_LABEL[intensita]}
          </span>
        )}
      </div>

      <div className="mt-4 flex-1 space-y-3">
        <Campo label="Focus tecnico">
          <textarea
            rows={3}
            disabled={!isAdmin}
            placeholder="Es. Difesa, possesso, transizione..."
            value={focusTecnico}
            onChange={(e) => setFocusTecnico(e.target.value)}
            className={`${inputClass} resize-y`}
          />
        </Campo>

        <div className="grid grid-cols-2 gap-2.5">
          <Campo label="Intensità">
            <select
              disabled={!isAdmin}
              value={intensita}
              onChange={(e) => setIntensita(e.target.value as Intensita | "")}
              className={inputClass}
            >
              <option value="">—</option>
              <option value="bassa">Bassa</option>
              <option value="medio-bassa">Medio-bassa</option>
              <option value="media">Media</option>
              <option value="medio-alta">Medio-alta</option>
              <option value="alta">Alta</option>
            </select>
          </Campo>

          <Campo label="RPE target/seduta">
            <input
              type="text"
              inputMode="numeric"
              pattern="^(10|[0-9])(-(10|[0-9]))?$"
              title='Un numero da 0 a 10 (es. "5") o un intervallo (es. "5-6")'
              disabled={!isAdmin}
              placeholder="Es. 5 o 5-6"
              value={rpeTarget}
              onChange={(e) => setRpeTarget(e.target.value)}
              className={inputClass}
            />
          </Campo>
        </div>

        <Campo label="Reparto specialistico — Avanti">
          <textarea
            rows={3}
            disabled={!isAdmin}
            placeholder="Es. Mischia chiusa, touche..."
            value={focusAvanti}
            onChange={(e) => setFocusAvanti(e.target.value)}
            className={`${inputClass} resize-y`}
          />
        </Campo>

        <Campo label="Reparto specialistico — Trequarti">
          <textarea
            rows={3}
            disabled={!isAdmin}
            placeholder="Es. Attacco a due fasce, difesa scivolata..."
            value={focusTrequarti}
            onChange={(e) => setFocusTrequarti(e.target.value)}
            className={`${inputClass} resize-y`}
          />
        </Campo>
      </div>

      {errore && (
        <p className="mt-3 text-xs font-medium text-red-400">{errore}</p>
      )}

      {isAdmin && (
        <button
          type="button"
          onClick={handleSalva}
          disabled={salvataggio}
          className="mt-4 inline-flex items-center justify-center gap-2 rounded-2xl border border-zinc-700 px-4 py-2 text-sm font-semibold transition hover:bg-zinc-900 disabled:cursor-not-allowed disabled:opacity-60"
          style={{ color: coloreClub }}
        >
          <Save size={16} />
          {salvataggio ? "Salvataggio..." : "Salva settimana"}
        </button>
      )}
    </div>
  );
}

function Campo({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <label className="block">
      <span className="mb-1.5 block text-xs text-zinc-500">{label}</span>
      {children}
    </label>
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
          ? "Nessun mesociclo configurato"
          : "Nessuna programmazione"}
      </h3>

      <p className="mt-1 max-w-md text-sm text-zinc-400">
        {hasProgrammazione
          ? "Crea un mesociclo per generare automaticamente le settimane."
          : "Crea prima una programmazione, poi potrai aggiungere mesocicli e settimane."}
      </p>

      <button
        type="button"
        onClick={hasProgrammazione ? onCreateFase : onCreateProgrammazione}
        className="mt-5 inline-flex items-center gap-2 rounded-2xl px-5 py-2.5 text-sm font-semibold text-white"
        style={{ backgroundColor: coloreClub }}
      >
        <Plus size={17} />
        {hasProgrammazione ? "Crea mesociclo" : "Crea programmazione"}
      </button>
    </div>
  );
}