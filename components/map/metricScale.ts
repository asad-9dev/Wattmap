import { quantile } from "@/lib/analytics/stats";
import { formatNumber } from "@/lib/format";

export type MapMetric = "eui" | "percentile" | "score" | "ghgIntensity";

export const MAP_METRICS: { key: MapMetric; label: string; unit: string }[] = [
  { key: "eui", label: "Latest EUI", unit: "GJ/m²" },
  { key: "percentile", label: "Peer percentile", unit: "" },
  { key: "score", label: "Opportunity score", unit: "/100" },
  { key: "ghgIntensity", label: "GHG intensity", unit: "kg CO₂e/m²" },
];

export const BAND_COLORS = ["#2f6f9f", "#8a8f98", "#b45309"] as const;
export const NO_VALUE_COLOR = "#c9ccd1";

export type Band = { color: string; label: string; min: number; max: number };

/**
 * Three bands per metric. Percentile and score use fixed thirds; EUI and GHG intensity use the
 * tertiles of the schools currently shown, since they have no natural fixed scale.
 */
export function bandsFor(metric: MapMetric, values: number[]): Band[] {
  const digits = metric === "eui" ? 2 : metric === "ghgIntensity" ? 1 : 0;
  let cuts: [number, number];
  if (metric === "percentile" || metric === "score") cuts = [33.3, 66.7];
  else cuts = [quantile(values, 1 / 3) ?? 0, quantile(values, 2 / 3) ?? 0];
  const low = Math.min(0, ...values);
  const high = Math.max(100, ...values);
  const f = (v: number) => formatNumber(v, digits);
  return [
    { color: BAND_COLORS[0], label: `Lower (below ${f(cuts[0])})`, min: low, max: cuts[0] },
    { color: BAND_COLORS[1], label: `Middle (${f(cuts[0])}–${f(cuts[1])})`, min: cuts[0], max: cuts[1] },
    { color: BAND_COLORS[2], label: `Higher (above ${f(cuts[1])})`, min: cuts[1], max: high },
  ];
}
