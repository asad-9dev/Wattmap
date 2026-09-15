import { describe, expect, it } from "vitest";
import { selectPeers, type PeerCandidate } from "../../lib/analytics/peers";

const target: PeerCandidate = {
  facilityId: 0,
  operationCategory: "School",
  schoolLevel: "secondary",
  floorAreaM2: 10000,
  weeklyHours: 60,
  eui: 0.8,
};

function candidates(count: number, overrides: Partial<PeerCandidate> = {}, startId = 1): PeerCandidate[] {
  return Array.from({ length: count }, (_, i) => ({ ...target, facilityId: startId + i, eui: 0.5 + i * 0.01, ...overrides }));
}

describe("selectPeers", () => {
  it("uses the strictest stage when it has 20+ peers", () => {
    const result = selectPeers(target, candidates(25));
    expect(result.sufficient).toBe(true);
    expect(result.stage?.matchHours).toBe(true);
    expect(result.peers).toHaveLength(25);
  });

  it("excludes the target, other operation types, and other school levels", () => {
    const pool = [
      ...candidates(20),
      { ...target },
      ...candidates(5, { operationCategory: "Office" }, 100),
      ...candidates(5, { schoolLevel: "elementary" }, 200),
    ];
    const result = selectPeers(target, pool);
    expect(result.peers.every((p) => p.facilityId !== 0 && p.operationCategory === "School" && p.schoolLevel === "secondary")).toBe(true);
    expect(result.peers).toHaveLength(20);
  });

  it("relaxes floor area progressively until 20 peers remain", () => {
    const pool = [...candidates(12), ...candidates(10, { floorAreaM2: 18000 }, 100)]; // 1.8× → needs the 0.5–2× stage
    const result = selectPeers(target, pool);
    expect(result.stage?.areaRange).toEqual([0.5, 2]);
    expect(result.peers).toHaveLength(22);
  });

  it("drops the hours criterion when hours are unknown", () => {
    const result = selectPeers({ ...target, weeklyHours: null }, candidates(20));
    expect(result.stage?.matchHours).toBe(false);
  });

  it("falls back to the most specific stage with 10+ when 20 is unreachable", () => {
    const result = selectPeers(target, candidates(12));
    expect(result.sufficient).toBe(true);
    expect(result.stage?.matchHours).toBe(true);
    expect(result.peers).toHaveLength(12);
  });

  it("reports insufficient peers below 10", () => {
    const result = selectPeers(target, candidates(9));
    expect(result.sufficient).toBe(false);
    expect(result.peers).toHaveLength(0);
  });
});
