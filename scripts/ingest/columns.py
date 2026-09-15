"""Source-column aliases, verified against the real files (see docs/data-dictionary.md).

Three BPS layouts exist:
  A  2011–2015  "Sector Name", "Operation Name", quantity columns with generic "Unit1…Unit10"
  B  2016–2020  "Sector", "Operation", "Electricity_Quantity" / "Electricity_Unit" pairs
  C  2021+      ENERGY STAR Portfolio Manager export: GJ columns, "Site Energy Use (GJ)"

Headers are compared after accent folding, lowercasing, and punctuation removal, so
"Property GFA - Self-Reported (m²)" matches "property gfa self reported m2". For each canonical
field the first variant present in a file wins.
"""

BPS_SOURCE_DATASET = "ontario-bps-energy-ghg"
SCHOOL_SOURCE_DATASET = "ontario-public-school-contact-information"

BPS_COLUMN_ALIASES: dict[str, list[str]] = {
    "sector": ["sector name", "sector"],
    "organization_name": ["organization name", "organization"],
    "facility_name": ["operation name", "operation", "property name"],
    "source_facility_identifier": ["portfolio manager property id"],
    "operation_type": ["operation type", "primary property type self selected"],
    "street": ["address"],
    "city": ["city"],
    "postal_code": ["postal code"],
    "reporting_year": ["year"],
    "year_ending": ["year ending"],
    # Floor area: layout C reports m² directly; A and B give a quantity plus a unit label.
    "floor_area_m2": ["property gfa self reported m2"],
    "floor_area_quantity": ["total floor area", "total indoor space x"],
    "floor_area_unit": ["unit1", "unit of measure", "unit"],  # plain "Unit" is 2012 only
    "weekly_hours": ["average hours per week", "weekly average hours"],
    "portable_count": ["number of portables"],
    # Electricity
    "electricity_kwh": ["electricity use grid purchase kwh"],
    "electricity_gj": ["electricity use grid purchase gj"],
    "electricity_quantity": ["electricity", "electricity quantity"],
    "electricity_unit": ["unit2", "electricity unit"],
    # Natural gas: A/B report m³ (occasionally GJ) via a unit label; C reports GJ and therms.
    "natural_gas_gj": ["natural gas use gj"],
    "natural_gas_quantity": ["natural gas", "naturalgas quantity"],
    "natural_gas_unit": ["unit3", "naturalgas unit", "natural gas2"],  # 2012 labels its gas unit "Natural Gas2"
    # Layout C fuels, all in GJ. A/B report these in litres/tonnes, which need assumed heating
    # values to convert, so they are not mapped.
    "fuel_oil_1_gj": ["fuel oil 1 use gj"],
    "fuel_oil_2_gj": ["fuel oil 2 use gj"],
    "fuel_oil_4_gj": ["fuel oil 4 use gj"],
    "fuel_oil_5_6_gj": ["fuel oil 5 and 6 use gj"],
    "diesel_gj": ["diesel use gj"],
    "kerosene_gj": ["kerosene use gj"],
    "propane_gj": ["propane use gj"],
    "district_steam_gj": ["district steam use gj"],
    "district_hot_water_gj": ["district hot water use gj"],
    "district_chilled_water_gj": ["district chilled water use gj"],
    "wood_gj": ["wood use gj"],
    # Totals and intensities
    "total_site_energy_gj": ["site energy use gj"],
    "reported_eui_gj_m2": ["energy intensity gj m2", "site eui gj m2"],
    "normalized_total_energy_gj": ["weather normalized site energy use gj"],
    "ghg_kg_co2e": ["ghg emissions kg"],
    "ghg_tonnes_co2e": ["total location based ghg emissions metric tons co2e"],
    # Layout C carries hours and portables in generic "Custom Property ID n" name/value slots.
    "custom_1_name": ["custom property id 1 name"],
    "custom_1_value": ["custom property id 1 value"],
    "custom_2_name": ["custom property id 2 name"],
    "custom_2_value": ["custom property id 2 value"],
    "custom_3_name": ["custom property id 3 name"],
    "custom_3_value": ["custom property id 3 value"],
}
BPS_REQUIRED = {"organization_name", "facility_name"}

FUEL_OIL_FIELDS = ("fuel_oil_1_gj", "fuel_oil_2_gj", "fuel_oil_4_gj", "fuel_oil_5_6_gj")
OTHER_ENERGY_FIELDS = (
    "diesel_gj",
    "kerosene_gj",
    "propane_gj",
    "district_steam_gj",
    "district_hot_water_gj",
    "district_chilled_water_gj",
    "wood_gj",
)
CUSTOM_SLOTS = (1, 2, 3)

SCHOOL_COLUMN_ALIASES: dict[str, list[str]] = {
    "region": ["region"],
    "board_number": ["board number"],
    "board_name": ["board name"],
    "board_type": ["board type"],
    "board_language": ["board language"],
    "board_website": ["board website"],
    "school_number": ["school number"],
    "name": ["school name"],
    "school_level": ["school level"],
    "language": ["school language"],
    "school_type": ["school type"],
    "special_conditions": ["school special conditions"],
    "street": ["street"],
    "city": ["city"],
    "province": ["province"],
    "postal_code": ["postal code"],
    "grade_range": ["grade range"],
    "website": ["website", "school website"],
}
SCHOOL_REQUIRED = {"board_number", "board_name", "school_number", "name"}

# The School Information file is read for coordinates only. Its student-demographic and
# achievement columns are out of scope for WattMap and are never mapped.
COORDINATE_ALIASES: dict[str, list[str]] = {
    "school_number": ["school number"],
    "latitude": ["latitude"],
    "longitude": ["longitude"],
}
