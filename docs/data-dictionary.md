# Data dictionary

Observed in the files downloaded on 2026-09-15 (`scripts/ingest/inspect_sources.py` regenerates the full profile in `data/processed/source-inspection.json`). Column aliases live in `scripts/ingest/columns.py`.

## BPS energy reports

Sector filter: `Sector Name` / `Sector` equal to **School Board** (2011–2020) or **School Boards** (2021+). About 4,850–5,100 school-board rows per year.

| Year file | Layout | Header row | Columns | School-board rows |
| --- | --- | --- | --- | --- |
| bps_2011–2015_report_english | A | 3 (title rows above) | 39–41 | 4,974–5,105 |
| bps_2016_report_english, 2017_energy_consumption, 2018/2019_final_data_set, 2020_final_data_set_1 | B | 1 | 41–42 | 4,870–4,968 |
| 2021_final_bps_dataset, 2022/2023_final_data_set | C | 1 | 58 | 4,851–4,868 |
| 2024_final_data_set | C | 1 | 58 | **0** — no school-board records published yet |

### Field mapping

| WattMap field | Layout A (2011–2015) | Layout B (2016–2020) | Layout C (2021+) | Notes |
| --- | --- | --- | --- | --- |
| reporting_year | file name | file name / `Year` (2020) | `Year` | |
| reporting_period_end | — | — | `Year Ending` (e.g. 2024-08-31 for 2023) | School-year basis from 2021 |
| organization_name | `Organization Name` | `Organization` | `Organization` | Resolved to a Ministry board |
| facility_name | `Operation Name` | `Operation` | `Property Name` | |
| source_facility_identifier | — | — | `Portfolio Manager Property ID` | Stored, not used as identity |
| operation_type | `Operation Type` | `Operation Type` | `Primary Property Type - Self Selected` | "School", "École", "Schools", "K-12 School", "Office", … |
| floor_area_m2 | `Total Floor Area` + `Unit1` (2012: `Unit`) | `Total Indoor Space_x` + `Unit of Measure` | `Property GFA - Self-Reported (m²)` | Units: Square feet/meters, pieds carrés, mètres carrés |
| weekly_hours | `Average Hours Per Week` | `Weekly Average Hours` | `Custom Property ID n - Value` where name = "Weekly Average Hours" | |
| portable_count | `Number of Portables` | `Number of Portables` | Custom property "Number of Portables" | |
| electricity_kwh | `Electricity` + `Unit2` | `Electricity_Quantity` + `Electricity_Unit` | `Electricity Use - Grid Purchase (kWh)` | kWh throughout |
| electricity_gj | kWh × 0.0036 | kWh × 0.0036 | `Electricity Use - Grid Purchase (GJ)` | Exact conversion |
| natural_gas_m3 | `Natural Gas` + `Unit3` (2012: `Natural Gas2`) | `NaturalGas_Quantity` + `_Unit` | — (therms reported, not used) | Cubic meter / mètre cube |
| natural_gas_gj | when unit is "Giga Joule" | when unit is "Giga Joule" | `Natural Gas Use (GJ)` | m³ never converted |
| fuel_oil_gj | — (litres; not converted) | — (litres) | sum of `Fuel Oil #1/#2/#4/#5 & 6 Use (GJ)` | "Not Available" = missing |
| other_energy_gj | — | — | sum of diesel, kerosene, propane, district steam/hot/chilled water, wood (GJ) | |
| total_site_energy_gj | `Energy Intensity GJ_m2` × floor area | same | `Site Energy Use (GJ)` | A/B flagged `total_energy_derived_from_reported_intensity` |
| normalized_total_energy_gj | — | — | `Weather Normalized Site Energy Use (GJ)` | Often "Not Available" |
| ghg_kg_co2e | `GHG Emissions(Kg)` | `GHG Emissions KG` | `Total (Location-Based) GHG Emissions (Metric Tons CO2e)` × 1000 | |

Every source row is also stored verbatim in `energy_records.raw_source_json`.

### Not ingested

`normalized_bps_data_2011-2020_school_board_english.xlsx`: one sheet per year (11 columns) with `YYYY Energy Intensity (eWh/HDD/sq. ft)` and `YYYY GHG Emissions (kg)`. Its explanatory note states the weather-normalization methodology was updated; the unit (per heating degree day per ft²) is not comparable with GJ, so it is documented here and not used.

## Ontario public school contact information (August 2026)

5,822 schools, 85 boards, 24 columns: `Region, Board Number, Board Name, Board Type, Board Language, School Number, School Name, School Level, School Language, School Type, School Special Conditions, Suite, PO Box, Street, City, Province, Postal Code, Phone, Fax, Grade Range, Date Open, Email, Website, Board Website`.

- `School Level`: Elementary (4,220), Secondary (1,343), Elem/Sec (259) → WattMap `elementary / secondary / combined`.
- `School Type`: Public, Catholic, Provincial, Consortium, Hospital, Protestant Separate.
- Board names are abbreviated (e.g. "CSDC du Nouvel-Ontario", "DSB Niagara", "Ottawa CSB"); the BPS files spell them out.
- Phone, fax, and email are not stored.

## School information and student demographics (2022–2023)

Only `School Number`, `Latitude`, `Longitude` are read (4,830 of the current schools match). All student-demographic and achievement columns are ignored.

## Database tables

See `drizzle/schema.ts` (with comments) and `drizzle/migrations/`. Quality flags written to `energy_records.data_quality_flags`:

| Flag | Meaning |
| --- | --- |
| `missing_floor_area`, `nonpositive_floor_area` | EUI cannot be calculated |
| `missing_total_energy` | No total and no reported intensity |
| `zero_total_with_reported_consumption` | Total is 0 but electricity was reported |
| `negative_energy_value` | Any energy field below zero |
| `implausible_intensity` | EUI outside 0.05–5 GJ/m² or GHG intensity above 500 kg CO₂e/m² (≈ 0.7% of records; excluded from peers, scores, and totals) |
| `unrecognized_unit:<field>` | A unit label WattMap cannot interpret |
| `duplicate_facility_year` | The source repeats this facility-year; the first row is kept |
| `total_energy_derived_from_reported_intensity` | 2011–2020 total recovered from GJ/m² × area |
| `pandemic_affected_period` | Reporting year 2020 or 2021 |
