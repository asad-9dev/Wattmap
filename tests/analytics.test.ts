/**
 * Formula verification for the public analytics API (lib/analytics/metrics). Each block checks
 * one documented formula against hand-calculated values. Module-level edge cases live in
 * tests/unit/*.test.ts.
 */
import { describe, expect, it } from "vitest";
import {
  KWH_PER_GJ,
  dataConfidence,
  energyGapToPeerMedian,
  energyUseIntensity,
  ghgIntensity,
  opportunityScore,
  percentileRank,
  quantile,
  recentTrend,
  selectPeerCohort,
  toKwhEquivalent,
  trendFactor,
  type DataConfidenceInputs,
  type PeerCandidate,
} from "../lib/analytics/metrics";
import type { YearlyEnergy } from "../lib/analytics/series";

describe("Energy Use Intensity", () => {
  it("EUI = total site energy ÷ floor area (GJ/m²)", () => {
    // 8,420 GJ over 10,268 m² — the spec's Ajax High School example.
    expect(energyUseIntensity(8420, 10268)).toBeCloseTo(0.82, 2);
  });
  it("kWh-equivalent = EUI × 277.78", () => {
    expect(KWH_PER_GJ).toBeCloseTo(277.7777778, 6);
    expect(toKwhEquivalent(energyUseIntensity(8420, 10268))).toBeCloseTo(227.8, 1);
  });
  it("is only calculated with valid energy and a positive floor area", () => {
    expect(energyUseIntensity(8420, 0)).toBeNull();
    expect(energyUseIntensity(8420, null)).toBeNull();
    expect(energyUseIntensity(null, 10268)).toBeNull();
    expect(energyUseIntensity(-1, 10268)).toBeNull();
  });
});

describe("GHG intensity", () => {
  it("= kg CO₂e ÷ floor area", () => {
    expect(ghgIntensity(184_000, 10_000)).toBeCloseTo(18.4);
    expect(ghgIntensity(184_000, 0)).toBeNull();
  });
});

describe("Peer cohort selection", () => {
  const target: PeerCandidate = { facilityId: 0, operationCategory: "school", schoolLevel: "secondary", floorAreaM2: 10_000, weeklyHours: 60, eui: 0.8 };
  const peer = (id: number, overrides: Partial<PeerCandidate> = {}): PeerCandidate => ({ ...target, facilityId: id, eui: 0.6, ...overrides });

  it("matches operation type, school level, and floor area 0.67–1.5× (with hours ±25%)", () => {
    const pool = [
      ...Array.from({ length: 20 }, (_, i) => peer(i + 1, { floorAreaM2: 6_700 + i * 400 })), // 6,700–14,300 m²: in range
      peer(100, { floorAreaM2: 6_600 }), // 0.66× — too small
      peer(101, { floorAreaM2: 15_100 }), // 1.51× — too large
      peer(102, { operationCategory: "administrative" }),
      peer(103, { schoolLevel: "elementary" }),
    ];
    const cohort = selectPeerCohort(target, pool);
    expect(cohort.stage?.label).toMatch(/0\.67–1\.5×/);
    expect(cohort.peers.map((p) => p.facilityId).sort((a, b) => a - b)).toEqual(Array.from({ length: 20 }, (_, i) => i + 1));
  });
  it("relaxes floor area until at least 20 peers, and refuses fewer than 10", () => {
    const wide = [...Array.from({ length: 10 }, (_, i) => peer(i + 1)), ...Array.from({ length: 10 }, (_, i) => peer(50 + i, { floorAreaM2: 19_000 }))];
    expect(selectPeerCohort(target, wide).stage?.areaRange).toEqual([0.5, 2]);
    expect(selectPeerCohort(target, Array.from({ length: 9 }, (_, i) => peer(i + 1))).sufficient).toBe(false);
  });
});

describe("Percentile", () => {
  it("= share of peers with lower EUI, ties counted half", () => {
    const peers = [0.5, 0.6, 0.7, 0.8, 0.8, 0.9, 1.0, 1.1];
    // below 0.8: 3 peers; equal: 2 → (3 + 1) / 8 = 50th percentile.
    expect(percentileRank(0.8, peers)).toBe(50);
    expect(percentileRank(1.2, peers)).toBe(100);
    expect(quantile(peers, 0.5)).toBeCloseTo(0.8);
  });
});

describe("Energy Opportunity Score", () => {
  it("trend factor maps −10 %/yr → 0, 0 → 0.5, +10 %/yr → 1 (clamped)", () => {
    expect([-15, -10, 0, 5, 10, 15].map(trendFactor)).toEqual([0, 0, 0.5, 0.75, 1, 1]);
  });
  it("trend uses the latest 3–5 non-pandemic years by least squares", () => {
    const trend = recentTrend([
      { year: 2016, value: 0.9 },
      { year: 2017, value: 0.9 },
      { year: 2018, value: 0.9 },
      { year: 2019, value: 0.9 },
      { year: 2020, value: 0.4 },
      { year: 2022, value: 0.9 },
      { year: 2023, value: 0.9 },
    ]);
    expect(trend?.yearsUsed).toEqual([2017, 2018, 2019, 2022, 2023]);
    expect(trend?.annualChangePct).toBeCloseTo(0);
  });
  it("score = 100 × (0.8 × percentile/100 + 0.2 × trend factor)", () => {
    const result = opportunityScore({
      euiPercentile: 72,
      peerCount: 84,
      trend: { annualChangePct: 5, yearsUsed: [2019, 2022, 2023], excludedPandemicYears: [] },
      matchConfidence: 1,
      qualityFlags: [],
    });
    expect(result.suppressed).toBe(false);
    if (!result.suppressed) expect(result.score).toBe(Math.round(100 * (0.8 * 0.72 + 0.2 * 0.75)));
  });
  it("is suppressed with fewer than 10 peers", () => {
    expect(opportunityScore({ euiPercentile: 90, peerCount: 9, trend: null, matchConfidence: 1, qualityFlags: [] }).suppressed).toBe(true);
  });
});

describe("Modeled energy gap to peer median", () => {
  it("= (EUI − peer median) × floor area, and 0 at or below the median", () => {
    expect(energyGapToPeerMedian(0.82, 0.7, 10_000)).toBeCloseTo(1_200);
    expect(energyGapToPeerMedian(0.65, 0.7, 10_000)).toBe(0);
  });
});

describe("Data confidence rating", () => {
  const latest: YearlyEnergy = {
    year: 2023, periodEnd: "2024-08-31", facilityCount: 1, totalSiteEnergyGj: 5000, normalizedTotalEnergyGj: null,
    electricityKwh: 400000, naturalGasGj: 3000, naturalGasM3: null, ghgKgCo2e: 150000, floorAreaM2: 6000,
    weeklyHours: 50, portableCount: 0, operationType: "K-12 School", eui: 0.83, ghgIntensity: 25, electricityIntensity: 66,
    totalDerived: false, pandemicAffected: false, qualityFlags: [], sources: ["2023_final_data_set.xlsx"],
  };
  const inputs: DataConfidenceInputs = {
    latest, yearsReported: 10, matchConfidence: 1, matchMethods: ["exact_name_board"], peerCount: 60, hasCoordinates: true, largeLatestYearChange: false,
  };
  it("High with complete fields, a firm match, and 20+ peers", () => {
    expect(dataConfidence(inputs).level).toBe("High");
  });
  it("Medium with 10–19 peers or fewer than three years", () => {
    expect(dataConfidence({ ...inputs, peerCount: 15 }).level).toBe("Medium");
    expect(dataConfidence({ ...inputs, yearsReported: 2 }).level).toBe("Medium");
  });
  it("Low with missing floor area or total energy, or fewer than 10 peers", () => {
    expect(dataConfidence({ ...inputs, latest: { ...latest, floorAreaM2: null } }).level).toBe("Low");
    expect(dataConfidence({ ...inputs, latest: { ...latest, totalSiteEnergyGj: null } }).level).toBe("Low");
    expect(dataConfidence({ ...inputs, peerCount: 6 }).level).toBe("Low");
  });
});
