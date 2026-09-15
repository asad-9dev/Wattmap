/**
 * Year-by-year energy series for one school, combining every facility matched to it with the
 * same rule as the benchmark rebuild: a combined value exists only when every part is reported.
 */

import { electricityIntensity, energyUseIntensity, ghgIntensity } from "./formulas";
import { PANDEMIC_YEARS } from "./score";

export type YearlyRecordInput = {
  reportingYear: number;
  reportingPeriodEnd: string | null;
  totalSiteEnergyGj: number | null;
  normalizedTotalEnergyGj: number | null;
  electricityKwh: number | null;
  naturalGasGj: number | null;
  naturalGasM3: number | null;
  ghgKgCo2e: number | null;
  floorAreaM2: number | null;
  weeklyHours: number | null;
  portableCount: number | null;
  operationType: string | null;
  dataQualityFlags: string[];
  sourceResource: string | null;
};

export type YearlyEnergy = {
  year: number;
  periodEnd: string | null;
  facilityCount: number;
  totalSiteEnergyGj: number | null;
  normalizedTotalEnergyGj: number | null;
  electricityKwh: number | null;
  naturalGasGj: number | null;
  naturalGasM3: number | null;
  ghgKgCo2e: number | null;
  floorAreaM2: number | null;
  weeklyHours: number | null;
  portableCount: number | null;
  operationType: string | null;
  eui: number | null;
  ghgIntensity: number | null;
  electricityIntensity: number | null;
  /** Total energy recovered from the ministry's reported GJ/m² × floor area (2011–2020). */
  totalDerived: boolean;
  pandemicAffected: boolean;
  qualityFlags: string[];
  sources: string[];
};

function sumAll(values: (number | null)[]): number | null {
  return values.some((v) => v === null) ? null : values.reduce<number>((sum, v) => sum + v!, 0);
}

export function combineYearly(records: readonly YearlyRecordInput[]): YearlyEnergy[] {
  const byYear = new Map<number, YearlyRecordInput[]>();
  for (const record of records) byYear.set(record.reportingYear, [...(byYear.get(record.reportingYear) ?? []), record]);
  return [...byYear.entries()]
    .sort(([a], [b]) => a - b)
    .map(([year, group]) => {
      const single = group.length === 1 ? group[0]! : null;
      const total = sumAll(group.map((r) => r.totalSiteEnergyGj));
      const area = sumAll(group.map((r) => r.floorAreaM2));
      const ghg = sumAll(group.map((r) => r.ghgKgCo2e));
      const electricity = sumAll(group.map((r) => r.electricityKwh));
      const flags = new Set(group.flatMap((r) => r.dataQualityFlags));
      return {
        year,
        periodEnd: group[0]!.reportingPeriodEnd,
        facilityCount: group.length,
        totalSiteEnergyGj: total,
        normalizedTotalEnergyGj: sumAll(group.map((r) => r.normalizedTotalEnergyGj)),
        electricityKwh: electricity,
        naturalGasGj: sumAll(group.map((r) => r.naturalGasGj)),
        naturalGasM3: sumAll(group.map((r) => r.naturalGasM3)),
        ghgKgCo2e: ghg,
        floorAreaM2: area,
        weeklyHours: single?.weeklyHours ?? null,
        portableCount: single?.portableCount ?? null,
        operationType: single?.operationType ?? group[0]!.operationType,
        eui: energyUseIntensity(total, area),
        ghgIntensity: ghgIntensity(ghg, area),
        electricityIntensity: electricityIntensity(electricity, area),
        totalDerived: flags.has("total_energy_derived_from_reported_intensity"),
        pandemicAffected: PANDEMIC_YEARS.has(year),
        qualityFlags: [...flags],
        sources: [...new Set(group.map((r) => r.sourceResource).filter((s): s is string => s !== null))],
      };
    });
}

/**
 * Chart rows for every year in [first, last] reported year. Years without a report get null
 * values so the chart breaks the line instead of implying data exists.
 */
export function withYearGaps<T extends { year: number }>(series: readonly T[]): (T | { year: number; missing: true })[] {
  if (series.length === 0) return [];
  const byYear = new Map(series.map((point) => [point.year, point]));
  const rows: (T | { year: number; missing: true })[] = [];
  for (let year = series[0]!.year; year <= series[series.length - 1]!.year; year += 1) {
    rows.push(byYear.get(year) ?? { year, missing: true });
  }
  return rows;
}
