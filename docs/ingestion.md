# Ingestion

## Commands

```bash
npm run data:fetch                      # scripts/ingest/fetch_sources.py
python scripts/ingest/inspect_sources.py   # profile every workbook → data/processed/source-inspection.json
npm run data:ingest                     # scripts/ingest/run.py → Supabase
python scripts/ingest/run.py --dry-run  # every stage except writes
python scripts/ingest/run.py --export-dir data/processed/load   # write load payloads as JSON (local mode)
npm run analytics:rebuild               # recompute peer_metrics after any ingestion
```

`run.py` defaults to every `.xlsx` in `data/raw/bps` (except the normalized workbook), the newest file in `data/raw/schools`, and the newest in `data/raw/sif`. Override with `--schools`, `--energy`, `--coordinates`, `--year`, `--overrides`, `--board-aliases`, `--coordinate-overrides`.

## Stages

1. **Obtain** — `fetch_sources.py` queries the CKAN API for the three packages, keeps English editions, skips files already downloaded at the same size, and writes `data/raw/manifest.json` (name, resource id, URL, bytes, SHA-256, time).
2. **Validate** — each workbook's sheets are scanned; the sheet and header row with the most recognized column aliases are used (2011–2015 have title rows above the header). Required columns missing → the run stops with the headers it found.
3. **Archive** — raw files stay in `data/raw`; each run records every input's SHA-256 in the summary and `ingestion_runs.source_hash`.
4. **Normalize columns** by alias (`columns.py`).
5. **Identify school-board records** by sector (or, with no sector column, by the expanded organization name).
6. **Clean units/types** — exact conversions only; unrecognized units are flagged; "Not Available" and blanks are null.
7. **Normalize names** — accents, punctuation, abbreviations (`normalize.py`).
8. **Deduplicate** — one row per facility-year; later duplicates go to `rejected-rows.csv` and the kept row is flagged.
9. **Enrich** — Ministry directory (boards, schools) and official coordinates.
10. **Match** facilities to schools (`docs/matching.md`).
11. **Quality checks** — flags listed in `docs/data-dictionary.md`.
12. **Load** — upserts on natural keys in foreign-key order; batches of 500; duplicate keys within a batch abort the run.
13. **Analytics** — `npm run analytics:rebuild`.
14. **Report** — `data/processed/ingestion-summary.json`, `match-review.csv`, `rejected-rows.csv`, and an `ingestion_runs` row.

## Idempotency

Natural keys: `boards.board_number`, `schools.school_number`, `facilities.source_key`, `energy_records (facility_id, reporting_year)`. Re-running the same sources updates rows in place (verified by `tests/ingest/test_pipeline.py`, which loads twice and compares table sizes).

## When Ontario publishes a new year

```bash
npm run data:fetch
python scripts/ingest/inspect_sources.py   # check the new file's columns against docs/data-dictionary.md
python scripts/ingest/run.py --dry-run     # review the summary, flags, and unresolved organizations
npm run data:ingest && npm run analytics:rebuild && npm run admin:validate
```

If the new file introduces renamed columns, add the variant to `columns.py`; if a board appears under a new name, add it to `scripts/ingest/board_aliases.csv`.
