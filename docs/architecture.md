# Architecture

## Repository layout

```
app/                    Next.js routes (server components) and route handlers (app/api/*)
components/             UI: site chrome, charts (Recharts + SVG), map (MapLibre), search, primitives
lib/
  analytics/            Pure, unit-tested calculations. metrics.ts is the public entry point that
                        re-exports formulas (EUI, intensities, gap), peers, stats, score, and
                        confidence; plus anomaly, series, histogram, rebuild (entity-year benchmarking)
  db/                   Drizzle client (Supabase or PGlite), queries/ (read models), rebuild (I/O)
  search/               In-memory grouped autocomplete
  validation/           Zod schemas for query parameters
  data.ts               Cached, failure-safe data access for pages
  format.ts             Display formatting (all rounding happens here)
drizzle/                schema.ts and generated SQL migrations
scripts/
  ingest/               Python ETL: fetch_sources, inspect_sources, run, columns, normalize, matching, load
  admin/                rebuild-analytics (recompute peer_metrics), list_unresolved,
                        approve_match, validate-db, export-stats
  dev/seed-local.ts     Load a pipeline export into local PGlite
tests/                  unit/, integration/ (PGlite), ingest/ (Python), e2e/ (Playwright)
data/raw|processed      Downloaded sources and pipeline outputs (git-ignored)
```

## Data flow

1. **Fetch** (`fetch_sources.py`) discovers resources through the Ontario Data Catalogue CKAN API and records URL, resource id, size, and SHA-256 in `data/raw/manifest.json`.
2. **Ingest** (`run.py`) detects each sheet's header row, maps columns by alias (never by position), converts units with exact factors only, flags quality problems, resolves organizations to Ministry boards, deduplicates facility-years, and matches facilities to schools.
3. **Load** upserts in foreign-key order (boards → schools → facilities → energy_records) on natural keys, then records an `ingestion_runs` row. Re-runs update in place.
4. **Rebuild** (`analytics:rebuild`) reads all facility-years, combines facilities matched to the same school per year, selects peers, and writes `peer_metrics`. Keeping the results in a table lets list, map, and sort queries stay simple SQL.
5. **Serve**: server components call `lib/data.ts`, which wraps the query modules in `unstable_cache` (1 h, tag `wattmap-data`) and converts database failures into an "unavailable" state instead of an error page.

## Key decisions

- **Entity = school, not facility.** Facility names change across layouts (≈ 470 per year at the 2020→2021 change). Benchmarks and history use every facility matched to a school, so a school's series stays continuous. Unmatched facilities are benchmarked as themselves but have no public profile.
- **Facility identity** is a hash of resolved board number + normalized facility name + city, stable across file layouts and board renames.
- **Matching never forces uncertain links.** The `facilities_school_only_when_matched` check constraint makes it impossible to store a school link without an accepted match.
- **Row Level Security on, no policies.** Supabase's auto-generated API exposes nothing; the app uses a direct Postgres connection and the pipeline uses the service-role key.
- **Search in memory.** About 6,000 short strings; a Dice-coefficient matcher avoids depending on `pg_trgm`/`unaccent`, which a default Supabase project does not enable.
- **Local mode.** `DATABASE_URL=pglite:<dir>` runs the whole app on an embedded Postgres loaded from a real pipeline export — used for development and end-to-end tests without secrets.
- **Theming.** Every colour is a CSS variable (`app/globals.css`) consumed by Tailwind tokens, so light and dark swap the whole palette; the dark palette applies on screens only, so reports always print light. A tiny inline script (`lib/theme.ts`) applies the saved or system theme before first paint. Recharts and MapLibre read the same variables through `components/theme/useTheme.ts`; server-rendered SVG charts use theme classes directly. The header switch offers light, dark, and system.
- **Eco Club toolkit.** `/toolkit` is static guidance for students (reading a profile, questions for staff, non-invasive investigations, a prominent safety section), linked from the header and footer.
