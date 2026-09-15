/** Turns a loaded school profile into the values the page and report display. Pure. */

import { yearOverYearChanges } from "@/lib/analytics/anomaly";
import { dataConfidence } from "@/lib/analytics/confidence";
import { recentTrend } from "@/lib/analytics/score";
import { withYearGaps } from "@/lib/analytics/series";
import type { SchoolProfile } from "@/lib/db/queries/schools";

export function buildProfileView(profile: SchoolProfile) {
  const { series, latest: metric, facilities } = profile;
  const latestYear = series.at(-1) ?? null;
  const euiSeries = series.filter((s) => s.eui !== null).map((s) => ({ year: s.year, value: s.eui! }));
  const changes = yearOverYearChanges(euiSeries);
  const latestChange = latestYear ? (changes.find((c) => c.year === latestYear.year) ?? null) : null;

  const matchConfidences = facilities.map((f) => f.matchConfidence).filter((c): c is number => c !== null);
  const confidence = dataConfidence({
    latest: latestYear,
    yearsReported: series.length,
    matchConfidence: matchConfidences.length ? Math.min(...matchConfidences) : null,
    matchMethods: facilities.map((f) => f.matchMethod ?? ""),
    peerCount: metric?.peerCount ?? 0,
    hasCoordinates: profile.school.latitude !== null && profile.school.longitude !== null,
    largeLatestYearChange: latestChange?.large ?? false,
  });

  return {
    latestYear,
    metric,
    confidence,
    chartRows: withYearGaps(series),
    trend3: recentTrend(euiSeries, { min: 3, max: 3 }),
    trend5: recentTrend(euiSeries, { min: 5, max: 5 }),
    latestChange,
    years: series.map((s) => s.year),
    hasEnergyData: facilities.length > 0 && series.length > 0,
  };
}

export type ProfileView = ReturnType<typeof buildProfileView>;

export const SCORE_EXPLANATION =
  "The WattMap Energy Opportunity Score is an independent benchmarking indicator based on publicly reported energy data, comparison with similar facilities, and recent trends. It is not an official government rating or a professional building energy audit.";

export const GAP_EXPLANATION =
  "This estimate shows the difference between the facility's reported energy intensity and the median of its WattMap peer group. Actual achievable savings may be higher or lower.";
