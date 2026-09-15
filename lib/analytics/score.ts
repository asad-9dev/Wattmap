/**
 * Recent trend, Energy Opportunity Score, and score confidence.
 *
 * The score is an independent benchmarking indicator, not an official rating or an audit:
 *   score = 100 × (0.80 × P + 0.20 × trend_factor)
 * where P is the EUI peer percentile / 100 and trend_factor maps the annualized recent EUI
 * trend onto 0–1 (−10 %/yr or better → 0, flat → 0.5, +10 %/yr or worse → 1).
 */

import { linearSlope } from "./stats";

/** Reporting years disrupted by the pandemic; excluded from trend fits and labelled in charts. */
export const PANDEMIC_YEARS: ReadonlySet<number> = new Set([2020, 2021]);
export const MIN_TREND_YEARS = 3;
export const MAX_TREND_YEARS = 5;
const TREND_BOUND_PCT = 10;

export type YearValue = { year: number; value: number };

export type Trend = {
  /** Least-squares slope divided by the mean of the fitted values, in % per year. */
  annualChangePct: number;
  yearsUsed: number[];
  excludedPandemicYears: number[];
};

/**
 * Annualized trend over the most recent 3–5 valid, non-pandemic years. Regression rather than
 * first-vs-last so one unusual year cannot dominate.
 */
export function recentTrend(
  series: readonly YearValue[],
  window: { min: number; max: number } = { min: MIN_TREND_YEARS, max: MAX_TREND_YEARS },
): Trend | null {
  const valid = series.filter((p) => Number.isFinite(p.value) && p.value > 0).sort((a, b) => a.year - b.year);
  const excludedPandemicYears = valid.filter((p) => PANDEMIC_YEARS.has(p.year)).map((p) => p.year);
  const usable = valid.filter((p) => !PANDEMIC_YEARS.has(p.year)).slice(-window.max);
  if (usable.length < window.min) return null;
  const slope = linearSlope(usable.map((p) => ({ x: p.year, y: p.value })));
  const mean = usable.reduce((sum, p) => sum + p.value, 0) / usable.length;
  if (slope === null || mean <= 0) return null;
  return {
    annualChangePct: (slope / mean) * 100,
    yearsUsed: usable.map((p) => p.year),
    excludedPandemicYears: excludedPandemicYears.filter((y) => y >= usable[0]!.year),
  };
}

export function trendFactor(annualChangePct: number): number {
  const factor = (annualChangePct + TREND_BOUND_PCT) / (2 * TREND_BOUND_PCT);
  return Math.min(1, Math.max(0, factor));
}

export type ConfidenceLevel = "High" | "Medium" | "Low";

export type ScoreInputs = {
  euiPercentile: number | null;
  peerCount: number;
  trend: Trend | null;
  /** Facility-to-school match confidence; null when the facility is not matched to a school. */
  matchConfidence: number | null;
  qualityFlags: readonly string[];
};

export type OpportunityScore =
  | {
      suppressed: false;
      score: number;
      confidence: ConfidenceLevel;
      usedTrend: boolean;
      reasons: string[];
    }
  | { suppressed: true; reasons: string[] };

/** Flags that make the underlying numbers themselves doubtful: the score is not shown. */
const BLOCKING_FLAGS = ["implausible_intensity", "negative_energy_value", "duplicate_facility_year", "nonpositive_floor_area"];

export function opportunityScore(inputs: ScoreInputs): OpportunityScore {
  const reasons: string[] = [];
  if (inputs.euiPercentile === null || inputs.peerCount < 10) {
    return { suppressed: true, reasons: ["Insufficient comparable facilities for a reliable peer benchmark."] };
  }
  const blocking = inputs.qualityFlags.filter((f) => BLOCKING_FLAGS.includes(f) || f.startsWith("unrecognized_unit"));
  if (blocking.length > 0) {
    return { suppressed: true, reasons: [`Data quality issues prevent a reliable score (${blocking.join(", ")}).`] };
  }

  const p = inputs.euiPercentile / 100;
  const usedTrend = inputs.trend !== null;
  const raw = usedTrend ? 0.8 * p + 0.2 * trendFactor(inputs.trend!.annualChangePct) : p;

  let points = 0;
  if (inputs.peerCount >= 20) {
    points += 2;
    reasons.push(`${inputs.peerCount} comparable facilities (20+ preferred).`);
  } else {
    points += 1;
    reasons.push(`Only ${inputs.peerCount} comparable facilities (20+ preferred).`);
  }
  if (usedTrend) {
    points += 2;
    reasons.push(`Trend based on ${inputs.trend!.yearsUsed.length} reporting years.`);
  } else {
    reasons.push("Fewer than 3 usable years: score uses peer percentile only.");
  }
  if (inputs.matchConfidence !== null && inputs.matchConfidence >= 0.95) {
    points += 1;
  } else {
    reasons.push("Facility-to-school match is not fully confirmed.");
  }
  if (inputs.qualityFlags.includes("missing_total_energy") || inputs.qualityFlags.includes("missing_floor_area")) {
    points -= 1;
    reasons.push("Some reported fields are missing.");
  }
  const confidence: ConfidenceLevel = points >= 5 ? "High" : points >= 3 ? "Medium" : "Low";
  return { suppressed: false, score: Math.round(raw * 100), confidence, usedTrend, reasons };
}
