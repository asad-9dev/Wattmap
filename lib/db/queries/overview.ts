import { and, asc, desc, eq, isNotNull, sql } from "drizzle-orm";
import { boards, energyRecords, facilities, ingestionRuns, peerMetrics, schools } from "@/drizzle/schema";
import type { AnyDatabase } from "@/lib/db";
import { latestReportingYear } from "./schools";

const pm = peerMetrics;
const medianEui = sql<number | null>`percentile_cont(0.5) within group (order by ${pm.euiGjM2})`;

/** Records whose reported values are physically implausible are left out of every total. */
export const plausibleRecord = sql`not ('implausible_intensity' = any(${energyRecords.dataQualityFlags}))`;
const implausibleCount = sql<number>`count(*) filter (where 'implausible_intensity' = any(${energyRecords.dataQualityFlags}))::int`;

/** Homepage statistics, computed from the database on every build of the page (never hardcoded). */
export async function getHomeStats(db: AnyDatabase) {
  const year = await latestReportingYear(db);
  if (year === null) return null;
  const [benchmark] = await db
    .select({
      schools: sql<number>`count(*)::int`,
      boards: sql<number>`count(distinct ${schools.boardId})::int`,
      medianEui,
    })
    .from(pm)
    .innerJoin(schools, eq(pm.schoolId, schools.id))
    .where(and(eq(pm.reportingYear, year), isNotNull(pm.euiGjM2)));
  const [energy] = await db
    .select({
      facilities: sql<number>`count(*)::int`,
      totalEnergyGj: sql<number | null>`sum(${energyRecords.totalSiteEnergyGj}) filter (where ${plausibleRecord})`,
    })
    .from(energyRecords)
    .where(eq(energyRecords.reportingYear, year));
  const [span] = await db
    .select({
      first: sql<number>`min(${energyRecords.reportingYear})`,
      years: sql<number>`count(distinct ${energyRecords.reportingYear})::int`,
    })
    .from(energyRecords);
  return {
    latestYear: year,
    benchmarkedSchools: benchmark?.schools ?? 0,
    boards: benchmark?.boards ?? 0,
    medianEui: benchmark?.medianEui ?? null,
    reportingFacilities: energy?.facilities ?? 0,
    totalEnergyGj: energy?.totalEnergyGj ?? null,
    firstYear: span?.first ?? null,
    yearsOfData: span?.years ?? 0,
  };
}

export async function getOntarioOverview(db: AnyDatabase) {
  const year = await latestReportingYear(db);
  if (year === null) return null;

  // All reporting school-board facilities, matched to a Ministry school or not.
  const reported = await db
    .select({
      year: energyRecords.reportingYear,
      facilities: sql<number>`count(*)::int`,
      totalEnergyGj: sql<number | null>`sum(${energyRecords.totalSiteEnergyGj}) filter (where ${plausibleRecord})`,
      totalGhgKg: sql<number | null>`sum(${energyRecords.ghgKgCo2e}) filter (where ${plausibleRecord})`,
      excludedImplausible: implausibleCount,
    })
    .from(energyRecords)
    .groupBy(energyRecords.reportingYear)
    .orderBy(asc(energyRecords.reportingYear));

  // Benchmarked school buildings only (matched schools in the school operation category).
  const schoolScope = and(isNotNull(pm.schoolId), eq(pm.operationCategory, "school"), isNotNull(pm.euiGjM2));
  const benchmarked = await db
    .select({ year: pm.reportingYear, schools: sql<number>`count(*)::int`, medianEui })
    .from(pm)
    .where(schoolScope)
    .groupBy(pm.reportingYear)
    .orderBy(asc(pm.reportingYear));

  const distribution = await db
    .select({ eui: pm.euiGjM2 })
    .from(pm)
    .where(and(schoolScope, eq(pm.reportingYear, year)));

  const byLevel = await db
    .select({ level: pm.schoolLevel, schools: sql<number>`count(*)::int`, medianEui })
    .from(pm)
    .where(and(schoolScope, eq(pm.reportingYear, year)))
    .groupBy(pm.schoolLevel);

  const byRegion = await db
    .select({ region: schools.region, schools: sql<number>`count(*)::int`, medianEui })
    .from(pm)
    .innerJoin(schools, eq(pm.schoolId, schools.id))
    .where(and(schoolScope, eq(pm.reportingYear, year)))
    .groupBy(schools.region)
    .orderBy(asc(schools.region));

  const byBoard = await db
    .select({ name: boards.name, slug: boards.slug, schools: sql<number>`count(*)::int`, medianEui })
    .from(pm)
    .innerJoin(schools, eq(pm.schoolId, schools.id))
    .innerJoin(boards, eq(schools.boardId, boards.id))
    .where(and(schoolScope, eq(pm.reportingYear, year)))
    .groupBy(boards.name, boards.slug)
    .orderBy(asc(boards.name));

  return {
    latestYear: year,
    reported,
    benchmarked,
    distribution: distribution.map((d) => d.eui!).sort((a, b) => a - b),
    byLevel,
    byRegion,
    byBoard,
  };
}

export async function getMapPoints(db: AnyDatabase, year: number) {
  return db
    .select({
      slug: schools.slug,
      name: schools.name,
      city: schools.city,
      region: schools.region,
      level: schools.schoolLevel,
      boardName: boards.name,
      boardSlug: boards.slug,
      lat: schools.latitude,
      lon: schools.longitude,
      eui: pm.euiGjM2,
      percentile: pm.euiPercentile,
      score: pm.opportunityScore,
      ghgIntensity: pm.ghgIntensityKgM2,
    })
    .from(schools)
    .innerJoin(boards, eq(schools.boardId, boards.id))
    .innerJoin(pm, and(eq(pm.schoolId, schools.id), eq(pm.reportingYear, year)))
    .where(and(isNotNull(schools.latitude), isNotNull(schools.longitude), isNotNull(pm.euiGjM2)));
}

export type MapPoint = Awaited<ReturnType<typeof getMapPoints>>[number];

export async function getDataSourceInfo(db: AnyDatabase) {
  const [latestRun] = await db.select().from(ingestionRuns).orderBy(desc(ingestionRuns.startedAt)).limit(1);
  const years = await db
    .select({ year: energyRecords.reportingYear, records: sql<number>`count(*)::int` })
    .from(energyRecords)
    .groupBy(energyRecords.reportingYear)
    .orderBy(asc(energyRecords.reportingYear));
  const matchStatus = await db
    .select({ status: facilities.matchStatus, facilities: sql<number>`count(*)::int` })
    .from(facilities)
    .groupBy(facilities.matchStatus);
  const [flagged] = await db
    .select({
      records: sql<number>`count(*) filter (where cardinality(${energyRecords.dataQualityFlags}) > 0)::int`,
      implausible: implausibleCount,
    })
    .from(energyRecords);
  return {
    latestRun: latestRun ?? null,
    years,
    matchStatus,
    flaggedRecords: flagged?.records ?? 0,
    implausibleRecords: flagged?.implausible ?? 0,
  };
}
