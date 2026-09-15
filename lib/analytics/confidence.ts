/**
 * Data confidence for a school profile: High / Medium / Limited, always with the reasons, so a
 * visitor can see exactly why. Problems lower confidence; they are never hidden.
 */

import type { YearlyEnergy } from "./series";

export type DataConfidenceLevel = "High" | "Medium" | "Limited";
export type ConfidenceReason = { severity: "limiting" | "caution" | "info"; text: string };

export type DataConfidenceInputs = {
  latest: YearlyEnergy | null;
  yearsReported: number;
  /** Lowest confidence among facilities matched to the school; null when none are matched. */
  matchConfidence: number | null;
  matchMethods: string[];
  peerCount: number;
  hasCoordinates: boolean;
  largeLatestYearChange: boolean;
};

export function dataConfidence(input: DataConfidenceInputs): { level: DataConfidenceLevel; reasons: ConfidenceReason[] } {
  const reasons: ConfidenceReason[] = [];
  const { latest } = input;

  if (input.matchConfidence === null) {
    reasons.push({ severity: "limiting", text: "No public energy-reporting facility is confidently matched to this school." });
  } else if (input.matchConfidence < 0.95) {
    reasons.push({ severity: "caution", text: "The facility-to-school match relies on name similarity rather than an exact name or address." });
  } else if (input.matchMethods.includes("override")) {
    reasons.push({ severity: "info", text: "The facility-to-school match was verified manually." });
  }

  if (latest) {
    const flags = new Set(latest.qualityFlags);
    if (latest.floorAreaM2 === null || flags.has("nonpositive_floor_area")) {
      reasons.push({ severity: "limiting", text: "Usable floor-area data is unavailable for the latest reporting period." });
    }
    if (latest.totalSiteEnergyGj === null) reasons.push({ severity: "limiting", text: "Total energy is missing for the latest reporting period." });
    if (flags.has("negative_energy_value")) reasons.push({ severity: "limiting", text: "The latest report contains a negative energy value." });
    if (flags.has("implausible_intensity")) {
      reasons.push({
        severity: "limiting",
        text: "The reported energy, emissions, or floor area give an intensity outside the physically plausible range for a school building; the source values are shown as published but are not benchmarked.",
      });
    }
    if (flags.has("duplicate_facility_year")) reasons.push({ severity: "caution", text: "The source contains a duplicate record for this facility and year." });
    if ([...flags].some((f) => f.startsWith("unrecognized_unit"))) reasons.push({ severity: "limiting", text: "A reported quantity used a unit WattMap could not interpret." });
    if (flags.has("multiple_facilities_combined") || latest.facilityCount > 1) {
      reasons.push({ severity: "info", text: `${latest.facilityCount} reported facilities are combined for this school.` });
    }
    if (latest.totalDerived) {
      reasons.push({ severity: "info", text: "Total energy is derived from the ministry's reported intensity × floor area." });
    }
  }

  if (input.peerCount < 10) reasons.push({ severity: "limiting", text: "There are not enough comparable facilities to calculate a reliable percentile." });
  else if (input.peerCount < 20) reasons.push({ severity: "caution", text: `The peer group has ${input.peerCount} facilities (20+ preferred).` });
  if (input.yearsReported < 3) reasons.push({ severity: "caution", text: "Fewer than three reporting years are available, so trends are not calculated." });
  if (input.largeLatestYearChange) reasons.push({ severity: "caution", text: "The latest year differs from the previous year by more than 30%." });
  if (!input.hasCoordinates) reasons.push({ severity: "info", text: "No official coordinates are available, so the school is not shown on the map." });

  const level: DataConfidenceLevel = reasons.some((r) => r.severity === "limiting")
    ? "Limited"
    : reasons.some((r) => r.severity === "caution")
      ? "Medium"
      : "High";
  return { level, reasons };
}
