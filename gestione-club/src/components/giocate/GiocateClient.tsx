"use client";

import { useMemo, useState, type ReactNode } from "react";
import {
  Search,
  Star,
  Shield,
  Swords,
  Footprints,
  Map,
  X,
  Play,
  ChevronRight,
} from "lucide-react";

import RugbyPlayAnimation from "./RugbyPlayAnimation";

type SezioneGiocata = "attacco" | "difesa" | "calci" | "bulls_map";

type Giocata = {
  id: string;
  sezione: SezioneGiocata;
  famiglia: string | null;
  codice: string;
  descrizione: string;
  prioritaria: boolean;
  ordine: number;
  animation_key: string | null;
  animation_duration_ms?: number | null;
};

type Props = {
  giocate: Giocata[];
  coloreClub: string;
};

const sezioni = [
  { key: "attacco", label: "Attacco", icon: Swords },
  { key: "difesa", label: "Difesa", icon: Shield },
  { key: "calci", label: "Calci", icon: Footprints },
  { key: "bulls_map", label: "Bulls Map", icon: Map },
] as const;

export default function GiocateClient({ giocate, coloreClub }: Props) {
  const [sezioneAttiva, setSezioneAttiva] =
    useState<SezioneGiocata>("attacco");

  const [search, setSearch] = useState("");
  const [giocataSelezionata, setGiocataSelezionata] =
    useState<Giocata | null>(null);

  const conteggi = useMemo(() => {
    return giocate.reduce<Record<SezioneGiocata, number>>(
      (acc, item) => {
        acc[item.sezione] += 1;
        return acc;
      },
      {
        attacco: 0,
        difesa: 0,
        calci: 0,
        bulls_map: 0,
      }
    );
  }, [giocate]);

  const giocateFiltrate = useMemo(() => {
    const q = search.trim().toLowerCase();

    return giocate.filter((item) => {
      const matchSezione = item.sezione === sezioneAttiva;

      const matchSearch =
        q.length === 0 ||
        item.codice.toLowerCase().includes(q) ||
        item.descrizione.toLowerCase().includes(q) ||
        item.famiglia?.toLowerCase().includes(q);

      return matchSezione && matchSearch;
    });
  }, [giocate, sezioneAttiva, search]);

  const gruppi = useMemo(() => {
    return giocateFiltrate.reduce<Record<string, Giocata[]>>((acc, item) => {
      const key = item.famiglia ?? "Altro";

      if (!acc[key]) {
        acc[key] = [];
      }

      acc[key].push(item);
      return acc;
    }, {});
  }, [giocateFiltrate]);

  function handleSezioneChange(sezione: SezioneGiocata) {
    setSezioneAttiva(sezione);
    setGiocataSelezionata(null);
  }

  return (
    <>
      <div className="space-y-6">
        <div className="rounded-3xl border border-zinc-800 bg-zinc-950 p-6">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.25em] text-zinc-500">
                Sistema di gioco
              </p>

              <h1 className="mt-2 text-2xl font-bold text-white">
                Giocate Rugby
              </h1>

              <p className="mt-2 max-w-2xl text-sm text-zinc-400">
                Consulta codici, famiglie, significati e movimenti tattici
                della squadra attiva.
              </p>
            </div>

            <div className="relative w-full lg:w-80">
              <Search className="absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-zinc-500" />

              <input
                value={search}
                onChange={(event) => setSearch(event.target.value)}
                placeholder="Cerca giocata..."
                className="w-full rounded-2xl border border-zinc-800 bg-zinc-900 py-3 pl-11 pr-4 text-sm text-white outline-none transition focus:border-zinc-600"
              />
            </div>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
          {sezioni.map((sezione) => {
            const Icon = sezione.icon;
            const active = sezioneAttiva === sezione.key;

            return (
              <button
                key={sezione.key}
                type="button"
                onClick={() => handleSezioneChange(sezione.key)}
                className="rounded-3xl border p-5 text-left transition hover:bg-zinc-900"
                style={{
                  borderColor: active ? coloreClub : "rgb(39 39 42)",
                  backgroundColor: active ? `${coloreClub}22` : "rgb(9 9 11)",
                }}
              >
                <div className="flex items-center justify-between">
                  <Icon
                    className="h-5 w-5"
                    style={{
                      color: active ? coloreClub : "rgb(161 161 170)",
                    }}
                  />

                  <span className="rounded-full bg-zinc-900 px-2 py-1 text-xs text-zinc-400">
                    {conteggi[sezione.key]}
                  </span>
                </div>

                <div className="mt-4 text-base font-semibold text-white">
                  {sezione.label}
                </div>

                <div className="mt-1 text-xs text-zinc-500">
                  Codici e indicazioni
                </div>
              </button>
            );
          })}
        </div>

        {sezioneAttiva === "bulls_map" ? (
          <BullsMapField giocate={giocateFiltrate} coloreClub={coloreClub} />
        ) : (
          <div className="space-y-5">
            {Object.keys(gruppi).length === 0 && (
              <div className="rounded-3xl border border-zinc-800 bg-zinc-950 p-8 text-center text-sm text-zinc-500">
                Nessuna giocata trovata.
              </div>
            )}

            {Object.entries(gruppi).map(([famiglia, items]) => (
              <section
                key={famiglia}
                className="rounded-3xl border border-zinc-800 bg-zinc-950 p-5"
              >
                <div className="mb-4 flex items-center justify-between">
                  <div>
                    <h2 className="text-lg font-semibold text-white">
                      {famiglia}
                    </h2>

                    <p className="text-xs text-zinc-500">
                      {items.length}{" "}
                      {items.length === 1 ? "giocata" : "giocate"}
                    </p>
                  </div>
                </div>

                <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
                  {items.map((item) => (
                    <button
                      key={item.id}
                      type="button"
                      onClick={() => setGiocataSelezionata(item)}
                      className="group rounded-2xl border border-zinc-800 bg-zinc-900 p-4 text-left transition hover:border-zinc-700 hover:bg-zinc-800/80"
                    >
                      <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0">
                          <div className="text-base font-bold text-white">
                            {item.codice}
                          </div>

                          {item.animation_key && (
                            <div
                              className="mt-2 inline-flex items-center gap-1.5 text-xs font-medium"
                              style={{ color: coloreClub }}
                            >
                              <Play className="h-3 w-3 fill-current" />
                              Animazione disponibile
                            </div>
                          )}
                        </div>

                        <div className="flex items-center gap-2">
                          {item.prioritaria && (
                            <div
                              className="inline-flex items-center gap-1 rounded-full px-2 py-1 text-xs font-medium"
                              style={{
                                backgroundColor: `${coloreClub}22`,
                                color: coloreClub,
                              }}
                            >
                              <Star className="h-3 w-3 fill-current" />
                              <span className="hidden sm:inline">
                                Prioritaria
                              </span>
                            </div>
                          )}

                          <ChevronRight className="h-4 w-4 text-zinc-600 transition group-hover:translate-x-0.5 group-hover:text-zinc-400" />
                        </div>
                      </div>

                      <p className="mt-3 line-clamp-3 text-sm leading-6 text-zinc-400">
                        {item.descrizione}
                      </p>
                    </button>
                  ))}
                </div>
              </section>
            ))}
          </div>
        )}
      </div>

      {giocataSelezionata && (
        <div
          className="fixed inset-0 z-[100] flex items-end justify-center bg-black/75 p-0 backdrop-blur-sm md:items-center md:p-6"
          onMouseDown={(event) => {
            if (event.target === event.currentTarget) {
              setGiocataSelezionata(null);
            }
          }}
        >
          <div className="max-h-[95vh] w-full overflow-y-auto rounded-t-3xl border border-zinc-800 bg-zinc-950 shadow-2xl md:max-w-5xl md:rounded-3xl">
            <div className="sticky top-0 z-20 flex items-start justify-between gap-4 border-b border-zinc-800 bg-zinc-950/95 p-5 backdrop-blur md:p-6">
              <div className="min-w-0">
                <p className="text-xs font-semibold uppercase tracking-[0.2em] text-zinc-500">
                  {giocataSelezionata.famiglia ?? "Giocata"}
                </p>

                <h2 className="mt-2 text-2xl font-bold text-white md:text-3xl">
                  {giocataSelezionata.codice}
                </h2>

                {giocataSelezionata.prioritaria && (
                  <div
                    className="mt-3 inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-semibold"
                    style={{
                      backgroundColor: `${coloreClub}22`,
                      color: coloreClub,
                    }}
                  >
                    <Star className="h-3.5 w-3.5 fill-current" />
                    Giocata prioritaria
                  </div>
                )}
              </div>

              <button
                type="button"
                onClick={() => setGiocataSelezionata(null)}
                className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full border border-zinc-800 bg-zinc-900 text-zinc-400 transition hover:bg-zinc-800 hover:text-white"
                aria-label="Chiudi"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <div className="grid gap-6 p-5 md:p-6 lg:grid-cols-[minmax(0,1.5fr)_minmax(280px,0.7fr)]">
              <div className="min-w-0">
                <div className="mb-3 flex items-center justify-between">
                  <h3 className="text-sm font-semibold text-white">
                    Movimento tattico
                  </h3>

                  {giocataSelezionata.animation_key && (
                    <div
                      className="flex items-center gap-1.5 text-xs font-medium"
                      style={{ color: coloreClub }}
                    >
                      <Play className="h-3 w-3 fill-current" />
                      Animazione
                    </div>
                  )}
                </div>

                <RugbyPlayAnimation
                  animationKey={giocataSelezionata.animation_key}
                  coloreClub={coloreClub}
                />
              </div>

              <aside className="space-y-4">
                <div className="rounded-2xl border border-zinc-800 bg-zinc-900 p-5">
                  <p className="text-xs font-semibold uppercase tracking-[0.18em] text-zinc-500">
                    Descrizione
                  </p>

                  <p className="mt-3 text-sm leading-7 text-zinc-300">
                    {giocataSelezionata.descrizione}
                  </p>
                </div>

                <div className="rounded-2xl border border-zinc-800 bg-zinc-900 p-5">
                  <p className="text-xs font-semibold uppercase tracking-[0.18em] text-zinc-500">
                    Informazioni
                  </p>

                  <div className="mt-4 space-y-3">
                    <InfoRow
                      label="Sezione"
                      value={formatSezione(giocataSelezionata.sezione)}
                    />

                    <InfoRow
                      label="Famiglia"
                      value={giocataSelezionata.famiglia ?? "—"}
                    />

                    <InfoRow
                      label="Priorità"
                      value={
                        giocataSelezionata.prioritaria
                          ? "Prioritaria"
                          : "Standard"
                      }
                    />

                    <InfoRow
                      label="Animazione"
                      value={
                        giocataSelezionata.animation_key
                          ? "Disponibile"
                          : "Non disponibile"
                      }
                    />
                  </div>
                </div>
              </aside>
            </div>
          </div>
        </div>
      )}
    </>
  );
}

function BullsMapField({
  giocate,
  coloreClub,
}: {
  giocate: Giocata[];
  coloreClub: string;
}) {
  const items = useMemo(() => {
    return [...giocate].sort((a, b) => a.ordine - b.ordine);
  }, [giocate]);

  const regolaSemplice =
    items.find((item) => {
      const codice = item.codice.toLowerCase();
      const famiglia = (item.famiglia ?? "").toLowerCase();

      return codice.includes("regola") || famiglia.includes("regola");
    }) ?? null;

  const corsie =
    items.find((item) => {
      const codice = item.codice.toLowerCase();
      const famiglia = (item.famiglia ?? "").toLowerCase();

      return codice.includes("cors") || famiglia.includes("cors");
    }) ?? null;

  const findZone = (key: "strike" | "launch" | "pressure" | "exit") => {
    return (
      items.find((item) => item.codice.toLowerCase().includes(key)) ?? null
    );
  };

  const zone = [
    findZone("strike"),
    findZone("launch"),
    findZone("pressure"),
    findZone("exit"),
  ].filter((item): item is Giocata => item !== null);

  const [tab, setTab] = useState<"zone" | "corsie">("zone");
  const [selectedId, setSelectedId] = useState<string | null>(
    zone[0]?.id ?? null
  );

  const selectedZone =
    zone.find((item) => item.id === selectedId) ?? zone[0] ?? null;

  if (items.length === 0) {
    return (
      <div className="rounded-3xl border border-zinc-800 bg-zinc-950 p-8 text-center text-sm text-zinc-500">
        Nessuna indicazione trovata per la Bulls Map.
      </div>
    );
  }

  return (
    <section className="space-y-5 rounded-3xl border border-zinc-800 bg-zinc-950 p-4 sm:p-5">
      {regolaSemplice && (
        <div
          className="rounded-3xl border p-5"
          style={{
            borderColor: coloreClub,
            backgroundColor: `${coloreClub}18`,
          }}
        >
          <p className="text-xs font-semibold uppercase tracking-[0.22em] text-zinc-500">
            Regola semplice
          </p>

          <h2 className="mt-2 text-2xl font-bold text-white">
            {regolaSemplice.codice}
          </h2>

          <p className="mt-3 text-sm leading-7 text-zinc-300">
            {regolaSemplice.descrizione}
          </p>
        </div>
      )}

      <div className="flex rounded-2xl border border-zinc-800 bg-zinc-900 p-1">
        <button
          type="button"
          onClick={() => setTab("zone")}
          className="flex-1 rounded-xl px-4 py-3 text-sm font-semibold transition"
          style={{
            backgroundColor: tab === "zone" ? coloreClub : "transparent",
            color: tab === "zone" ? "white" : "rgb(161 161 170)",
          }}
        >
          Zone
        </button>

        <button
          type="button"
          onClick={() => setTab("corsie")}
          className="flex-1 rounded-xl px-4 py-3 text-sm font-semibold transition"
          style={{
            backgroundColor: tab === "corsie" ? coloreClub : "transparent",
            color: tab === "corsie" ? "white" : "rgb(161 161 170)",
          }}
        >
          Corsie
        </button>
      </div>

      <div className="grid gap-5 lg:grid-cols-[minmax(0,1.2fr)_360px]">
        <RugbyFieldShell>
          {tab === "zone" ? (
            <div className="absolute inset-x-[7%] bottom-[7%] top-[7%] z-10 grid grid-rows-4 gap-1.5">
              {zone.map((item) => {
                const active = selectedZone?.id === item.id;
                const zoneColor = getBullsMapColor(item, coloreClub);

                return (
                  <button
                    key={item.id}
                    type="button"
                    onClick={() => setSelectedId(item.id)}
                    className="group relative overflow-hidden rounded-xl border text-left transition hover:scale-[1.005] sm:rounded-2xl"
                    style={{
                      borderColor: active
                        ? coloreClub
                        : "rgba(255,255,255,0.24)",
                      backgroundColor: `${zoneColor}${active ? "72" : "3D"}`,
                      boxShadow: active
                        ? `0 0 0 2px ${coloreClub}44 inset`
                        : undefined,
                    }}
                  >
                    <div
                      className="absolute inset-y-0 left-0 w-1.5 sm:w-2"
                      style={{ backgroundColor: zoneColor }}
                    />

                    <div className="flex h-full items-center justify-between gap-3 px-4 py-3 pl-5 sm:px-6 sm:pl-7">
                      <div className="min-w-0">
                        <div className="truncate text-base font-black uppercase tracking-wide text-white sm:text-xl">
                          {item.codice}
                        </div>
                        <div className="mt-1 truncate text-[10px] font-semibold uppercase tracking-[0.18em] text-white/70 sm:text-xs">
                          {item.famiglia ?? "Zona campo"}
                        </div>
                      </div>

                      <span
                        className="shrink-0 rounded-full px-2.5 py-1 text-[10px] font-bold sm:px-3 sm:text-xs"
                        style={{
                          backgroundColor: active
                            ? coloreClub
                            : "rgba(0,0,0,0.34)",
                          color: "white",
                        }}
                      >
                        {active ? "Attiva" : "Apri"}
                      </span>
                    </div>
                  </button>
                );
              })}
            </div>
          ) : (
            <div className="absolute inset-x-[7%] bottom-[7%] top-[7%] z-10 grid grid-cols-4 overflow-hidden rounded-xl border border-white/25 sm:rounded-2xl">
              {[1, 2, 3, 4].map((numero) => (
                <div
                  key={numero}
                  className="relative flex items-center justify-center border-r border-dashed border-white/40 last:border-r-0"
                  style={{
                    backgroundColor:
                      numero % 2 === 0
                        ? "rgba(255,255,255,0.045)"
                        : "rgba(0,0,0,0.04)",
                  }}
                >
                  <div className="absolute inset-x-0 top-3 text-center text-[9px] font-black uppercase tracking-[0.18em] text-white/55 sm:text-[10px]">
                    {numero === 1
                      ? "SX"
                      : numero === 4
                        ? "DX"
                        : "Centro"}
                  </div>

                  <span className="rounded-full border border-white/20 bg-black/40 px-2 py-2 text-center text-[10px] font-black uppercase tracking-wide text-white backdrop-blur-sm sm:px-4 sm:text-sm">
                    Corsia {numero}
                  </span>
                </div>
              ))}
            </div>
          )}
        </RugbyFieldShell>

        <aside className="space-y-4">
          {tab === "zone" ? (
            <>
              {selectedZone && (
                <div className="rounded-3xl border border-zinc-800 bg-zinc-900 p-5">
                  <p className="text-xs font-semibold uppercase tracking-[0.2em] text-zinc-500">
                    Zona selezionata
                  </p>

                  <h3 className="mt-3 text-2xl font-bold text-white">
                    {selectedZone.codice}
                  </h3>

                  <p className="mt-2 text-sm text-zinc-400">
                    {selectedZone.famiglia ?? "Zona campo"}
                  </p>

                  <p className="mt-4 text-sm leading-7 text-zinc-300">
                    {selectedZone.descrizione}
                  </p>
                </div>
              )}

              <div className="rounded-3xl border border-zinc-800 bg-zinc-900 p-5">
                <p className="text-sm font-semibold text-white">
                  4 zone di gioco
                </p>

                <div className="mt-4 space-y-2">
                  {zone.map((item) => (
                    <button
                      key={item.id}
                      type="button"
                      onClick={() => setSelectedId(item.id)}
                      className="flex w-full items-center gap-3 rounded-2xl border border-zinc-800 bg-zinc-950 px-4 py-3 text-left transition hover:border-zinc-700"
                    >
                      <span
                        className="h-3 w-3 shrink-0 rounded-full"
                        style={{
                          backgroundColor: getBullsMapColor(item, coloreClub),
                        }}
                      />

                      <span className="truncate text-sm font-medium text-zinc-200">
                        {item.codice}
                      </span>
                    </button>
                  ))}
                </div>
              </div>
            </>
          ) : (
            <div className="rounded-3xl border border-zinc-800 bg-zinc-900 p-5">
              <p className="text-xs font-semibold uppercase tracking-[0.2em] text-zinc-500">
                Suddivisione del campo
              </p>

              <h3 className="mt-3 text-2xl font-bold text-white">
                {corsie?.codice ?? "Le 4 corsie"}
              </h3>

              <p className="mt-4 text-sm leading-7 text-zinc-300">
                {corsie?.descrizione ??
                  "Lo stesso campo viene diviso verticalmente in quattro corsie, da sinistra verso destra, mantenendo la nostra meta in basso e la meta avversaria in alto."}
              </p>

              <div className="mt-5 grid grid-cols-2 gap-2">
                {[1, 2, 3, 4].map((numero) => (
                  <div
                    key={numero}
                    className="rounded-2xl border border-zinc-800 bg-zinc-950 px-4 py-3"
                  >
                    <p className="text-xs font-bold text-white">
                      Corsia {numero}
                    </p>
                    <p className="mt-1 text-[11px] text-zinc-500">
                      {numero === 1
                        ? "Lato sinistro"
                        : numero === 4
                          ? "Lato destro"
                          : "Zona centrale"}
                    </p>
                  </div>
                ))}
              </div>
            </div>
          )}
        </aside>
      </div>
    </section>
  );
}

function RugbyFieldShell({ children }: { children: ReactNode }) {
  return (
    <div className="relative min-h-[560px] overflow-hidden rounded-[2rem] border border-white/20 bg-[#174726] shadow-[inset_0_0_45px_rgba(0,0,0,0.38)] sm:min-h-[640px]">
      <div className="absolute inset-0 bg-[linear-gradient(90deg,rgba(255,255,255,0.025)_50%,transparent_50%)] bg-[length:42px_100%]" />
      <div className="absolute inset-x-[4%] bottom-[4%] top-[4%] rounded-[1.4rem] border-2 border-white/50" />

      <div className="absolute left-[4%] right-[4%] top-[7%] border-t-2 border-white/55" />
      <div className="absolute left-[4%] right-[4%] top-[28%] border-t border-dashed border-white/45" />
      <div className="absolute left-[4%] right-[4%] top-1/2 border-t-2 border-white/65" />
      <div className="absolute left-[4%] right-[4%] top-[72%] border-t border-dashed border-white/45" />
      <div className="absolute bottom-[7%] left-[4%] right-[4%] border-t-2 border-white/55" />

      <div className="absolute inset-x-0 top-2 text-center text-[9px] font-black uppercase tracking-[0.25em] text-white/70 sm:text-[10px]">
        Meta avversaria
      </div>
      <div className="absolute bottom-2 inset-x-0 text-center text-[9px] font-black uppercase tracking-[0.25em] text-white/70 sm:text-[10px]">
        Nostra meta
      </div>

      <div className="absolute left-[5%] top-[25%] rounded-full bg-black/35 px-2 py-1 text-[8px] font-bold uppercase tracking-wider text-white/65 sm:text-[9px]">
        22 m
      </div>
      <div className="absolute left-[5%] top-[47%] rounded-full bg-black/35 px-2 py-1 text-[8px] font-bold uppercase tracking-wider text-white/70 sm:text-[9px]">
        Metà campo
      </div>
      <div className="absolute left-[5%] top-[69%] rounded-full bg-black/35 px-2 py-1 text-[8px] font-bold uppercase tracking-wider text-white/65 sm:text-[9px]">
        22 m
      </div>

      <div className="absolute left-1/2 top-[3.1%] h-6 w-px -translate-x-1/2 bg-white/70" />
      <div className="absolute left-[calc(50%-26px)] top-[3.1%] h-4 w-px bg-white/70" />
      <div className="absolute left-[calc(50%+26px)] top-[3.1%] h-4 w-px bg-white/70" />

      <div className="absolute bottom-[3.1%] left-1/2 h-6 w-px -translate-x-1/2 bg-white/70" />
      <div className="absolute bottom-[3.1%] left-[calc(50%-26px)] h-4 w-px bg-white/70" />
      <div className="absolute bottom-[3.1%] left-[calc(50%+26px)] h-4 w-px bg-white/70" />

      {children}
    </div>
  );
}

function getBullsMapColor(item: Giocata, fallback: string) {
  const codice = item.codice.toLowerCase();

  if (codice.includes("strike")) return "#1E8449";
  if (codice.includes("launch")) return "#B7950B";
  if (codice.includes("pressure")) return "#D68910";
  if (codice.includes("exit")) return "#C0392B";

  return fallback;
}

function InfoRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-start justify-between gap-4 border-b border-zinc-800 pb-3 last:border-b-0 last:pb-0">
      <span className="text-xs text-zinc-500">{label}</span>

      <span className="text-right text-xs font-medium text-zinc-300">
        {value}
      </span>
    </div>
  );
}

function formatSezione(sezione: SezioneGiocata) {
  switch (sezione) {
    case "attacco":
      return "Attacco";
    case "difesa":
      return "Difesa";
    case "calci":
      return "Calci";
    case "bulls_map":
      return "Bulls Map";
  }
}