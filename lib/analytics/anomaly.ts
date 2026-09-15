/** Transparent statistical screening: robust z against peers and year-over-year movement. */

import { PANDEMIC_YEARS, type YearValue } from "./score";
import { robustZ } from "./stats";

export type PeerAnomalyLabel = "typical" | "elevated" | "unusually_high";

export const PEER_ANOMALY_LABELS: Record<PeerAnomalyLabel, string> = {
  typical: "Typical peer range",
  elevated: "Elevated relative to peers",
  unusually_high: "Unusually high relative to peers",
};

/** 3.5 is Iglewicz & Hoaglin's recommended outlier cut-off for the modified z-score. */
const UNUSUAL_Z = 3.5;
const ELEVATED_Z = 2;
const MIN_PEERS = 10;

export function peerAnomaly(value: number, peers: readonly number[]): { z: number; label: PeerAnomalyLabel } | null {
  if (peers.length < MIN_PEERS) return null;
  const z = robustZ(value, peers);
  if (z === null) return null;
  const label: PeerAnomalyLabel = z >= UNUSUAL_Z ? "unusually_high" : z >= ELEVATED_Z ? "elevated" : "typical";
  return { z, label };
}

/** Year-over-year moves larger than this share of the previous value are flagged for review. */
export const LARGE_YOY_CHANGE = 0.3;

export type YearOverYear = { year: number; previousYear: number; changePct: number; large: boolean; pandemicAffected: boolean };

/** Changes between consecutive reported years. Gaps are not bridged: 2019→2022 is not a YoY change. */
export function yearOverYearChanges(series: readonly YearValue[]): YearOverYear[] {
  const sorted = series.filter((p) => Number.isFinite(p.value) && p.value > 0).sort((a, b) => a.year - b.year);
  const changes: YearOverYear[] = [];
  for (let i = 1; i < sorted.length; i += 1) {
    const previous = sorted[i - 1]!;
    const current = sorted[i]!;
    if (current.year !== previous.year + 1) continue;
    const change = (current.value - previous.value) / previous.value;
    changes.push({
      year: current.year,
      previousYear: previous.year,
      changePct: change * 100,
      large: Math.abs(change) > LARGE_YOY_CHANGE,
      pandemicAffected: PANDEMIC_YEARS.has(current.year) || PANDEMIC_YEARS.has(previous.year),
    });
  }
  return changes;
}
