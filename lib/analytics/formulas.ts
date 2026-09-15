/**
 * Core engineering formulas. Every function returns null instead of a number whenever its inputs
 * cannot support the calculation; nothing is estimated or defaulted. Import through
 * `lib/analytics/metrics` from application code.
 */

/** 1 GJ = 10⁹ J and 1 kWh = 3.6 × 10⁶ J, so 1 GJ = 277.78 kWh. */
export const KWH_PER_GJ = 1000 / 3.6;

type Maybe = number | null | undefined;

function isFiniteNumber(value: Maybe): value is number {
  return typeof value === "number" && Number.isFinite(value);
}

/** quantity / floor area, valid only for a non-negative quantity and a positive area. */
function perSquareMetre(quantity: Maybe, floorAreaM2: Maybe): number | null {
  if (!isFiniteNumber(quantity) || quantity < 0) return null;
  if (!isFiniteNumber(floorAreaM2) || floorAreaM2 <= 0) return null;
  return quantity / floorAreaM2;
}

/** Energy Use Intensity, GJ/m² = total site energy (GJ) / floor area (m²). */
export function energyUseIntensity(totalSiteEnergyGj: Maybe, floorAreaM2: Maybe): number | null {
  return perSquareMetre(totalSiteEnergyGj, floorAreaM2);
}

/**
 * Energy-equivalent kWh for a GJ value. Label results "ekWh": this is total energy expressed in
 * kWh units, not electricity consumption.
 */
export function toKwhEquivalent(gj: Maybe): number | null {
  return isFiniteNumber(gj) ? gj * KWH_PER_GJ : null;
}

/** GHG intensity, kg CO₂e/m². */
export function ghgIntensity(ghgKgCo2e: Maybe, floorAreaM2: Maybe): number | null {
  return perSquareMetre(ghgKgCo2e, floorAreaM2);
}

/** Electricity intensity, kWh/m². */
export function electricityIntensity(electricityKwh: Maybe, floorAreaM2: Maybe): number | null {
  return perSquareMetre(electricityKwh, floorAreaM2);
}

/** Natural gas intensity, GJ/m², from the source's reported GJ (never from converted m³). */
export function naturalGasIntensity(naturalGasGj: Maybe, floorAreaM2: Maybe): number | null {
  return perSquareMetre(naturalGasGj, floorAreaM2);
}

/**
 * Modeled annual energy gap to the peer median, GJ: (EUI − peer median EUI) × floor area,
 * floored at 0. A benchmarking estimate, not an audit or a guaranteed saving.
 */
export function energyGapToPeerMedian(currentEui: Maybe, peerMedianEui: Maybe, floorAreaM2: Maybe): number | null {
  if (!isFiniteNumber(currentEui) || !isFiniteNumber(peerMedianEui)) return null;
  if (!isFiniteNumber(floorAreaM2) || floorAreaM2 <= 0) return null;
  return Math.max(0, currentEui - peerMedianEui) * floorAreaM2;
}
