import { formatNumber } from "@/lib/format";

type Point = { year: number; value: number | null };

const WIDTH = 640;
const HEIGHT = 220;
const PAD = { top: 16, right: 16, bottom: 28, left: 56 };

/** Print-friendly SVG line chart; breaks the line at missing years and shades 2020–2021. */
export function StaticLineChart({ points, unit, digits = 0, label }: { points: Point[]; unit: string; digits?: number; label: string }) {
  const valid = points.filter((p): p is { year: number; value: number } => p.value !== null);
  if (valid.length === 0 || points.length === 0) return <p className="text-sm text-ink-muted">No reported values.</p>;
  const firstYear = points[0]!.year;
  const lastYear = points.at(-1)!.year;
  const max = Math.max(...valid.map((p) => p.value)) * 1.1 || 1;
  const x = (year: number) => PAD.left + ((year - firstYear) / Math.max(1, lastYear - firstYear)) * (WIDTH - PAD.left - PAD.right);
  const y = (value: number) => HEIGHT - PAD.bottom - (value / max) * (HEIGHT - PAD.top - PAD.bottom);

  const segments: Point[][] = [];
  for (const point of points) {
    if (point.value === null) segments.push([]);
    else (segments.at(-1) ?? segments[segments.push([]) - 1]!).push(point);
  }
  const ticks = Array.from({ length: 5 }, (_, i) => (max / 4) * i);
  const summary = `${label}: ${valid.map((p) => `${p.year} ${formatNumber(p.value, digits)} ${unit}`).join("; ")}.`;

  return (
    <svg viewBox={`0 0 ${WIDTH} ${HEIGHT}`} className="h-auto w-full" role="img" aria-label={summary}>
      {firstYear <= 2021 && lastYear >= 2020 && (
        <rect
          x={x(Math.max(2020, firstYear)) - 6}
          y={PAD.top}
          width={x(Math.min(2021, lastYear)) - x(Math.max(2020, firstYear)) + 12}
          height={HEIGHT - PAD.top - PAD.bottom}
          className="fill-signal-high/10"
        />
      )}
      {ticks.map((t) => (
        <g key={t}>
          <line x1={PAD.left} x2={WIDTH - PAD.right} y1={y(t)} y2={y(t)} className="stroke-line" />
          <text x={PAD.left - 6} y={y(t) + 4} textAnchor="end" fontSize={11} className="fill-ink-muted">
            {formatNumber(t, digits > 1 ? 2 : 0)}
          </text>
        </g>
      ))}
      <text x={12} y={PAD.top + 4} fontSize={11} className="fill-ink-muted">
        {unit}
      </text>
      {segments
        .filter((s) => s.length > 0)
        .map((segment, i) => (
          <polyline key={i} points={segment.map((p) => `${x(p.year)},${y(p.value!)}`).join(" ")} fill="none" className="stroke-accent" strokeWidth={2} />
        ))}
      {valid.map((p) => (
        <circle key={p.year} cx={x(p.year)} cy={y(p.value)} r={3} className="fill-accent" />
      ))}
      {points.map((p) => (
        <text key={p.year} x={x(p.year)} y={HEIGHT - 8} textAnchor="middle" fontSize={10} className="fill-ink-muted">
          {String(p.year).slice(2)}
        </text>
      ))}
    </svg>
  );
}
