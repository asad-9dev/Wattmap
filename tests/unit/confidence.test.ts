import { describe, expect, it } from "vitest";
import { dataConfidence, type DataConfidenceInputs } from "../../lib/analytics/confidence";
import { histogram } from "../../lib/analytics/histogram";
import type { YearlyEnergy } from "../../lib/analytics/series";

const latest: YearlyEnergy = {
  year: 2023,
  periodEnd: "2024-08-31",
  facilityCount: 1,
  totalSiteEnergyGj: 5000,
  normalizedTotalEnergyGj: null,
  electricityKwh: 400000,
  naturalGasGj: 3000,
  naturalGasM3: null,
  ghgKgCo2e: 150000,
  floorAreaM2: 6000,
  weeklyHours: 50,
  portableCount: 0,
  operationType: "K-12 School",
  eui: 0.83,
  ghgIntensity: 25,
  electricityIntensity: 66,
  totalDerived: false,
  pandemicAffected: false,
  qualityFlags: [],
  sources: ["2023_final_data_set.xlsx"],
};

const good: DataConfidenceInputs = {
  latest,
  yearsReported: 10,
  matchConfidence: 1,
  matchMethods: ["exact_name_board"],
  peerCount: 60,
  hasCoordinates: true,
  largeLatestYearChange: false,
};

describe("dataConfidence", () => {
  it("is High with complete data and a firm match", () => {
    expect(dataConfidence(good)).toEqual({ level: "High", reasons: [] });
  });
  it("is Medium for a similarity-based match or a small peer group", () => {
    expect(dataConfidence({ ...good, matchConfidence: 0.85 }).level).toBe("Medium");
    expect(dataConfidence({ ...good, peerCount: 15 }).level).toBe("Medium");
  });
  it("is Limited without floor area, peers, or a match — and says why", () => {
    const result = dataConfidence({ ...good, latest: { ...latest, floorAreaM2: null } });
    expect(result.level).toBe("Limited");
    expect(result.reasons[0]?.text).toMatch(/floor-area/);
    expect(dataConfidence({ ...good, peerCount: 4 }).level).toBe("Limited");
    expect(dataConfidence({ ...good, matchConfidence: null }).level).toBe("Limited");
  });
  it("keeps informational notes without lowering confidence", () => {
    const result = dataConfidence({ ...good, hasCoordinates: false, latest: { ...latest, totalDerived: true } });
    expect(result.level).toBe("High");
    expect(result.reasons).toHaveLength(2);
  });
});

describe("histogram", () => {
  it("bins to the 99th percentile with an open-ended overflow bin", () => {
    const values = [...Array.from({ length: 99 }, (_, i) => i / 100), 50];
    const bins = histogram(values, 10);
    expect(bins.at(-1)).toMatchObject({ openEnded: true, count: 1 });
    expect(bins.reduce((sum, b) => sum + b.count, 0)).toBe(100);
  });
  it("handles empty and all-zero input", () => {
    expect(histogram([])).toEqual([]);
    expect(histogram([0, 0])).toEqual([{ from: 0, to: 0, count: 2, openEnded: false }]);
  });
});
