"""Tests for the ingestion pipeline on small synthetic inputs (never written into the repo).

    python -m unittest discover -s tests/ingest
"""

from __future__ import annotations

import json
import sys
import tempfile
import unittest
from collections import Counter
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[2] / "scripts" / "ingest"))

import run  # noqa: E402
from normalize import board_key, fold, normalize_school_name, stable_hash, to_float  # noqa: E402

SCHOOLS = """Ontario public school contact information (synthetic test title row)
Board Number,Board Name,Board Type,Board Language,School Number,School Name,School Level,School Language,School Type,Street,City,Province,Postal Code,Grade Range,Website,Board Website
B1,Test DSB,Public,English,100001,Alpha Secondary School,Secondary,English,Public,12 Main Street,Ajax,ON,L1S 1A1,9-12,,
B1,Test DSB,Public,English,100002,Beta Public School,Elementary,English,Public,50 King Road,Ajax,ON,l1s2b2,JK-8,,
B1,Test DSB,Public,English,100003,Gamma Public School,Elementary,English,Public,7 Oak Avenue,Ajax,ON,,JK-8,,
B1,Test DSB,Public,English,100004,Gamma Public School,Elementary,English,Public,9 Elm Crescent,Ajax,ON,,JK-8,,
B2,CS Test,Catholic,French,200001,École secondaire Delta,Secondary,French,Catholic,1 Rue Principale,Ottawa,ON,,9-12,,
B2,CS Test,Catholic,French,200002,Epsilon,Elem/Sec,French,Catholic,2 Rue Deux,Ottawa,ON,,K-12,,
B1,Test DSB,Public,English,100001,Duplicate Number,Secondary,English,Public,,Ajax,ON,,9-12,,
"""

LAYOUT_B = """Year,Sector,SubSector,Organization,Operation,Operation Type,Address,City,Postal Code,Total Indoor Space_x,Unit of Measure,Weekly Average Hours,Number of Portables,Electricity_Quantity,Electricity_Unit,NaturalGas_Quantity,NaturalGas_Unit,GHG Emissions KG,Energy Intensity GJ_m2
2019,School Board,School Board,Test District School Board,Alpha S.S.,School,12 Main St.,Ajax,L1S1A1,"100,000",Square feet,60,3,"500,000",kWh,"20,000",Cubic Meter,"45,000",0.9
2019,School Board,School Board,Test District School Board,Beta Community Hub,School,50 King Rd,Ajax,,5000,Square meters,50,0,1000,MWh,0,,,0.5
2019,School Board,School Board,Test District School Board,Gamma P.S.,School,,Ajax,,4000,Square meters,50,,,,,,,0.6
2019,School Board,School Board,Test District School Board,Admin Centre,Administrative offices and related facilities,1 Board Way,Ajax,,,,40,,-5,kWh,,,,
2019,School Board,School Board,Conseil scolaire Test,É.S. Delta,School,1 rue Principale,Ottawa,,6000,Square meters,,,,,120,Giga Joule,,0.7
2019,School Board,School Board,Conseil scolaire Test,Epsilon Annex,School,,Ottawa,,3,Hectares,,,,,,,,
2019,School Board,School Board,Test District School Board,Alpha S.S.,School,12 Main St.,Ajax,L1S1A1,"100,000",Square feet,60,3,"500,000",kWh,"20,000",Cubic Meter,"45,000",0.9
2019,Municipal,Municipal,Town of Ajax,Town Hall,Office,,Ajax,,,,,,,,,,,
"""

LAYOUT_C = """Year,Sector,Organization,Property Name,Primary Property Type - Self Selected,Portfolio Manager Property ID,Year Ending,Address,City,Property GFA - Self-Reported (m²),Custom Property ID 1 - Name,Custom Property ID 1 - Value,Custom Property ID 2 - Name,Custom Property ID 2 - Value,Electricity Use - Grid Purchase (kWh),Electricity Use - Grid Purchase (GJ),Natural Gas Use (GJ),Fuel Oil #2 Use (GJ),Propane Use (GJ),Site Energy Use (GJ),Weather Normalized Site Energy Use (GJ),Total (Location-Based) GHG Emissions (Metric Tons CO2e)
2022,School Boards,Test DSB,Alpha Secondary School,K-12 School,123,2023-08-31 00:00:00,12 Main Street,Ajax,9290.304,Weekly Average Hours,55,Number of Portables,2,450000,1620,6300,Not Available,12,8000,8200,40
"""


class FakeLoader:
    """Emulates PostgREST upsert: rows keyed by conflict columns, ids stable across runs."""

    def __init__(self) -> None:
        self.tables: dict[str, dict] = {}
        self.inserted: list[tuple[str, dict]] = []
        self.next_id = 1

    def upsert(self, table, rows, on_conflict):
        json.dumps(rows, allow_nan=False)  # PostgREST rejects NaN; raises if any slipped through
        store = self.tables.setdefault(table, {})
        keys = [tuple(r[c] for c in on_conflict) for r in rows]
        assert len(set(keys)) == len(keys), f"duplicate conflict keys in {table}"
        out = []
        for key, row in zip(keys, rows):
            existing = store.get(key)
            row_id = existing["id"] if existing else self.next_id
            self.next_id += 0 if existing else 1
            store[key] = {**row, "id": row_id}
            out.append(store[key])
        return out

    def insert(self, table, row):
        self.inserted.append((table, row))


class PipelineTest(unittest.TestCase):
    @classmethod
    def setUpClass(cls) -> None:
        cls.tmp = tempfile.TemporaryDirectory()
        root = Path(cls.tmp.name)
        (root / "schools.csv").write_text(SCHOOLS, encoding="utf-8")
        (root / "bps-2019.csv").write_text(LAYOUT_B, encoding="utf-8")
        (root / "bps-2022.csv").write_text(LAYOUT_C, encoding="utf-8")
        (root / "empty.csv").write_text("organization_name,board_number,note\n", encoding="utf-8")
        (root / "empty-coords.csv").write_text("school_number,latitude,longitude,note\n", encoding="utf-8")
        cls.root = root
        run.PROCESSED_DIR = root / "processed"

    @classmethod
    def tearDownClass(cls) -> None:
        cls.tmp.cleanup()

    def args(self, *extra: str) -> list[str]:
        r = self.root
        return [
            "--schools", str(r / "schools.csv"),
            "--energy", str(r / "bps-2019.csv"), str(r / "bps-2022.csv"),
            "--overrides", str(r / "none.csv"),
            "--board-aliases", str(r / "empty.csv"),
            "--coordinate-overrides", str(r / "empty-coords.csv"),
            *extra,
        ]

    def test_dry_run_summary(self) -> None:
        self.assertEqual(run.main(self.args("--dry-run")), 0)
        s = json.loads((run.PROCESSED_DIR / "ingestion-summary.json").read_text(encoding="utf-8"))
        self.assertEqual(s["rowsRead"], 9)
        self.assertEqual(s["schoolRows"], 8)
        self.assertEqual(s["accepted"], 7)
        self.assertEqual(s["rejected"], 1)
        self.assertEqual(s["schoolDirectory"]["schools"], 6)
        self.assertEqual(s["reportingYears"], [2019, 2022])
        self.assertEqual(s["unresolvedOrganizations"], [])
        self.assertEqual(s["matchedByMethod"], {"exact_name_board": 2, "address_board": 1})
        self.assertEqual(s["ambiguousMatches"], 1)
        flags = s["qualityFlags"]
        self.assertEqual(flags["negative_energy_value"], 1)
        self.assertEqual(flags["unrecognized_unit:floor_area"], 1)
        self.assertEqual(flags["duplicate_facility_year"], 1)
        self.assertEqual(flags["total_energy_derived_from_reported_intensity"], 4)

    def entries(self) -> tuple[list, list, list]:
        schools, boards = run.prepare_schools(self.root / "schools.csv", [])
        lookup = run.build_board_lookup(boards)
        resolve = lambda org: lookup.get(board_key(org))  # noqa: E731
        rejected: list = []
        entries = run.prepare_energy(self.root / "bps-2019.csv", None, rejected, Counter(), resolve)
        entries += run.prepare_energy(self.root / "bps-2022.csv", None, rejected, Counter(), resolve)
        return schools, boards, run.dedupe_facility_years(entries, rejected)

    def test_units_and_layouts(self) -> None:
        _, _, entries = self.entries()
        alpha = {e["energy"]["reporting_year"]: e for e in entries if e["facility"]["facility_name"].startswith("Alpha")}
        self.assertEqual(len({e["facility"]["source_key"] for e in alpha.values()}), 1, "one identity across layouts")
        b, c = alpha[2019]["energy"], alpha[2022]["energy"]
        self.assertAlmostEqual(b["floor_area_m2"], 9290.304)
        self.assertAlmostEqual(b["electricity_gj"], 1800)
        self.assertEqual(b["natural_gas_m3"], 20000)
        self.assertIsNone(b["natural_gas_gj"], "m³ is never converted to GJ")
        self.assertAlmostEqual(b["total_site_energy_gj"], 0.9 * 9290.304)
        self.assertIsNone(b["reporting_period_end"])
        self.assertEqual(c["reporting_period_start"], "2022-09-01")
        self.assertEqual(c["reporting_period_end"], "2023-08-31")
        self.assertEqual(c["ghg_kg_co2e"], 40000)
        self.assertEqual(c["weekly_hours"], 55)
        self.assertEqual(c["portable_count"], 2)
        self.assertEqual(c["other_energy_gj"], 12)
        self.assertIsNone(c["fuel_oil_gj"], '"Not Available" is not zero')
        self.assertEqual(c["normalized_total_energy_gj"], 8200)
        delta = next(e["energy"] for e in entries if "Delta" in e["facility"]["facility_name"])
        self.assertEqual(delta["natural_gas_gj"], 120, "gas reported in GJ is kept as GJ")

    def test_normalization(self) -> None:
        self.assertEqual(normalize_school_name("É.S. Delta"), "ecole secondaire delta")
        self.assertEqual(normalize_school_name("Maple E.S."), "maple elementary school")
        self.assertEqual(normalize_school_name("St. Mary's C.S.S."), "saint marys catholic secondary school")
        self.assertEqual(board_key("DSB of Niagara"), board_key("District School Board Niagara"))
        self.assertEqual(board_key("Peterborough District Catholic School Board"), board_key("Peterborough CDSB"))
        self.assertEqual(run.normalize_school_level("Elem/Sec"), "combined")
        self.assertIsNone(to_float("Not Available"))
        self.assertEqual(to_float("1,234.5"), 1234.5)

    def test_load_is_idempotent_and_respects_match_invariant(self) -> None:
        schools, boards, entries = self.entries()
        facilities = {}
        for e in sorted(entries, key=lambda e: e["energy"]["reporting_year"]):
            facilities[e["facility"]["source_key"]] = {**e["facility"], "latest_year": e["energy"]["reporting_year"]}
        lookup, index = run.build_board_lookup(boards), run.SchoolIndex(schools)
        gamma_key = stable_hash("B1", normalize_school_name("Gamma P.S."), fold("Ajax"))
        overrides_file = self.root / "overrides.csv"
        overrides_file.write_text(f"facility_key,decision,school_number,note\n{gamma_key},match,100003,verified\n", encoding="utf-8")
        overrides = run.load_overrides(overrides_file)
        for f in facilities.values():
            f["board_number"] = lookup.get(board_key(f["organization_name"]))
            f["match"] = run.match_facility(f, f["board_number"], index, overrides)
        self.assertEqual(facilities[gamma_key]["match"].method, "override")

        loader = FakeLoader()
        run.attach_coordinates(schools, None, self.root / "empty-coords.csv")
        first = run.load_all(loader, boards, schools, facilities, entries, "2026-09-15T00:00:00+00:00")
        sizes = {t: len(rows) for t, rows in loader.tables.items()}
        second = run.load_all(loader, boards, schools, facilities, entries, "2026-09-15T01:00:00+00:00")
        self.assertEqual(first, second)
        self.assertEqual(sizes, {t: len(rows) for t, rows in loader.tables.items()})
        for row in loader.tables["facilities"].values():
            self.assertEqual(row["match_status"] == "matched", row["school_id"] is not None)
        slugs = {r["slug"] for r in loader.tables["schools"].values()}
        self.assertIn("gamma-public-school-ajax-100003", slugs)

    def test_implausible_values_are_flagged(self) -> None:
        base = {field: None for field in run.ENERGY_FIELDS} | {
            "floor_area_m2": 1000.0,
            "total_site_energy_gj": 600.0,
            "ghg_kg_co2e": 25_000.0,
            "electricity_kwh": 1.0,
        }
        self.assertNotIn("implausible_intensity", run.quality_flags(base, 2019))
        self.assertIn("implausible_intensity", run.quality_flags({**base, "total_site_energy_gj": 600_000.0}, 2013))
        self.assertIn("implausible_intensity", run.quality_flags({**base, "total_site_energy_gj": 0.0}, 2018))
        self.assertIn("implausible_intensity", run.quality_flags({**base, "ghg_kg_co2e": 900_000.0}, 2019))
        self.assertNotIn("implausible_intensity", run.quality_flags({**base, "floor_area_m2": None}, 2019))

    def test_coordinates_are_validated(self) -> None:
        self.assertIsNone(run.ontario_coordinates("43.7", "79.4"), "positive longitude is outside Ontario")
        self.assertEqual(run.ontario_coordinates("43.7", "-79.4"), (43.7, -79.4))


if __name__ == "__main__":
    unittest.main()
