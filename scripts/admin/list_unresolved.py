"""List facilities awaiting a human matching decision, most relevant first.

    python scripts/admin/list_unresolved.py                  # current facilities, all boards
    python scripts/admin/list_unresolved.py --board B66150 --status ambiguous --all-years

Reads data/processed/match-review.csv written by the last ingestion run. Record a decision with
scripts/admin/approve_match.py, then re-run ingestion.
"""

from __future__ import annotations

import argparse
import csv
import sys
from pathlib import Path

REVIEW = Path(__file__).resolve().parents[2] / "data" / "processed" / "match-review.csv"


def main(argv: list[str] | None = None) -> int:
    parser = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    parser.add_argument("--status", choices=["ambiguous", "unmatched"])
    parser.add_argument("--board", help="Ministry board number, e.g. B66150")
    parser.add_argument("--all-years", action="store_true", help="Include facilities no longer reporting")
    parser.add_argument("--limit", type=int, default=50)
    args = parser.parse_args(argv)
    if not REVIEW.exists():
        print("No review file yet. Run scripts/ingest/run.py first.", file=sys.stderr)
        return 1
    with REVIEW.open(newline="", encoding="utf-8") as handle:
        rows = list(csv.DictReader(handle))
    latest = max((int(r["latest_year"]) for r in rows), default=0)
    selected = [
        r
        for r in rows
        if (args.all_years or int(r["latest_year"]) == latest)
        and (not args.status or r["status"] == args.status)
        and (not args.board or r["board_number"] == args.board)
    ]
    print(f"{len(selected)} facilities (showing {min(len(selected), args.limit)})\n")
    for row in selected[: args.limit]:
        print(f"{row['facility_key'][:16]}…  {row['status']:<9}  {row['latest_year']}  {row['board_number'] or '—':<7}  {row['facility_name']} ({row['city']})")
        if row["candidates"]:
            print(f"{'':>20}candidates: {row['candidates']}")
    return 0


if __name__ == "__main__":
    sys.exit(main())
