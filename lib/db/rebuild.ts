import { eq } from "drizzle-orm";
import { energyRecords, facilities, peerMetrics, schools } from "@/drizzle/schema";
import { computePeerMetrics, type FacilityYearInput } from "@/lib/analytics/rebuild";
import type { AnyDatabase } from "./index";

const INSERT_BATCH = 1000;

export async function loadFacilityYears(db: AnyDatabase): Promise<FacilityYearInput[]> {
  const rows = await db
    .select({
      facilityId: energyRecords.facilityId,
      schoolId: facilities.schoolId,
      reportingYear: energyRecords.reportingYear,
      operationType: energyRecords.operationType,
      totalSiteEnergyGj: energyRecords.totalSiteEnergyGj,
      floorAreaM2: energyRecords.floorAreaM2,
      ghgKgCo2e: energyRecords.ghgKgCo2e,
      electricityKwh: energyRecords.electricityKwh,
      weeklyHours: energyRecords.weeklyHours,
      qualityFlags: energyRecords.dataQualityFlags,
      matchStatus: facilities.matchStatus,
      matchConfidence: facilities.matchConfidence,
      schoolLevel: schools.schoolLevel,
    })
    .from(energyRecords)
    .innerJoin(facilities, eq(energyRecords.facilityId, facilities.id))
    .leftJoin(schools, eq(facilities.schoolId, schools.id));
  return rows.map(({ matchStatus, matchConfidence, ...row }) => ({
    ...row,
    matchConfidence: matchStatus === "matched" ? matchConfidence : null,
  }));
}

/** Recompute all peer metrics and replace the table's contents in one transaction. */
export async function rebuildPeerMetrics(db: AnyDatabase): Promise<{ records: number; scored: number }> {
  const metrics = computePeerMetrics(await loadFacilityYears(db));
  await db.transaction(async (tx) => {
    await tx.delete(peerMetrics);
    for (let start = 0; start < metrics.length; start += INSERT_BATCH) {
      await tx.insert(peerMetrics).values(metrics.slice(start, start + INSERT_BATCH));
    }
  });
  return { records: metrics.length, scored: metrics.filter((m) => m.opportunityScore !== null).length };
}
