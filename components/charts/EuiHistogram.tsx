"use client";

import { Bar, BarChart, CartesianGrid, ReferenceLine, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { tooltipStyles, useChartColors } from "@/components/theme/useTheme";
import type { Bin } from "@/lib/analytics/histogram";
import { formatNumber } from "@/lib/format";

type Props = { bins: Bin[]; median?: number | null; highlight?: { value: number; label: string } | null; height?: number };

export function EuiHistogram({ bins, median, highlight, height = 220 }: Props) {
  const colors = useChartColors();
  const rows = bins.map((bin) => ({
    mid: (bin.from + bin.to) / 2,
    count: bin.count,
    label: bin.openEnded ? `≥ ${formatNumber(bin.from, 2)}` : `${formatNumber(bin.from, 2)}–${formatNumber(bin.to, 2)}`,
  }));
  return (
    <div aria-hidden="true" style={{ height }}>
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={rows} margin={{ top: 16, right: 8, bottom: 20, left: 0 }} barCategoryGap={1}>
          <CartesianGrid vertical={false} stroke={colors.grid} />
          <XAxis
            dataKey="mid"
            type="number"
            domain={[0, "dataMax"]}
            tickFormatter={(value: number) => formatNumber(value, 1)}
            tick={{ fontSize: 12, fill: colors.muted }}
            stroke={colors.lineStrong}
            label={{ value: "Energy Use Intensity (GJ/m²)", position: "insideBottom", offset: -12, fontSize: 12, fill: colors.muted }}
          />
          <YAxis allowDecimals={false} width={40} tick={{ fontSize: 12, fill: colors.muted }} stroke={colors.lineStrong} />
          <Tooltip
            cursor={{ fill: colors.cursor }}
            formatter={(value) => [`${value} schools`, "Count"]}
            labelFormatter={(_, payload) => `${payload?.[0]?.payload?.label ?? ""} GJ/m²`}
            {...tooltipStyles(colors)}
          />
          <Bar dataKey="count" fill={colors.bar} fillOpacity={0.85} radius={[2, 2, 0, 0]} isAnimationActive={false} />
          {median != null && (
            <ReferenceLine x={median} stroke={colors.ink} strokeDasharray="4 3" label={{ value: "Median", position: "top", fontSize: 11, fill: colors.ink }} />
          )}
          {highlight && (
            <ReferenceLine x={highlight.value} stroke={colors.signalHigh} strokeWidth={2} label={{ value: highlight.label, position: "top", fontSize: 11, fill: colors.signalHigh }} />
          )}
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}
