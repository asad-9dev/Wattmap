/**
 * Server-side data access for pages and route handlers: cached (1 h, invalidated by the
 * "wattmap-data" tag after ingestion) and failure-safe, so an unreachable database renders an
 * error state instead of crashing the page. Never import this from a client component.
 */

import { createHash } from "node:crypto";
import { unstable_cache } from "next/cache";
import { getDb, type AnyDatabase } from "@/lib/db";
import { getBoardProfile, listBoards } from "@/lib/db/queries/boards";
import { getHomeStats, getMapPoints, getOntarioOverview } from "@/lib/db/queries/overview";
import {
  availableYears,
  getSchoolProfile,
  getSchoolsForCompare,
  latestReportingYear,
  listFilterOptions,
  listSchools,
} from "@/lib/db/queries/schools";
import { loadSearchSource } from "@/lib/db/queries/search";

export const DATA_TAG = "wattmap-data";
const REVALIDATE_SECONDS = 3600;

/**
 * Next's data cache outlives builds and restarts, so keys carry the deployed commit and a hash
 * of the database URL: a redeploy or a switch of database never serves results computed by other
 * code or from other data. Only the hash is stored, never the URL itself.
 */
const CACHE_VERSION = [
  process.env.VERCEL_GIT_COMMIT_SHA ?? "local",
  createHash("sha256")
    .update(process.env.DATABASE_URL ?? "")
    .digest("hex")
    .slice(0, 12),
].join(":");

function cached<A extends unknown[], T>(key: string, query: (db: AnyDatabase, ...args: A) => Promise<T>) {
  return unstable_cache((...args: A) => query(getDb(), ...args), [key, CACHE_VERSION], {
    revalidate: REVALIDATE_SECONDS,
    tags: [DATA_TAG],
  });
}

export const data = {
  homeStats: cached("home-stats", getHomeStats),
  ontario: cached("ontario", getOntarioOverview),
  mapPoints: cached("map-points", getMapPoints),
  schoolProfile: cached("school-profile", getSchoolProfile),
  compare: cached("compare", getSchoolsForCompare),
  boardProfile: cached("board-profile", getBoardProfile),
  boards: cached("boards", listBoards),
  schoolList: cached("school-list", listSchools),
  filterOptions: cached("filter-options", listFilterOptions),
  years: cached("years", availableYears),
  latestYear: cached("latest-year", latestReportingYear),
  searchSource: cached("search-source", loadSearchSource),
};

export type Loaded<T> = { ok: true; data: T } | { ok: false; reason: "unconfigured" | "unavailable" };

export async function load<T>(query: () => Promise<T>): Promise<Loaded<T>> {
  if (!process.env.DATABASE_URL) return { ok: false, reason: "unconfigured" };
  try {
    return { ok: true, data: await query() };
  } catch (error) {
    // Logged server-side only; visitors see a neutral message, never a stack trace.
    console.error("[wattmap] data load failed:", error instanceof Error ? error.message : error);
    return { ok: false, reason: "unavailable" };
  }
}
