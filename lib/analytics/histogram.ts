export type Bin = { from: number; to: number; count: number; openEnded: boolean };

/**
 * Equal-width bins from 0 to the 99th percentile; the few values above it share a final
 * open-ended bin so one extreme building cannot flatten the whole chart.
 */
export function histogram(values: readonly number[], binCount = 24, clip = 0.99): Bin[] {
  const sorted = values.filter((v) => Number.isFinite(v) && v >= 0).sort((a, b) => a - b);
  if (sorted.length === 0) return [];
  const ceiling = sorted[Math.min(sorted.length - 1, Math.floor(clip * (sorted.length - 1)))]!;
  if (ceiling === 0) return [{ from: 0, to: 0, count: sorted.length, openEnded: false }];
  const width = ceiling / binCount;
  const bins: Bin[] = Array.from({ length: binCount }, (_, i) => ({ from: i * width, to: (i + 1) * width, count: 0, openEnded: false }));
  const overflow: Bin = { from: ceiling, to: sorted[sorted.length - 1]!, count: 0, openEnded: true };
  for (const value of sorted) {
    if (value > ceiling) overflow.count += 1;
    else bins[Math.min(binCount - 1, Math.floor(value / width))]!.count += 1;
  }
  return overflow.count > 0 ? [...bins, overflow] : bins;
}
