"""WattMap ingestion pipeline.

    python scripts/ingest/run.py                 # all files in data/raw/bps and data/raw/schools
    python scripts/ingest/run.py --dry-run       # every stage except the database writes
    python scripts/ingest/run.py --schools FILE --energy FILE [FILE ...]

Stages: read sources → detect headers and map columns → keep school-board records → clean
units → normalize names → deduplicate → match facilities to schools → quality flags →
upsert into Supabase → write the ingestion report to data/processed/.
"""

from __future__ import annotations

import argparse
import csv
import hashlib
import json
import os
import re
import sys
from collections import Counter
from collections.abc import Callable
from datetime import datetime, timezone
from pathlib import Path
from typing import Any, Protocol

import pandas as pd
from dotenv import load_dotenv

from columns import (
    BPS_COLUMN_ALIASES,
    BPS_REQUIRED,
    BPS_SOURCE_DATASET,
    COORDINATE_ALIASES,
    CUSTOM_SLOTS,
    FUEL_OIL_FIELDS,
    OTHER_ENERGY_FIELDS,
    SCHOOL_COLUMN_ALIASES,
    SCHOOL_REQUIRED,
    SCHOOL_SOURCE_DATASET,
)
from load import SupabaseLoader, json_safe
from matching import SchoolIndex, build_board_lookup, load_board_aliases, load_overrides, match_facility
from normalize import (
    AREA_TO_M2,
    ELECTRICITY_TO_KWH,
    GAS_REPORTED_IN_GJ,
    GAS_TO_M3,
    GJ_PER_KWH,
    KG_PER_TONNE,
    board_key,
    clean_text,
    convert_quantity,
    fold,
    map_columns,
    normalize_header,
    normalize_org_name,
    normalize_postal_code,
    normalize_school_name,
    slugify,
    stable_hash,
    to_float,
)

ROOT = Path(__file__).resolve().parents[2]
RAW_DIR = ROOT / "data" / "raw"
PROCESSED_DIR = ROOT / "data" / "processed"
DEFAULT_OVERRIDES = Path(__file__).with_name("match_overrides.csv")
DEFAULT_BOARD_ALIASES = Path(__file__).with_name("board_aliases.csv")
DEFAULT_COORDINATE_OVERRIDES = Path(__file__).with_name("coordinate_overrides.csv")

# Ontario's bounding box, padded; a point outside it is a data error, not a school.
ONTARIO_LAT = (41.5, 57.0)
ONTARIO_LON = (-95.5, -74.0)

HEADER_SCAN_ROWS = 15  # 2011–2015 workbooks put title rows above the real header.
SCHOOL_BOARD_MARKERS = ("school board", "conseil scolaire", "school authority")
PANDEMIC_YEARS = {2020, 2021}  # tagged so trend analytics can treat them explicitly
ENERGY_FIELDS = (
    "electricity_kwh",
    "electricity_gj",
    "natural_gas_m3",
    "natural_gas_gj",
    "fuel_oil_gj",
    "other_energy_gj",
    "total_site_energy_gj",
    "normalized_total_energy_gj",
)
SCHOOL_TEXT_FIELDS = ("school_type", "language", "grade_range", "region", "street", "city", "province", "website")

# Plausibility bounds for a school-board building, set from the observed 2011–2023 distribution
# (median EUI ≈ 0.6 GJ/m², 99.9th percentile ≈ 5; median GHG intensity ≈ 25 kg CO₂e/m²). Values
# outside them are source errors — e.g. 2013 rows reporting ~600,000 GJ/m², floor areas entered
# ten times too large, or zero energy for buildings with floor area. They are flagged and kept,
# and excluded from peer groups, scores, and totals.
EUI_PLAUSIBLE_GJ_M2 = (0.05, 5.0)
GHG_PLAUSIBLE_MAX_KG_M2 = 500.0

Row = dict[str, Any]


class Loader(Protocol):
    def upsert(self, table: str, rows: list[Row], on_conflict: tuple[str, ...]) -> list[Row]: ...

    def insert(self, table: str, row: Row) -> None: ...


class ExportLoader:
    """Writes the exact load payloads to JSON instead of Supabase (for a local database or for
    inspection). Ids are assigned sequentially per table, as the database would."""

    def __init__(self, directory: Path) -> None:
        self.directory = directory
        self.tables: dict[str, list[Row]] = {}

    def upsert(self, table: str, rows: list[Row], on_conflict: tuple[str, ...]) -> list[Row]:
        stored = [{**json_safe(row), "id": index} for index, row in enumerate(rows, start=1)]
        self.tables[table] = stored
        return stored

    def insert(self, table: str, row: Row) -> None:
        rows = self.tables.setdefault(table, [])
        rows.append({**json_safe(row), "id": len(rows) + 1})

    def write(self) -> None:
        self.directory.mkdir(parents=True, exist_ok=True)
        for table, rows in self.tables.items():
            (self.directory / f"{table}.json").write_text(json.dumps(rows, ensure_ascii=False), encoding="utf-8")


# ── Reading ─────────────────────────────────────────────────────────────────────────────


def read_table(path: Path, aliases: dict[str, list[str]]) -> pd.DataFrame:
    """Read a CSV or workbook as text, picking the sheet and header row matching the most aliases."""
    suffix = path.suffix.lower()
    if suffix == ".csv":
        frames = [_read_csv(path)]
    elif suffix in {".xlsx", ".xlsm", ".xls"}:
        frames = list(pd.read_excel(path, sheet_name=None, header=None, dtype=str).values())
    else:
        raise ValueError(f"Unsupported file type: {path.name}")
    candidates = [_with_detected_header(frame, aliases) for frame in frames if not frame.empty]
    if not candidates:
        raise ValueError(f"{path.name} contains no data")
    return max(candidates, key=lambda pair: pair[1])[0]


def _read_csv(path: Path) -> pd.DataFrame:
    # csv.reader rather than pd.read_csv: pandas fixes the field count from the first line,
    # so a one-cell title row above the real header makes it reject the whole file.
    for encoding in ("utf-8-sig", "cp1252"):
        try:
            with path.open(newline="", encoding=encoding) as handle:
                rows = list(csv.reader(handle))
        except UnicodeDecodeError:
            continue
        width = max((len(row) for row in rows), default=0)
        return pd.DataFrame(
            [[cell if cell != "" else None for cell in row] + [None] * (width - len(row)) for row in rows],
            dtype=object,
        )
    raise ValueError(f"{path.name}: not UTF-8 or Windows-1252 text")


def _with_detected_header(frame: pd.DataFrame, aliases: dict[str, list[str]]) -> tuple[pd.DataFrame, int]:
    scan = range(min(HEADER_SCAN_ROWS, len(frame)))
    scores = [len(map_columns(frame.iloc[i].tolist(), aliases)) for i in scan]
    header_row = scores.index(max(scores))
    headers: list[str] = []
    seen: Counter[str] = Counter()
    for position, value in enumerate(frame.iloc[header_row].tolist()):
        name = clean_text(value) or f"unnamed_{position}"
        seen[name] += 1
        headers.append(name if seen[name] == 1 else f"{name}.{seen[name] - 1}")
    body = frame.iloc[header_row + 1 :].reset_index(drop=True)
    body.columns = headers
    return body.dropna(how="all"), scores[header_row]


def _require_columns(raw: pd.DataFrame, aliases: dict[str, list[str]], required: set[str], path: Path) -> dict[str, str]:
    mapping = map_columns(raw.columns, aliases)
    missing = required - mapping.keys()
    if missing:
        raise ValueError(f"{path.name}: required columns {sorted(missing)} not found; headers: {list(raw.columns)}")
    return mapping


def _rejection(path: Path, row_number: int, reason: str, row: Row) -> Row:
    return {
        "source_file": path.name,
        "data_row": row_number,
        "reason": reason,
        "row_json": json.dumps(json_safe(row), ensure_ascii=False),
    }


def file_sha256(path: Path) -> str:
    digest = hashlib.sha256()
    with path.open("rb") as handle:
        for block in iter(lambda: handle.read(1 << 20), b""):
            digest.update(block)
    return digest.hexdigest()


# ── School directory ────────────────────────────────────────────────────────────────────


def normalize_school_level(value: object) -> str | None:
    # Ministry values: "Elementary", "Secondary", and "Elem/Sec" for combined schools.
    tokens = set(normalize_header(value).split())
    elementary = bool(tokens & {"elem", "elementary", "elementaire"})
    secondary = bool(tokens & {"sec", "secondary", "secondaire"})
    if elementary and secondary:
        return "combined"
    return "elementary" if elementary else "secondary" if secondary else None


def prepare_schools(path: Path, rejected: list[Row]) -> tuple[list[Row], list[Row]]:
    """Return (schools, boards) from the Ministry school directory."""
    raw = read_table(path, SCHOOL_COLUMN_ALIASES)
    mapping = _require_columns(raw, SCHOOL_COLUMN_ALIASES, SCHOOL_REQUIRED, path)
    schools: dict[str, Row] = {}
    boards: dict[str, Row] = {}
    for row_number, row in enumerate(raw.to_dict("records"), start=1):
        record = {field: clean_text(row[source]) for field, source in mapping.items()}
        if not all(record[field] for field in SCHOOL_REQUIRED):
            rejected.append(_rejection(path, row_number, "missing_required_school_field", row))
            continue
        if record["school_number"] in schools:
            rejected.append(_rejection(path, row_number, "duplicate_school_number", row))
            continue
        schools[record["school_number"]] = record
        boards.setdefault(
            record["board_number"],
            {
                "board_number": record["board_number"],
                "name": record["board_name"],
                "board_type": record.get("board_type"),
                "language": record.get("board_language"),
                "region": record.get("region"),
                "website": record.get("board_website"),
            },
        )
    return list(schools.values()), list(boards.values())


def ontario_coordinates(latitude: object, longitude: object) -> tuple[float, float] | None:
    lat, lon = to_float(latitude), to_float(longitude)
    if lat is None or lon is None:
        return None
    if not (ONTARIO_LAT[0] <= lat <= ONTARIO_LAT[1] and ONTARIO_LON[0] <= lon <= ONTARIO_LON[1]):
        return None
    return lat, lon


def attach_coordinates(schools: list[Row], coordinate_file: Path | None, overrides_file: Path) -> None:
    """Set official coordinates from the Ministry School Information file; manual overrides win.

    Schools absent from both keep null coordinates and are left off the map rather than placed
    at a guessed location.
    """
    found: dict[str, tuple[tuple[float, float], str]] = {}
    if coordinate_file is not None:
        raw = read_table(coordinate_file, COORDINATE_ALIASES)
        mapping = _require_columns(raw, COORDINATE_ALIASES, set(COORDINATE_ALIASES), coordinate_file)
        source = f"ontario-school-information:{coordinate_file.stem}"
        for row in raw.to_dict("records"):
            number = clean_text(row[mapping["school_number"]])
            point = ontario_coordinates(row[mapping["latitude"]], row[mapping["longitude"]])
            if number and point:
                found[number] = (point, source)
    if overrides_file.exists():
        with overrides_file.open(newline="", encoding="utf-8") as handle:
            for line, row in enumerate(csv.DictReader(handle), start=2):
                number = (row.get("school_number") or "").strip()
                point = ontario_coordinates(row.get("latitude"), row.get("longitude"))
                if not number or point is None:
                    raise ValueError(f"{overrides_file.name}:{line}: need school_number and an Ontario latitude/longitude")
                found[number] = (point, "manual-override")
    for school in schools:
        point, source = found.get(school["school_number"], (None, None))
        school["latitude"], school["longitude"] = point if point else (None, None)
        school["coordinates_source"] = source


# ── BPS energy files ────────────────────────────────────────────────────────────────────


def _year_in(text: str) -> int | None:
    years = set(re.findall(r"(?<!\d)(20\d{2})(?!\d)", text))
    return int(years.pop()) if len(years) == 1 else None


def _parse_year(value: object) -> int | None:
    number = to_float(value)
    if number is not None and number.is_integer():
        return int(number)
    return _year_in(clean_text(value) or "")


def _reporting_period(year_ending: object) -> tuple[str | None, str | None]:
    """Layout C gives the period's last day; the period is the twelve months ending then."""
    text = clean_text(year_ending)
    if not text:
        return None, None
    try:
        end = pd.Timestamp(text)
    except (ValueError, TypeError):
        return None, None
    start = end - pd.DateOffset(years=1) + pd.Timedelta(days=1)
    return start.date().isoformat(), end.date().isoformat()


def _is_school_board(sector: object, organization: str | None, has_sector_column: bool) -> bool:
    # Without a sector column, fall back to the org name with abbreviations expanded ("DSB").
    text = fold(sector) if has_sector_column else normalize_org_name(organization)
    return any(marker in text for marker in SCHOOL_BOARD_MARKERS)


def _measures(cell: Callable[[str], object]) -> tuple[Row, list[str]]:
    """Clean one row's measures into WattMap units. Returns (measures, flags)."""
    flags: list[str] = []

    def number(name: str) -> float | None:
        return to_float(cell(name))

    def converted(quantity: str, unit: str, factors: dict[str, float], label: str) -> float | None:
        amount, recognized = convert_quantity(cell(quantity), cell(unit), factors)
        if not recognized:
            flags.append(f"unrecognized_unit:{label}")
        return amount

    def reported_sum(fields: tuple[str, ...]) -> float | None:
        values = [value for value in (number(field) for field in fields) if value is not None]
        return sum(values) if values else None

    floor_area = number("floor_area_m2")
    if floor_area is None:
        floor_area = converted("floor_area_quantity", "floor_area_unit", AREA_TO_M2, "floor_area")

    electricity_kwh = number("electricity_kwh")
    if electricity_kwh is None:
        electricity_kwh = converted("electricity_quantity", "electricity_unit", ELECTRICITY_TO_KWH, "electricity")
    electricity_gj = number("electricity_gj")
    if electricity_gj is None and electricity_kwh is not None:
        electricity_gj = electricity_kwh * GJ_PER_KWH  # exact, unlike fuel conversions

    # Gas GJ is taken only as reported: converting m³ would need an assumed heating value.
    natural_gas_m3: float | None = None
    natural_gas_gj = number("natural_gas_gj")
    gas_quantity = number("natural_gas_quantity")
    if natural_gas_gj is None and gas_quantity is not None:
        gas_unit = normalize_header(cell("natural_gas_unit"))
        if gas_quantity == 0 or gas_unit in GAS_TO_M3:
            natural_gas_m3 = gas_quantity * GAS_TO_M3.get(gas_unit, 1.0)
        elif gas_unit in GAS_REPORTED_IN_GJ:
            natural_gas_gj = gas_quantity
        else:
            flags.append("unrecognized_unit:natural_gas")

    total = number("total_site_energy_gj")
    reported_eui = number("reported_eui_gj_m2")
    if total is None and reported_eui is not None and floor_area is not None and floor_area > 0:
        # 2011–2020 files publish the ministry's GJ/m² but not the total; intensity × area
        # recovers their total without any fuel conversion factor of our own.
        total = reported_eui * floor_area
        flags.append("total_energy_derived_from_reported_intensity")

    ghg_kg = number("ghg_kg_co2e")
    ghg_tonnes = number("ghg_tonnes_co2e")
    if ghg_kg is None and ghg_tonnes is not None:
        ghg_kg = ghg_tonnes * KG_PER_TONNE

    weekly_hours, portables = number("weekly_hours"), number("portable_count")
    for slot in CUSTOM_SLOTS:
        label = normalize_header(cell(f"custom_{slot}_name"))
        if label == "weekly average hours" and weekly_hours is None:
            weekly_hours = number(f"custom_{slot}_value")
        elif label == "number of portables" and portables is None:
            portables = number(f"custom_{slot}_value")

    measures: Row = {
        "electricity_kwh": electricity_kwh,
        "electricity_gj": electricity_gj,
        "natural_gas_m3": natural_gas_m3,
        "natural_gas_gj": natural_gas_gj,
        "fuel_oil_gj": reported_sum(FUEL_OIL_FIELDS),
        "other_energy_gj": reported_sum(OTHER_ENERGY_FIELDS),
        "total_site_energy_gj": total,
        "normalized_total_energy_gj": number("normalized_total_energy_gj"),
        "ghg_kg_co2e": ghg_kg,
        "normalized_ghg_kg_co2e": None,  # no source publishes a comparable normalized GHG in kg
        "floor_area_m2": floor_area,
        "weekly_hours": weekly_hours,
        "portable_count": int(portables) if portables is not None and portables.is_integer() else None,
    }
    return measures, flags


def quality_flags(measures: Row, year: int) -> list[str]:
    flags: list[str] = []
    area = measures["floor_area_m2"]
    total = measures["total_site_energy_gj"]
    if area is None:
        flags.append("missing_floor_area")
    elif area <= 0:
        flags.append("nonpositive_floor_area")
    if total is None:
        flags.append("missing_total_energy")
    elif total == 0 and (measures["electricity_kwh"] or 0) > 0:
        flags.append("zero_total_with_reported_consumption")
    if any(measures[field] is not None and measures[field] < 0 for field in ENERGY_FIELDS):
        flags.append("negative_energy_value")
    if area is not None and area > 0:
        ghg = measures["ghg_kg_co2e"]
        eui_out = total is not None and not (EUI_PLAUSIBLE_GJ_M2[0] <= total / area <= EUI_PLAUSIBLE_GJ_M2[1])
        ghg_out = ghg is not None and ghg / area > GHG_PLAUSIBLE_MAX_KG_M2
        if eui_out or ghg_out:
            flags.append("implausible_intensity")
    if year in PANDEMIC_YEARS:
        flags.append("pandemic_affected_period")
    return flags


def prepare_energy(
    path: Path,
    fallback_year: int | None,
    rejected: list[Row],
    counts: Counter[str],
    resolve_board: Callable[[str], str | None],
) -> list[Row]:
    """Return one {facility, energy, origin} entry per school-board facility-year row."""
    raw = read_table(path, BPS_COLUMN_ALIASES)
    mapping = _require_columns(raw, BPS_COLUMN_ALIASES, BPS_REQUIRED, path)
    file_year = _year_in(path.stem) or fallback_year
    entries: list[Row] = []
    for row_number, row in enumerate(raw.to_dict("records"), start=1):
        counts["rows_read"] += 1

        def cell(name: str, row: Row = row) -> object:
            return row.get(mapping[name]) if name in mapping else None

        organization = clean_text(cell("organization_name"))
        if not _is_school_board(cell("sector"), organization, "sector" in mapping):
            continue
        counts["school_board_rows"] += 1
        facility_name = clean_text(cell("facility_name"))
        year = _parse_year(cell("reporting_year")) or file_year
        if not organization or not facility_name:
            rejected.append(_rejection(path, row_number, "missing_organization_or_facility_name", row))
            continue
        if year is None:
            rejected.append(_rejection(path, row_number, "unknown_reporting_year", row))
            continue

        city = clean_text(cell("city"))
        raw_json = json_safe(row)
        measures, measure_flags = _measures(cell)
        period_start, period_end = _reporting_period(cell("year_ending"))
        # Keyed on the resolved board (not the raw organization name) so a school keeps one
        # identity when its board is renamed between reporting years.
        board_key = resolve_board(organization) or normalize_org_name(organization)
        facility = {
            "source_key": stable_hash(board_key, normalize_school_name(facility_name), fold(city)),
            "source_facility_identifier": clean_text(cell("source_facility_identifier")),
            "facility_name": facility_name,
            "organization_name": organization,
            "operation_type": clean_text(cell("operation_type")),
            "street": clean_text(cell("street")),
            "city": city,
            "postal_code": normalize_postal_code(cell("postal_code")) or clean_text(cell("postal_code")),
        }
        energy = {
            "reporting_year": year,
            "reporting_period_start": period_start,
            "reporting_period_end": period_end,
            **measures,
            "operation_type": facility["operation_type"],
            "raw_source_json": raw_json,
            "data_quality_flags": measure_flags + quality_flags(measures, year),
            "source_dataset": BPS_SOURCE_DATASET,
            "source_resource": path.name,
            "source_row_hash": stable_hash(json.dumps(raw_json, sort_keys=True, ensure_ascii=False)),
        }
        entries.append({"facility": facility, "energy": energy, "origin": (path, row_number, row)})
    return entries


def dedupe_facility_years(entries: list[Row], rejected: list[Row]) -> list[Row]:
    """Keep the first row per facility-year; later ones are rejected and the kept one flagged."""
    kept: dict[tuple[str, int], Row] = {}
    for entry in entries:
        key = (entry["facility"]["source_key"], entry["energy"]["reporting_year"])
        if key not in kept:
            kept[key] = entry
            continue
        flags = kept[key]["energy"]["data_quality_flags"]
        if "duplicate_facility_year" not in flags:
            flags.append("duplicate_facility_year")
        path, row_number, row = entry["origin"]
        rejected.append(_rejection(path, row_number, "duplicate_facility_year", row))
    return list(kept.values())


# ── Loading ─────────────────────────────────────────────────────────────────────────────


def _unique_slugs(items: list[Row], key: str, base: Callable[[Row], str], fallback: Callable[[Row], str]) -> dict[str, str]:
    """Slug every item; items whose base slug collides all get the more specific fallback."""
    counts = Counter(base(item) for item in items)
    return {item[key]: base(item) if counts[base(item)] == 1 else fallback(item) for item in items}


def load_all(loader: Loader, boards: list[Row], schools: list[Row], facilities: dict[str, Row], entries: list[Row], now: str) -> dict[str, int]:
    """Upsert in foreign-key order, carrying generated ids forward from each stage."""
    board_slugs = _unique_slugs(boards, "board_number", lambda b: slugify(b["name"]), lambda b: slugify(b["name"], b["board_number"]))
    stored = loader.upsert(
        "boards",
        [
            {
                "board_number": board["board_number"],
                "name": board["name"],
                "slug": board_slugs[board["board_number"]],
                "board_type": board["board_type"],
                "language": board["language"],
                "region": board["region"],
                "website": board["website"],
                "updated_at": now,
            }
            for board in boards
        ],
        ("board_number",),
    )
    board_ids = {row["board_number"]: row["id"] for row in stored}

    school_slugs = _unique_slugs(
        schools,
        "school_number",
        lambda s: slugify(s["name"], s.get("city")),
        lambda s: slugify(s["name"], s.get("city"), s["school_number"]),
    )
    school_rows = []
    for school in schools:
        row: Row = {
            "school_number": school["school_number"],
            "name": school["name"],
            "slug": school_slugs[school["school_number"]],
            "board_id": board_ids[school["board_number"]],
            "school_level": normalize_school_level(school.get("school_level")),
            **{field: school.get(field) for field in SCHOOL_TEXT_FIELDS},
            "postal_code": normalize_postal_code(school.get("postal_code")) or school.get("postal_code"),
            "latitude": school.get("latitude"),
            "longitude": school.get("longitude"),
            "coordinates_source": school.get("coordinates_source"),
            "active": True,
            "updated_at": now,
        }
        school_rows.append(row)
    stored = loader.upsert("schools", school_rows, ("school_number",))
    school_ids = {row["school_number"]: row["id"] for row in stored}

    facility_rows = []
    for facility in facilities.values():
        match = facility["match"]
        facility_rows.append(
            {
                **{
                    field: facility[field]
                    for field in (
                        "source_key",
                        "source_facility_identifier",
                        "facility_name",
                        "organization_name",
                        "operation_type",
                        "street",
                        "city",
                        "postal_code",
                    )
                },
                "school_id": school_ids[match.school_number] if match.status == "matched" else None,
                "board_id": board_ids.get(facility["board_number"]) if facility["board_number"] else None,
                "match_status": match.status,
                "match_method": match.method,
                "match_confidence": match.confidence,
                "match_candidates": match.candidates or None,
                "updated_at": now,
            }
        )
    stored = loader.upsert("facilities", facility_rows, ("source_key",))
    facility_ids = {row["source_key"]: row["id"] for row in stored}

    energy_rows = [
        {"facility_id": facility_ids[entry["facility"]["source_key"]], **entry["energy"], "imported_at": now}
        for entry in entries
    ]
    loader.upsert("energy_records", energy_rows, ("facility_id", "reporting_year"))
    return {
        "boards": len(board_ids),
        "schools": len(school_ids),
        "facilities": len(facility_ids),
        "energyRecords": len(energy_rows),
    }


# ── Reporting ───────────────────────────────────────────────────────────────────────────


def _write_csv(path: Path, rows: list[Row], fieldnames: list[str]) -> None:
    with path.open("w", newline="", encoding="utf-8") as handle:
        writer = csv.DictWriter(handle, fieldnames=fieldnames)
        writer.writeheader()
        writer.writerows(rows)


def write_reports(summary: Row, facilities: dict[str, Row], rejected: list[Row]) -> None:
    PROCESSED_DIR.mkdir(parents=True, exist_ok=True)
    (PROCESSED_DIR / "ingestion-summary.json").write_text(json.dumps(summary, indent=2), encoding="utf-8")
    # Copy a facility_key from here into match_overrides.csv to record a verified decision.
    review = [
        {
            "facility_key": facility["source_key"],
            "status": facility["match"].status,
            "organization_name": facility["organization_name"],
            "facility_name": facility["facility_name"],
            "operation_type": facility["operation_type"],
            "street": facility["street"],
            "city": facility["city"],
            "board_number": facility["board_number"],
            "latest_year": facility["latest_year"],
            "candidates": "; ".join(f"{c['school_number']} {c['school_name']}" for c in facility["match"].candidates),
        }
        # Facilities still reporting come first: they matter most for current profiles.
        for facility in sorted(facilities.values(), key=lambda f: -f["latest_year"])
        if facility["match"].status in {"ambiguous", "unmatched"}
    ]
    _write_csv(
        PROCESSED_DIR / "match-review.csv",
        review,
        [
            "facility_key", "status", "organization_name", "facility_name", "operation_type",
            "street", "city", "board_number", "latest_year", "candidates",
        ],
    )
    _write_csv(PROCESSED_DIR / "rejected-rows.csv", rejected, ["source_file", "data_row", "reason", "row_json"])


# ── Entry point ─────────────────────────────────────────────────────────────────────────


def _default_energy_files() -> list[Path]:
    # The 2011–2020 "normalized" workbook uses a per-HDD intensity that is not comparable with
    # the GJ fields, so it is documented but not ingested (docs/data-dictionary.md).
    return sorted(p for p in (RAW_DIR / "bps").glob("*.xlsx") if "normalized" not in p.name.lower())


def _latest(subdirectory: str) -> Path | None:
    files = sorted((RAW_DIR / subdirectory).glob("*.xlsx"))
    return files[-1] if files else None


def parse_args(argv: list[str] | None) -> argparse.Namespace:
    parser = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    parser.add_argument("--schools", type=Path, help="Ontario public school contact information file")
    parser.add_argument("--energy", type=Path, nargs="+", help="BPS energy/GHG files, any years")
    parser.add_argument("--year", type=int, help="Reporting year when neither the file nor its rows carry one")
    parser.add_argument("--overrides", type=Path, default=DEFAULT_OVERRIDES, help="Verified match decisions")
    parser.add_argument("--board-aliases", type=Path, default=DEFAULT_BOARD_ALIASES, help="Former board names")
    parser.add_argument("--coordinates", type=Path, help="Ministry School Information file (lat/long)")
    parser.add_argument("--coordinate-overrides", type=Path, default=DEFAULT_COORDINATE_OVERRIDES, help="Manual coordinates")
    parser.add_argument("--dry-run", action="store_true", help="Run every stage except the database writes")
    parser.add_argument("--export-dir", type=Path, help="Write the load payloads as JSON here instead of to Supabase")
    args = parser.parse_args(argv)
    args.schools = args.schools or _latest("schools")
    args.coordinates = args.coordinates or _latest("sif")
    args.energy = args.energy or _default_energy_files()
    if args.schools is None or not args.energy:
        parser.error("No source files found. Run scripts/ingest/fetch_sources.py or pass --schools/--energy.")
    return args


def _loader_from_env() -> SupabaseLoader:
    url = os.environ.get("SUPABASE_URL") or os.environ.get("NEXT_PUBLIC_SUPABASE_URL")
    key = os.environ.get("SUPABASE_SERVICE_ROLE_KEY")
    if not url or not key:
        raise SystemExit(
            "Set NEXT_PUBLIC_SUPABASE_URL (or SUPABASE_URL) and SUPABASE_SERVICE_ROLE_KEY in .env.local, or pass --dry-run."
        )
    return SupabaseLoader(url, key)


def main(argv: list[str] | None = None) -> int:
    args = parse_args(argv)
    # Same precedence as Next.js: .env.local wins (load_dotenv never overrides a set variable).
    load_dotenv(ROOT / ".env.local")
    load_dotenv(ROOT / ".env")
    loader: Loader | None
    if args.export_dir:
        loader = ExportLoader(args.export_dir)
    else:
        loader = None if args.dry_run else _loader_from_env()
    started = datetime.now(timezone.utc)

    school_rejected: list[Row] = []
    schools, boards = prepare_schools(args.schools, school_rejected)
    attach_coordinates(schools, args.coordinates, args.coordinate_overrides)
    board_lookup = build_board_lookup(boards)
    board_aliases = load_board_aliases(args.board_aliases, {board["board_number"] for board in boards})

    def resolve_board(organization: str) -> str | None:
        key = board_key(organization)
        return board_aliases.get(key) or board_lookup.get(key)

    energy_rejected: list[Row] = []
    counts: Counter[str] = Counter()
    entries: list[Row] = []
    for path in args.energy:
        entries.extend(prepare_energy(path, args.year, energy_rejected, counts, resolve_board))
        print(f"read {path.name}: {counts['school_board_rows']} school-board rows so far", file=sys.stderr)
    entries = dedupe_facility_years(entries, energy_rejected)

    # A facility's descriptive fields come from its most recent reporting year.
    facilities: dict[str, Row] = {}
    for entry in sorted(entries, key=lambda e: e["energy"]["reporting_year"]):
        facilities[entry["facility"]["source_key"]] = {**entry["facility"], "latest_year": entry["energy"]["reporting_year"]}

    index = SchoolIndex(schools)
    overrides = load_overrides(args.overrides)
    for facility in facilities.values():
        facility["board_number"] = resolve_board(facility["organization_name"])
        facility["match"] = match_facility(facility, facility["board_number"], index, overrides)

    loaded = load_all(loader, boards, schools, facilities, entries, started.isoformat()) if loader else None

    statuses = Counter(facility["match"].status for facility in facilities.values())
    methods = Counter(facility["match"].method for facility in facilities.values() if facility["match"].status == "matched")
    period_ends: dict[int, Counter[str]] = {}
    for entry in entries:
        energy = entry["energy"]
        period_ends.setdefault(energy["reporting_year"], Counter())[energy["reporting_period_end"] or "not reported"] += 1
    summary = {
        "startedAt": started.isoformat(),
        "finishedAt": datetime.now(timezone.utc).isoformat(),
        "dryRun": args.dry_run,
        "sources": [
            {"dataset": SCHOOL_SOURCE_DATASET, "file": args.schools.name, "sha256": file_sha256(args.schools)},
            *({"dataset": BPS_SOURCE_DATASET, "file": p.name, "sha256": file_sha256(p)} for p in args.energy),
        ],
        "rowsRead": counts["rows_read"],
        "schoolRows": counts["school_board_rows"],
        "accepted": len(entries),
        "rejected": len(energy_rejected),
        "facilities": len(facilities),
        "highConfidenceSchoolMatches": sum(
            1 for f in facilities.values() if f["match"].status == "matched" and (f["match"].confidence or 0) >= 0.9
        ),
        "matchedByMethod": dict(methods),
        "ambiguousMatches": statuses["ambiguous"],
        "unmatched": statuses["unmatched"],
        "rejectedByOverride": statuses["rejected"],
        "unresolvedOrganizations": sorted({f["organization_name"] for f in facilities.values() if f["board_number"] is None}),
        "reportingYears": sorted(period_ends),
        "reportingPeriodEnds": {str(y): dict(c.most_common(3)) for y, c in sorted(period_ends.items())},
        "operationTypes": dict(Counter(e["energy"]["operation_type"] for e in entries).most_common(15)),
        "qualityFlags": dict(Counter(flag for e in entries for flag in e["energy"]["data_quality_flags"])),
        "schoolDirectory": {
            "schools": len(schools),
            "boards": len(boards),
            "rejected": len(school_rejected),
            "withCoordinates": sum(1 for school in schools if school["latitude"] is not None),
        },
        "loaded": loaded,
    }
    write_reports(summary, facilities, school_rejected + energy_rejected)
    if loader is not None:
        loader.insert(
            "ingestion_runs",
            {
                "source": BPS_SOURCE_DATASET,
                "started_at": summary["startedAt"],
                "finished_at": summary["finishedAt"],
                "rows_processed": summary["rowsRead"],
                "accepted": summary["accepted"],
                "rejected": summary["rejected"],
                "warnings": {"qualityFlags": summary["qualityFlags"], "unresolvedOrganizations": summary["unresolvedOrganizations"]},
                "source_hash": stable_hash(*(source["sha256"] for source in summary["sources"])),
                "summary": summary,
            },
        )
        if isinstance(loader, ExportLoader):
            loader.write()
    print(json.dumps(summary, indent=2))
    return 0


if __name__ == "__main__":
    sys.exit(main())
