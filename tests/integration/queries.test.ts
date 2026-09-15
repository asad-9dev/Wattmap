/**
 * Integration tests: real migrations and real SQL against an in-memory Postgres (PGlite).
 * The rows below are synthetic test fixtures, used only here.
 */
import { PGlite } from "@electric-sql/pglite";
import { drizzle } from "drizzle-orm/pglite";
import { migrate } from "drizzle-orm/pglite/migrator";
import { beforeAll, describe, expect, it } from "vitest";
import * as schema from "../../drizzle/schema";
import type { AnyDatabase } from "../../lib/db";
import { getBoardProfile } from "../../lib/db/queries/boards";
import { getDataSourceInfo, getHomeStats, getMapPoints, getOntarioOverview } from "../../lib/db/queries/overview";
import { loadSearchSource } from "../../lib/db/queries/search";
import { availableYears, getSchoolProfile, listSchools } from "../../lib/db/queries/schools";
import { rebuildPeerMetrics } from "../../lib/db/rebuild";

let db: AnyDatabase;
const YEARS = [2021, 2022, 2023];

beforeAll(async () => {
  const database = drizzle(new PGlite(), { schema });
  await migrate(database, { migrationsFolder: "drizzle/migrations" });
  db = database;

  const [east, west] = await db
    .insert(schema.boards)
    .values([
      { boardNumber: "B1", name: "East District School Board", slug: "east-dsb" },
      { boardNumber: "B2", name: "West Catholic District School Board", slug: "west-cdsb" },
    ])
    .returning();

  // 30 elementary schools in East (EUIs 0.50…1.08), 2 secondary schools in West.
  const schoolRows = await db
    .insert(schema.schools)
    .values([
      ...Array.from({ length: 30 }, (_, i) => ({
        schoolNumber: `1${String(i).padStart(5, "0")}`,
        name: `Test Public School ${i}`,
        slug: `test-public-school-${i}`,
        boardId: east!.id,
        schoolLevel: "elementary" as const,
        city: i < 15 ? "Ajax" : "Whitby",
        region: "Toronto",
        latitude: i % 2 === 0 ? 43.85 + i / 100 : null,
        longitude: i % 2 === 0 ? -79.03 : null,
      })),
      { schoolNumber: "200001", name: "West Secondary", slug: "west-secondary", boardId: west!.id, schoolLevel: "secondary" as const, city: "Windsor" },
      { schoolNumber: "200002", name: "No Data Secondary", slug: "no-data-secondary", boardId: west!.id, schoolLevel: "secondary" as const, city: "Windsor" },
    ])
    .returning();

  const matched = schoolRows.slice(0, 31);
  const facilityRows = await db
    .insert(schema.facilities)
    .values([
      ...matched.map((s) => ({
        sourceKey: `key-${s.schoolNumber}`,
        facilityName: s.name,
        organizationName: s.boardId === east!.id ? "East DSB" : "West CDSB",
        operationType: "K-12 School",
        schoolId: s.id,
        boardId: s.boardId,
        matchStatus: "matched" as const,
        matchMethod: "exact_name_board" as const,
        matchConfidence: 1,
      })),
      { sourceKey: "key-admin", facilityName: "East Admin Centre", organizationName: "East DSB", operationType: "Office", boardId: east!.id },
    ])
    .returning();

  await db.insert(schema.energyRecords).values(
    facilityRows.flatMap((f, i) =>
      YEARS.map((year) => ({
        facilityId: f.id,
        reportingYear: year,
        totalSiteEnergyGj: 5000 * (0.5 + (i % 30) * 0.02),
        floorAreaM2: 5000,
        ghgKgCo2e: 100000,
        electricityKwh: 400000,
        weeklyHours: 50,
        operationType: f.operationType,
        rawSourceJson: { fixture: true },
        dataQualityFlags: year === 2021 ? ["pandemic_affected_period"] : [],
        sourceDataset: "test-fixture",
        sourceRowHash: `${f.id}-${year}`,
      })),
    ),
  );
  await rebuildPeerMetrics(db);
}, 60_000);

describe("rebuild + school queries", () => {
  it("lists available years", async () => {
    expect(await availableYears(db)).toEqual(YEARS);
  });

  it("assembles a school profile with history and peer metrics", async () => {
    const profile = await getSchoolProfile(db, "test-public-school-29");
    expect(profile?.school.boardName).toBe("East District School Board");
    expect(profile?.series.map((s) => s.year)).toEqual(YEARS);
    expect(profile?.series.at(-1)?.eui).toBeCloseTo(1.08);
    expect(profile?.latest?.peerCount).toBe(29);
    expect(profile?.latest?.euiPercentile).toBe(100);
    expect(profile?.latest?.opportunityScore).not.toBeNull();
  });

  it("returns no facilities for a school without energy data", async () => {
    const profile = await getSchoolProfile(db, "no-data-secondary");
    expect(profile?.facilities).toEqual([]);
    expect(profile?.series).toEqual([]);
  });

  it("returns null for an unknown slug", async () => {
    expect(await getSchoolProfile(db, "does-not-exist")).toBeNull();
  });

  it("filters, sorts, and paginates the school list", async () => {
    const base = { year: 2023, sort: "eui" as const, direction: "desc" as const, page: 1, pageSize: 5 };
    const { rows, total } = await listSchools(db, { ...base, board: "east-dsb" });
    expect(total).toBe(30);
    expect(rows).toHaveLength(5);
    expect(rows[0]?.name).toBe("Test Public School 29");
    const ajax = await listSchools(db, { ...base, city: "ajax", pageSize: 50 });
    expect(ajax.total).toBe(15);
    const scored = await listSchools(db, { ...base, scoreMin: 90, pageSize: 50 });
    expect(scored.rows.every((r) => (r.opportunityScore ?? 0) >= 90)).toBe(true);
    const named = await listSchools(db, { ...base, q: "west" });
    expect(named.rows.map((r) => r.slug)).toEqual(["west-secondary"]);
  });
});

describe("board, map, overview, and search queries", () => {
  it("aggregates a board, including its unmatched facilities", async () => {
    const board = await getBoardProfile(db, "east-dsb");
    expect(board?.schools).toHaveLength(30);
    expect(board?.benchmarkedCount).toBe(30);
    expect(board?.yearly.at(-1)?.facilities).toBe(31);
    expect(board?.medianEui).toBeCloseTo(0.79);
  });

  it("returns map points only for schools with coordinates and metrics", async () => {
    const points = await getMapPoints(db, 2023);
    expect(points).toHaveLength(15);
    expect(points.every((p) => p.lat !== null && p.eui !== null)).toBe(true);
  });

  it("separates provincial totals from benchmarked schools", async () => {
    const overview = await getOntarioOverview(db);
    expect(overview?.latestYear).toBe(2023);
    expect(overview?.reported.at(-1)?.facilities).toBe(32);
    expect(overview?.distribution).toHaveLength(31);
    const stats = await getHomeStats(db);
    expect(stats).toMatchObject({ latestYear: 2023, reportingFacilities: 32, firstYear: 2021, yearsOfData: 3 });
  });

  it("reports coverage for the data page", async () => {
    const info = await getDataSourceInfo(db);
    expect(info.years).toHaveLength(3);
    expect(info.flaggedRecords).toBe(32);
    expect(info.matchStatus.find((m) => m.status === "unmatched")?.facilities).toBe(1);
  });

  it("builds the search source from active schools and boards", async () => {
    const source = await loadSearchSource(db);
    expect(source.schools).toHaveLength(32);
    expect(source.boards).toHaveLength(2);
  });
});
