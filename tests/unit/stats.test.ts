import { describe, expect, it } from "vitest";
import { linearSlope, median, medianAbsoluteDeviation, percentileRank, quantile, robustZ } from "../../lib/analytics/stats";

describe("quantile", () => {
  it("interpolates linearly (type 7)", () => {
    expect(quantile([1, 2, 3, 4], 0.25)).toBeCloseTo(1.75);
    expect(quantile([1, 2, 3, 4], 0.5)).toBeCloseTo(2.5);
    expect(quantile([10], 0.9)).toBe(10);
  });
  it("ignores non-finite values and rejects bad input", () => {
    expect(median([3, Number.NaN, 1, Infinity, 2])).toBe(2);
    expect(quantile([], 0.5)).toBeNull();
    expect(quantile([1, 2], 1.5)).toBeNull();
  });
});

describe("percentileRank", () => {
  it("measures the share of peers the value exceeds", () => {
    const peers = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10];
    expect(percentileRank(8.5, peers)).toBe(80);
    expect(percentileRank(0, peers)).toBe(0);
    expect(percentileRank(11, peers)).toBe(100);
  });
  it("counts ties as half", () => {
    expect(percentileRank(5, [5, 5, 5, 5])).toBe(50);
    expect(percentileRank(2, [1, 2, 2, 3])).toBe(50);
  });
  it("returns null without usable peers", () => {
    expect(percentileRank(1, [])).toBeNull();
    expect(percentileRank(Number.NaN, [1, 2])).toBeNull();
  });
});

describe("robustZ", () => {
  it("uses 0.6745 · (x − median) / MAD", () => {
    const peers = [1, 2, 3, 4, 5, 6, 7, 8, 9];
    expect(medianAbsoluteDeviation(peers)).toBe(2);
    expect(robustZ(9, peers)).toBeCloseTo((0.6745 * 4) / 2);
  });
  it("falls back to mean absolute deviation when MAD is 0", () => {
    const peers = [5, 5, 5, 5, 5, 6, 10];
    expect(medianAbsoluteDeviation(peers)).toBe(0);
    const meanAd = (0 + 0 + 0 + 0 + 0 + 1 + 5) / 7;
    expect(robustZ(10, peers)).toBeCloseTo(5 / (Math.sqrt(Math.PI / 2) * meanAd));
  });
  it("handles identical peers without dividing by zero", () => {
    expect(robustZ(5, [5, 5, 5])).toBe(0);
    expect(robustZ(6, [5, 5, 5])).toBeNull();
  });
});

describe("linearSlope", () => {
  it("fits least squares", () => {
    expect(linearSlope([{ x: 0, y: 1 }, { x: 1, y: 3 }, { x: 2, y: 5 }])).toBeCloseTo(2);
  });
  it("needs two distinct x values", () => {
    expect(linearSlope([{ x: 1, y: 1 }])).toBeNull();
    expect(linearSlope([{ x: 1, y: 1 }, { x: 1, y: 2 }])).toBeNull();
  });
});
