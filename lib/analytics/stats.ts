/** Pure statistical helpers used by peer benchmarking and anomaly screening. */

function finiteSorted(values: readonly number[]): number[] {
  return values.filter(Number.isFinite).sort((a, b) => a - b);
}

/** Linear-interpolated quantile (Hyndman–Fan type 7, the default in NumPy and R). */
export function quantile(values: readonly number[], q: number): number | null {
  const sorted = finiteSorted(values);
  if (sorted.length === 0 || !(q >= 0 && q <= 1)) return null;
  const position = (sorted.length - 1) * q;
  const lower = sorted[Math.floor(position)]!;
  const upper = sorted[Math.ceil(position)]!;
  return lower + (upper - lower) * (position - Math.floor(position));
}

export function median(values: readonly number[]): number | null {
  return quantile(values, 0.5);
}

/**
 * Percentile rank of `value` within `peers`, 0–100. Higher means the value exceeds more of the
 * peer group: 80 ⇒ higher than about 80% of peers. Ties count half, so equal values always
 * share a rank and a value equal to every peer sits at exactly 50.
 */
export function percentileRank(value: number, peers: readonly number[]): number | null {
  const finite = peers.filter(Number.isFinite);
  if (!Number.isFinite(value) || finite.length === 0) return null;
  let below = 0;
  let equal = 0;
  for (const peer of finite) {
    if (peer < value) below += 1;
    else if (peer === value) equal += 1;
  }
  return ((below + 0.5 * equal) / finite.length) * 100;
}

export function medianAbsoluteDeviation(values: readonly number[]): number | null {
  const center = median(values);
  if (center === null) return null;
  return median(values.filter(Number.isFinite).map((value) => Math.abs(value - center)));
}

/** 0.6745 is the 75th percentile of the standard normal, making MAD consistent with σ. */
const MAD_SCALE = 0.6745;
/** √(π/2): the same consistency factor for the mean absolute deviation. */
const MEAN_AD_SCALE = Math.sqrt(Math.PI / 2);

/**
 * Robust z-score: 0.6745 · (x − median) / MAD.
 *
 * When MAD is 0 (more than half the peers share one value) it falls back to the mean absolute
 * deviation, as in Iglewicz & Hoaglin's modified z. If every peer is identical there is no
 * spread to measure against: the result is 0 for an equal value and null otherwise.
 */
export function robustZ(value: number, peers: readonly number[]): number | null {
  const finite = peers.filter(Number.isFinite);
  const center = median(finite);
  if (center === null || !Number.isFinite(value)) return null;
  const mad = medianAbsoluteDeviation(finite)!;
  if (mad > 0) return (MAD_SCALE * (value - center)) / mad;
  const meanAbsoluteDeviation = finite.reduce((sum, peer) => sum + Math.abs(peer - center), 0) / finite.length;
  if (meanAbsoluteDeviation > 0) return (value - center) / (MEAN_AD_SCALE * meanAbsoluteDeviation);
  return value === center ? 0 : null;
}

/** Ordinary least-squares slope of y on x. Null for fewer than two points or no x variation. */
export function linearSlope(points: readonly { x: number; y: number }[]): number | null {
  const valid = points.filter((p) => Number.isFinite(p.x) && Number.isFinite(p.y));
  if (valid.length < 2) return null;
  const meanX = valid.reduce((s, p) => s + p.x, 0) / valid.length;
  const meanY = valid.reduce((s, p) => s + p.y, 0) / valid.length;
  let covariance = 0;
  let varianceX = 0;
  for (const p of valid) {
    covariance += (p.x - meanX) * (p.y - meanY);
    varianceX += (p.x - meanX) ** 2;
  }
  return varianceX === 0 ? null : covariance / varianceX;
}
