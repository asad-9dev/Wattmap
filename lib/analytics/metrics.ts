/**
 * WattMap analytics — the public entry point for every benchmarking calculation.
 *
 * Each formula lives in one focused, pure module (formulas, peers, stats, score, confidence) and
 * is re-exported here, so pages, scripts, and tests import from a single place without any
 * calculation being duplicated. Formulas, units, and rationale: docs/methodology.md.
 *
 *   EUI (GJ/m²)          = total site energy ÷ floor area            energyUseIntensity
 *   EUI (ekWh/m²)        = EUI × 277.78                              toKwhEquivalent
 *   GHG intensity        = kg CO₂e ÷ floor area                      ghgIntensity
 *   Peer cohort          = same operation type + level, area 0.67–1.5× (relaxed to ≥ 20 peers)
 *                                                                    selectPeerCohort
 *   Percentile           = 100 × (below + ½ equal) ÷ peers           percentileRank
 *   Opportunity Score    = 100 × (0.8 × P + 0.2 × trend factor)      opportunityScore
 *   Energy gap (GJ)      = max(0, EUI − peer median) × floor area    energyGapToPeerMedian
 *   Data confidence      = High / Medium / Low with reasons          dataConfidence
 */

export {
  KWH_PER_GJ,
  electricityIntensity,
  energyGapToPeerMedian,
  energyUseIntensity,
  ghgIntensity,
  naturalGasIntensity,
  toKwhEquivalent,
} from "./formulas";

export {
  HOURS_TOLERANCE,
  MINIMUM_PEER_COUNT,
  PEER_STAGES,
  PREFERRED_PEER_COUNT,
  selectPeers as selectPeerCohort,
  type PeerCandidate,
  type PeerSelection,
  type PeerStage,
  type SchoolLevel,
} from "./peers";

export { linearSlope, median, medianAbsoluteDeviation, percentileRank, quantile, robustZ } from "./stats";

export {
  MAX_TREND_YEARS,
  MIN_TREND_YEARS,
  PANDEMIC_YEARS,
  opportunityScore,
  recentTrend,
  trendFactor,
  type ConfidenceLevel,
  type OpportunityScore,
  type ScoreInputs,
  type Trend,
  type YearValue,
} from "./score";

export {
  dataConfidence,
  type ConfidenceReason,
  type DataConfidenceInputs,
  type DataConfidenceLevel,
} from "./confidence";
