/**
 * Recompute peer benchmarks, percentiles, trends, and Opportunity Scores for every
 * facility-year. Run after each ingestion:
 *
 *     npm run analytics:rebuild
 */
import { config } from "dotenv";

config({ path: [".env.local", ".env"], quiet: true });

async function main(): Promise<void> {
  // Imported after dotenv so the database module sees DATABASE_URL.
  const { getDb } = await import("@/lib/db");
  const { rebuildPeerMetrics } = await import("@/lib/db/rebuild");
  const started = Date.now();
  const result = await rebuildPeerMetrics(getDb());
  console.log(
    `peer_metrics rebuilt: ${result.records} facility-years, ${result.scored} with an Opportunity Score (${((Date.now() - started) / 1000).toFixed(1)} s)`,
  );
  process.exit(0);
}

main().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
