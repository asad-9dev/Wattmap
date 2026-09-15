/**
 * Local mode: load the pipeline's export into an embedded Postgres (PGlite) and rebuild analytics.
 *
 *     python scripts/ingest/run.py --export-dir data/processed/load
 *     npm run db:seed-local
 *     DATABASE_URL=pglite:./data/local-pglite npm run dev
 *
 * The data is exactly what the Supabase load would write; nothing is invented.
 */
import { existsSync, readFileSync, rmSync } from "node:fs";
import path from "node:path";
import { PGlite } from "@electric-sql/pglite";
import { sql } from "drizzle-orm";
import { drizzle } from "drizzle-orm/pglite";
import { migrate } from "drizzle-orm/pglite/migrator";
import * as schema from "@/drizzle/schema";
import { rebuildPeerMetrics } from "@/lib/db/rebuild";

const [exportDir = "data/processed/load", dbDir = "data/local-pglite"] = process.argv.slice(2);
const TIMESTAMP_FIELDS = new Set(["createdAt", "updatedAt", "importedAt", "startedAt", "finishedAt"]);
const BATCH = 500;

const TABLES = [
  ["boards", schema.boards],
  ["schools", schema.schools],
  ["facilities", schema.facilities],
  ["energy_records", schema.energyRecords],
  ["ingestion_runs", schema.ingestionRuns],
] as const;

/** Pipeline payloads use database column names; Drizzle expects the schema's property names. */
function toSchemaKeys(row: Record<string, unknown>): Record<string, unknown> {
  return Object.fromEntries(
    Object.entries(row).map(([key, value]) => {
      const camel = key.replace(/_([a-z0-9])/g, (_, c: string) => c.toUpperCase());
      return [camel, TIMESTAMP_FIELDS.has(camel) && typeof value === "string" ? new Date(value) : value];
    }),
  );
}

async function main(): Promise<void> {
  if (!existsSync(path.join(exportDir, "boards.json"))) {
    throw new Error(`No export found in ${exportDir}. Run: python scripts/ingest/run.py --export-dir ${exportDir}`);
  }
  rmSync(dbDir, { recursive: true, force: true });
  const db = drizzle(new PGlite(dbDir), { schema });
  await migrate(db, { migrationsFolder: "drizzle/migrations" });

  for (const [name, table] of TABLES) {
    const file = path.join(exportDir, `${name}.json`);
    if (!existsSync(file)) continue;
    const rows = (JSON.parse(readFileSync(file, "utf8")) as Record<string, unknown>[]).map(toSchemaKeys);
    for (let start = 0; start < rows.length; start += BATCH) {
      // Keep the export's ids so foreign keys between the files stay valid.
      await db.insert(table).overridingSystemValue().values(rows.slice(start, start + BATCH) as never);
    }
    await db.execute(sql.raw(`select setval(pg_get_serial_sequence('${name}', 'id'), coalesce((select max(id) from ${name}), 1))`));
    console.log(`${name}: ${rows.length} rows`);
  }

  const result = await rebuildPeerMetrics(db);
  console.log(`peer_metrics: ${result.records} rows, ${result.scored} with an Opportunity Score`);
  console.log(`\nLocal database ready. Start the app with DATABASE_URL=pglite:./${dbDir.replace(/^\.\//, "")}`);
}

main().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
