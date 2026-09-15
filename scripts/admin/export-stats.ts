/**
 * Export the provincial statistics shown on the site as JSON, e.g. for a report or an audit trail.
 *
 *     npm run admin:stats [-- output.json]
 */
import { mkdirSync, writeFileSync } from "node:fs";
import path from "node:path";
import { config } from "dotenv";

config({ path: [".env.local", ".env"], quiet: true });

async function main(): Promise<void> {
  const { getDb } = await import("@/lib/db");
  const { getDataSourceInfo, getHomeStats, getOntarioOverview } = await import("@/lib/db/queries/overview");
  const db = getDb();
  const [home, ontario, sources] = await Promise.all([getHomeStats(db), getOntarioOverview(db), getDataSourceInfo(db)]);
  const output = process.argv[2] ?? path.join("data", "processed", `stats-${new Date().toISOString().slice(0, 10)}.json`);
  mkdirSync(path.dirname(output), { recursive: true });
  const { distribution, ...overview } = ontario ?? { distribution: [] };
  writeFileSync(
    output,
    JSON.stringify({ generatedAt: new Date().toISOString(), home, ontario: { ...overview, benchmarkedSchools: distribution.length }, coverage: { years: sources.years, matchStatus: sources.matchStatus, flaggedRecords: sources.flaggedRecords } }, null, 2),
  );
  console.log(`Wrote ${output}`);
  process.exit(0);
}

main().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
