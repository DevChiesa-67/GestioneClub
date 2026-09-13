// src/components/charts/LineChart.tsx

"use client";

import { AppCard } from "@/components/ui/AppCard";
import {
  LineaHover,
  PuntoHover,
  TooltipGrafico,
  formatValore,
  useHoverGrafico,
} from "@/components/charts/hover-grafico";

export type ChartRow = {
  id: string;
  date: string;
  [key: string]: string | number | null;
};

type Props<T extends ChartRow> = {
  title: string;
  yLabel: string;
  rows: T[];
  valueKey: keyof T;
  coloreFlag: string;
};

function formatDate(value: string) {
  const [, month, day] = value.split("-");
  return `${day}/${month}`;
}

function toNumber(value: unknown): number | null {
  if (typeof value !== "number") return null;
  if (!Number.isFinite(value)) return null;
  return value;
}

export default function LineChart<T extends ChartRow>({
  title,
  yLabel,
  rows,
  valueKey,
  coloreFlag,
}: Props<T>) {
  const width = 900;
  const height = 330;
  const left = 70;
  const right = 40;
  const top = 40;
  const bottom = 75;

  const chartW = width - left - right;
  const chartH = height - top - bottom;

  const values: number[] = [];

  rows.forEach((row) => {
    const value = toNumber(row[valueKey]);
    if (value !== null) values.push(value);
  });

  const max = Math.max(1, ...values);
  const min = Math.min(0, ...values);
  const range = max - min || 1;

  function x(index: number) {
    if (rows.length <= 1) return left + chartW / 2;
    return left + (index / (rows.length - 1)) * chartW;
  }

  function y(value: number) {
    return top + chartH - ((value - min) / range) * chartH;
  }

  const points = rows
    .map((row, index) => {
      const value = toNumber(row[valueKey]);
      if (value === null) return null;

      return `${x(index)},${y(value)}`;
    })
    .filter((point): point is string => point !== null)
    .join(" ");

  const labelStep = Math.max(1, Math.ceil(rows.length / 10));

  /*
   * Su una linea i punti stanno SUI bordi dell'area, non al centro di
   * una fascia: si aggancia il punto piu' vicino al cursore.
   */
  const { ref, indice, handlers, proiettaX, larghezzaSvg } = useHoverGrafico({
    viewBoxWidth: width,
    left,
    chartW,
    count: rows.length,
    modo: "punti",
  });

  const rigaAttiva = indice !== null ? rows[indice] : null;
  const valoreAttivo = rigaAttiva ? toNumber(rigaAttiva[valueKey]) : null;

  return (
    <AppCard title={title}>
      <div className="scrollbar-gestionale overflow-x-auto">
        <div className="relative min-w-[760px]">
          <svg
            ref={ref}
            viewBox={`0 0 ${width} ${height}`}
            className="w-full"
            {...handlers}
          >
            {[0, 1, 2, 3, 4].map((tick) => {
              const value = min + (range / 4) * tick;
              const yy = y(value);

              return (
                <g key={tick}>
                  <line
                    x1={left}
                    x2={width - right}
                    y1={yy}
                    y2={yy}
                    stroke="rgba(255,255,255,0.12)"
                  />

                  <text
                    x={left - 12}
                    y={yy + 4}
                    textAnchor="end"
                    fontSize="12"
                    fill="#a1a1aa"
                  >
                    {value.toFixed(0)}
                  </text>
                </g>
              );
            })}

            {/*
              La riga bianca si disegna PRIMA della serie: cosi' il
              tratto del grafico resta sopra e leggibile.
            */}
            {rigaAttiva && indice !== null && (
              <LineaHover x={x(indice)} top={top} bottom={top + chartH} />
            )}

            {points && (
              <polyline
                points={points}
                fill="none"
                stroke={coloreFlag}
                strokeWidth="4"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            )}

            {valoreAttivo !== null && indice !== null && (
              <PuntoHover
                x={x(indice)}
                y={y(valoreAttivo)}
                colore={coloreFlag}
              />
            )}

            {rows.map((row, index) => {
              if (index % labelStep !== 0) return null;

              const xx = x(index);
              const yy = height - 35;

              return (
                <text
                  key={row.id}
                  x={xx}
                  y={yy}
                  textAnchor="end"
                  fontSize="11"
                  fill="#a1a1aa"
                  transform={`rotate(-45 ${xx} ${yy})`}
                >
                  {formatDate(row.date)}
                </text>
              );
            })}

            <text
              x={20}
              y={height / 2}
              textAnchor="middle"
              fontSize="12"
              fill="#d4d4d8"
              transform={`rotate(-90 20 ${height / 2})`}
            >
              {yLabel}
            </text>
          </svg>

          {rigaAttiva && indice !== null && (
            <TooltipGrafico
              xPixel={proiettaX(x(indice))}
              larghezza={larghezzaSvg()}
              titolo={formatDate(rigaAttiva.date)}
              voci={[
                {
                  label: yLabel,
                  valore: formatValore(valoreAttivo),
                  colore: coloreFlag,
                },
              ]}
            />
          )}
        </div>
      </div>
    </AppCard>
  );
}
