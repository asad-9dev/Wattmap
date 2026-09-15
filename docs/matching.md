# Facility-to-school matching

Implemented in `scripts/ingest/matching.py`; tested in `tests/ingest/test_pipeline.py`.

## 1. Board resolution

Each BPS organization name is resolved to a Ministry board number using `board_key` (`normalize.py`): accents and punctuation folded, abbreviations expanded (DSB, CDSB, CSB, CS, CSDC, CEP, SA…), filler words removed (of, the, de, du, des…), tokens sorted. "Peterborough … District Catholic School Board" and "Peterborough … CDSB" produce the same key. Former and long-form names that still differ are listed in `scripts/ingest/board_aliases.csv` (e.g. Centre-Sud → CS catholique MonAvenir). The 2026-09-15 run resolved every organization.

## 2. Tiers

| Order | Method | Rule | Confidence | Accepted automatically |
| --- | --- | --- | --- | --- |
| 0 | `override` | a row in `match_overrides.csv` | 1.00 | yes (human-verified) |
| 1 | `exact_name_board` | normalized facility name = normalized school name, same board | 1.00 | yes, if exactly one school |
| 2 | `address_board` | normalized street + city, same board | 0.95 | yes, if exactly one school |
| 3 | `name_city_board` | token-sorted similarity ≥ 0.90, same city and board, ≥ 0.05 ahead of the runner-up | 0.85 | yes, if unique |
| 4 | `fuzzy` | similarity ≥ 0.75 anywhere in the board (top 3) | 0.50 | **never** — candidates for review |

A tier that finds more than one school stops matching and marks the facility `ambiguous` with its candidates stored in `facilities.match_candidates`. A facility with no board, or no candidate at any tier, is `unmatched`. Only `matched` facilities may reference a school (database check constraint).

## 3. Human review

```bash
npm run admin:unresolved                       # current facilities awaiting a decision
npm run admin:unresolved -- --board B66150 --status ambiguous
npm run admin:approve -- <key-prefix> --school 123456 --note "Board facility list, 2026"
npm run admin:approve -- <key-prefix> --no-match --note "Administrative building"
```

Decisions are written to `scripts/ingest/match_overrides.csv` and applied on the next ingestion, so they survive every re-run. Facility keys are stable: SHA-256 of resolved board number, normalized facility name, and normalized city.

## Known sources of unmatched facilities

- Schools closed before the current (August 2026) Ministry directory.
- Administrative, storage, and adult-education buildings (correctly unmatched).
- Facilities reported under campus or program names ("Prince Charles Sec/AEC").
- Shared buildings reported once for several Ministry schools.
