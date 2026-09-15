import { describe, expect, it } from "vitest";
import {
  KWH_PER_GJ,
  electricityIntensity,
  energyGapToPeerMedian,
  energyUseIntensity,
  ghgIntensity,
  naturalGasIntensity,
  toKwhEquivalent,
} from "../../lib/analytics/metrics";

describe("energyUseIntensity", () => {
  it("divides total site energy by floor area", () => {
    expect(energyUseIntensity(8420, 10268)).toBeCloseTo(0.82, 2);
  });
  it("refuses missing, zero, or negative inputs", () => {
    expect(energyUseIntensity(null, 100)).toBeNull();
    expect(energyUseIntensity(100, null)).toBeNull();
    expect(energyUseIntensity(100, 0)).toBeNull();
    expect(energyUseIntensity(100, -5)).toBeNull();
    expect(energyUseIntensity(-1, 100)).toBeNull();
    expect(energyUseIntensity(Number.NaN, 100)).toBeNull();
  });
  it("allows zero energy", () => {
    expect(energyUseIntensity(0, 100)).toBe(0);
  });
});

describe("toKwhEquivalent", () => {
  it("uses 1 GJ = 277.78 kWh", () => {
    expect(KWH_PER_GJ).toBeCloseTo(277.7777778, 6);
    expect(toKwhEquivalent(0.82)).toBeCloseTo(227.78, 2);
    expect(toKwhEquivalent(null)).toBeNull();
  });
});

describe("per-area intensities", () => {
  it("compute kg CO₂e/m², kWh/m², and GJ/m²", () => {
    expect(ghgIntensity(184000, 10000)).toBeCloseTo(18.4);
    expect(electricityIntensity(1420000, 10000)).toBeCloseTo(142);
    expect(naturalGasIntensity(5000, 10000)).toBeCloseTo(0.5);
    expect(ghgIntensity(100, 0)).toBeNull();
  });
});

describe("energyGapToPeerMedian", () => {
  it("scales the EUI excess by floor area", () => {
    expect(energyGapToPeerMedian(0.82, 0.7, 10000)).toBeCloseTo(1200);
  });
  it("is zero at or below the median", () => {
    expect(energyGapToPeerMedian(0.6, 0.7, 10000)).toBe(0);
    expect(energyGapToPeerMedian(0.7, 0.7, 10000)).toBe(0);
  });
  it("is null without a valid area or median", () => {
    expect(energyGapToPeerMedian(0.8, null, 10000)).toBeNull();
    expect(energyGapToPeerMedian(0.8, 0.7, 0)).toBeNull();
  });
});
