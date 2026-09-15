import { describe, expect, it } from "vitest";
import { opportunityScore, recentTrend, trendFactor, type ScoreInputs } from "../../lib/analytics/score";
import { peerAnomaly, yearOverYearChanges } from "../../lib/analytics/anomaly";

describe("trendFactor", () => {
  it("maps −10%/yr → 0, 0 → 0.5, +10%/yr → 1 and clamps", () => {
    expect(trendFactor(-10)).toBe(0);
    expect(trendFactor(0)).toBe(0.5);
    expect(trendFactor(10)).toBe(1);
    expect(trendFactor(5)).toBe(0.75);
    expect(trendFactor(-40)).toBe(0);
    expect(trendFactor(40)).toBe(1);
  });
});

describe("recentTrend", () => {
  it("regresses the latest non-pandemic years", () => {
    const trend = recentTrend([
      { year: 2016, value: 1.0 },
      { year: 2017, value: 1.0 },
      { year: 2018, value: 1.0 },
      { year: 2019, value: 1.0 },
      { year: 2020, value: 0.5 },
      { year: 2021, value: 0.6 },
      { year: 2022, value: 1.0 },
    ]);
    expect(trend?.yearsUsed).toEqual([2016, 2017, 2018, 2019, 2022]);
    expect(trend?.excludedPandemicYears).toEqual([2020, 2021]);
    expect(trend?.annualChangePct).toBeCloseTo(0);
  });
  it("needs three usable years", () => {
    expect(recentTrend([{ year: 2022, value: 1 }, { year: 2023, value: 1 }])).toBeNull();
    expect(recentTrend([{ year: 2020, value: 1 }, { year: 2021, value: 1 }, { year: 2022, value: 1 }])).toBeNull();
  });
  it("expresses slope relative to the mean", () => {
    const trend = recentTrend([{ year: 2022, value: 0.9 }, { year: 2023, value: 1.0 }, { year: 2024, value: 1.1 }]);
    expect(trend?.annualChangePct).toBeCloseTo(10);
  });
});

const base: ScoreInputs = {
  euiPercentile: 72,
  peerCount: 84,
  trend: { annualChangePct: 0, yearsUsed: [2022, 2023, 2024], excludedPandemicYears: [] },
  matchConfidence: 1,
  qualityFlags: [],
};

describe("opportunityScore", () => {
  it("combines 80% percentile and 20% trend", () => {
    const result = opportunityScore(base);
    expect(result.suppressed).toBe(false);
    if (!result.suppressed) {
      expect(result.score).toBe(Math.round(100 * (0.8 * 0.72 + 0.2 * 0.5)));
      expect(result.confidence).toBe("High");
    }
  });
  it("uses the percentile alone without history, at lower confidence", () => {
    const result = opportunityScore({ ...base, trend: null });
    if (result.suppressed) throw new Error("expected a score");
    expect(result.score).toBe(72);
    expect(result.usedTrend).toBe(false);
    expect(result.confidence).toBe("Medium");
  });
  it("is suppressed with fewer than 10 peers or blocking data flags", () => {
    expect(opportunityScore({ ...base, peerCount: 9 }).suppressed).toBe(true);
    expect(opportunityScore({ ...base, euiPercentile: null }).suppressed).toBe(true);
    expect(opportunityScore({ ...base, qualityFlags: ["negative_energy_value"] }).suppressed).toBe(true);
    expect(opportunityScore({ ...base, qualityFlags: ["unrecognized_unit:floor_area"] }).suppressed).toBe(true);
    expect(opportunityScore({ ...base, qualityFlags: ["implausible_intensity"] }).suppressed).toBe(true);
  });
  it("drops to Low with few peers, no trend, and an unconfirmed match", () => {
    const result = opportunityScore({ ...base, peerCount: 12, trend: null, matchConfidence: null });
    if (result.suppressed) throw new Error("expected a score");
    expect(result.confidence).toBe("Low");
  });
});

describe("anomaly screening", () => {
  const peers = [0.6, 0.62, 0.65, 0.66, 0.7, 0.71, 0.72, 0.75, 0.78, 0.8, 0.82];
  it("labels by robust z", () => {
    expect(peerAnomaly(0.71, peers)?.label).toBe("typical");
    expect(peerAnomaly(1.5, peers)?.label).toBe("unusually_high");
  });
  it("requires 10 peers", () => {
    expect(peerAnomaly(2, peers.slice(0, 9))).toBeNull();
  });
  it("flags large year-over-year moves without bridging gaps", () => {
    const changes = yearOverYearChanges([
      { year: 2018, value: 1 },
      { year: 2019, value: 1.5 },
      { year: 2022, value: 1.5 },
      { year: 2023, value: 1.6 },
    ]);
    expect(changes.map((c) => c.year)).toEqual([2019, 2023]);
    expect(changes[0]?.large).toBe(true);
    expect(changes[1]?.large).toBe(false);
  });
});
