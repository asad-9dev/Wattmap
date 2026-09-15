# Deployment

## Database (Supabase)

1. In Supabase → Connect, copy the **Transaction pooler** URI (port 6543) into `DATABASE_URL`. The client sets `prepare: false`, which the transaction pooler requires.
2. `npm run db:migrate` from a trusted machine. Migrations enable Row Level Security on every table without policies, so the public REST API returns nothing.
3. Load data: `npm run data:fetch && npm run data:ingest && npm run analytics:rebuild && npm run admin:validate`. Ingestion needs `NEXT_PUBLIC_SUPABASE_URL` and `SUPABASE_SERVICE_ROLE_KEY`; keep the service-role key off Vercel — the app does not need it.

## App (Vercel)

1. Import the repository; framework preset Next.js; build command `npm run build`.
2. Environment variables: `DATABASE_URL` (server-only), `NEXT_PUBLIC_SITE_URL` (canonical URL for metadata and the sitemap), optionally `NEXT_PUBLIC_MAP_STYLE_URL`.
3. Pages read through `unstable_cache` for one hour. Cache keys include the deployed commit (`VERCEL_GIT_COMMIT_SHA`) and a hash of `DATABASE_URL`, so a redeploy always starts from fresh results. After loading new data, either wait an hour or redeploy. Locally, delete `.next/cache` after re-ingesting if you need fresh pages immediately.

## Security

- Secrets live only in `.env.local` (git-ignored, as is every `.env*` except `.env.example`) and in the hosting provider's settings.
- Security headers are set in `next.config.mjs`; route handlers validate every parameter with Zod and never return stack traces.
- The map uses keyless OpenFreeMap tiles; no API keys reach the browser.

## Annual refresh

Run the "When Ontario publishes a new year" steps in `docs/ingestion.md`. A scheduled CI job can run the same commands with the three database secrets stored as encrypted CI variables.
