"use client";

import { useMemo, useState } from "react";
import { CartesianGrid, Line, LineChart, ReferenceArea, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
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
};

type MetricKey = "totalSiteEnergyGj" | "eui" | "electricityKwh" | "naturalGasM3" | "naturalGasGj" | "ghgTonnes" | "normalizedTotalEnergyGj";

// Each metric is one unit and one data type. Gas m³ (to 2020) and gas GJ (2021+) are separate
// series, and weather-normalized energy never shares a line with raw energy.
const METRICS: { key: MetricKey; label: string; unit: string; digits: number; note?: string }[] = [
  { key: "totalSiteEnergyGj", label: "Total energy", unit: "GJ", digits: 0 },
  { key: "eui", label: "Energy intensity", unit: "GJ/m²", digits: 2 },
  { key: "electricityKwh", label: "Electricity", unit: "kWh", digits: 0 },
  { key: "naturalGasM3", label: "Natural gas (m³)", unit: "m³", digits: 0, note: "Reported in cubic metres through 2020." },
  { key: "naturalGasGj", label: "Natural gas (GJ)", unit: "GJ", digits: 0, note: "Reported in GJ from 2021; not joined to the m³ series." },
  { key: "ghgTonnes", label: "GHG emissions", unit: "t CO₂e", digits: 1 },
  {
    key: "normalizedTotalEnergyGj",
    label: "Weather-normalized energy",
    unit: "GJ",
    digits: 0,
    note: "Weather-normalized energy adjusts reported consumption to reduce the effect of differences in weather conditions between years. Shown separately from raw energy and only where the source reports it.",
  },
];

function valueOf(row: TrendRow, key: MetricKey): number | null {
  if (row.missing) return null;
  if (key === "ghgTonnes") return row.ghgKgCo2e != null ? row.ghgKgCo2e / 1000 : null;
  return row[key] ?? null;
}

export function EnergyTrendChart({ rows, title }: { rows: TrendRow[]; title: string }) {
  const available = METRICS.filter((m) => rows.some((r) => valueOf(r, m.key) !== null));
  const [selected, setSelected] = useState<MetricKey>(available[0]?.key ?? "totalSiteEnergyGj");
  const metric = available.find((m) => m.key === selected) ?? available[0];

  const data = useMemo(() => rows.map((r) => ({ year: r.year, value: metric ? valueOf(r, metric.key) : null })), [rows, metric]);
  if (!metric) return <p className="text-sm text-ink-muted">No reported values to chart.</p>;

  const points = data.filter((d) => d.value !== null);
  const first = points[0];
  const last = points.at(-1);
  const missingYears = rows.filter((r) => r.missing).map((r) => r.year);
  const hasPandemic = rows.some((r) => r.year === 2020 || r.year === 2021);

  return (
    <figure className="space-y-3">
      <div role="radiogroup" aria-label={`${title}: choose a metric`} className="flex flex-wrap gap-1.5">
        {available.map((m) => (
          <button
            key={m.key}
            type="button"
            role="radio"
            aria-checked={m.key === metric.key}
            onClick={() => setSelected(m.key)}
            className={`rounded border px-2.5 py-1 text-xs font-medium ${
              m.key === metric.key ? "border-accent bg-accent-subtle text-accent-strong" : "border-line bg-white text-ink-muted hover:text-ink"
            }`}
          >
            {m.label}
          </button>
        ))}
      </div>
      <div aria-hidden="true" className="h-64">
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={data} margin={{ top: 12, right: 12, bottom: 4, left: 4 }}>
            <CartesianGrid stroke="#e4e4e0" vertical={false} />
            <XAxis dataKey="year" tick={{ fontSize: 12, fill: "#565d66" }} />
            <YAxis
              width={64}
              tick={{ fontSize: 12, fill: "#565d66" }}
              tickFormatter={(v: number) => formatNumber(v, metric.digits > 1 ? 2 : 0)}
              domain={[0, "auto"]}
              label={{ value: metric.unit, angle: -90, position: "insideLeft", fontSize: 12, fill: "#565d66" }}
            />
            {hasPandemic && (
              <ReferenceArea x1={2020} x2={2021} fill="#b45309" fillOpacity={0.07} label={{ value: "Pandemic-affected", position: "insideTop", fontSize: 11, fill: "#b45309" }} />
            )}
            <Tooltip formatter={(v) => [`${formatNumber(Number(v), metric.digits)} ${metric.unit}`, metric.label]} labelFormatter={(y) => `Reporting year ${y}`} />
            <Line type="linear" dataKey="value" stroke="#0f766e" strokeWidth={2} dot={{ r: 3 }} connectNulls={false} isAnimationActive={false} />
          </LineChart>
        </ResponsiveContainer>
      </div>
      <figcaption className="space-y-1 text-sm text-ink-muted">
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
          <table className="min-w-[16rem] text-left">
            <caption className="sr-only">
              {title}: {metric.label} by reporting year
            </caption>
            <thead>
              <tr className="border-b border-line text-xs uppercase text-ink-muted">
                <th scope="col" className="py-1 pr-6">Year</th>
                <th scope="col" className="py-1">{metric.label} ({metric.unit})</th>
              </tr>
            </thead>
            <tbody>
              {data.map((d) => (
                <tr key={d.year} className="border-b border-line/60">
                  <th scope="row" className="num py-1 pr-6 font-normal">{d.year}</th>
                  <td className="num py-1">{d.value === null ? "Not reported" : formatNumber(d.value, metric.digits)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </details>
    </figure>
  );
}
