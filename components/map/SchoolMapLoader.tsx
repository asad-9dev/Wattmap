"use client";

import dynamic from "next/dynamic";
import { useResolvedTheme } from "@/components/theme/useTheme";
import { MapLegend } from "./MapLegend";
import type { MapMetric } from "./metricScale";
import type { SchoolPoint } from "./SchoolMap";

// MapLibre is large and browser-only, so it loads on demand and never on the server.
const SchoolMap = dynamic(() => import("./SchoolMap").then((m) => m.SchoolMap), {
  ssr: false,
  loading: () => (
    <div className="flex h-64 items-center justify-center rounded-md border border-line bg-surface text-sm text-ink-muted" role="status">
      Loading map…
    </div>
  ),
});

export function SchoolMapLoader({ points, metric, height }: { points: SchoolPoint[]; metric: MapMetric; height?: number }) {
  const theme = useResolvedTheme();
  return (
    <div className="space-y-2">
      {/* Keyed by theme: switching theme rebuilds the map with the matching basemap and colours. */}
      <SchoolMap key={theme} theme={theme} points={points} metric={metric} height={height} />
      <MapLegend points={points} metric={metric} />
    </div>
  );
}
