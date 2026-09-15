import { bandsFor, MAP_METRICS, type BandTone, type MapMetric } from "./metricScale";
import type { SchoolPoint } from "./SchoolMap";

const TONE_CLASS: Record<BandTone, string> = { low: "bg-signal-low", mid: "bg-signal-mid", high: "bg-signal-high" };

export function MapLegend({ points, metric }: { points: SchoolPoint[]; metric: MapMetric }) {
  const values = points.map((p) => p[metric]).filter((v): v is number => v !== null);
  const bands = bandsFor(metric, values);
  const meta = MAP_METRICS.find((m) => m.key === metric)!;
  return (
    <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-ink-muted" aria-label={`Legend: ${meta.label}`}>
      <span className="font-medium text-ink">
        {meta.label}
        {meta.unit && ` (${meta.unit})`}:
      </span>
      {bands.map((band) => (
        <span key={band.label} className="inline-flex items-center gap-1.5">
          <span className={`inline-block h-3 w-3 rounded-full ${TONE_CLASS[band.tone]}`} aria-hidden="true" />
          {band.label}
        </span>
      ))}
      <span className="inline-flex items-center gap-1.5">
        <span className="inline-block h-3 w-3 rounded-full bg-line-strong" aria-hidden="true" />
        No value
      </span>
      <span className="inline-flex items-center gap-1.5">
        <span className="inline-block h-3 w-3 rounded-full bg-accent" aria-hidden="true" />
        Cluster (select to zoom)
      </span>
    </div>
  );
}
