"use client";

import Image from "next/image";
import Link from "next/link";
import { useMemo, useState } from "react";
import {
  CalendarDays,
  Clock,
  History,
  MapPin,
  Shield,
  Trophy,
  Users,
  Settings,
  Plus,
} from "lucide-react";

import { AppCard } from "@/components/ui/AppCard";
import type { Partita } from "@/app/(dashboard)/partite/page";

type TabKey = "prossime" | "tutte" | "classifica";

type Props = {
  partite: Partita[];
  coloreClub: string;
};

function formatData(data: string) {
  return new Intl.DateTimeFormat("it-IT", {
    weekday: "long",
    day: "2-digit",
    month: "long",
    year: "numeric",
  }).format(new Date(`${data}T12:00:00`));
}

function formatDataMobile(data: string) {
  return new Intl.DateTimeFormat("it-IT", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  }).format(new Date(`${data}T12:00:00`));
}

function formatOra(ora: string | null) {
  if (!ora) return "Da definire";
  return ora.slice(0, 5);
}

function getTipoLabel(tipo: Partita["tipo_partita"]) {
  if (tipo === "amichevole") return "Amichevole";
  if (tipo === "campionato") return "Campionato";
  if (tipo === "barrage") return "Barrage";
  return "Partita";
}

function EmptyState({
  title,
  description,
  coloreClub,
}: {
  title: string;
  description: string;
  coloreClub: string;
}) {
  return (
    <AppCard>
      <div className="flex flex-col items-center justify-center px-4 py-10 text-center sm:py-12">
        <div
          className="mb-4 flex h-14 w-14 items-center justify-center rounded-2xl border sm:h-16 sm:w-16"
          style={{
            borderColor: `${coloreClub}44`,
            backgroundColor: `${coloreClub}14`,
          }}
        >
          <Trophy
            className="h-7 w-7 sm:h-8 sm:w-8"
            style={{ color: coloreClub }}
          />
        </div>

        <h2 className="text-lg font-semibold text-white sm:text-xl">
          {title}
        </h2>

        <p className="mt-2 max-w-md text-sm leading-6 text-zinc-400">
          {description}
        </p>
      </div>
    </AppCard>
  );
}

function TeamLogo({
  nome,
  logoUrl,
  colore,
  fallbackColor,
  mobile = false,
}: {
  nome: string;
  logoUrl: string | null | undefined;
  colore: string | null | undefined;
  fallbackColor: string;
  mobile?: boolean;
}) {
  return (
    <div
      className={
        mobile
          ? "flex h-14 w-14 shrink-0 items-center justify-center overflow-hidden rounded-2xl border bg-zinc-900"
          : "mb-4 flex h-20 w-20 items-center justify-center overflow-hidden rounded-3xl border bg-zinc-900"
      }
      style={{
        borderColor: colore ? `${colore}66` : `${fallbackColor}44`,
      }}
    >
      {logoUrl ? (
        <Image
          src={logoUrl}
          alt={nome}
          width={mobile ? 56 : 80}
          height={mobile ? 56 : 80}
          className={
            mobile
              ? "h-full w-full object-contain p-1.5"
              : "h-full w-full object-contain p-2"
          }
          unoptimized
        />
      ) : (
        <Shield
          className={mobile ? "h-7 w-7" : "h-10 w-10"}
          style={{
            color: colore || fallbackColor,
          }}
        />
      )}
    </div>
  );
}

function PartitaCard({
  partita,
  coloreClub,
}: {
  partita: Partita;
  coloreClub: string;
}) {
  const squadraCasa = partita.squadra_casa;
  const squadraFuori = partita.squadra_fuori;

  const nomeCasa = squadraCasa?.nome || "Squadra casa";
  const nomeFuori = squadraFuori?.nome || "Squadra trasferta";

  return (
    <div
      className="min-w-0 overflow-hidden rounded-2xl border border-zinc-800 bg-zinc-950 shadow-xl transition duration-300 sm:rounded-3xl sm:hover:-translate-y-0.5 sm:hover:bg-zinc-900/80"
      style={{
        boxShadow: `0 0 28px ${coloreClub}12`,
      }}
    >
      {/* =====================================================
          HEADER MOBILE
      ===================================================== */}
      <div className="border-b border-zinc-800 bg-zinc-900 px-4 py-3 sm:hidden">
        <div className="flex min-w-0 items-center justify-between gap-2">
          <span
            className="shrink-0 rounded-full border px-2.5 py-1 text-[10px] font-black uppercase tracking-wider"
            style={{
              borderColor: `${coloreClub}55`,
              backgroundColor: `${coloreClub}18`,
              color: coloreClub,
            }}
          >
            {getTipoLabel(partita.tipo_partita)}
          </span>

          <div className="flex min-w-0 items-center gap-1.5 text-[11px] font-semibold text-zinc-300">
            <CalendarDays
              className="h-3.5 w-3.5 shrink-0"
              style={{ color: coloreClub }}
            />

            <span className="truncate">
              {formatDataMobile(partita.data_partita)}
            </span>
          </div>
        </div>

        <div className="mt-2 min-w-0">
          <p className="truncate text-[11px] font-semibold text-zinc-500">
            {nomeCasa} vs {nomeFuori}
          </p>
        </div>
      </div>

      {/* =====================================================
          HEADER DESKTOP
      ===================================================== */}
      <div className="hidden flex-col gap-3 border-b border-zinc-800 bg-zinc-900 px-5 py-4 sm:flex md:flex-row md:items-center md:justify-between">
        <div className="flex flex-wrap items-center gap-2">
          <span
            className="rounded-full border px-3 py-1 text-xs font-bold uppercase tracking-wider"
            style={{
              borderColor: `${coloreClub}55`,
              backgroundColor: `${coloreClub}18`,
              color: coloreClub,
            }}
          >
            {getTipoLabel(partita.tipo_partita)}
          </span>

          <span className="rounded-full border border-zinc-700 bg-zinc-800 px-3 py-1 text-xs font-semibold uppercase text-zinc-300">
            {nomeCasa} vs {nomeFuori}
          </span>
        </div>

        <div className="flex items-center gap-2 text-sm font-medium text-zinc-300">
          <CalendarDays
            className="h-4 w-4"
            style={{ color: coloreClub }}
          />

          <span>{formatData(partita.data_partita)}</span>
        </div>
      </div>

      {/* =====================================================
          BODY MOBILE
          CASA | VS | TRASFERTA
      ===================================================== */}
      <div className="px-3 py-5 sm:hidden">
        <div className="grid grid-cols-[minmax(0,1fr)_58px_minmax(0,1fr)] items-start gap-2">
          {/* CASA */}
          <div className="flex min-w-0 flex-col items-center text-center">
            <TeamLogo
              nome={nomeCasa}
              logoUrl={squadraCasa?.logo_url}
              colore={squadraCasa?.colore_1}
              fallbackColor={coloreClub}
              mobile
            />

            <p className="mt-2 text-[9px] font-black uppercase tracking-[0.2em] text-zinc-500">
              Casa
            </p>

            <h2 className="mt-1 line-clamp-2 min-h-[34px] max-w-full break-words text-[13px] font-black leading-[17px] text-white">
              {nomeCasa}
            </h2>
          </div>

          {/* CENTRO */}
          <div className="flex min-w-0 flex-col items-center pt-1">
            {partita.risultato ? (
              <div
                className="flex min-h-12 min-w-12 items-center justify-center rounded-xl border px-2 text-base font-black text-white"
                style={{
                  borderColor: `${coloreClub}66`,
                  backgroundColor: `${coloreClub}18`,
                }}
              >
                {partita.risultato}
              </div>
            ) : (
              <>
                <div
                  className="flex h-12 w-12 items-center justify-center rounded-xl border"
                  style={{
                    borderColor: `${coloreClub}55`,
                    backgroundColor: `${coloreClub}12`,
                  }}
                >
                  <span className="text-lg font-black italic tracking-tight text-white">
                    VS
                  </span>
                </div>

                <div className="mt-2 flex items-center gap-1 rounded-full border border-zinc-800 bg-zinc-900 px-2 py-1">
                  <Clock
                    className="h-3 w-3 shrink-0"
                    style={{ color: coloreClub }}
                  />

                  <span className="whitespace-nowrap text-[10px] font-bold text-zinc-300">
                    {formatOra(partita.ora_partita)}
                  </span>
                </div>
              </>
            )}
          </div>

          {/* TRASFERTA */}
          <div className="flex min-w-0 flex-col items-center text-center">
            <TeamLogo
              nome={nomeFuori}
              logoUrl={squadraFuori?.logo_url}
              colore={squadraFuori?.colore_1}
              fallbackColor="#d4d4d8"
              mobile
            />

            <p className="mt-2 text-[9px] font-black uppercase tracking-[0.2em] text-zinc-500">
              Trasferta
            </p>

            <h2 className="mt-1 line-clamp-2 min-h-[34px] max-w-full break-words text-[13px] font-black leading-[17px] text-white">
              {nomeFuori}
            </h2>
          </div>
        </div>
      </div>

      {/* =====================================================
          BODY DESKTOP
      ===================================================== */}
      <div className="hidden gap-6 px-5 py-7 sm:grid md:grid-cols-[1fr_auto_1fr] md:items-center">
        <div className="flex flex-col items-center text-center md:items-start md:text-left">
          <TeamLogo
            nome={nomeCasa}
            logoUrl={squadraCasa?.logo_url}
            colore={squadraCasa?.colore_1}
            fallbackColor={coloreClub}
          />

          <p className="text-xs font-bold uppercase tracking-[0.25em] text-zinc-500">
            Casa
          </p>

          <h2 className="mt-1 text-2xl font-black text-white">
            {nomeCasa}
          </h2>
        </div>

        <div className="flex flex-col items-center justify-center">
          {partita.risultato ? (
            <div
              className="rounded-2xl border px-6 py-3 text-3xl font-black text-white"
              style={{
                borderColor: `${coloreClub}66`,
                backgroundColor: `${coloreClub}18`,
              }}
            >
              {partita.risultato}
            </div>
          ) : (
            <>
              <div
                className="rounded-2xl border px-6 py-3 text-4xl font-black tracking-tight text-white"
                style={{
                  borderColor: `${coloreClub}44`,
                  backgroundColor: `${coloreClub}12`,
                }}
              >
                VS
              </div>

              <div className="mt-3 flex items-center gap-2 rounded-full bg-zinc-900 px-3 py-1 text-sm font-semibold text-zinc-300">
                <Clock
                  className="h-4 w-4"
                  style={{ color: coloreClub }}
                />

                {formatOra(partita.ora_partita)}
              </div>
            </>
          )}
        </div>

        <div className="flex flex-col items-center text-center md:items-end md:text-right">
          <TeamLogo
            nome={nomeFuori}
            logoUrl={squadraFuori?.logo_url}
            colore={squadraFuori?.colore_1}
            fallbackColor="#d4d4d8"
          />

          <p className="text-xs font-bold uppercase tracking-[0.25em] text-zinc-500">
            Trasferta
          </p>

          <h2 className="mt-1 text-2xl font-black text-white">
            {nomeFuori}
          </h2>
        </div>
      </div>

      {/* =====================================================
          INFO MOBILE
      ===================================================== */}
      <div className="border-t border-zinc-800 bg-zinc-950/70 px-4 py-3 sm:hidden">
        <div className="flex min-w-0 items-center gap-2">
          <MapPin
            className="h-4 w-4 shrink-0"
            style={{ color: coloreClub }}
          />

          <span className="truncate text-xs font-medium text-zinc-300">
            {partita.luogo || "Luogo da definire"}
          </span>
        </div>
      </div>

      {/* =====================================================
          INFO DESKTOP
      ===================================================== */}
      <div className="hidden gap-3 border-t border-zinc-800 bg-zinc-950/70 px-5 py-4 text-sm text-zinc-300 sm:grid md:grid-cols-3">
        <div className="flex items-center gap-2">
          <MapPin
            className="h-4 w-4 shrink-0"
            style={{ color: coloreClub }}
          />

          <span>{partita.luogo || "Luogo da definire"}</span>
        </div>

        <div className="flex items-center gap-2">
          <Users
            className="h-4 w-4 shrink-0"
            style={{ color: coloreClub }}
          />

          <span>
            {nomeCasa} vs {nomeFuori}
          </span>
        </div>

        <div className="flex items-center gap-2">
          <Trophy
            className="h-4 w-4 shrink-0"
            style={{ color: coloreClub }}
          />

          <span>{getTipoLabel(partita.tipo_partita)}</span>
        </div>
      </div>

      {/* NOTE */}
      {partita.note && (
        <div className="border-t border-zinc-800 px-4 py-3 sm:px-5 sm:py-4">
          <p className="line-clamp-3 text-xs leading-5 text-zinc-400 sm:text-sm">
            {partita.note}
          </p>
        </div>
      )}

      {/* =====================================================
          AZIONE
      ===================================================== */}
      <div className="border-t border-zinc-800 px-4 py-3 sm:px-5 sm:py-4">
        <Link
          href={`/partite/${partita.id}`}
          className="inline-flex w-full items-center justify-center gap-2 rounded-xl px-4 py-2.5 text-sm font-bold text-zinc-950 transition hover:opacity-90 sm:w-auto sm:py-2"
          style={{
            backgroundColor: coloreClub,
          }}
        >
          <Settings className="h-4 w-4" />
          Gestisci partita
        </Link>
      </div>
    </div>
  );
}

export function PartiteTabs({ partite, coloreClub }: Props) {
  const [activeTab, setActiveTab] = useState<TabKey>("prossime");

  const oggi = new Date();
  oggi.setHours(0, 0, 0, 0);

  const prossimePartite = useMemo(() => {
    return partite
      .filter((partita) => {
        const dataPartita = new Date(
          `${partita.data_partita}T00:00:00`
        );

        return dataPartita >= oggi;
      })
      .sort((a, b) => {
        const dataA = new Date(
          `${a.data_partita}T${a.ora_partita || "00:00:00"}`
        ).getTime();

        const dataB = new Date(
          `${b.data_partita}T${b.ora_partita || "00:00:00"}`
        ).getTime();

        return dataA - dataB;
      });
  }, [partite]);

  const tutteLePartite = useMemo(() => {
    return [...partite].sort((a, b) => {
      const dataA = new Date(
        `${a.data_partita}T${a.ora_partita || "00:00:00"}`
      ).getTime();

      const dataB = new Date(
        `${b.data_partita}T${b.ora_partita || "00:00:00"}`
      ).getTime();

      return dataB - dataA;
    });
  }, [partite]);

  const tabs = [
    {
      key: "prossime" as const,
      label: "Prossime Partite",
      mobileLabel: "Prossime",
      icon: CalendarDays,
      count: prossimePartite.length,
    },
    {
      key: "tutte" as const,
      label: "Tutte le Partite",
      mobileLabel: "Tutte",
      icon: History,
      count: tutteLePartite.length,
    },
    {
      key: "classifica" as const,
      label: "Classifica Campionato",
      mobileLabel: "Classifica",
      icon: Trophy,
      count: null,
    },
  ];

  return (
    <div className="min-w-0 space-y-4 sm:space-y-6">
      {/* =====================================================
          TAB SCORREVOLI + CREA PARTITA COME ULTIMA TAB
      ===================================================== */}
      <div className="min-w-0 overflow-hidden">
        <div
          className="
            flex w-full gap-2 overflow-x-auto overscroll-x-contain
            rounded-2xl border border-zinc-800 bg-zinc-950 p-2
            [-ms-overflow-style:none]
            [scrollbar-width:none]
            [&::-webkit-scrollbar]:hidden
          "
        >
          {tabs.map((tab) => {
            const Icon = tab.icon;
            const active = activeTab === tab.key;

            return (
              <button
                key={tab.key}
                type="button"
                onClick={() => setActiveTab(tab.key)}
                className="flex shrink-0 items-center gap-2 whitespace-nowrap rounded-xl border px-3 py-2.5 text-xs font-bold transition sm:px-4 sm:py-3 sm:text-sm"
                style={
                  active
                    ? {
                        borderColor: coloreClub,
                        backgroundColor: coloreClub,
                        color: "#ffffff",
                        boxShadow: `0 0 18px ${coloreClub}55`,
                      }
                    : {
                        borderColor: "transparent",
                        backgroundColor: "transparent",
                        color: "#a1a1aa",
                      }
                }
              >
                <Icon className="h-4 w-4 shrink-0" />

                <span className="sm:hidden">
                  {tab.mobileLabel}
                </span>

                <span className="hidden sm:inline">
                  {tab.label}
                </span>

                {typeof tab.count === "number" && (
                  <span
                    className="rounded-full px-1.5 py-0.5 text-[10px] sm:px-2 sm:text-xs"
                    style={
                      active
                        ? {
                            backgroundColor: "rgba(255,255,255,0.16)",
                            color: "#ffffff",
                          }
                        : {
                            backgroundColor: "#27272a",
                            color: "#a1a1aa",
                          }
                    }
                  >
                    {tab.count}
                  </span>
                )}
              </button>
            );
          })}

      
        </div>
      </div>

      {/* PROSSIME */}
      {activeTab === "prossime" &&
        (prossimePartite.length === 0 ? (
          <EmptyState
            title="Nessuna partita in programma"
            description="Non risultano partite future per il club e la squadra selezionati."
            coloreClub={coloreClub}
          />
        ) : (
          <div className="grid min-w-0 gap-4 sm:gap-5">
            {prossimePartite.map((partita) => (
              <PartitaCard
                key={partita.id}
                partita={partita}
                coloreClub={coloreClub}
              />
            ))}
          </div>
        ))}

      {/* TUTTE */}
      {activeTab === "tutte" &&
        (tutteLePartite.length === 0 ? (
          <EmptyState
            title="Nessuna partita disponibile"
            description="Non risultano partite registrate per il club e la squadra selezionati."
            coloreClub={coloreClub}
          />
        ) : (
          <div className="grid min-w-0 gap-4 sm:gap-5">
            {tutteLePartite.map((partita) => (
              <PartitaCard
                key={partita.id}
                partita={partita}
                coloreClub={coloreClub}
              />
            ))}
          </div>
        ))}

      {/* CLASSIFICA */}
      {activeTab === "classifica" && (
        <div
          className="overflow-hidden rounded-2xl border border-zinc-800 bg-zinc-950 sm:rounded-3xl"
          style={{
            boxShadow: `0 0 32px ${coloreClub}12`,
          }}
        >
          <div className="border-b border-zinc-800 p-4 sm:p-5">
            <div className="flex items-center gap-3">
              <div
                className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border sm:h-11 sm:w-11"
                style={{
                  borderColor: `${coloreClub}44`,
                  backgroundColor: `${coloreClub}16`,
                }}
              >
                <Trophy
                  className="h-5 w-5"
                  style={{ color: coloreClub }}
                />
              </div>

              <div className="min-w-0">
                <h2 className="text-base font-black text-white sm:text-lg">
                  Classifica Campionato
                </h2>

                <p className="mt-0.5 text-xs text-zinc-400 sm:text-sm">
                  Collegamento classifica campionato.
                </p>
              </div>
            </div>
          </div>

          <div className="flex flex-col items-center justify-center px-4 py-12 text-center sm:px-6 sm:py-16">
            <Trophy
              className="h-10 w-10 sm:h-12 sm:w-12"
              style={{ color: coloreClub }}
            />

            <h3 className="mt-5 text-lg font-bold text-white sm:text-xl">
              Classifica pronta per il collegamento
            </h3>

            <p className="mt-2 max-w-lg text-sm leading-6 text-zinc-400">
              La tab è pronta. Ora possiamo leggere i dati da
              `v_classifica_campionato` filtrando per club attivo e
              campionato.
            </p>
          </div>
        </div>
      )}
    </div>
  );
}