"use client";

import { CartesianGrid, Legend, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { formatNumber } from "@/lib/format";

export const SERIES_COLORS = ["#047857", "#b45309", "#2f6f9f", "#7c3aed"];
const DASHES = ["", "6 3", "2 3", "8 3 2 3"];

/** One EUI line per school; distinct dash patterns so the series never depend on colour alone. */
export function CompareChart({ schools }: { schools: { name: string; points: { year: number; eui: number | null }[] }[] }) {
  const years = [...new Set(schools.flatMap((s) => s.points.map((p) => p.year)))].sort((a, b) => a - b);
  const rows = years.map((year) => {
    const row: Record<string, number | null> = { year };
    schools.forEach((s, i) => {
      row[`s${i}`] = s.points.find((p) => p.year === year)?.eui ?? null;
    });
    return row;
  });
  return (
    <div aria-hidden="true" className="h-72">
      <ResponsiveContainer width="100%" height="100%">
        <LineChart data={rows} margin={{ top: 8, right: 12, bottom: 4, left: 4 }}>
          <CartesianGrid stroke="#dce2de" vertical={false} />
          <XAxis dataKey="year" tick={{ fontSize: 12, fill: "#56615b" }} />
          <YAxis width={56} domain={[0, "auto"]} tickFormatter={(v: number) => formatNumber(v, 2)} tick={{ fontSize: 12, fill: "#56615b" }} label={{ value: "GJ/m²", angle: -90, position: "insideLeft", fontSize: 12, fill: "#56615b" }} />
          <Tooltip formatter={(v) => `${formatNumber(Number(v), 2)} GJ/m²`} labelFormatter={(y) => `Reporting year ${y}`} />
          <Legend wrapperStyle={{ fontSize: 12 }} />
          {schools.map((s, i) => (
            <Line key={s.name} name={s.name} dataKey={`s${i}`} stroke={SERIES_COLORS[i]} strokeDasharray={DASHES[i]} strokeWidth={2} dot={{ r: 2.5 }} connectNulls={false} isAnimationActive={false} />
          ))}
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}
