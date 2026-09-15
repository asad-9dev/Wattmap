import { describe, expect, it } from "vitest";
import { combineYearly, withYearGaps, type YearlyRecordInput } from "../../lib/analytics/series";

function rec(year: number, overrides: Partial<YearlyRecordInput> = {}): YearlyRecordInput {
  return {
    reportingYear: year,
    reportingPeriodEnd: null,
    totalSiteEnergyGj: 1000,
    normalizedTotalEnergyGj: null,
    electricityKwh: 100000,
    naturalGasGj: null,
    naturalGasM3: 10000,
    ghgKgCo2e: 20000,
    floorAreaM2: 2000,
    weeklyHours: 50,
    portableCount: 0,
    operationType: "School",
    dataQualityFlags: [],
    sourceResource: `${year}.xlsx`,
    ...overrides,
  };
}

describe("combineYearly", () => {
  it("computes per-year intensities and tags pandemic years", () => {
    const series = combineYearly([rec(2021), rec(2019)]);
    expect(series.map((s) => s.year)).toEqual([2019, 2021]);
    expect(series[0]?.eui).toBeCloseTo(0.5);
    expect(series[0]?.ghgIntensity).toBeCloseTo(10);
    expect(series[1]?.pandemicAffected).toBe(true);
  });
  it("sums multiple facilities in one year, unknown if any part is missing", () => {
    const [both] = combineYearly([rec(2023), rec(2023, { totalSiteEnergyGj: 500, floorAreaM2: 1000 })]);
    expect(both).toMatchObject({ facilityCount: 2, totalSiteEnergyGj: 1500, floorAreaM2: 3000, weeklyHours: null });
    const [partial] = combineYearly([rec(2023), rec(2023, { naturalGasGj: 5 })]);
    expect(partial?.naturalGasGj).toBeNull();
  });
  it("marks derived totals", () => {
    const [row] = combineYearly([rec(2015, { dataQualityFlags: ["total_energy_derived_from_reported_intensity"] })]);
    expect(row?.totalDerived).toBe(true);
  });
});

describe("withYearGaps", () => {
  it("inserts missing years so charts do not bridge them", () => {
    const rows = withYearGaps([{ year: 2019 }, { year: 2022 }]);
    expect(rows.map((r) => r.year)).toEqual([2019, 2020, 2021, 2022]);
    expect(rows[1]).toEqual({ year: 2020, missing: true });
  });
});
