/**
 * Computes benchmarking results for every entity-year from reported facility records. Pure:
 * no I/O, so the same code runs in the rebuild CLI and in tests.
 *
 * Entity = a Ministry school (every facility matched to it, combined per year) or, when a
 * facility has no confirmed school, the facility itself. Combining by school keeps a school's
 * history continuous when its facility name changes between reporting layouts.
 */

import { peerAnomaly } from "./anomaly";
import { operationCategory, type OperationCategory } from "./category";
import { electricityIntensity, energyGapToPeerMedian, energyUseIntensity, ghgIntensity } from "./metrics";
import { selectPeers, type PeerCandidate, type SchoolLevel } from "./peers";
import { opportunityScore, recentTrend, type YearValue } from "./score";
import { percentileRank, quantile } from "./stats";

export type FacilityYearInput = {
  facilityId: number;
  /** Set only when the facility is matched to a Ministry school. */
  schoolId: number | null;
  reportingYear: number;
  operationType: string | null;
  schoolLevel: SchoolLevel | null;
  matchConfidence: number | null;
  totalSiteEnergyGj: number | null;
  floorAreaM2: number | null;
  ghgKgCo2e: number | null;
  electricityKwh: number | null;
  weeklyHours: number | null;
  qualityFlags: string[];
};

export type PeerMetricRow = {
  schoolId: number | null;
  facilityId: number | null;
  reportingYear: number;
  facilityCount: number;
  operationCategory: OperationCategory;
  schoolLevel: SchoolLevel | null;
  euiGjM2: number | null;
  ghgIntensityKgM2: number | null;
  electricityIntensityKwhM2: number | null;
  peerStage: string | null;
  peerCriteria: string[];
  peerCount: number;
  peerEuis: number[];
  euiPercentile: number | null;
  ghgPercentile: number | null;
  peerMedianEui: number | null;
  peerQ25Eui: number | null;
  peerQ75Eui: number | null;
  energyGapGj: number | null;
  euiRobustZ: number | null;
  anomalyLabel: string | null;
  trendAnnualPct: number | null;
  trendYears: number[];
  opportunityScore: number | null;
  scoreConfidence: string | null;
  scoreReasons: string[];
};

/** Records with these flags are still shown on their own profile but never used as peers. */
const EXCLUDED_FROM_PEERS = [
  "implausible_intensity",
  "negative_energy_value",
  "duplicate_facility_year",
  "nonpositive_floor_area",
  "zero_total_with_reported_consumption",
];

type EntityYear = {
  key: string;
  schoolId: number | null;
  facilityId: number | null;
  reportingYear: number;
  facilityCount: number;
  category: OperationCategory;
  schoolLevel: SchoolLevel | null;
  matchConfidence: number | null;
  totalSiteEnergyGj: number | null;
  floorAreaM2: number | null;
  ghgKgCo2e: number | null;
  electricityKwh: number | null;
  weeklyHours: number | null;
  qualityFlags: string[];
};

/** Sum when every part is reported; one missing part makes the combined value unknown. */
function sumAll(values: (number | null)[]): number | null {
  return values.some((v) => v === null) ? null : values.reduce<number>((sum, v) => sum + v!, 0);
}

export function combineEntityYears(records: readonly FacilityYearInput[]): EntityYear[] {
  const groups = new Map<string, FacilityYearInput[]>();
  for (const record of records) {
    const entity = record.schoolId !== null ? `s${record.schoolId}` : `f${record.facilityId}`;
    const key = `${entity}|${record.reportingYear}`;
    groups.set(key, [...(groups.get(key) ?? []), record]);
  }
  return [...groups.entries()].map(([key, group]) => {
    const largest = [...group].sort((a, b) => (b.floorAreaM2 ?? 0) - (a.floorAreaM2 ?? 0))[0]!;
    const flags = new Set(group.flatMap((r) => r.qualityFlags));
    if (group.length > 1) flags.add("multiple_facilities_combined");
    return {
      key: key.split("|")[0]!,
      schoolId: largest.schoolId,
      facilityId: largest.schoolId === null ? largest.facilityId : null,
      reportingYear: largest.reportingYear,
      facilityCount: group.length,
      category: operationCategory(largest.operationType),
      schoolLevel: largest.schoolLevel,
      matchConfidence: group.every((r) => r.matchConfidence !== null) ? Math.min(...group.map((r) => r.matchConfidence!)) : null,
      totalSiteEnergyGj: sumAll(group.map((r) => r.totalSiteEnergyGj)),
      floorAreaM2: sumAll(group.map((r) => r.floorAreaM2)),
      ghgKgCo2e: sumAll(group.map((r) => r.ghgKgCo2e)),
      electricityKwh: sumAll(group.map((r) => r.electricityKwh)),
      weeklyHours: group.length === 1 ? largest.weeklyHours : null,
      qualityFlags: [...flags],
    };
  });
}

function usableAsPeer(entity: EntityYear): boolean {
  return !entity.qualityFlags.some((f) => EXCLUDED_FROM_PEERS.includes(f) || f.startsWith("unrecognized_unit"));
}

export function computePeerMetrics(records: readonly FacilityYearInput[]): PeerMetricRow[] {
  const entities = combineEntityYears(records).map((e) => ({
    ...e,
    eui: energyUseIntensity(e.totalSiteEnergyGj, e.floorAreaM2),
    ghgI: ghgIntensity(e.ghgKgCo2e, e.floorAreaM2),
  }));

  const series = new Map<string, YearValue[]>();
  const pools = new Map<string, { candidate: PeerCandidate; ghgI: number | null; key: string }[]>();
  for (const e of entities) {
    if (e.eui === null || !usableAsPeer(e)) continue;
    series.set(e.key, [...(series.get(e.key) ?? []), { year: e.reportingYear, value: e.eui }]);
    const poolKey = `${e.reportingYear}|${e.category}`;
    const candidate: PeerCandidate = {
      // Peer selection needs a numeric id only to exclude the target itself.
      facilityId: entityNumber(e.key),
      operationCategory: e.category,
      schoolLevel: e.schoolLevel,
      floorAreaM2: e.floorAreaM2!,
      weeklyHours: e.weeklyHours,
      eui: e.eui,
    };
    pools.set(poolKey, [...(pools.get(poolKey) ?? []), { candidate, ghgI: e.ghgI, key: e.key }]);
  }

  return entities.map((e) => {
    const row: PeerMetricRow = {
      schoolId: e.schoolId,
      facilityId: e.facilityId,
      reportingYear: e.reportingYear,
      facilityCount: e.facilityCount,
      operationCategory: e.category,
      schoolLevel: e.schoolLevel,
      euiGjM2: e.eui,
      ghgIntensityKgM2: e.ghgI,
      electricityIntensityKwhM2: electricityIntensity(e.electricityKwh, e.floorAreaM2),
      peerStage: null,
      peerCriteria: [],
      peerCount: 0,
      peerEuis: [],
      euiPercentile: null,
      ghgPercentile: null,
      peerMedianEui: null,
      peerQ25Eui: null,
      peerQ75Eui: null,
      energyGapGj: null,
      euiRobustZ: null,
      anomalyLabel: null,
      trendAnnualPct: null,
      trendYears: [],
      opportunityScore: null,
      scoreConfidence: null,
      scoreReasons: [],
    };
    if (e.eui === null) {
      row.scoreReasons = ["Energy intensity cannot be calculated: usable floor area or total energy is missing."];
      return row;
    }

    const pool = pools.get(`${e.reportingYear}|${e.category}`) ?? [];
    const selection = selectPeers(
      {
        facilityId: entityNumber(e.key),
        operationCategory: e.category,
        schoolLevel: e.schoolLevel,
        floorAreaM2: e.floorAreaM2!,
        weeklyHours: e.weeklyHours,
        eui: e.eui,
      },
      pool.filter((p) => p.key !== e.key).map((p) => p.candidate),
    );
    // Trend uses only years up to this one, so historical rows show what was knowable then.
    const trend = recentTrend((series.get(e.key) ?? []).filter((p) => p.year <= e.reportingYear));
    row.trendAnnualPct = trend?.annualChangePct ?? null;
    row.trendYears = trend?.yearsUsed ?? [];
    row.peerCriteria = selection.baseCriteria;

    if (selection.sufficient) {
      const peerEuis = selection.peers.map((p) => p.eui).sort((a, b) => a - b);
      const chosen = new Set(selection.peers);
      const peerGhg = pool.filter((p) => chosen.has(p.candidate) && p.ghgI !== null).map((p) => p.ghgI!);
      const median = quantile(peerEuis, 0.5);
      const anomaly = peerAnomaly(e.eui, peerEuis);
      Object.assign(row, {
        peerStage: selection.stage?.label ?? null,
        peerCount: peerEuis.length,
        peerEuis,
        euiPercentile: percentileRank(e.eui, peerEuis),
        ghgPercentile: e.ghgI !== null && peerGhg.length >= 10 ? percentileRank(e.ghgI, peerGhg) : null,
        peerMedianEui: median,
        peerQ25Eui: quantile(peerEuis, 0.25),
        peerQ75Eui: quantile(peerEuis, 0.75),
        energyGapGj: energyGapToPeerMedian(e.eui, median, e.floorAreaM2),
        euiRobustZ: anomaly?.z ?? null,
        anomalyLabel: anomaly?.label ?? null,
      });
    }

    const score = opportunityScore({
      euiPercentile: row.euiPercentile,
      peerCount: row.peerCount,
      trend,
      matchConfidence: e.matchConfidence,
      qualityFlags: e.qualityFlags,
    });
    row.scoreReasons = score.reasons;
    if (!score.suppressed) {
      row.opportunityScore = score.score;
      row.scoreConfidence = score.confidence;
    }
    return row;
  });
}

/** Schools and facilities get disjoint numeric ids (facilities negative) for peer exclusion. */
function entityNumber(key: string): number {
  const id = Number(key.slice(1));
  return key.startsWith("s") ? id : -id;
}
