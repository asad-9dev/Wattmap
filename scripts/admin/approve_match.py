"""Record a verified facility-to-school decision so it survives every future ingestion.

    python scripts/admin/approve_match.py FACILITY_KEY --school 123456 --note "Confirmed with board site list"
    python scripts/admin/approve_match.py FACILITY_KEY --no-match --note "Administrative building"

FACILITY_KEY may be the full key or a unique prefix from list_unresolved.py. The decision is
written to scripts/ingest/match_overrides.csv (replacing any earlier decision for the facility).
"""

from __future__ import annotations

import argparse
import csv
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
OVERRIDES = ROOT / "scripts" / "ingest" / "match_overrides.csv"
REVIEW = ROOT / "data" / "processed" / "match-review.csv"
FIELDS = ["facility_key", "decision", "school_number", "note"]

sys.path.insert(0, str(ROOT / "scripts" / "ingest"))


def _known_school_numbers() -> set[str]:
    import run  # imported lazily: pulls in pandas

    school_file = run._latest("schools")
    if school_file is None:
        raise SystemExit("No school directory in data/raw/schools. Run scripts/ingest/fetch_sources.py.")
    schools, _ = run.prepare_schools(school_file, [])
    return {school["school_number"] for school in schools}


def _resolve_key(prefix: str) -> str:
    if len(prefix) == 64 or not REVIEW.exists():
        return prefix
    with REVIEW.open(newline="", encoding="utf-8") as handle:
        keys = [row["facility_key"] for row in csv.DictReader(handle) if row["facility_key"].startswith(prefix)]
    if len(keys) != 1:
        raise SystemExit(f"'{prefix}' matches {len(keys)} facilities in the review file; give more characters.")
    return keys[0]


def main(argv: list[str] | None = None) -> int:
    parser = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    parser.add_argument("facility_key")
    decision = parser.add_mutually_exclusive_group(required=True)
    decision.add_argument("--school", help="Ministry school number the facility belongs to")
    decision.add_argument("--no-match", action="store_true", help="The facility is not a Ministry school")
    parser.add_argument("--note", required=True, help="How the decision was verified")
    args = parser.parse_args(argv)

    key = _resolve_key(args.facility_key)
    if args.school and args.school not in _known_school_numbers():
        raise SystemExit(f"School number {args.school} is not in the current Ministry directory.")
    rows: list[dict[str, str]] = []
    if OVERRIDES.exists():
        with OVERRIDES.open(newline="", encoding="utf-8") as handle:
            rows = [row for row in csv.DictReader(handle) if row["facility_key"] != key]
    rows.append({"facility_key": key, "decision": "no_match" if args.no_match else "match", "school_number": args.school or "", "note": args.note})
    with OVERRIDES.open("w", newline="", encoding="utf-8") as handle:
        writer = csv.DictWriter(handle, fieldnames=FIELDS)
        writer.writeheader()
        writer.writerows(rows)
    print(f"Recorded {rows[-1]['decision']} for {key[:16]}… in {OVERRIDES.relative_to(ROOT)}. Re-run ingestion to apply.")
    return 0


if __name__ == "__main__":
    sys.exit(main())
