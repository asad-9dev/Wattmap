/** Display formatting. Values are stored at full precision; rounding happens only here. */

export const MISSING = "—";
const MINUS = "−";

type Maybe = number | null | undefined;

function valid(value: Maybe): value is number {
  return typeof value === "number" && Number.isFinite(value);
}

export function formatNumber(value: Maybe, digits = 0): string {
  if (!valid(value)) return MISSING;
  return new Intl.NumberFormat("en-CA", { minimumFractionDigits: digits, maximumFractionDigits: digits })
    .format(value)
    .replace("-", MINUS);
}

export function formatGj(value: Maybe): string {
  return valid(value) ? `${formatNumber(value, Math.abs(value) < 100 ? 1 : 0)} GJ` : MISSING;
}

export function formatEui(value: Maybe): string {
  return valid(value) ? `${formatNumber(value, 2)} GJ/m²` : MISSING;
}

/** Energy-equivalent kWh per m² — total energy in kWh units, not electricity. */
export function formatEkwhPerM2(value: Maybe): string {
  return valid(value) ? `${formatNumber(value, 0)} ekWh/m²` : MISSING;
}

export function formatKwhPerM2(value: Maybe): string {
  return valid(value) ? `${formatNumber(value, 0)} kWh/m²` : MISSING;
}

export function formatKwh(value: Maybe): string {
  return valid(value) ? `${formatNumber(value, 0)} kWh` : MISSING;
}

export function formatGhgIntensity(value: Maybe): string {
  return valid(value) ? `${formatNumber(value, 1)} kg CO₂e/m²` : MISSING;
}

export function formatTonnesCo2e(kg: Maybe): string {
  if (!valid(kg)) return MISSING;
  const tonnes = kg / 1000;
  return `${formatNumber(tonnes, Math.abs(tonnes) < 100 ? 1 : 0)} t CO₂e`;
}

export function formatArea(m2: Maybe): string {
  return valid(m2) ? `${formatNumber(m2, 0)} m²` : MISSING;
}

/** Split "1,240 GJ" into { value: "1,240", unit: "GJ" } so the unit can be typeset smaller. */
export function splitUnit(formatted: string): { value: string; unit: string } {
  const match = /^([+−-]?[\d,.]+)\s+(.+)$/.exec(formatted);
  return match ? { value: match[1]!, unit: match[2]! } : { value: formatted, unit: "" };
}

export function ordinal(n: number): string {
  const rounded = Math.round(n);
  const lastTwo = rounded % 100;
  if (lastTwo >= 11 && lastTwo <= 13) return `${rounded}th`;
  return `${rounded}${{ 1: "st", 2: "nd", 3: "rd" }[rounded % 10] ?? "th"}`;
}

export function formatPercentile(value: Maybe): string {
  return valid(value) ? `${ordinal(value)} percentile` : MISSING;
}

/** "+4.2%", "−7.8%", "0.0%" — a true minus sign, and an explicit plus for increases. */
export function formatSignedPercent(value: Maybe, digits = 1): string {
  if (!valid(value)) return MISSING;
  const rounded = Number(value.toFixed(digits));
  const sign = rounded > 0 ? "+" : rounded < 0 ? MINUS : "";
  return `${sign}${formatNumber(Math.abs(rounded), digits)}%`;
}

export function formatYearRange(years: readonly number[]): string {
  if (years.length === 0) return MISSING;
  const first = Math.min(...years);
  const last = Math.max(...years);
  return first === last ? String(first) : `${first}–${last}`;
}

const LEVEL_LABELS: Record<string, string> = {
  elementary: "Elementary school",
  secondary: "Secondary school",
  combined: "Elementary and secondary school",
};

export function formatSchoolLevel(level: string | null | undefined): string {
  return level ? (LEVEL_LABELS[level] ?? level) : "School level not reported";
}
