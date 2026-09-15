# WattMap project checklist

Status as of 2026-09-15. ✅ done and verified · 🟡 done, awaiting an external step · ⬜ not started

## Phase 0 — Repository and research
- ✅ Next.js 14 + TypeScript (strict) + Tailwind + ESLint + Vitest + Playwright
- ✅ Drizzle schema and migrations (0000 core tables, 0001 peer_metrics + ingestion_runs)
- ✅ Migrations applied to Supabase (6 tables, RLS enabled)
- ✅ Real source files downloaded and profiled (`inspect_sources.py`); data dictionary written

## Phase 1 — Data pipeline
- ✅ Fetch via CKAN API with manifest (URL, resource id, SHA-256)
- ✅ Three BPS layouts normalized (2011–2023; the 2024 file has no school-board rows)
- ✅ School directory + official coordinates (4,830 of 5,822 schools)
- ✅ Board resolution (abbreviations, word order, renames) — 0 unresolved organizations
- ✅ Matching tiers with confidence, review file, overrides
- ✅ Quality flags incl. plausibility bounds (423 implausible records flagged), rejected rows, summary, ingestion_runs
- ✅ Loaded into Supabase: 85 boards, 5,822 schools, 8,284 facilities, 64,166 energy records (retrying, idempotent upserts)

## Phase 2 — Analytics engine
- ✅ EUI, ekWh, GHG/electricity/gas intensity, energy gap
- ✅ Peer selection with relaxation, percentiles (mid-rank ties), robust z, YoY screening
- ✅ Trend (least squares, pandemic years excluded), Opportunity Score, score confidence, data confidence
- ✅ `peer_metrics` rebuilt on Supabase: 63,987 school/facility-years, 63,162 scored; `admin:validate` all PASS

## Phase 3 — Core website
- ✅ Homepage, search API + autocomplete, /schools, school profile, methodology, data, about

## Phase 4 — Exploration
- ✅ Map (clustered MapLibre, filters, mini-cards), compare (EUI and GHG trend switch), board profiles with filterable/sortable school table, board index, Ontario overview
- ✅ About page and Eco Club toolkit (`/toolkit`)
- ✅ Light / dark / system theme switch across pages, charts, and map

## Phase 5 — Reports
- ✅ Printable report page (print stylesheet, SVG charts)

## Phase 6 — Quality
- ✅ Error/empty/loading states, real 404s, error boundary, security headers, sitemap, robots, metadata
- ✅ Tests: 74 Vitest (unit + PGlite integration), 6 Python pipeline, 14 Playwright (desktop + mobile)
- ✅ Docs: README, architecture, methodology, data dictionary, ingestion, matching, deployment
- 🟡 Deployment to Vercel — needs the user's Vercel account
- ⬜ Manual review of ambiguous (1,045) / unmatched (1,845) facilities (`npm run admin:unresolved`)
- ⬜ Choose a licence for the source code
