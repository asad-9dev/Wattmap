import { and, asc, eq, gte, inArray, lte, sql, type SQL } from "drizzle-orm";
import { boards, energyRecords, facilities, peerMetrics, schools } from "@/drizzle/schema";
import { foldText } from "@/lib/analytics/category";
import type { SchoolLevel } from "@/lib/analytics/peers";
import { combineYearly } from "@/lib/analytics/series";
import type { AnyDatabase } from "@/lib/db";

// Accent/apostrophe folding in SQL without extensions (Supabase does not enable unaccent by default).
const ACCENTED = "àâäáãéèêëíìîïóòôöõúùûüçñ’";
const PLAIN = "aaaaaeeeeiiiiooooouuuucn'";

export function foldedSql(column: SQL | typeof schools.name | typeof schools.city): SQL {
  return sql`translate(lower(${column}), ${ACCENTED}, ${PLAIN})`;
}

export async function latestReportingYear(db: AnyDatabase): Promise<number | null> {
  const [row] = await db.select({ year: sql<number | null>`max(${peerMetrics.reportingYear})` }).from(peerMetrics);
  return row?.year ?? null;
}

export async function availableYears(db: AnyDatabase): Promise<number[]> {
  const rows = await db
    .selectDistinct({ year: peerMetrics.reportingYear })
    .from(peerMetrics)
    .orderBy(asc(peerMetrics.reportingYear));
  return rows.map((r) => r.year);
}

export const SCHOOL_SORTS = ["name", "eui", "score", "percentile", "year"] as const;
export type SchoolSort = (typeof SCHOOL_SORTS)[number];

export type SchoolListFilters = {
  q?: string;
  board?: string;
  city?: string;
  region?: string;
  level?: SchoolLevel;
  year: number;
  scoreMin?: number;
  scoreMax?: number;
  percentileMin?: number;
  percentileMax?: number;
  reportedOnly?: boolean;
  sort: SchoolSort;
  direction: "asc" | "desc";
  page: number;
  pageSize: number;
};

export async function listSchools(db: AnyDatabase, f: SchoolListFilters) {
  const pm = peerMetrics;
  const conditions: SQL[] = [eq(schools.active, true)];
  if (f.q) conditions.push(sql`${foldedSql(schools.name)} like ${`%${foldText(f.q).replace(/[’`]/g, "'")}%`}`);
  if (f.board) conditions.push(eq(boards.slug, f.board));
  if (f.city) conditions.push(sql`${foldedSql(schools.city)} = ${foldText(f.city)}`);
  if (f.region) conditions.push(eq(schools.region, f.region));
  if (f.level) conditions.push(eq(schools.schoolLevel, f.level));
  if (f.scoreMin !== undefined) conditions.push(gte(pm.opportunityScore, f.scoreMin));
  if (f.scoreMax !== undefined) conditions.push(lte(pm.opportunityScore, f.scoreMax));
  if (f.percentileMin !== undefined) conditions.push(gte(pm.euiPercentile, f.percentileMin));
  if (f.percentileMax !== undefined) conditions.push(lte(pm.euiPercentile, f.percentileMax));
  if (f.reportedOnly) conditions.push(sql`${pm.id} is not null`);
  const where = and(...conditions);

  const latestYear = sql<number | null>`(select max(reporting_year) from peer_metrics where peer_metrics.school_id = ${schools.id})`;
  const direction = f.direction === "asc" ? sql`asc` : sql`desc`;
  const sortColumn: Record<SchoolSort, SQL> = {
    name: sql`${schools.name}`,
    eui: sql`${pm.euiGjM2}`,
    score: sql`${pm.opportunityScore}`,
    percentile: sql`${pm.euiPercentile}`,
    year: latestYear,
  };

  const join = and(eq(pm.schoolId, schools.id), eq(pm.reportingYear, f.year));
  const rows = await db
    .select({
      slug: schools.slug,
      name: schools.name,
      city: schools.city,
      region: schools.region,
      schoolLevel: schools.schoolLevel,
      boardName: boards.name,
      boardSlug: boards.slug,
      euiGjM2: pm.euiGjM2,
      euiPercentile: pm.euiPercentile,
      peerCount: pm.peerCount,
      opportunityScore: pm.opportunityScore,
      scoreConfidence: pm.scoreConfidence,
      latestYear,
    })
    .from(schools)
    .innerJoin(boards, eq(schools.boardId, boards.id))
    .leftJoin(pm, join)
    .where(where)
    .orderBy(sql`${sortColumn[f.sort]} ${direction} nulls last`, asc(schools.name))
    .limit(f.pageSize)
    .offset((f.page - 1) * f.pageSize);

  const [count] = await db
    .select({ total: sql<number>`count(*)::int` })
    .from(schools)
    .innerJoin(boards, eq(schools.boardId, boards.id))
    .leftJoin(pm, join)
    .where(where);
  return { rows, total: count?.total ?? 0 };
}

export type SchoolListRow = Awaited<ReturnType<typeof listSchools>>["rows"][number];

export async function getSchoolProfile(db: AnyDatabase, slug: string) {
  const [school] = await db
    .select({
      id: schools.id,
      slug: schools.slug,
      schoolNumber: schools.schoolNumber,
      name: schools.name,
      schoolLevel: schools.schoolLevel,
      schoolType: schools.schoolType,
      language: schools.language,
      gradeRange: schools.gradeRange,
      region: schools.region,
      street: schools.street,
      city: schools.city,
      postalCode: schools.postalCode,
      website: schools.website,
      latitude: schools.latitude,
      longitude: schools.longitude,
      boardName: boards.name,
      boardSlug: boards.slug,
    })
    .from(schools)
    .innerJoin(boards, eq(schools.boardId, boards.id))
    .where(eq(schools.slug, slug))
    .limit(1);
  if (!school) return null;

  const matched = await db
    .select({
      id: facilities.id,
      facilityName: facilities.facilityName,
      organizationName: facilities.organizationName,
      operationType: facilities.operationType,
      matchMethod: facilities.matchMethod,
      matchConfidence: facilities.matchConfidence,
    })
    .from(facilities)
    .where(eq(facilities.schoolId, school.id));

  const records = matched.length
    ? await db
        .select({
          reportingYear: energyRecords.reportingYear,
          reportingPeriodEnd: energyRecords.reportingPeriodEnd,
          totalSiteEnergyGj: energyRecords.totalSiteEnergyGj,
          normalizedTotalEnergyGj: energyRecords.normalizedTotalEnergyGj,
          electricityKwh: energyRecords.electricityKwh,
          naturalGasGj: energyRecords.naturalGasGj,
          naturalGasM3: energyRecords.naturalGasM3,
          ghgKgCo2e: energyRecords.ghgKgCo2e,
          floorAreaM2: energyRecords.floorAreaM2,
          weeklyHours: energyRecords.weeklyHours,
          portableCount: energyRecords.portableCount,
          operationType: energyRecords.operationType,
          dataQualityFlags: energyRecords.dataQualityFlags,
          sourceResource: energyRecords.sourceResource,
        })
        .from(energyRecords)
        .where(
          inArray(
            energyRecords.facilityId,
            matched.map((m) => m.id),
          ),
        )
    : [];

  const metrics = await db
    .select()
    .from(peerMetrics)
    .where(eq(peerMetrics.schoolId, school.id))
    .orderBy(asc(peerMetrics.reportingYear));

  return {
    school,
    facilities: matched,
    series: combineYearly(records),
    metrics,
    latest: metrics.at(-1) ?? null,
  };
}

export type SchoolProfile = NonNullable<Awaited<ReturnType<typeof getSchoolProfile>>>;

export async function getSchoolsForCompare(db: AnyDatabase, slugs: readonly string[]) {
  const profiles = await Promise.all(slugs.map((slug) => getSchoolProfile(db, slug)));
  return profiles.filter((p): p is SchoolProfile => p !== null);
}

export async function listFilterOptions(db: AnyDatabase) {
  const [boardRows, regionRows] = await Promise.all([
    db.select({ slug: boards.slug, name: boards.name }).from(boards).orderBy(asc(boards.name)),
    db.selectDistinct({ region: schools.region }).from(schools).orderBy(asc(schools.region)),
  ]);
  return { boards: boardRows, regions: regionRows.map((r) => r.region).filter((r): r is string => r !== null) };
}
