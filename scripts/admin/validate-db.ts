/**
 * Check database invariants after ingestion and analytics rebuild. Exits non-zero on failure.
 *
 *     npm run admin:validate
 */
import { config } from "dotenv";
import { sql } from "drizzle-orm";

config({ path: [".env.local", ".env"], quiet: true });

const CHECKS: { name: string; query: string; expectZero: boolean }[] = [
  { name: "Matched facilities without a school", query: "select count(*) from facilities where match_status = 'matched' and school_id is null", expectZero: true },
  { name: "Schools pointing at a missing board", query: "select count(*) from schools s left join boards b on b.id = s.board_id where b.id is null", expectZero: true },
  { name: "Duplicate facility-years", query: "select count(*) from (select facility_id, reporting_year from energy_records group by 1, 2 having count(*) > 1) d", expectZero: true },
  { name: "Scores outside 0–100", query: "select count(*) from peer_metrics where opportunity_score not between 0 and 100", expectZero: true },
  { name: "Scores shown with fewer than 10 peers", query: "select count(*) from peer_metrics where opportunity_score is not null and peer_count < 10", expectZero: true },
  {
    name: "Matched facility-years missing from peer_metrics (rebuild needed)",
    query: `select count(*) from (select distinct f.school_id, e.reporting_year from energy_records e join facilities f on f.id = e.facility_id where f.school_id is not null) m
            left join peer_metrics p on p.school_id = m.school_id and p.reporting_year = m.reporting_year where p.id is null`,
    expectZero: true,
  },
  { name: "Energy records", query: "select count(*) from energy_records", expectZero: false },
  { name: "Schools with coordinates", query: "select count(*) from schools where latitude is not null", expectZero: false },
];

async function main(): Promise<void> {
  const { getDb } = await import("@/lib/db");
  const db = getDb();
  let failed = 0;
  for (const check of CHECKS) {
    const result = await db.execute(sql.raw(check.query));
    const rows = (Array.isArray(result) ? result : (result as { rows: unknown[] }).rows) as { count: string | number }[];
    const count = Number(rows[0]?.count ?? 0);
    const ok = check.expectZero ? count === 0 : count > 0;
    if (!ok) failed += 1;
    console.log(`${ok ? "PASS" : "FAIL"}  ${check.name}: ${count.toLocaleString("en-CA")}`);
  }
  process.exit(failed ? 1 : 0);
}

main().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
