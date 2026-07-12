// src/components/charts/DistanceVsSprintChart.tsx

import { AppCard } from "@/components/ui/AppCard";

export type ChartRow = {
  id: string;
  date: string;
  distance: number | null;
  sprint_distance: number | null;
};

type Props<T extends ChartRow> = {
  rows: T[];
  coloreFlag: string;
  title?: string;
};

function formatDate(value: string) {
  const [, month, day] = value.split("-");

  if (!month || !day) {
    return value;
  }

  return `${day}/${month}`;
}

export default function DistanceVsSprintChart<T extends ChartRow>({
  rows,
  coloreFlag,
  title = "Distanza totale vs Sprint Distance",
}: Props<T>) {
  const width = 900;
  const height = 330;

  const left = 70;
  const right = 40;
  const top = 40;
  const bottom = 75;

  const chartW = width - left - right;
  const chartH = height - top - bottom;

  const max = Math.max(
    1,
    ...rows.map((row) =>
      Math.max(row.distance ?? 0, row.sprint_distance ?? 0)
    )
  );

  const groupW = chartW / Math.max(rows.length, 1);
  const barW = Math.max(8, groupW / 4);
  const labelStep = Math.max(1, Math.ceil(rows.length / 10));

  function y(value: number) {
    return top + chartH - (value / max) * chartH;
  }

  return (
    <AppCard title={title}>
      <div className="overflow-x-auto">
        <svg
          viewBox={`0 0 ${width} ${height}`}
          className="min-w-[760px]"
          role="img"
          aria-label={title}
        >
          {[0, 1, 2, 3, 4].map((tick) => {
            const value = (max / 4) * tick;
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

          {rows.map((row, index) => {
            const groupX = left + index * groupW + groupW / 2;
            const distance = row.distance ?? 0;
            const sprint = row.sprint_distance ?? 0;

            const distanceH = top + chartH - y(distance);
            const sprintH = top + chartH - y(sprint);

            const distanceX = groupX - barW - 2;
            const sprintX = groupX + 2;

            return (
              <g key={row.id}>
                <rect
                  x={distanceX}
                  y={y(distance)}
                  width={barW}
                  height={distanceH}
                  rx={Math.min(4, barW / 2)}
                  fill={coloreFlag}
                >
                  <title>
                    {`${formatDate(row.date)} - Distanza: ${distance}`}
                  </title>
                </rect>

                <rect
                  x={sprintX}
                  y={y(sprint)}
                  width={barW}
                  height={sprintH}
                  rx={Math.min(4, barW / 2)}
                  fill="#ef4444"
                >
                  <title>
                    {`${formatDate(row.date)} - Sprint Distance: ${sprint}`}
                  </title>
                </rect>

                {index % labelStep === 0 && (
                  <text
                    x={groupX}
                    y={height - 35}
                    textAnchor="end"
                    fontSize="11"
                    fill="#a1a1aa"
                    transform={`rotate(-45 ${groupX} ${height - 35})`}
                  >
                    {formatDate(row.date)}
                  </text>
                )}
              </g>
            );
          })}

          <g transform={`translate(${width - 220}, 35)`}>
            <rect width="10" height="10" fill={coloreFlag} rx="2" />

            <text x="18" y="10" fontSize="12" fill="#d4d4d8">
              Distanza (m)
            </text>

            <rect y="24" width="10" height="10" fill="#ef4444" rx="2" />

            <text x="18" y="34" fontSize="12" fill="#d4d4d8">
              Sprint Distance (m)
            </text>
          </g>

          <text
            x={20}
            y={height / 2}
            textAnchor="middle"
            fontSize="12"
            fill="#d4d4d8"
            transform={`rotate(-90 20 ${height / 2})`}
          >
            Metri
          </text>

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