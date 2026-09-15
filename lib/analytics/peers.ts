/**
 * Peer-group selection. A facility is benchmarked only against comparable facilities: same
 * operation category, same broad school level, similar floor area, and similar operating hours
 * where known. Criteria are relaxed step by step until enough peers remain.
 */

export const PREFERRED_PEER_COUNT = 20;
export const MINIMUM_PEER_COUNT = 10;

export type SchoolLevel = "elementary" | "secondary" | "combined";

export type PeerCandidate = {
  facilityId: number;
  operationCategory: string;
  schoolLevel: SchoolLevel | null;
  floorAreaM2: number;
  weeklyHours: number | null;
  eui: number;
};

export type PeerStage = {
  /** Human-readable description shown in "How peers are selected". */
  label: string;
  areaRange: [number, number] | null;
  matchHours: boolean;
};

/** Ordered from most to least specific. */
export const PEER_STAGES: readonly PeerStage[] = [
  { label: "Floor area 0.67–1.5× and weekly hours within ±25%", areaRange: [0.67, 1.5], matchHours: true },
  { label: "Floor area 0.67–1.5×", areaRange: [0.67, 1.5], matchHours: false },
  { label: "Floor area 0.5–2×", areaRange: [0.5, 2], matchHours: false },
  { label: "Floor area 0.33–3×", areaRange: [0.33, 3], matchHours: false },
  { label: "Any floor area", areaRange: null, matchHours: false },
];

export const HOURS_TOLERANCE = 0.25;

export type PeerSelection = {
  peers: PeerCandidate[];
  stage: PeerStage | null;
  /** Criteria applied at every stage, for on-screen explanation. */
  baseCriteria: string[];
  sufficient: boolean;
};

function withinStage(target: PeerCandidate, candidate: PeerCandidate, stage: PeerStage): boolean {
  if (stage.areaRange) {
    const ratio = candidate.floorAreaM2 / target.floorAreaM2;
    if (ratio < stage.areaRange[0] || ratio > stage.areaRange[1]) return false;
  }
  if (stage.matchHours) {
    if (target.weeklyHours === null || candidate.weeklyHours === null) return false;
    const difference = Math.abs(candidate.weeklyHours - target.weeklyHours) / target.weeklyHours;
    if (difference > HOURS_TOLERANCE) return false;
  }
  return true;
}

/**
 * Take the most specific stage with at least 20 peers; failing that, the most specific stage
 * with at least 10. Fewer than 10 comparable facilities means no reliable benchmark.
 */
export function selectPeers(target: PeerCandidate, candidates: readonly PeerCandidate[]): PeerSelection {
  const baseCriteria = [`Operation type: ${target.operationCategory}`];
  if (target.schoolLevel) baseCriteria.push(`School level: ${target.schoolLevel}`);

  const pool = candidates.filter(
    (c) =>
      c.facilityId !== target.facilityId &&
      c.operationCategory === target.operationCategory &&
      (target.schoolLevel === null || c.schoolLevel === target.schoolLevel) &&
      Number.isFinite(c.eui) &&
      c.floorAreaM2 > 0,
  );
  // The hours stage only applies when the target reports hours.
  const stages = PEER_STAGES.filter((s) => !s.matchHours || (target.weeklyHours !== null && target.weeklyHours > 0));
  const staged = stages.map((stage) => ({ stage, peers: pool.filter((c) => withinStage(target, c, stage)) }));

  const chosen =
    staged.find((s) => s.peers.length >= PREFERRED_PEER_COUNT) ?? staged.find((s) => s.peers.length >= MINIMUM_PEER_COUNT);
  if (!chosen) return { peers: [], stage: null, baseCriteria, sufficient: false };
  return { peers: chosen.peers, stage: chosen.stage, baseCriteria, sufficient: true };
}
