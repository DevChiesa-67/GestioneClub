// src/components/charts/BarChart.tsx

import { AppCard } from "@/components/ui/AppCard";

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

  if (!month || !day) {
    return value;
  }

  return `${day}/${month}`;
}

export default function BarChart<T extends ChartRow>({
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

  const values = rows.map((row) => {
    const value = row[valueKey];

    return typeof value === "number" ? value : 0;
  });

  const max = Math.max(1, ...values);

  const groupW =
    chartW / Math.max(rows.length, 1);

  const barGap = Math.min(
    10,
    Math.max(2, groupW * 0.2)
  );

  const barW = Math.max(
    4,
    groupW - barGap
  );

  function x(index: number) {
    return (
      left +
      index * groupW +
      (groupW - barW) / 2
    );
  }

  function h(value: number) {
    if (value <= 0) return 0;

    return (value / max) * chartH;
  }

  const labelStep = Math.max(
    1,
    Math.ceil(rows.length / 10)
  );

  return (
    <AppCard title={title}>
      <div className="overflow-x-auto">
        <svg
          viewBox={`0 0 ${width} ${height}`}
          className="min-w-[760px]"
          role="img"
          aria-label={title}
        >
          {/* GRIGLIA + VALORI ASSE Y */}
          {[0, 1, 2, 3, 4].map((tick) => {
            const value = (max / 4) * tick;

            const yy =
              top +
              chartH -
              (value / max) * chartH;

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

          {/* BARRE */}
          {rows.map((row, index) => {
            const rawValue = row[valueKey];

            const value =
              typeof rawValue === "number"
                ? rawValue
                : 0;

            const barH = h(value);
            const barX = x(index);
            const barY = top + chartH - barH;

            return (
              <g key={row.id}>
                <rect
                  x={barX}
                  y={barY}
                  width={barW}
                  height={barH}
                  rx={Math.min(4, barW / 2)}
                  fill={coloreFlag}
                >
                  <title>
                    {`${formatDate(row.date)}: ${value}`}
                  </title>
                </rect>

                {/* LABEL VALORE SOPRA LA BARRA */}
                {value > 0 && rows.length <= 20 && (
                  <text
                    x={barX + barW / 2}
                    y={Math.max(
                      top + 12,
                      barY - 7
                    )}
                    textAnchor="middle"
                    fontSize="10"
                    fontWeight="700"
                    fill="#d4d4d8"
                  >
                    {value.toFixed(0)}
                  </text>
                )}

                {/* DATA ASSE X */}
                {index % labelStep === 0 && (
                  <text
                    x={barX + barW / 2}
                    y={height - 35}
                    textAnchor="end"
                    fontSize="11"
                    fill="#a1a1aa"
                    transform={`rotate(
                      -45
                      ${barX + barW / 2}
                      ${height - 35}
                    )`}
                  >
                    {formatDate(row.date)}
                  </text>
                )}
              </g>
            );
          })}

          {/* LABEL ASSE Y */}
          <text
            x={20}
            y={height / 2}
            textAnchor="middle"
            fontSize="12"
            fill="#d4d4d8"
            transform={`rotate(
              -90
              20
              ${height / 2}
            )`}
          >
            {yLabel}
          </text>

          {/* LINEA BASE ASSE X */}
          <line
            x1={left}
            x2={width - right}
            y1={top + chartH}
            y2={top + chartH}
            stroke="rgba(255,255,255,0.18)"
          />
        </svg>
      </div>
    </AppCard>
  );
}