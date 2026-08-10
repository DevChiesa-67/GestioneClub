"use client";

import { useEffect, useMemo, useState } from "react";
import { Loader2 } from "lucide-react";

import { supabase } from "@/lib/supabase-client";

type Metrica = "presenze" | "acwr";
type Vista = "mese_attuale" | "per_mese" | "per_settimana" | "per_seduta" | "stagione";

type Props = {
  clubId: string;
  squadraId: string | null;
  coloreFlag: string;
};

type PuntoGrezzo = {
  data: string; // YYYY-MM-DD
  valore: number;
  presenti?: number;
  totale?: number;
};

type PuntoGrafico = {
  key: string;
  label: string;
  value: number;
  sottotitolo?: string;
};

const STATI_PRESENTE = [
  "presente_mattina",
  "presente_pomeriggio",
  "presente_entrambe",
];

const VISTE: { key: Vista; label: string }[] = [
  { key: "mese_attuale", label: "Mese attuale" },
  { key: "per_mese", label: "Vista per mese" },
  { key: "per_settimana", label: "Vista settimana" },
  { key: "per_seduta", label: "Vista seduta" },
  { key: "stagione", label: "Stagione" },
];

/*
 * Carica una riga grezza (percentuale presenza) per ciascuna seduta con
 * presenze registrate, senza limiti di data: l'aggregazione per vista
 * (mese/settimana/stagione) avviene poi lato client su questi dati.
 */
async function fetchPresenzeGrezze(
  clubId: string,
  squadraId: string | null
): Promise<PuntoGrezzo[]> {
  let query = supabase
    .from("presenze_allenamenti")
    .select(
      `
        stato,
        allenamento:allenamenti!presenze_allenamenti_allenamento_id_fkey (
          data_allenamento
        )
      `
    )
    .eq("club_id", clubId);

  if (squadraId) {
    query = query.eq("squadra_id", squadraId);
  }

  const { data, error } = await query;

  if (error || !data) {
    console.error("Errore caricamento presenze dashboard:", error);
    return [];
  }

  type Allenamento = { data_allenamento: string };
  type Riga = {
    stato: string;
    allenamento: Allenamento | Allenamento[] | null;
  };

  const grouped = new Map<string, { presenti: number; totale: number }>();

  for (const riga of data as unknown as Riga[]) {
    const allenamento = Array.isArray(riga.allenamento)
      ? riga.allenamento[0]
      : riga.allenamento;

    const dataSeduta = allenamento?.data_allenamento;

    if (!dataSeduta) continue;

    const current = grouped.get(dataSeduta) ?? { presenti: 0, totale: 0 };
    current.totale += 1;

    if (STATI_PRESENTE.includes(riga.stato)) {
      current.presenti += 1;
    }

    grouped.set(dataSeduta, current);
  }

  return Array.from(grouped.entries())
    .map(([data, v]) => ({
      data,
      valore: v.totale > 0 ? Math.round((v.presenti / v.totale) * 100) : 0,
      presenti: v.presenti,
      totale: v.totale,
    }))
    .sort((a, b) => a.data.localeCompare(b.data));
}

/*
 * ACWR medio squadra per giorno: media dell'ACWR (media mobile) tra tutti
 * i giocatori con un dato quel giorno.
 */
async function fetchAcwrGrezzo(
  clubId: string,
  squadraId: string | null
): Promise<PuntoGrezzo[]> {
  let query = supabase
    .from("catapult_acwr")
    .select("data, acwr_media_mobile")
    .eq("club_id", clubId);

  if (squadraId) {
    query = query.eq("squadra_id", squadraId);
  }

  const { data, error } = await query;

  if (error || !data) {
    console.error("Errore caricamento ACWR dashboard:", error);
    return [];
  }

  const grouped = new Map<string, { somma: number; conteggio: number }>();

  for (const riga of data as { data: string; acwr_media_mobile: number | null }[]) {
    if (riga.acwr_media_mobile === null || riga.acwr_media_mobile === undefined) {
      continue;
    }

    const current = grouped.get(riga.data) ?? { somma: 0, conteggio: 0 };
    current.somma += Number(riga.acwr_media_mobile);
    current.conteggio += 1;
    grouped.set(riga.data, current);
  }

  return Array.from(grouped.entries())
    .map(([data, v]) => ({
      data,
      valore: v.conteggio > 0 ? v.somma / v.conteggio : 0,
    }))
    .sort((a, b) => a.data.localeCompare(b.data));
}

function formatGiorno(data: string) {
  return new Date(`${data}T12:00:00`).toLocaleDateString("it-IT", {
    day: "2-digit",
    month: "short",
  });
}

function chiaveMese(data: string) {
  return data.slice(0, 7);
}

function etichettaMese(chiave: string) {
  const [anno, mese] = chiave.split("-");
  return new Date(`${anno}-${mese}-01T12:00:00`).toLocaleDateString("it-IT", {
    month: "short",
    year: "2-digit",
  });
}

function chiaveSettimana(data: string) {
  const d = new Date(`${data}T12:00:00`);
  const giornoSettimana = (d.getDay() + 6) % 7; // lunedì = 0
  const lunedi = new Date(d);
  lunedi.setDate(d.getDate() - giornoSettimana);
  return lunedi.toISOString().slice(0, 10);
}

function aggregaPerChiave(
  punti: PuntoGrezzo[],
  chiaveFn: (data: string) => string,
  etichettaFn: (chiave: string) => string
): PuntoGrafico[] {
  const grouped = new Map<string, { somma: number; conteggio: number }>();

  for (const punto of punti) {
    const chiave = chiaveFn(punto.data);
    const current = grouped.get(chiave) ?? { somma: 0, conteggio: 0 };
    current.somma += punto.valore;
    current.conteggio += 1;
    grouped.set(chiave, current);
  }

  return Array.from(grouped.entries())
    .sort((a, b) => a[0].localeCompare(b[0]))
    .map(([chiave, v]) => ({
      key: chiave,
      label: etichettaFn(chiave),
      value: v.conteggio > 0 ? v.somma / v.conteggio : 0,
      sottotitolo: `${v.conteggio} sedut${v.conteggio === 1 ? "a" : "e"}`,
    }));
}

function costruisciPunti(grezzi: PuntoGrezzo[], vista: Vista): PuntoGrafico[] {
  if (vista === "mese_attuale") {
    const oggi = new Date();
    const primoGiorno = `${oggi.getFullYear()}-${String(
      oggi.getMonth() + 1
    ).padStart(2, "0")}-01`;

    return grezzi
      .filter((p) => p.data >= primoGiorno)
      .map((p) => ({
        key: p.data,
        label: formatGiorno(p.data),
        value: p.valore,
        sottotitolo:
          p.presenti !== undefined && p.totale !== undefined
            ? `${p.presenti}/${p.totale}`
            : undefined,
      }));
  }

  if (vista === "per_seduta") {
    return grezzi.map((p) => ({
      key: p.data,
      label: formatGiorno(p.data),
      value: p.valore,
      sottotitolo:
        p.presenti !== undefined && p.totale !== undefined
          ? `${p.presenti}/${p.totale}`
          : undefined,
    }));
  }

  if (vista === "per_settimana") {
    return aggregaPerChiave(grezzi, chiaveSettimana, formatGiorno);
  }

  // per_mese e stagione: entrambe aggregano per mese (la stagione mostra
  // in più un riepilogo sopra al grafico).
  return aggregaPerChiave(grezzi, chiaveMese, etichettaMese);
}

function GraficoLineare({
  punti,
  coloreFlag,
  unita,
  decimali,
  dominioFisso,
}: {
  punti: PuntoGrafico[];
  coloreFlag: string;
  unita: string;
  decimali: number;
  dominioFisso?: [number, number];
}) {
  if (punti.length === 0) {
    return (
      <div className="flex h-72 items-center justify-center rounded-xl bg-black/20 text-center text-sm text-zinc-500">
        Nessun dato disponibile per questa vista.
      </div>
    );
  }

  const width = 1000;
  const height = 280;
  const paddingLeft = 46;
  const paddingRight = 46;
  const paddingTop = 34;
  const paddingBottom = 40;

  const chartWidth = width - paddingLeft - paddingRight;
  const chartHeight = height - paddingTop - paddingBottom;

  const valori = punti.map((p) => p.value);
  const minValore = Math.min(...valori);
  const maxValore = Math.max(...valori);
  const margine = (maxValore - minValore || 1) * 0.2;

  const minY = dominioFisso ? dominioFisso[0] : Math.floor(minValore - margine);
  const maxY = dominioFisso ? dominioFisso[1] : Math.ceil(maxValore + margine);

  const xForIndex = (index: number) => {
    if (punti.length <= 1) return paddingLeft + chartWidth / 2;
    return paddingLeft + (index / (punti.length - 1)) * chartWidth;
  };

  const yForValue = (value: number) => {
    const range = maxY - minY || 1;
    const normalized = (value - minY) / range;
    return paddingTop + chartHeight - normalized * chartHeight;
  };

  const puntiSvg = punti.map((p, index) => ({
    ...p,
    x: xForIndex(index),
    y: yForValue(p.value),
  }));

  const labelStep = Math.max(1, Math.ceil(punti.length / 8));

  const tickCount = 4;
  const yTicks = Array.from(
    { length: tickCount },
    (_, i) => minY + ((maxY - minY) / (tickCount - 1)) * i
  );

  return (
    <div className="rounded-xl bg-black/20 p-3 sm:p-6">
      <svg
        viewBox={`0 0 ${width} ${height}`}
        className="h-[260px] w-full sm:h-[300px]"
      >
        {yTicks.map((tick, i) => {
          const y = yForValue(tick);

          return (
            <g key={i}>
              <line
                x1={paddingLeft}
                x2={width - paddingRight}
                y1={y}
                y2={y}
                stroke="rgba(255,255,255,0.08)"
                strokeWidth="1"
              />

              <text
                x={paddingLeft - 10}
                y={y + 4}
                textAnchor="end"
                fill="#71717a"
                fontSize="13"
              >
                {tick.toFixed(decimali)}
                {unita}
              </text>
            </g>
          );
        })}

        <polyline
          fill="none"
          stroke={coloreFlag}
          strokeWidth="3.5"
          strokeLinecap="round"
          strokeLinejoin="round"
          points={puntiSvg.map((p) => `${p.x},${p.y}`).join(" ")}
        />

        {puntiSvg.map((p) => (
          <g key={`punto-${p.key}`}>
            <circle cx={p.x} cy={p.y} r="5" fill={coloreFlag} />

            <text
              x={p.x}
              y={p.y - 14}
              textAnchor="middle"
              className="fill-white text-[11px] font-bold"
            >
              {p.value.toFixed(decimali)}
              {unita}
            </text>
          </g>
        ))}

        {puntiSvg.map((p, index) => {
          if (index % labelStep !== 0 && index !== puntiSvg.length - 1) {
            return null;
          }

          return (
            <text
              key={`label-${p.key}`}
              x={p.x}
              y={height - paddingBottom + 22}
              textAnchor="middle"
              className="fill-zinc-500 text-[10px]"
            >
              {p.label}
            </text>
          );
        })}
      </svg>
    </div>
  );
}

export default function DashboardAttendanceClient({
  clubId,
  squadraId,
  coloreFlag,
}: Props) {
  const [metrica, setMetrica] = useState<Metrica>("presenze");
  const [vista, setVista] = useState<Vista>("per_seduta");
  const [grezziPresenze, setGrezziPresenze] = useState<PuntoGrezzo[]>([]);
  const [grezziAcwr, setGrezziAcwr] = useState<PuntoGrezzo[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;

    async function carica() {
      setLoading(true);

      const [presenze, acwr] = await Promise.all([
        fetchPresenzeGrezze(clubId, squadraId),
        fetchAcwrGrezzo(clubId, squadraId),
      ]);

      if (cancelled) return;

      setGrezziPresenze(presenze);
      setGrezziAcwr(acwr);
      setLoading(false);
    }

    void carica();

    return () => {
      cancelled = true;
    };
  }, [clubId, squadraId]);

  const grezzi = metrica === "presenze" ? grezziPresenze : grezziAcwr;

  const punti = useMemo(
    () => costruisciPunti(grezzi, vista),
    [grezzi, vista]
  );

  const mediaStagionale = useMemo(() => {
    if (punti.length === 0) return 0;
    return punti.reduce((acc, p) => acc + p.value, 0) / punti.length;
  }, [punti]);

  return (
    <div className="rounded-2xl border border-white/10 bg-[#171717] p-4 sm:p-6">
      <div className="mb-5 flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
        <div className="flex items-center gap-3">
          <select
            value={metrica}
            onChange={(e) => setMetrica(e.target.value as Metrica)}
            className="rounded-xl border border-zinc-700 bg-zinc-950 px-3 py-2 text-sm font-bold text-white outline-none focus:border-zinc-500"
          >
            <option value="presenze">Presenze</option>
            <option value="acwr">ACWR</option>
          </select>

          <span
            className="hidden text-sm font-semibold sm:inline"
            style={{ color: coloreFlag }}
          >
            {metrica === "presenze"
              ? "━ % presenza per seduta"
              : "━ ACWR medio squadra"}
          </span>
        </div>

        <div className="flex flex-wrap gap-2">
          {VISTE.map((v) => {
            const attiva = vista === v.key;

            return (
              <button
                key={v.key}
                type="button"
                onClick={() => setVista(v.key)}
                className="rounded-lg px-3 py-1.5 text-xs font-bold transition"
                style={
                  attiva
                    ? { backgroundColor: coloreFlag, color: "#ffffff" }
                    : { backgroundColor: "rgba(255,255,255,0.06)", color: "#a1a1aa" }
                }
              >
                {v.label}
              </button>
            );
          })}
        </div>
      </div>

      {loading ? (
        <div className="flex h-72 items-center justify-center rounded-xl bg-black/20">
          <Loader2 size={26} className="animate-spin text-zinc-500" />
        </div>
      ) : (
        <>
          {vista === "stagione" && punti.length > 0 && (
            <div className="mb-4 grid grid-cols-2 gap-3">
              <div className="rounded-xl bg-black/30 p-3">
                <p className="text-xs text-zinc-500">Media stagionale</p>
                <p className="text-xl font-black text-white">
                  {mediaStagionale.toFixed(metrica === "presenze" ? 0 : 2)}
                  {metrica === "presenze" ? "%" : ""}
                </p>
              </div>

              <div className="rounded-xl bg-black/30 p-3">
                <p className="text-xs text-zinc-500">
                  {metrica === "presenze"
                    ? "Sedute registrate"
                    : "Giorni con dato ACWR"}
                </p>
                <p className="text-xl font-black text-white">{grezzi.length}</p>
              </div>
            </div>
          )}

          <GraficoLineare
            punti={punti}
            coloreFlag={coloreFlag}
            unita={metrica === "presenze" ? "%" : ""}
            decimali={metrica === "presenze" ? 0 : 2}
            dominioFisso={metrica === "presenze" ? [0, 100] : undefined}
          />

          {metrica === "presenze" &&
            (vista === "per_seduta" || vista === "mese_attuale") &&
            punti.length > 0 && (
              <div className="mt-4 grid grid-cols-2 gap-3 text-xs text-zinc-400 sm:grid-cols-4">
                {punti.slice(-4).map((p) => (
                  <div key={p.key} className="rounded-lg bg-black/30 p-2">
                    <p className="text-zinc-500">{p.label}</p>
                    <p className="font-bold text-white">{p.value}%</p>
                    {p.sottotitolo && (
                      <p className="text-[10px] text-zinc-500">
                        {p.sottotitolo} presenti
                      </p>
                    )}
                  </div>
                ))}
              </div>
            )}
        </>
      )}
    </div>
  );
}
