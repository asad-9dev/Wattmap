import { formatNumber } from "@/lib/format";

type Props = {
  /** The school's value; omit to draw only the peer band and median (e.g. provincial overview). */
  value?: number | null;
  q25: number | null;
  median: number | null;
  q75: number | null;
  /** Axis maximum. Values beyond it are drawn at the edge with an overflow arrow. */
  max: number;
  unit?: string;
  size?: "sm" | "lg";
  valueLabel?: string;
  /** What the band describes, for the text description: "peers" on a profile, "schools" province-wide. */
  groupLabel?: string;
};

/**
 * WattMap's benchmark ruler — a bullet chart: the peer group's middle half (25th–75th
 * percentile) as a band, the peer median as a tick, and the school as an amber marker. Plain SVG,
 * so it renders on the server, in tables, and in print. The description is always in text.
 */
export function PercentileRuler({ value, q25, median, q75, max, unit = "GJ/m²", size = "lg", valueLabel = "This school", groupLabel = "peers" }: Props) {
  const width = size === "lg" ? 640 : 160;
  const height = size === "lg" ? 76 : 18;
  const pad = size === "lg" ? 12 : 3;
  const trackY = size === "lg" ? 38 : 9;
  const bandHeight = size === "lg" ? 18 : 10;
  const x = (v: number) => pad + (Math.min(Math.max(v, 0), max) / max) * (width - 2 * pad);
  const hasValue = value !== null && value !== undefined;
  const overflow = hasValue && value > max;
  const band = q25 !== null && q75 !== null ? `middle half of ${groupLabel} ${formatNumber(q25, 2)}–${formatNumber(q75, 2)} ${unit}` : null;
  const description = [
    hasValue ? `${valueLabel}: ${formatNumber(value, 2)} ${unit}.` : null,
    median !== null ? `Median ${formatNumber(median, 2)} ${unit}${band ? `, ${band}` : ""}.` : band ? `${band}.` : null,
  ]
    .filter(Boolean)
    .join(" ");

  return (
    <svg
      viewBox={`0 0 ${width} ${height}`}
      className={size === "lg" ? "h-auto w-full" : "h-[18px] w-full min-w-[96px]"}
      role="img"
      aria-label={description}
      preserveAspectRatio="none"
    >
      <line x1={pad} x2={width - pad} y1={trackY} y2={trackY} stroke="#c3ccc6" strokeWidth={size === "lg" ? 2 : 1.5} />
      {q25 !== null && q75 !== null && (
        <rect
          x={x(q25)}
          y={trackY - bandHeight / 2}
          width={Math.max(2, x(q75) - x(q25))}
          height={bandHeight}
          rx={2}
          fill="#d1fae5"
          stroke="#047857"
          strokeOpacity={0.45}
        />
      )}
      {median !== null && (
        <line x1={x(median)} x2={x(median)} y1={trackY - bandHeight / 2 - 3} y2={trackY + bandHeight / 2 + 3} stroke="#14201a" strokeWidth={size === "lg" ? 2 : 1.5} />
      )}
      {hasValue &&
        (overflow ? (
          <path d={`M ${width - pad} ${trackY} l -8 -6 v 12 z`} fill="#b45309" />
        ) : (
          <>
            <line x1={x(value)} x2={x(value)} y1={trackY - bandHeight / 2 - 6} y2={trackY + bandHeight / 2 + 6} stroke="#b45309" strokeWidth={size === "lg" ? 3 : 2.5} />
            {size === "lg" && <path d={`M ${x(value)} ${trackY - bandHeight / 2 - 7} l -6 -9 h 12 z`} fill="#b45309" />}
          </>
        ))}
      {size === "lg" && (
        <>
          {hasValue && (
            <text x={Math.min(width - pad - 40, Math.max(pad + 40, x(value)))} y={12} textAnchor="middle" fontSize={12} fontWeight={600} fill="#b45309">
              {valueLabel} {formatNumber(value, 2)}
            </text>
          )}
          {median !== null && (
            <text x={x(median)} y={trackY + bandHeight / 2 + 18} textAnchor="middle" fontSize={11} fill="#14201a">
              Median {formatNumber(median, 2)}
            </text>
          )}
          <text x={pad} y={height - 2} fontSize={10} fill="#56615b">
            0
          </text>
          <text x={width - pad} y={height - 2} textAnchor="end" fontSize={10} fill="#56615b">
            {formatNumber(max, 2)} {unit}
          </text>
        </>
      )}
    </svg>
  );
}
