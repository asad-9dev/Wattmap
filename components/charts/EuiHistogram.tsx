"use client";

import { Bar, BarChart, CartesianGrid, ReferenceLine, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import type { Bin } from "@/lib/analytics/histogram";
import { formatNumber } from "@/lib/format";

type Props = { bins: Bin[]; median?: number | null; highlight?: { value: number; label: string } | null; height?: number };

export function EuiHistogram({ bins, median, highlight, height = 220 }: Props) {
  const rows = bins.map((bin) => ({
    mid: (bin.from + bin.to) / 2,
    count: bin.count,
    label: bin.openEnded ? `≥ ${formatNumber(bin.from, 2)}` : `${formatNumber(bin.from, 2)}–${formatNumber(bin.to, 2)}`,
  }));
  const tick = (value: number) => formatNumber(value, 1);
  return (
    <div aria-hidden="true" style={{ height }}>
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={rows} margin={{ top: 16, right: 8, bottom: 20, left: 0 }} barCategoryGap={1}>
          <CartesianGrid vertical={false} stroke="#dce2de" />
          <XAxis
            dataKey="mid"
            type="number"
            domain={[0, "dataMax"]}
            tickFormatter={tick}
            tick={{ fontSize: 12, fill: "#56615b" }}
            label={{ value: "Energy Use Intensity (GJ/m²)", position: "insideBottom", offset: -12, fontSize: 12, fill: "#56615b" }}
          />
          <YAxis allowDecimals={false} width={40} tick={{ fontSize: 12, fill: "#56615b" }} />
          <Tooltip
            cursor={{ fill: "rgba(4,120,87,0.06)" }}
            formatter={(value) => [`${value} schools`, "Count"]}
            labelFormatter={(_, payload) => `${payload?.[0]?.payload?.label ?? ""} GJ/m²`}
          />
          <Bar dataKey="count" fill="#047857" fillOpacity={0.75} />
          {median != null && (
            <ReferenceLine x={median} stroke="#14201a" strokeDasharray="4 3" label={{ value: "Median", position: "top", fontSize: 11, fill: "#14201a" }} />
          )}
          {highlight && (
            <ReferenceLine x={highlight.value} stroke="#b45309" strokeWidth={2} label={{ value: highlight.label, position: "top", fontSize: 11, fill: "#b45309" }} />
          )}
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}
