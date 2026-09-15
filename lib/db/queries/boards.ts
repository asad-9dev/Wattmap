import { and, asc, eq, isNotNull, sql } from "drizzle-orm";
import { boards, energyRecords, facilities, peerMetrics, schools } from "@/drizzle/schema";
import type { AnyDatabase } from "@/lib/db";
import { plausibleRecord } from "./overview";
import { latestReportingYear } from "./schools";

const pm = peerMetrics;

export async function getBoardProfile(db: AnyDatabase, slug: string) {
  const [board] = await db.select().from(boards).where(eq(boards.slug, slug)).limit(1);
  if (!board) return null;
  const year = await latestReportingYear(db);

  const schoolRows = await db
    .select({
      slug: schools.slug,
      name: schools.name,
      city: schools.city,
      level: schools.schoolLevel,
      lat: schools.latitude,
      lon: schools.longitude,
      eui: pm.euiGjM2,
      percentile: pm.euiPercentile,
      score: pm.opportunityScore,
      scoreConfidence: pm.scoreConfidence,
    })
    .from(schools)
    .leftJoin(pm, and(eq(pm.schoolId, schools.id), eq(pm.reportingYear, year ?? -1)))
    .where(and(eq(schools.boardId, board.id), eq(schools.active, true)))
    .orderBy(asc(schools.name));

  // Every facility the board reported, matched or not: totals describe the board's reporting.
  const yearly = await db
    .select({
      year: energyRecords.reportingYear,
      facilities: sql<number>`count(*)::int`,
      totalEnergyGj: sql<number | null>`sum(${energyRecords.totalSiteEnergyGj}) filter (where ${plausibleRecord})`,
      totalGhgKg: sql<number | null>`sum(${energyRecords.ghgKgCo2e}) filter (where ${plausibleRecord})`,
      excludedImplausible: sql<number>`count(*) filter (where not ${plausibleRecord})::int`,
      // Aggregate EUI over plausible records reporting both energy and a positive floor area.
      aggregateEui: sql<number | null>`sum(${energyRecords.totalSiteEnergyGj}) filter (where ${energyRecords.floorAreaM2} > 0 and ${plausibleRecord})
        / nullif(sum(${energyRecords.floorAreaM2}) filter (where ${energyRecords.totalSiteEnergyGj} is not null and ${energyRecords.floorAreaM2} > 0 and ${plausibleRecord}), 0)`,
    })
    .from(energyRecords)
    .innerJoin(facilities, eq(energyRecords.facilityId, facilities.id))
    .where(eq(facilities.boardId, board.id))
    .groupBy(energyRecords.reportingYear)
    .orderBy(asc(energyRecords.reportingYear));

  const benchmarked = schoolRows.filter((s) => s.eui !== null);
  const [summary] = year
    ? await db
        .select({
          medianEui: sql<number | null>`percentile_cont(0.5) within group (order by ${pm.euiGjM2})`,
          medianScore: sql<number | null>`percentile_cont(0.5) within group (order by ${pm.opportunityScore})`,
        })
        .from(pm)
        .innerJoin(schools, eq(pm.schoolId, schools.id))
        .where(and(eq(schools.boardId, board.id), eq(pm.reportingYear, year), isNotNull(pm.euiGjM2)))
    : [];

  return {
    board,
    latestYear: year,
    schools: schoolRows,
    benchmarkedCount: benchmarked.length,
    medianEui: summary?.medianEui ?? null,
    medianScore: summary?.medianScore ?? null,
    yearly,
  };
}

export type BoardProfile = NonNullable<Awaited<ReturnType<typeof getBoardProfile>>>;

export async function listBoards(db: AnyDatabase) {
  return db.select({ slug: boards.slug, name: boards.name }).from(boards).orderBy(asc(boards.name));
}
