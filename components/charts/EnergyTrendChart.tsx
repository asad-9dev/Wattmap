"use client";

import { useMemo, useState } from "react";
import { CartesianGrid, Line, LineChart, ReferenceArea, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { tooltipStyles, useChartColors } from "@/components/theme/useTheme";
import { formatNumber } from "@/lib/format";

export type TrendRow = {
  year: number;
  missing?: true;
  totalSiteEnergyGj?: number | null;
  normalizedTotalEnergyGj?: number | null;
  eui?: number | null;
  electricityKwh?: number | null;
  naturalGasM3?: number | null;
  naturalGasGj?: number | null;
  ghgKgCo2e?: number | null;
  ghgIntensity?: number | null;
};

export type MetricKey =
  | "totalSiteEnergyGj"
  | "eui"
  | "electricityKwh"
  | "naturalGasM3"
  | "naturalGasGj"
  | "ghgTonnes"
  | "ghgIntensity"
  | "normalizedTotalEnergyGj";

// Each metric is one unit and one data type. Gas m³ (to 2020) and gas GJ (2021+) are separate
// series, and weather-normalized energy never shares a line with raw energy.
const METRICS: Record<MetricKey, { label: string; unit: string; digits: number; note?: string }> = {
  totalSiteEnergyGj: { label: "Total energy", unit: "GJ", digits: 0 },
  eui: { label: "Energy intensity", unit: "GJ/m²", digits: 2 },
  electricityKwh: { label: "Electricity", unit: "kWh", digits: 0 },
  naturalGasM3: { label: "Natural gas (m³)", unit: "m³", digits: 0, note: "Reported in cubic metres through 2020." },
  naturalGasGj: { label: "Natural gas (GJ)", unit: "GJ", digits: 0, note: "Reported in GJ from 2021; not joined to the m³ series." },
  ghgTonnes: { label: "GHG emissions", unit: "t CO₂e", digits: 1 },
  ghgIntensity: { label: "GHG intensity", unit: "kg CO₂e/m²", digits: 1 },
  normalizedTotalEnergyGj: {
    label: "Weather-normalized energy",
    unit: "GJ",
    digits: 0,
    note: "Weather-normalized energy adjusts reported consumption to reduce the effect of differences in weather conditions between years. Shown separately from raw energy and only where the source reports it.",
  },
};

const DEFAULT_METRICS: MetricKey[] = ["totalSiteEnergyGj", "eui", "electricityKwh", "naturalGasM3", "naturalGasGj", "ghgTonnes", "normalizedTotalEnergyGj"];

function valueOf(row: TrendRow, key: MetricKey): number | null {
  if (row.missing) return null;
  if (key === "ghgTonnes") return row.ghgKgCo2e != null ? row.ghgKgCo2e / 1000 : null;
  return row[key] ?? null;
}

export function EnergyTrendChart({
  rows,
  title,
  metrics = DEFAULT_METRICS,
  height = 256,
}: {
  rows: TrendRow[];
  title: string;
  metrics?: MetricKey[];
  height?: number;
}) {
  const colors = useChartColors();
  const available = metrics.filter((key) => rows.some((r) => valueOf(r, key) !== null));
  const [selected, setSelected] = useState<MetricKey | undefined>(available[0]);
  const key = selected && available.includes(selected) ? selected : available[0];

  const data = useMemo(() => rows.map((r) => ({ year: r.year, value: key ? valueOf(r, key) : null })), [rows, key]);
  if (!key) return <p className="text-sm text-ink-muted">No reported values to chart.</p>;
  const metric = METRICS[key];

  const points = data.filter((d) => d.value !== null);
  const first = points[0];
  const last = points.at(-1);
  const missingYears = rows.filter((r) => r.missing).map((r) => r.year);
  const hasPandemic = rows.some((r) => r.year === 2020 || r.year === 2021);

  return (
    <figure className="space-y-3">
      {available.length > 1 && (
        <div role="radiogroup" aria-label={`${title}: choose a metric`} className="flex flex-wrap gap-1.5">
          {available.map((option) => (
            <button
              key={option}
              type="button"
              role="radio"
              aria-checked={option === key}
              onClick={() => setSelected(option)}
              className={`min-h-[32px] cursor-pointer rounded-md border px-2.5 text-xs font-medium transition-colors duration-150 ${
                option === key ? "border-accent bg-accent-subtle text-accent-strong" : "border-line bg-surface text-ink-muted hover:border-line-strong hover:text-ink"
              }`}
            >
              {METRICS[option].label}
            </button>
          ))}
        </div>
      )}
      <div aria-hidden="true" style={{ height }}>
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={data} margin={{ top: 12, right: 12, bottom: 4, left: 4 }}>
            <CartesianGrid stroke={colors.grid} vertical={false} />
            <XAxis dataKey="year" tick={{ fontSize: 12, fill: colors.muted }} stroke={colors.lineStrong} tickMargin={6} />
            <YAxis
              width={64}
              tick={{ fontSize: 12, fill: colors.muted }}
              stroke={colors.lineStrong}
              tickFormatter={(v: number) => formatNumber(v, metric.digits > 1 ? 2 : 0)}
              domain={[0, "auto"]}
              label={{ value: metric.unit, angle: -90, position: "insideLeft", fontSize: 12, fill: colors.muted }}
            />
            {hasPandemic && (
              <ReferenceArea x1={2020} x2={2021} fill={colors.signalHigh} fillOpacity={0.08} label={{ value: "Pandemic-affected", position: "insideTop", fontSize: 11, fill: colors.signalHigh }} />
            )}
            <Tooltip
              formatter={(v) => [`${formatNumber(Number(v), metric.digits)} ${metric.unit}`, metric.label]}
              labelFormatter={(y) => `Reporting year ${y}`}
              {...tooltipStyles(colors)}
            />
            <Line type="linear" dataKey="value" stroke={colors.accent} strokeWidth={2} dot={{ r: 3, fill: colors.accent }} activeDot={{ r: 5 }} connectNulls={false} isAnimationActive={false} />
          </LineChart>
        </ResponsiveContainer>
      </div>
      <figcaption className="space-y-1 text-[13px] leading-5 text-ink-muted">
        <p>
          {metric.label} ({metric.unit}):{" "}
          {first && last && first !== last
            ? `${formatNumber(first.value, metric.digits)} in ${first.year}, ${formatNumber(last.value, metric.digits)} in ${last.year}.`
            : last
              ? `${formatNumber(last.value, metric.digits)} in ${last.year}.`
              : "not reported."}
          {missingYears.length > 0 && ` No report for ${missingYears.join(", ")}; the line is broken there rather than interpolated.`}
        </p>
        {metric.note && <p>{metric.note}</p>}
      </figcaption>
      <details className="text-sm">
        <summary className="cursor-pointer text-accent-strong">View data table</summary>
        <div className="mt-2 overflow-x-auto">
          <table className="table-dense min-w-[16rem]">
            <caption className="sr-only">
              {title}: {metric.label} by reporting year
            </caption>
            <thead>
              <tr>
                <th scope="col">Year</th>
                <th scope="col" className="text-right">
                  {metric.label} ({metric.unit})
                </th>
              </tr>
            </thead>
            <tbody>
              {data.map((d) => (
                <tr key={d.year}>
                  <th scope="row" className="num font-normal">
                    {d.year}
                  </th>
                  <td className="num text-right">{d.value === null ? "Not reported" : formatNumber(d.value, metric.digits)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </details>
    </figure>
  );
}
