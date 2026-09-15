"use client";

import dynamic from "next/dynamic";
import { MapLegend } from "./MapLegend";
import type { MapMetric } from "./metricScale";
import type { SchoolPoint } from "./SchoolMap";

// MapLibre is large and browser-only, so it loads on demand and never on the server.
const SchoolMap = dynamic(() => import("./SchoolMap").then((m) => m.SchoolMap), {
  ssr: false,
  loading: () => <div className="flex h-64 items-center justify-center rounded-md border border-line bg-white text-sm text-ink-muted">Loading map…</div>,
});

export function SchoolMapLoader({ points, metric, height }: { points: SchoolPoint[]; metric: MapMetric; height?: number }) {
  return (
    <div className="space-y-2">
      <SchoolMap points={points} metric={metric} height={height} />
      <MapLegend points={points} metric={metric} />
    </div>
  );
}
