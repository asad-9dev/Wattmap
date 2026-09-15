import { describe, expect, it } from "vitest";
import { operationCategory } from "../../lib/analytics/category";
import { combineEntityYears, computePeerMetrics, type FacilityYearInput } from "../../lib/analytics/rebuild";

function record(overrides: Partial<FacilityYearInput>): FacilityYearInput {
  return {
    facilityId: 1,
    schoolId: null,
    reportingYear: 2023,
    operationType: "K-12 School",
    schoolLevel: "elementary",
    matchConfidence: 1,
    totalSiteEnergyGj: 5000,
    floorAreaM2: 5000,
    ghgKgCo2e: 100000,
    electricityKwh: 400000,
    weeklyHours: 50,
    qualityFlags: [],
    ...overrides,
  };
}

/** 30 elementary schools of equal size with EUIs 0.50, 0.52, … 1.08 GJ/m². */
function cohort(year = 2023): FacilityYearInput[] {
  return Array.from({ length: 30 }, (_, i) =>
    record({ facilityId: 100 + i, schoolId: 100 + i, reportingYear: year, totalSiteEnergyGj: 5000 * (0.5 + i * 0.02) }),
  );
}

describe("operationCategory", () => {
  it("collapses layout-specific labels", () => {
    expect(operationCategory("School")).toBe("school");
    expect(operationCategory("Schools")).toBe("school");
    expect(operationCategory("École")).toBe("school");
    expect(operationCategory("K-12 School")).toBe("school");
    expect(operationCategory("Administrative offices and related facilities")).toBe("administrative");
    expect(operationCategory("Pre-school/Daycare")).toBe("other");
    expect(operationCategory(null)).toBe("other");
  });
});

describe("combineEntityYears", () => {
  it("merges all facilities matched to one school in a year", () => {
    const [entity] = combineEntityYears([
      record({ facilityId: 1, schoolId: 9, totalSiteEnergyGj: 3000, floorAreaM2: 4000 }),
      record({ facilityId: 2, schoolId: 9, totalSiteEnergyGj: 1000, floorAreaM2: 1000, matchConfidence: 0.95 }),
    ]);
    expect(entity).toMatchObject({ schoolId: 9, facilityId: null, facilityCount: 2, totalSiteEnergyGj: 4000, floorAreaM2: 5000, matchConfidence: 0.95 });
    expect(entity?.qualityFlags).toContain("multiple_facilities_combined");
  });

  it("makes a combined value unknown when any part is missing", () => {
    const [entity] = combineEntityYears([record({ facilityId: 1, schoolId: 9 }), record({ facilityId: 2, schoolId: 9, floorAreaM2: null })]);
    expect(entity?.floorAreaM2).toBeNull();
  });

  it("keeps unmatched facilities separate", () => {
    const entities = combineEntityYears([record({ facilityId: 1 }), record({ facilityId: 2 })]);
    expect(entities.map((e) => e.facilityId).sort()).toEqual([1, 2]);
  });
});

describe("computePeerMetrics", () => {
  it("benchmarks against peers and never against itself", () => {
    const rows = computePeerMetrics(cohort());
    const top = rows.find((r) => r.schoolId === 129)!;
    expect(top.peerCount).toBe(29);
    expect(top.euiPercentile).toBe(100);
    expect(top.peerEuis).toHaveLength(29);
    expect(top.peerEuis).toEqual([...top.peerEuis].sort((a, b) => a - b));
    expect(top.energyGapGj).toBeGreaterThan(0);
    const bottom = rows.find((r) => r.schoolId === 100)!;
    expect(bottom.euiPercentile).toBe(0);
    expect(bottom.energyGapGj).toBe(0);
  });

  it("uses only history up to each year for the trend", () => {
    const history = [2017, 2018, 2019, 2022, 2023].flatMap((year) => cohort(year));
    const rows = computePeerMetrics(history);
    expect(rows.find((r) => r.schoolId === 110 && r.reportingYear === 2023)?.trendYears).toEqual([2017, 2018, 2019, 2022, 2023]);
    expect(rows.find((r) => r.schoolId === 110 && r.reportingYear === 2018)?.trendYears).toEqual([]);
  });

  it("suppresses the score without floor area, and excludes flagged records from peer pools", () => {
    const rows = computePeerMetrics([
      ...cohort(),
      record({ facilityId: 1, schoolId: 1, floorAreaM2: null }),
      record({ facilityId: 2, schoolId: 2, totalSiteEnergyGj: 999999, qualityFlags: ["negative_energy_value"] }),
    ]);
    const missing = rows.find((r) => r.schoolId === 1)!;
    expect(missing.opportunityScore).toBeNull();
    expect(missing.scoreReasons[0]).toMatch(/floor area/);
    expect(rows.find((r) => r.schoolId === 110)!.peerEuis).not.toContain(999999 / 5000);
  });

  it("does not mix school levels", () => {
    const secondary = Array.from({ length: 5 }, (_, i) => record({ facilityId: 200 + i, schoolId: 200 + i, schoolLevel: "secondary" }));
    const rows = computePeerMetrics([...cohort(), ...secondary]);
    expect(rows.find((r) => r.schoolId === 200)!.peerCount).toBe(0);
    expect(rows.find((r) => r.schoolId === 110)!.peerCount).toBe(29);
  });
});
