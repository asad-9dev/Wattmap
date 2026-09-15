"use client";

import { useState } from "react";
import { CartesianGrid, Legend, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { tooltipStyles, useChartColors, useResolvedTheme } from "@/components/theme/useTheme";
import { formatNumber } from "@/lib/format";

type Metric = "eui" | "ghgIntensity";
const METRICS: Record<Metric, { label: string; unit: string; digits: number }> = {
  eui: { label: "Energy intensity", unit: "GJ/m²", digits: 2 },
  ghgIntensity: { label: "GHG intensity", unit: "kg CO₂e/m²", digits: 1 },
};

// Distinct hues per theme, plus dash patterns, so series never depend on colour alone.
const SERIES = {
  light: ["rgb(4 120 87)", "rgb(180 83 9)", "rgb(47 102 144)", "rgb(109 40 217)"],
  dark: ["rgb(52 211 153)", "rgb(251 191 36)", "rgb(140 195 234)", "rgb(196 181 253)"],
};
const DASHES = ["", "6 3", "2 3", "8 3 2 3"];

type SchoolSeries = { name: string; points: { year: number; eui: number | null; ghgIntensity: number | null }[] };

export function CompareChart({ schools }: { schools: SchoolSeries[] }) {
  const colors = useChartColors();
  const palette = SERIES[useResolvedTheme()];
  const [metric, setMetric] = useState<Metric>("eui");
  const meta = METRICS[metric];
  const years = [...new Set(schools.flatMap((s) => s.points.map((p) => p.year)))].sort((a, b) => a - b);
  const rows = years.map((year) => {
    const row: Record<string, number | null> = { year };
    schools.forEach((s, i) => {
      row[`s${i}`] = s.points.find((p) => p.year === year)?.[metric] ?? null;
    });
    return row;
  });
  const latest = schools.map((s) => {
    const last = [...s.points].reverse().find((p) => p[metric] !== null);
    return `${s.name}: ${last ? `${formatNumber(last[metric], meta.digits)} ${meta.unit} in ${last.year}` : "not reported"}`;
  });

  return (
    <figure className="space-y-3">
      <div role="radiogroup" aria-label="Metric to compare" className="flex flex-wrap gap-1.5">
        {(Object.keys(METRICS) as Metric[]).map((key) => (
          <button
            key={key}
            type="button"
            role="radio"
            aria-checked={metric === key}
            onClick={() => setMetric(key)}
            className={`min-h-[32px] cursor-pointer rounded-md border px-2.5 text-xs font-medium transition-colors duration-150 ${
              metric === key ? "border-accent bg-accent-subtle text-accent-strong" : "border-line bg-surface text-ink-muted hover:border-line-strong hover:text-ink"
            }`}
          >
            {METRICS[key].label}
          </button>
        ))}
      </div>
      <div aria-hidden="true" className="h-72">
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={rows} margin={{ top: 8, right: 12, bottom: 4, left: 4 }}>
            <CartesianGrid stroke={colors.grid} vertical={false} />
            <XAxis dataKey="year" tick={{ fontSize: 12, fill: colors.muted }} stroke={colors.lineStrong} />
            <YAxis
              width={60}
              domain={[0, "auto"]}
              tickFormatter={(v: number) => formatNumber(v, meta.digits > 1 ? 2 : 0)}
              tick={{ fontSize: 12, fill: colors.muted }}
              stroke={colors.lineStrong}
              label={{ value: meta.unit, angle: -90, position: "insideLeft", fontSize: 12, fill: colors.muted }}
            />
            <Tooltip formatter={(v) => `${formatNumber(Number(v), meta.digits)} ${meta.unit}`} labelFormatter={(y) => `Reporting year ${y}`} {...tooltipStyles(colors)} />
            <Legend wrapperStyle={{ fontSize: 12, color: colors.ink }} />
            {schools.map((s, i) => (
              <Line
                key={s.name}
                name={s.name}
                dataKey={`s${i}`}
                stroke={palette[i]}
                strokeDasharray={DASHES[i]}
                strokeWidth={2}
                dot={{ r: 2.5, fill: palette[i] }}
                connectNulls={false}
                isAnimationActive={false}
              />
            ))}
          </LineChart>
        </ResponsiveContainer>
      </div>
      <figcaption className="text-[13px] leading-5 text-ink-muted">
        <span className="sr-only">Latest {meta.label.toLowerCase()}: {latest.join("; ")}. </span>
        Line styles differ per school as well as colour. Gaps are years without a report; 2020–2021 were pandemic-affected for every school.
      </figcaption>
    </figure>
  );
}
