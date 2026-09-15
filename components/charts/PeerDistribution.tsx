import { formatEui } from "@/lib/format";

type Props = {
  peerEuis: number[];
  target: number;
  q25: number | null;
  median: number | null;
  q75: number | null;
  targetLabel?: string;
};

const WIDTH = 640;
const HEIGHT = 120;
const PAD = 24;

/**
 * Horizontal strip of every peer's EUI with the interquartile box, the median, and the target.
 * Plain SVG with theme classes: renders on the server, scales with its container, prints in the
 * light palette, and carries a text description.
 */
export function PeerDistribution({ peerEuis, target, q25, median, q75, targetLabel = "This school" }: Props) {
  const values = [...peerEuis, target];
  const max = Math.max(...values) * 1.05 || 1;
  const x = (v: number) => PAD + (v / max) * (WIDTH - 2 * PAD);
  const ticks = Array.from({ length: 5 }, (_, i) => (max / 4) * i);
  const above = peerEuis.filter((p) => p < target).length;
  const description = `Energy intensity of ${peerEuis.length} comparable facilities. ${targetLabel}: ${formatEui(target)}. Peer median ${formatEui(median)}, middle half from ${formatEui(q25)} to ${formatEui(q75)}. ${above} of ${peerEuis.length} peers have lower intensity.`;

  return (
    <figure className="space-y-2">
      <svg viewBox={`0 0 ${WIDTH} ${HEIGHT}`} className="h-auto w-full" role="img" aria-label={description}>
        <line x1={PAD} x2={WIDTH - PAD} y1={70} y2={70} className="stroke-line" />
        {q25 !== null && q75 !== null && (
          <rect x={x(q25)} y={52} width={Math.max(1, x(q75) - x(q25))} height={36} className="fill-accent-subtle stroke-accent/40" />
        )}
        {peerEuis.map((value, i) => (
          <line key={i} x1={x(value)} x2={x(value)} y1={58} y2={82} className="stroke-accent/45" strokeWidth={1.5} />
        ))}
        {median !== null && (
          <>
            <line x1={x(median)} x2={x(median)} y1={46} y2={94} className="stroke-ink" strokeWidth={2} />
            <text x={x(median)} y={40} textAnchor="middle" fontSize={12} className="fill-ink">
              Peer median
            </text>
          </>
        )}
        <path d={`M ${x(target)} 96 l -6 10 h 12 z`} className="fill-signal-high" />
        <line x1={x(target)} x2={x(target)} y1={48} y2={96} className="stroke-signal-high" strokeWidth={2.5} />
        <text x={Math.min(WIDTH - PAD, Math.max(PAD, x(target)))} y={20} textAnchor="middle" fontSize={12} fontWeight={600} className="fill-signal-high">
          {targetLabel}
        </text>
        {ticks.map((t) => (
          <text key={t} x={x(t)} y={HEIGHT - 2} textAnchor="middle" fontSize={11} className="fill-ink-faint">
            {t.toFixed(2)}
          </text>
        ))}
      </svg>
      <figcaption className="text-sm text-ink-muted">
        Each tick is one comparable facility; the shaded box spans the middle half of the peer group (25th–75th percentile).
        Axis: Energy Use Intensity, GJ/m².
      </figcaption>
    </figure>
  );
}
