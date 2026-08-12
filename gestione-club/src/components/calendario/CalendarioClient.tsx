// src/components/calendario/CalendarioClient.tsx

"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import {
  CalendarDays,
  ChevronLeft,
  ChevronRight,
  Clock,
  Dumbbell,
  MapPin,
  Sparkles,
  Trophy,
} from "lucide-react";

import type {
  EventoCalendario,
  TipoEventoCalendario,
} from "@/app/(dashboard)/calendario/page";

type Vista = "giorno" | "settimana" | "mese";

type Props = {
  eventi: EventoCalendario[];
  coloreClub: string;
  nomeClub: string | null;
  /** Data odierna calcolata lato server (evita mismatch di idratazione). */
  dataOdierna: string;
};

type ConfigTipo = {
  label: string;
  plurale: string;
  icon: typeof Dumbbell;
  colore: string;
};

/*
 * Ogni tipologia ha una sua icona e un suo colore, così a colpo d'occhio
 * si distingue un allenamento da una partita o da un evento del club.
 * Le partite usano il colore del club; gli eventi possono avere un
 * colore proprio definito sulla tipologia (tipi_eventi.colore).
 */
const CONFIG_TIPI: Record<TipoEventoCalendario, ConfigTipo> = {
  allenamento: {
    label: "Allenamento",
    plurale: "Allenamenti",
    icon: Dumbbell,
    colore: "#38bdf8",
  },
  partita: {
    label: "Partita",
    plurale: "Partite",
    icon: Trophy,
    colore: "",
  },
  evento: {
    label: "Evento",
    plurale: "Eventi",
    icon: Sparkles,
    colore: "#f59e0b",
  },
};

const ORDINE_TIPI: TipoEventoCalendario[] = [
  "allenamento",
  "partita",
  "evento",
];

const VISTE: { key: Vista; label: string }[] = [
  { key: "giorno", label: "Giorno" },
  { key: "settimana", label: "Settimana" },
  { key: "mese", label: "Mese" },
];

const GIORNI_SETTIMANA = [
  "Lun",
  "Mar",
  "Mer",
  "Gio",
  "Ven",
  "Sab",
  "Dom",
];

/* ------------------------------------------------------------------ */
/* Utility date: si lavora sempre con stringhe ISO locali YYYY-MM-DD,  */
/* mai con Date "UTC", per non far slittare i giorni di un'ora.        */
/* ------------------------------------------------------------------ */

function toIso(data: Date): string {
  const anno = data.getFullYear();
  const mese = String(data.getMonth() + 1).padStart(2, "0");
  const giorno = String(data.getDate()).padStart(2, "0");

  return `${anno}-${mese}-${giorno}`;
}

function fromIso(iso: string): Date {
  const [anno, mese, giorno] = iso.split("-").map(Number);

  return new Date(anno, (mese ?? 1) - 1, giorno ?? 1);
}

function addGiorni(iso: string, giorni: number): string {
  const data = fromIso(iso);
  data.setDate(data.getDate() + giorni);

  return toIso(data);
}

function addMesi(iso: string, mesi: number): string {
  const data = fromIso(iso);
  const giornoOriginale = data.getDate();

  data.setDate(1);
  data.setMonth(data.getMonth() + mesi);

  // Ultimo giorno del mese di destinazione (es. 31 gennaio -> 28/29 febbraio).
  const ultimoGiorno = new Date(
    data.getFullYear(),
    data.getMonth() + 1,
    0
  ).getDate();

  data.setDate(Math.min(giornoOriginale, ultimoGiorno));

  return toIso(data);
}

/** Lunedì della settimana a cui appartiene la data. */
function inizioSettimana(iso: string): string {
  const data = fromIso(iso);
  const offset = (data.getDay() + 6) % 7;

  return addGiorni(iso, -offset);
}

function inizioMese(iso: string): string {
  const data = fromIso(iso);

  return toIso(new Date(data.getFullYear(), data.getMonth(), 1));
}

function capitalizza(testo: string): string {
  return testo.charAt(0).toUpperCase() + testo.slice(1);
}

function etichettaGiornoLungo(iso: string): string {
  return capitalizza(
    fromIso(iso).toLocaleDateString("it-IT", {
      weekday: "long",
      day: "numeric",
      month: "long",
      year: "numeric",
    })
  );
}

function etichettaMese(iso: string): string {
  return capitalizza(
    fromIso(iso).toLocaleDateString("it-IT", {
      month: "long",
      year: "numeric",
    })
  );
}

function etichettaSettimana(isoLunedi: string): string {
  const lunedi = fromIso(isoLunedi);
  const domenica = fromIso(addGiorni(isoLunedi, 6));

  const stessoMese = lunedi.getMonth() === domenica.getMonth();

  const inizio = lunedi.toLocaleDateString("it-IT", {
    day: "numeric",
    ...(stessoMese ? {} : { month: "short" }),
  });

  const fine = domenica.toLocaleDateString("it-IT", {
    day: "numeric",
    month: "long",
    year: "numeric",
  });

  return `${inizio} - ${fine}`;
}

function coloreEvento(evento: EventoCalendario, coloreClub: string): string {
  if (evento.colore) return evento.colore;

  const config = CONFIG_TIPI[evento.tipo];

  return config.colore || coloreClub;
}

function orarioEvento(evento: EventoCalendario): string | null {
  if (!evento.oraInizio) return null;

  return evento.oraFine
    ? `${evento.oraInizio} - ${evento.oraFine}`
    : evento.oraInizio;
}

/** Ordina per orario (gli impegni senza orario vanno in fondo). */
function ordinaEventi(eventi: EventoCalendario[]): EventoCalendario[] {
  return [...eventi].sort((a, b) => {
    if (a.oraInizio && b.oraInizio) {
      return a.oraInizio.localeCompare(b.oraInizio);
    }

    if (a.oraInizio) return -1;
    if (b.oraInizio) return 1;

    return a.titolo.localeCompare(b.titolo);
  });
}

export default function CalendarioClient({
  eventi,
  coloreClub,
  nomeClub,
  dataOdierna,
}: Props) {
  const [vista, setVista] = useState<Vista>("mese");
  const [cursore, setCursore] = useState(dataOdierna);
  const [oggi, setOggi] = useState(dataOdierna);

  const [tipiAttivi, setTipiAttivi] = useState<
    Record<TipoEventoCalendario, boolean>
  >({
    allenamento: true,
    partita: true,
    evento: true,
  });

  /*
   * La data odierna arriva dal server (UTC): appena montato il componente
   * la riallineiamo al fuso del browser, spostando anche il cursore se
   * l'utente non ha ancora navigato.
   */
  useEffect(() => {
    const localeOggi = toIso(new Date());

    if (localeOggi === dataOdierna) return;

    setOggi(localeOggi);
    setCursore((corrente) =>
      corrente === dataOdierna ? localeOggi : corrente
    );
  }, [dataOdierna]);

  const eventiVisibili = useMemo(
    () => eventi.filter((evento) => tipiAttivi[evento.tipo]),
    [eventi, tipiAttivi]
  );

  /*
   * Mappa giorno ISO -> eventi di quel giorno. Gli eventi su più giorni
   * (es. un torneo di due giornate) vengono ripetuti su ogni data del
   * loro intervallo.
   */
  const eventiPerGiorno = useMemo(() => {
    const mappa = new Map<string, EventoCalendario[]>();

    for (const evento of eventiVisibili) {
      let giorno = evento.dataInizio;

      const fine =
        evento.dataFine && evento.dataFine >= evento.dataInizio
          ? evento.dataFine
          : evento.dataInizio;

      // Limite di sicurezza: un impegno non può occupare più di un anno.
      let passi = 0;

      while (giorno <= fine && passi < 366) {
        const elenco = mappa.get(giorno);

        if (elenco) {
          elenco.push(evento);
        } else {
          mappa.set(giorno, [evento]);
        }

        giorno = addGiorni(giorno, 1);
        passi += 1;
      }
    }

    for (const [giorno, elenco] of mappa) {
      mappa.set(giorno, ordinaEventi(elenco));
    }

    return mappa;
  }, [eventiVisibili]);

  const conteggioPerTipo = useMemo(() => {
    const conteggi: Record<TipoEventoCalendario, number> = {
      allenamento: 0,
      partita: 0,
      evento: 0,
    };

    for (const evento of eventi) {
      conteggi[evento.tipo] += 1;
    }

    return conteggi;
  }, [eventi]);

  const lunediCorrente = useMemo(
    () => inizioSettimana(cursore),
    [cursore]
  );

  const giorniSettimana = useMemo(
    () =>
      Array.from({ length: 7 }, (_, indice) =>
        addGiorni(lunediCorrente, indice)
      ),
    [lunediCorrente]
  );

  const settimaneMese = useMemo(() => {
    const primoGiorno = inizioMese(cursore);
    const inizioGriglia = inizioSettimana(primoGiorno);

    const dataMese = fromIso(primoGiorno);

    const ultimoGiornoMese = toIso(
      new Date(dataMese.getFullYear(), dataMese.getMonth() + 1, 0)
    );

    const settimane: string[][] = [];

    let giorno = inizioGriglia;

    while (giorno <= ultimoGiornoMese || settimane.length === 0) {
      settimane.push(
        Array.from({ length: 7 }, (_, indice) => addGiorni(giorno, indice))
      );

      giorno = addGiorni(giorno, 7);
    }

    return settimane;
  }, [cursore]);

  const meseCorrente = fromIso(cursore).getMonth();

  const titoloPeriodo =
    vista === "giorno"
      ? etichettaGiornoLungo(cursore)
      : vista === "settimana"
        ? etichettaSettimana(lunediCorrente)
        : etichettaMese(cursore);

  function vaiA(direzione: -1 | 1) {
    setCursore((corrente) => {
      if (vista === "giorno") return addGiorni(corrente, direzione);
      if (vista === "settimana") return addGiorni(corrente, direzione * 7);

      return addMesi(corrente, direzione);
    });
  }

  function eventiDelGiorno(giorno: string): EventoCalendario[] {
    return eventiPerGiorno.get(giorno) ?? [];
  }

  function toggleTipo(tipo: TipoEventoCalendario) {
    setTipiAttivi((corrente) => ({
      ...corrente,
      [tipo]: !corrente[tipo],
    }));
  }

  function apriGiorno(giorno: string) {
    setCursore(giorno);
    setVista("giorno");
  }

  return (
    <div className="min-w-0 space-y-4 sm:space-y-5">
      {/* INTESTAZIONE */}
      <div className="flex flex-col gap-4 rounded-2xl border border-white/10 bg-[#171717] p-4 sm:p-5">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="min-w-0">
            <h1 className="flex items-center gap-2 text-xl font-bold text-white sm:text-2xl">
              <CalendarDays size={22} style={{ color: coloreClub }} />
              Calendario
            </h1>

            <p className="mt-1 text-sm text-zinc-400">
              Allenamenti, partite ed eventi
              {nomeClub ? ` di ${nomeClub}` : ""} in un&apos;unica vista.
            </p>
          </div>

          {/* SELETTORE VISTA */}
          <div className="flex rounded-xl border border-white/10 bg-black/30 p-1">
            {VISTE.map((opzione) => {
              const attiva = vista === opzione.key;

              return (
                <button
                  key={opzione.key}
                  type="button"
                  onClick={() => setVista(opzione.key)}
                  aria-pressed={attiva}
                  className={`rounded-lg px-3 py-1.5 text-xs font-semibold transition sm:text-sm ${
                    attiva
                      ? "text-white"
                      : "text-zinc-400 hover:bg-white/5 hover:text-white"
                  }`}
                  style={
                    attiva ? { backgroundColor: coloreClub } : undefined
                  }
                >
                  {opzione.label}
                </button>
              );
            })}
          </div>
        </div>

        <div className="flex flex-wrap items-center justify-between gap-3">
          {/* NAVIGAZIONE PERIODO */}
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => vaiA(-1)}
              aria-label="Periodo precedente"
              className="flex h-9 w-9 items-center justify-center rounded-lg border border-white/10 bg-black/30 text-zinc-300 transition hover:bg-white/10 hover:text-white"
            >
              <ChevronLeft size={18} />
            </button>

            <button
              type="button"
              onClick={() => vaiA(1)}
              aria-label="Periodo successivo"
              className="flex h-9 w-9 items-center justify-center rounded-lg border border-white/10 bg-black/30 text-zinc-300 transition hover:bg-white/10 hover:text-white"
            >
              <ChevronRight size={18} />
            </button>

            <button
              type="button"
              onClick={() => setCursore(oggi)}
              className="rounded-lg border border-white/10 bg-black/30 px-3 py-1.5 text-xs font-semibold text-zinc-300 transition hover:bg-white/10 hover:text-white sm:text-sm"
            >
              Oggi
            </button>

            <p className="ml-1 truncate text-sm font-semibold text-white sm:text-base">
              {titoloPeriodo}
            </p>
          </div>

          {/* LEGENDA / FILTRI PER TIPOLOGIA */}
          <div className="flex flex-wrap items-center gap-2">
            {ORDINE_TIPI.map((tipo) => {
              const config = CONFIG_TIPI[tipo];
              const Icona = config.icon;
              const colore = config.colore || coloreClub;
              const attivo = tipiAttivi[tipo];

              return (
                <button
                  key={tipo}
                  type="button"
                  onClick={() => toggleTipo(tipo)}
                  aria-pressed={attivo}
                  title={
                    attivo
                      ? `Nascondi ${config.plurale.toLowerCase()}`
                      : `Mostra ${config.plurale.toLowerCase()}`
                  }
                  className={`flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-xs font-semibold transition ${
                    attivo
                      ? "text-white"
                      : "border-white/10 bg-black/30 text-zinc-500 hover:text-zinc-300"
                  }`}
                  style={
                    attivo
                      ? {
                          borderColor: `${colore}66`,
                          backgroundColor: `${colore}1f`,
                        }
                      : undefined
                  }
                >
                  <Icona
                    size={14}
                    style={{ color: attivo ? colore : undefined }}
                  />

                  <span>{config.plurale}</span>

                  <span className="text-[10px] text-zinc-400">
                    {conteggioPerTipo[tipo]}
                  </span>
                </button>
              );
            })}
          </div>
        </div>
      </div>

      {/* CONTENUTO */}
      {vista === "mese" && (
        <VistaMese
          settimane={settimaneMese}
          meseCorrente={meseCorrente}
          oggi={oggi}
          coloreClub={coloreClub}
          eventiDelGiorno={eventiDelGiorno}
          onApriGiorno={apriGiorno}
        />
      )}

      {vista === "settimana" && (
        <VistaSettimana
          giorni={giorniSettimana}
          oggi={oggi}
          coloreClub={coloreClub}
          eventiDelGiorno={eventiDelGiorno}
          onApriGiorno={apriGiorno}
        />
      )}

      {vista === "giorno" && (
        <VistaGiorno
          giorno={cursore}
          oggi={oggi}
          coloreClub={coloreClub}
          eventi={eventiDelGiorno(cursore)}
        />
      )}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Vista mensile                                                       */
/* ------------------------------------------------------------------ */

function VistaMese({
  settimane,
  meseCorrente,
  oggi,
  coloreClub,
  eventiDelGiorno,
  onApriGiorno,
}: {
  settimane: string[][];
  meseCorrente: number;
  oggi: string;
  coloreClub: string;
  eventiDelGiorno: (giorno: string) => EventoCalendario[];
  onApriGiorno: (giorno: string) => void;
}) {
  const MAX_VISIBILI = 3;

  return (
    <div className="min-w-0 overflow-hidden rounded-2xl border border-white/10 bg-[#171717]">
      <div className="grid grid-cols-7 border-b border-white/10">
        {GIORNI_SETTIMANA.map((giorno) => (
          <div
            key={giorno}
            className="px-1 py-2 text-center text-[10px] font-bold uppercase tracking-wide text-zinc-500 sm:text-xs"
          >
            {giorno}
          </div>
        ))}
      </div>

      <div className="grid grid-cols-7">
        {settimane.flat().map((giorno) => {
          const data = fromIso(giorno);
          const fuoriMese = data.getMonth() !== meseCorrente;
          const isOggi = giorno === oggi;
          const eventi = eventiDelGiorno(giorno);
          const extra = eventi.length - MAX_VISIBILI;

          return (
            <div
              key={giorno}
              className={`min-h-[86px] border-b border-r border-white/5 p-1 sm:min-h-[124px] sm:p-1.5 ${
                fuoriMese ? "bg-black/20" : ""
              }`}
            >
              <button
                type="button"
                onClick={() => onApriGiorno(giorno)}
                className={`mb-1 flex h-6 w-6 items-center justify-center rounded-lg text-[11px] font-bold transition sm:text-xs ${
                  isOggi
                    ? "text-white"
                    : fuoriMese
                      ? "text-zinc-600 hover:bg-white/5"
                      : "text-zinc-300 hover:bg-white/10 hover:text-white"
                }`}
                style={isOggi ? { backgroundColor: coloreClub } : undefined}
                aria-label={`Apri ${etichettaGiornoLungo(giorno)}`}
              >
                {data.getDate()}
              </button>

              {/* MOBILE: pallini colorati con icona */}
              <div className="flex flex-wrap gap-1 sm:hidden">
                {eventi.slice(0, 4).map((evento) => {
                  const colore = coloreEvento(evento, coloreClub);
                  const Icona = CONFIG_TIPI[evento.tipo].icon;

                  return (
                    <span
                      key={`${evento.tipo}-${evento.id}`}
                      title={`${CONFIG_TIPI[evento.tipo].label}: ${evento.titolo}`}
                      className="flex h-4 w-4 items-center justify-center rounded"
                      style={{ backgroundColor: `${colore}33` }}
                    >
                      <Icona size={10} style={{ color: colore }} />
                    </span>
                  );
                })}

                {eventi.length > 4 && (
                  <span className="text-[9px] font-semibold text-zinc-500">
                    +{eventi.length - 4}
                  </span>
                )}
              </div>

              {/* DESKTOP: chip con icona, orario e titolo */}
              <div className="hidden flex-col gap-1 sm:flex">
                {eventi.slice(0, MAX_VISIBILI).map((evento) => (
                  <ChipEvento
                    key={`${evento.tipo}-${evento.id}`}
                    evento={evento}
                    coloreClub={coloreClub}
                  />
                ))}

                {extra > 0 && (
                  <button
                    type="button"
                    onClick={() => onApriGiorno(giorno)}
                    className="px-1 text-left text-[10px] font-semibold text-zinc-500 transition hover:text-white"
                  >
                    +{extra} altri
                  </button>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Vista settimanale                                                   */
/* ------------------------------------------------------------------ */

function VistaSettimana({
  giorni,
  oggi,
  coloreClub,
  eventiDelGiorno,
  onApriGiorno,
}: {
  giorni: string[];
  oggi: string;
  coloreClub: string;
  eventiDelGiorno: (giorno: string) => EventoCalendario[];
  onApriGiorno: (giorno: string) => void;
}) {
  return (
    <div className="grid min-w-0 grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4 xl:grid-cols-7">
      {giorni.map((giorno) => {
        const data = fromIso(giorno);
        const isOggi = giorno === oggi;
        const eventi = eventiDelGiorno(giorno);

        return (
          <div
            key={giorno}
            className="flex min-w-0 flex-col rounded-2xl border bg-[#171717] p-3"
            style={{
              borderColor: isOggi ? `${coloreClub}80` : "rgba(255,255,255,0.1)",
            }}
          >
            <button
              type="button"
              onClick={() => onApriGiorno(giorno)}
              className="mb-3 flex items-center justify-between gap-2 text-left"
            >
              <span className="text-xs font-bold uppercase tracking-wide text-zinc-500">
                {capitalizza(
                  data.toLocaleDateString("it-IT", { weekday: "short" })
                )}
              </span>

              <span
                className={`flex h-7 min-w-7 items-center justify-center rounded-lg px-1.5 text-sm font-black ${
                  isOggi ? "text-white" : "text-zinc-200"
                }`}
                style={isOggi ? { backgroundColor: coloreClub } : undefined}
              >
                {data.getDate()}
              </span>
            </button>

            <div className="flex flex-1 flex-col gap-2">
              {eventi.length === 0 && (
                <p className="text-xs text-zinc-600">Niente in programma</p>
              )}

              {eventi.map((evento) => (
                <RigaEvento
                  key={`${evento.tipo}-${evento.id}`}
                  evento={evento}
                  coloreClub={coloreClub}
                  compatta
                />
              ))}
            </div>
          </div>
        );
      })}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Vista giornaliera                                                   */
/* ------------------------------------------------------------------ */

function VistaGiorno({
  giorno,
  oggi,
  coloreClub,
  eventi,
}: {
  giorno: string;
  oggi: string;
  coloreClub: string;
  eventi: EventoCalendario[];
}) {
  return (
    <div className="min-w-0 rounded-2xl border border-white/10 bg-[#171717] p-4 sm:p-5">
      <div className="mb-4 flex items-center gap-3">
        <div
          className="flex h-14 w-14 shrink-0 flex-col items-center justify-center rounded-xl"
          style={{
            backgroundColor: giorno === oggi ? coloreClub : "rgba(0,0,0,0.45)",
          }}
        >
          <span className="text-[10px] uppercase text-white/70">
            {fromIso(giorno).toLocaleDateString("it-IT", { weekday: "short" })}
          </span>

          <span className="text-xl font-black leading-none text-white">
            {fromIso(giorno).getDate()}
          </span>
        </div>

        <div className="min-w-0">
          <p className="truncate text-base font-bold text-white">
            {etichettaGiornoLungo(giorno)}
          </p>

          <p className="text-sm text-zinc-400">
            {eventi.length === 0
              ? "Nessun impegno"
              : `${eventi.length} ${eventi.length === 1 ? "impegno" : "impegni"}`}
          </p>
        </div>
      </div>

      <div className="space-y-2.5">
        {eventi.length === 0 && (
          <p className="text-sm text-zinc-500">
            Non ci sono allenamenti, partite o eventi in questa giornata.
          </p>
        )}

        {eventi.map((evento) => (
          <RigaEvento
            key={`${evento.tipo}-${evento.id}`}
            evento={evento}
            coloreClub={coloreClub}
          />
        ))}
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Elementi riutilizzabili                                             */
/* ------------------------------------------------------------------ */

function ChipEvento({
  evento,
  coloreClub,
}: {
  evento: EventoCalendario;
  coloreClub: string;
}) {
  const colore = coloreEvento(evento, coloreClub);
  const Icona = CONFIG_TIPI[evento.tipo].icon;

  const contenuto = (
    <>
      <Icona size={11} className="shrink-0" style={{ color: colore }} />

      {evento.oraInizio && (
        <span className="shrink-0 tabular-nums text-zinc-400">
          {evento.oraInizio}
        </span>
      )}

      <span className="truncate">{evento.titolo}</span>
    </>
  );

  const classi =
    "flex items-center gap-1 rounded-md px-1.5 py-1 text-[10px] font-medium text-zinc-100 transition hover:brightness-125";

  const stile = {
    backgroundColor: `${colore}26`,
    borderLeft: `2px solid ${colore}`,
  };

  if (!evento.href) {
    return (
      <div
        className={classi}
        style={stile}
        title={`${CONFIG_TIPI[evento.tipo].label}: ${evento.titolo}`}
      >
        {contenuto}
      </div>
    );
  }

  return (
    <Link
      href={evento.href}
      className={classi}
      style={stile}
      title={`${CONFIG_TIPI[evento.tipo].label}: ${evento.titolo}`}
    >
      {contenuto}
    </Link>
  );
}

function RigaEvento({
  evento,
  coloreClub,
  compatta = false,
}: {
  evento: EventoCalendario;
  coloreClub: string;
  compatta?: boolean;
}) {
  const colore = coloreEvento(evento, coloreClub);
  const config = CONFIG_TIPI[evento.tipo];
  const Icona = config.icon;
  const orario = orarioEvento(evento);

  const contenuto = (
    <>
      <span
        className={`flex shrink-0 items-center justify-center rounded-lg ${
          compatta ? "h-7 w-7" : "h-10 w-10"
        }`}
        style={{ backgroundColor: `${colore}26` }}
      >
        <Icona size={compatta ? 14 : 18} style={{ color: colore }} />
      </span>

      <span className="min-w-0 flex-1">
        <span
          className={`block truncate font-semibold text-white ${
            compatta ? "text-xs" : "text-sm"
          }`}
        >
          {evento.titolo}
        </span>

        <span
          className={`mt-0.5 flex flex-wrap items-center gap-x-2 gap-y-0.5 text-zinc-400 ${
            compatta ? "text-[10px]" : "text-xs"
          }`}
        >
          <span style={{ color: colore }}>
            {evento.sottotitolo || config.label}
          </span>

          {orario && (
            <span className="flex items-center gap-1">
              <Clock size={compatta ? 9 : 11} />
              {orario}
            </span>
          )}

          {evento.luogo && (
            <span className="flex min-w-0 items-center gap-1">
              <MapPin size={compatta ? 9 : 11} className="shrink-0" />
              <span className="truncate">{evento.luogo}</span>
            </span>
          )}

          {evento.dettaglio && (
            <span className="font-semibold text-zinc-200">
              {evento.dettaglio}
            </span>
          )}
        </span>
      </span>
    </>
  );

  const classi = `flex items-center gap-2.5 rounded-xl border border-white/5 bg-black/20 transition hover:border-white/20 hover:bg-black/40 ${
    compatta ? "p-2" : "p-3"
  }`;

  if (!evento.href) {
    return (
      <div className={classi} style={{ borderLeft: `3px solid ${colore}` }}>
        {contenuto}
      </div>
    );
  }

  return (
    <Link
      href={evento.href}
      className={classi}
      style={{ borderLeft: `3px solid ${colore}` }}
    >
      {contenuto}
    </Link>
  );
}
