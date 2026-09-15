import type { PgDatabase, PgQueryResultHKT } from "drizzle-orm/pg-core";
import { drizzle, type PostgresJsDatabase } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import * as schema from "@/drizzle/schema";

export type Database = PostgresJsDatabase<typeof schema>;
/** Any Postgres driver: postgres.js for Supabase, PGlite for local mode and tests. */
export type AnyDatabase = PgDatabase<PgQueryResultHKT, typeof schema>;

// Next.js re-evaluates modules on every dev reload; caching on globalThis stops each reload from
// opening a new connection pool.
const globalForDb = globalThis as unknown as { wattmapDb?: AnyDatabase };

function createDatabase(url: string): AnyDatabase {
  if (url.startsWith("pglite:")) {
    // Local mode: an embedded Postgres stored in a directory, e.g. DATABASE_URL=pglite:./data/local-pglite.
    // Loaded lazily so production bundles never touch it.
    const { PGlite } = require("@electric-sql/pglite") as typeof import("@electric-sql/pglite");
    const { drizzle: drizzlePglite } = require("drizzle-orm/pglite") as typeof import("drizzle-orm/pglite");
    return drizzlePglite(new PGlite(url.slice("pglite:".length)), { schema });
  }
  // Supabase's transaction pooler does not support prepared statements.
  return drizzle(postgres(url, { prepare: false }), { schema });
}

/**
 * Server-only database handle. Created lazily so `next build` succeeds without credentials.
 * Never import this from a client component.
 */
export function getDb(): AnyDatabase {
  if (globalForDb.wattmapDb) return globalForDb.wattmapDb;
  const url = process.env.DATABASE_URL;
  if (!url) throw new Error("DATABASE_URL is not set. Copy .env.example to .env.local and fill it in.");
  const db = createDatabase(url);
  globalForDb.wattmapDb = db;
  return db;
}
