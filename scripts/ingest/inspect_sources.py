"""Profile the raw Ontario source files before any mapping is trusted.

    python scripts/ingest/inspect_sources.py

For every workbook and sheet: row counts, the detected header row, column names, sector and
operation-type values, unit labels, missingness among school-board rows, and sample rows.
Full results go to data/processed/source-inspection.json; a short summary is printed.
"""

from __future__ import annotations

import json
import sys
from collections import Counter
from pathlib import Path

import pandas as pd

sys.path.insert(0, str(Path(__file__).parent))
from normalize import clean_text, fold, normalize_org_name  # noqa: E402

ROOT = Path(__file__).resolve().parents[2]
RAW_DIR = ROOT / "data" / "raw"
OUTPUT = ROOT / "data" / "processed" / "source-inspection.json"
MIN_HEADER_CELLS = 5
SCHOOL_BOARD_MARKERS = ("school board", "conseil scolaire", "school authority")


def _header_row(frame: pd.DataFrame) -> int:
    """First row with several text cells: title rows above the header have one or two."""
    for index in range(min(20, len(frame))):
        cells = [clean_text(v) for v in frame.iloc[index].tolist()]
        texts = [c for c in cells if c and not c.replace(".", "").replace(",", "").isdigit()]
        if len(texts) >= MIN_HEADER_CELLS:
            return index
    return 0


def _column(columns: list[str], *needles: str) -> str | None:
    for column in columns:
        folded = fold(column)
        if all(needle in folded for needle in needles):
            return column
    return None


def profile_sheet(frame: pd.DataFrame) -> dict:
    header = _header_row(frame)
    columns = [clean_text(v) or f"unnamed_{i}" for i, v in enumerate(frame.iloc[header].tolist())]
    body = frame.iloc[header + 1 :].dropna(how="all").reset_index(drop=True)
    body.columns = columns
    sector = _column(columns, "sector")
    organization = _column(columns, "organi")
    if sector:
        mask = body[sector].map(lambda v: any(m in fold(v) for m in SCHOOL_BOARD_MARKERS))
    elif organization:
        mask = body[organization].map(lambda v: any(m in normalize_org_name(v) for m in SCHOOL_BOARD_MARKERS))
    else:
        mask = pd.Series(False, index=body.index)
    boards = body[mask]
    operation = _column(columns, "operation", "type") or _column(columns, "property", "type")
    return {
        "header_row": header,
        "rows": len(body),
        "columns": columns,
        "sector_column": sector,
        "sector_values": dict(Counter(clean_text(v) for v in body[sector]).most_common(25)) if sector else None,
        "school_board_rows": int(mask.sum()),
        "school_board_organizations": int(boards[organization].nunique()) if organization and len(boards) else 0,
        "operation_types": dict(Counter(clean_text(v) for v in boards[operation]).most_common(30)) if operation and len(boards) else None,
        "unit_values": {
            c: dict(Counter(clean_text(v) for v in boards[c]).most_common(10)) for c in columns if "unit" in fold(c) and len(boards)
        },
        "missing_pct_school_board": {
            c: round(float(boards[c].isna().mean() * 100), 1) for c in columns
        } if len(boards) else None,
        "samples": [
            {c: clean_text(v) for c, v in row.items()} for _, row in boards.head(2).iterrows()
        ],
    }


def main() -> int:
    report: dict[str, dict] = {}
    for path in sorted(RAW_DIR.rglob("*.xlsx")):
        sheets = pd.read_excel(path, sheet_name=None, header=None, dtype=str)
        report[path.relative_to(RAW_DIR).as_posix()] = {
            name: profile_sheet(frame) for name, frame in sheets.items() if not frame.empty
        }
        for name, profile in report[path.relative_to(RAW_DIR).as_posix()].items():
            print(f"{path.name} [{name}] header@{profile['header_row']} rows={profile['rows']} "
                  f"cols={len(profile['columns'])} school_board_rows={profile['school_board_rows']}")
    OUTPUT.parent.mkdir(parents=True, exist_ok=True)
    OUTPUT.write_text(json.dumps(report, indent=2, ensure_ascii=False), encoding="utf-8")
    print(f"\nwrote {OUTPUT.relative_to(ROOT)}")
    return 0


if __name__ == "__main__":
    sys.exit(main())
