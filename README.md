# WattMap

**See how Ontario schools use energy.** WattMap turns Ontario's public school-board energy reports into searchable, peer-benchmarked, fully explained school energy profiles.

> Screenshots: add after the first production deployment (`docs/screenshots/`).

WattMap is an independent project using publicly available data. It is not affiliated with or endorsed by the Government of Ontario or any school board.

## Problem

Every Ontario school board reports each facility's annual energy use and greenhouse-gas emissions, and the province publishes those reports as open data. They are hard to use: 13 years of large spreadsheets in three different layouts, units that change between years (and sometimes appear in French), facility names that don't match the Ministry's school directory, and no way to tell whether a school's number is high or low for a building like it.

## Solution

WattMap ingests every English BPS report from 2011 onward, maps each layout onto one schema, matches facilities to Ministry school records with explicit confidence, and benchmarks each school only against comparable schools. Every figure links back to its source row and a documented formula.

## Features

- **School search** with grouped, typo- and accent-tolerant autocomplete (schools, cities, boards)
- **School profiles**: total energy, Energy Use Intensity, GHG intensity, multi-year history, peer distribution, percentile, Energy Opportunity Score with confidence, modeled gap to the peer median, 3- and 5-year trends, data-confidence explanation
- **Map** of benchmarked schools (MapLibre, clustered, coloured by EUI, percentile, score, or GHG intensity)
- **Compare** 2–4 schools side by side
- **Board** and **Ontario** overviews that keep provincial totals separate from benchmarked schools
- **Printable report** for each school
- **Eco Club toolkit** (`/toolkit`): how students can read a profile, questions for facility staff, safe investigations
- **Light, dark, and system themes**, switched from the header; printed reports always use the light palette
- **Methodology** and **Data sources** pages describing exactly what is implemented

## Architecture

```mermaid
flowchart TD
  A[Ontario Data Catalogue<br/>BPS energy reports 2011–2024<br/>School directory · School information] -->|fetch_sources.py| B[data/raw + manifest.json]
  B -->|run.py: header detection, column aliases,<br/>exact unit conversions, quality flags| C[Normalized facility-years]
  C -->|matching.py: override → exact name → address<br/>→ near-identical name; fuzzy = review only| D[Facilities ↔ Ministry schools]
  D -->|Supabase upsert (idempotent)| E[(PostgreSQL<br/>boards · schools · facilities<br/>energy_records · ingestion_runs)]
  E -->|analytics:rebuild — lib/analytics pure functions| F[(peer_metrics)]
  E --> G[Next.js server components<br/>+ typed, validated route handlers]
  F --> G
  G --> H[WattMap UI]
  D -->|match-review.csv| R[Human review → match_overrides.csv]
  R --> D
```

More detail: [docs/architecture.md](docs/architecture.md).

## Tech stack

| Layer | Choice |
| --- | --- |
| App | Next.js 14 (App Router), React 18, TypeScript (strict), Tailwind CSS, Lucide icons |
| Charts / map | Recharts, plain SVG for print, MapLibre GL JS with OpenFreeMap (OpenStreetMap) tiles |
| Database | PostgreSQL on Supabase, Drizzle ORM + drizzle-kit migrations; PGlite for local mode and tests |
| Data processing | Python 3 · pandas · numpy · openpyxl · supabase-py |
| Validation | Zod on every query parameter |
| Tests | Vitest (unit + PGlite integration), Python unittest (pipeline), Playwright (end-to-end) |

## Data sources

- *Energy use and greenhouse gas emissions for the Broader Public Sector* — Government of Ontario
- *Ontario public school contact information* — Ministry of Education
- *School information and student demographics* — Ministry of Education (**coordinates only**; no student data is read)

All from the [Ontario Data Catalogue](https://data.ontario.ca), used under the Open Government Licence – Ontario. Field-level documentation: [docs/data-dictionary.md](docs/data-dictionary.md).

## Analytics methodology (summary)

```
EUI (GJ/m²)        = total site energy (GJ) ÷ floor area (m²)
percentile         = 100 × (peers below + ½ peers equal) ÷ peers          (higher = more energy per m²)
score              = round(100 × (0.8 × percentile/100 + 0.2 × clamp((trend%/yr + 10) / 20, 0, 1)))
energy gap (GJ)    = max(0, EUI − peer median EUI) × floor area
robust z           = 0.6745 × (EUI − peer median) ÷ MAD
```

Peers share the reporting year, operation type, and school level, with floor area 0.67–1.5× (relaxed step by step until ≥ 20 peers; ≥ 10 required). Full details: [docs/methodology.md](docs/methodology.md) and the in-app `/methodology` page.

## Local setup

Requirements: Node 20+ (tested on 24), Python 3.12+ (tested on 3.14).

```bash
npm install
python -m venv .venv
.venv/Scripts/python -m pip install -r requirements.txt     # macOS/Linux: .venv/bin/python
cp .env.example .env.local                                   # then fill in the values
```

### Environment variables

| Variable | Used by | Notes |
| --- | --- | --- |
| `DATABASE_URL` | Next.js server, Drizzle, admin scripts | Supabase **transaction pooler** URI (port 6543). `pglite:./data/local-pglite` selects local mode. Server-only. |
| `NEXT_PUBLIC_SUPABASE_URL` | Ingestion pipeline | Project URL (not secret). |
| `SUPABASE_SERVICE_ROLE_KEY` | Ingestion pipeline | Bypasses Row Level Security. Never expose to the browser. |
| `NEXT_PUBLIC_SITE_URL` | Metadata, sitemap | Production URL, e.g. `https://wattmap.ca`. |
| `NEXT_PUBLIC_MAP_STYLE_URL` | Map | Optional MapLibre style for the light theme; defaults to OpenFreeMap Positron. |
| `NEXT_PUBLIC_MAP_STYLE_URL_DARK` | Map | Optional MapLibre style for the dark theme; defaults to OpenFreeMap Dark. |

### Database setup

```bash
npm run db:migrate          # applies drizzle/migrations to DATABASE_URL
```

All tables have Row Level Security enabled with no policies: the public Supabase API exposes nothing, while the server connection and the service-role pipeline work normally.

## Ingestion

```bash
npm run data:fetch          # download/refresh official files into data/raw (skips unchanged)
npm run data:ingest         # normalize, match, quality-check, upsert into Supabase
npm run analytics:rebuild   # recompute peer_metrics
npm run admin:validate      # check database invariants
```

`python scripts/ingest/run.py --dry-run` runs every stage without writing. Each run writes `data/processed/ingestion-summary.json`, `match-review.csv`, and `rejected-rows.csv`. Re-running is idempotent. See [docs/ingestion.md](docs/ingestion.md) and [docs/matching.md](docs/matching.md).

### Admin utilities (`scripts/admin/`)

| Command | What it does |
| --- | --- |
| `npm run analytics:rebuild` | Recompute peer groups, percentiles, trends, and scores (`rebuild-analytics.ts`) |
| `npm run admin:unresolved` | List facilities awaiting a matching decision, current ones first |
| `npm run admin:approve -- <key> --school <number> --note "…"` | Record a verified match (or `--no-match`) that survives re-ingestion |
| `npm run admin:validate` | Check database invariants; exits non-zero on failure |
| `npm run admin:stats` | Export the provincial statistics shown on the site as JSON |

### Local mode (no Supabase needed)

```bash
.venv/Scripts/python scripts/ingest/run.py --export-dir data/processed/load
npm run db:seed-local
DATABASE_URL=pglite:./data/local-pglite npm run dev
```

## Tests

```bash
npm test                    # Vitest: analytics, formatting, search, and PGlite integration tests
npm run test:ingest         # Python pipeline tests
npm run build && npm run test:e2e   # Playwright (desktop + mobile) against the local database
```

## Deployment

Vercel for the app, Supabase for Postgres. Set the environment variables above in Vercel, run migrations and ingestion from a trusted machine or CI job, then deploy. See [docs/deployment.md](docs/deployment.md).

## Limitations

- Values are self-reported by boards; WattMap flags problems but does not correct them.
- 2011–2020 totals are derived from the ministry's published GJ/m² × floor area.
- Weather-normalized energy exists only for some facilities from 2021 onward and is never mixed with raw values.
- Facilities of schools closed before the current directory, and some renamed facilities, remain unmatched until reviewed.
- WattMap screens and benchmarks; it is not an energy audit and its score is not an official rating.

## Roadmap

Advanced map filtering, saved comparison links, shareable chart images, automated annual refresh in CI, richer reports, a public API, French-language UI, open-data exports, and a school Eco Club toolkit.

## Licence and attribution

Source data © King's Printer for Ontario, licensed under the [Open Government Licence – Ontario](https://www.ontario.ca/page/open-government-licence-ontario). A licence for the WattMap source code has not been chosen yet; add a `LICENSE` file before publishing the repository.
