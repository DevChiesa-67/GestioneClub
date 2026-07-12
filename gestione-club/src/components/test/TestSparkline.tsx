"use client";

type Point = {
  data_test: string;
  valore: number;
};

type Props = {
  points: Point[];
  color: string;
};

export default function TestSparkline({ points, color }: Props) {
  const ordered = [...points]
    .filter((p) => typeof p.valore === "number")
    .sort(
      (a, b) =>
        new Date(a.data_test).getTime() - new Date(b.data_test).getTime()
    )
    .slice(-8);

  if (ordered.length < 2) {
    return <span className="text-xs text-zinc-500">Storico insufficiente</span>;
  }

  const values = ordered.map((p) => p.valore);
  const min = Math.min(...values);
  const max = Math.max(...values);
  const range = max - min || 1;

  const width = 120;
  const height = 34;

  const path = ordered
    .map((point, index) => {
      const x = (index / (ordered.length - 1)) * width;
      const y = height - ((point.valore - min) / range) * height;
      return `${index === 0 ? "M" : "L"} ${x} ${y}`;
    })
    .join(" ");

  return (
    <svg width={width} height={height} viewBox={`0 0 ${width} ${height}`}>
      <path
        d={path}
        fill="none"
        stroke={color}
        strokeWidth="3"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}