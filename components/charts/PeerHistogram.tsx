"use client";

import { Bar, BarChart, CartesianGrid, ReferenceArea, ReferenceLine, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { tooltipStyles, useChartColors } from "@/components/theme/useTheme";
import { histogram } from "@/lib/analytics/histogram";
import { formatNumber } from "@/lib/format";

type Props = { peerEuis: number[]; target: number; q25: number | null; median: number | null; q75: number | null };

/**
 * Peer distribution as bars (how many comparable schools fall in each EUI range), with the
 * middle half shaded, the median dashed, and the school marked in amber. Decorative for screen
 * readers: the surrounding panel states the same facts in text.
 */
export function PeerHistogram({ peerEuis, target, q25, median, q75 }: Props) {
  const colors = useChartColors();
  const bins = histogram([...peerEuis, target], 18);
  const rows = bins.map((bin) => ({
    mid: (bin.from + bin.to) / 2,
    count: bin.count - (target >= bin.from && (target < bin.to || (bin.openEnded && target >= bin.from)) ? 1 : 0),
    label: bin.openEnded ? `≥ ${formatNumber(bin.from, 2)}` : `${formatNumber(bin.from, 2)}–${formatNumber(bin.to, 2)}`,
  }));
  return (
    <div aria-hidden="true" className="h-56">
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={rows} margin={{ top: 18, right: 8, bottom: 18, left: 0 }} barCategoryGap={1}>
          <CartesianGrid vertical={false} stroke={colors.grid} />
          {q25 !== null && q75 !== null && <ReferenceArea x1={q25} x2={q75} fill={colors.band} fillOpacity={0.7} ifOverflow="extendDomain" />}
          <XAxis
            dataKey="mid"
            type="number"
            domain={[0, "dataMax"]}
            tickFormatter={(v: number) => formatNumber(v, 1)}
            tick={{ fontSize: 12, fill: colors.muted }}
            stroke={colors.lineStrong}
            label={{ value: "Energy Use Intensity (GJ/m²)", position: "insideBottom", offset: -12, fontSize: 12, fill: colors.muted }}
          />
          <YAxis allowDecimals={false} width={36} tick={{ fontSize: 12, fill: colors.muted }} stroke={colors.lineStrong} />
          <Tooltip
            cursor={{ fill: colors.cursor }}
            formatter={(value) => [`${value} schools`, "Peers"]}
            labelFormatter={(_, payload) => `${payload?.[0]?.payload?.label ?? ""} GJ/m²`}
            {...tooltipStyles(colors)}
          />
          <Bar dataKey="count" fill={colors.bar} fillOpacity={0.85} radius={[2, 2, 0, 0]} isAnimationActive={false} />
          {median !== null && (
            <ReferenceLine x={median} stroke={colors.ink} strokeDasharray="4 3" label={{ value: "Median", position: "top", fontSize: 11, fill: colors.ink }} />
          )}
          <ReferenceLine x={target} stroke={colors.signalHigh} strokeWidth={2.5} label={{ value: "This school", position: "top", fontSize: 11, fontWeight: 600, fill: colors.signalHigh }} />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}
