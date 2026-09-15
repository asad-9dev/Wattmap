import { describe, expect, it } from "vitest";
import {
  MISSING,
  formatEui,
  formatGhgIntensity,
  formatGj,
  formatKwhPerM2,
  formatPercentile,
  formatSignedPercent,
  formatTonnesCo2e,
  formatYearRange,
  ordinal,
} from "../../lib/format";

describe("formatting", () => {
  it("matches the spec's examples", () => {
    expect(formatGj(1240)).toBe("1,240 GJ");
    expect(formatKwhPerM2(142)).toBe("142 kWh/m²");
    expect(formatGhgIntensity(18.4)).toBe("18.4 kg CO₂e/m²");
    expect(formatPercentile(72)).toBe("72nd percentile");
    expect(formatSignedPercent(4.2)).toBe("+4.2%");
    expect(formatSignedPercent(-7.8)).toBe("−7.8%");
  });
  it("uses sensible precision", () => {
    expect(formatEui(0.8234)).toBe("0.82 GJ/m²");
    expect(formatGj(12.34)).toBe("12.3 GJ");
    expect(formatTonnesCo2e(184000)).toBe("184 t CO₂e");
    expect(formatSignedPercent(-0.01)).toBe("0.0%");
  });
  it("renders ordinals", () => {
    expect([1, 2, 3, 4, 11, 12, 13, 21, 22, 101, 111].map(ordinal)).toEqual([
      "1st", "2nd", "3rd", "4th", "11th", "12th", "13th", "21st", "22nd", "101st", "111th",
    ]);
  });
  it("shows a dash for missing values", () => {
    expect(formatGj(null)).toBe(MISSING);
    expect(formatEui(Number.NaN)).toBe(MISSING);
    expect(formatPercentile(undefined)).toBe(MISSING);
    expect(formatYearRange([])).toBe(MISSING);
  });
  it("formats year ranges", () => {
    expect(formatYearRange([2023, 2011, 2019])).toBe("2011–2023");
    expect(formatYearRange([2023])).toBe("2023");
  });
});
