"""Name, address, unit, and header normalization.

Normalized strings are comparison keys only. Original spellings are always stored separately
for display and attribution.
"""

from __future__ import annotations

import hashlib
import math
import re
import unicodedata

import pandas as pd

# Exact definitional conversions only. Conversions that depend on an assumed heating value
# (e.g. natural gas m³ → GJ) are deliberately absent: use the source's reported GJ instead.
GJ_PER_KWH = 0.0036
M2_PER_SQFT = 0.09290304
KG_PER_TONNE = 1000.0

ELECTRICITY_TO_KWH = {"kwh": 1.0, "kilowatt hours": 1.0, "mwh": 1000.0, "megawatt hours": 1000.0}
# Unit labels as observed in the 2011–2020 files, French variants included (compared folded).
GAS_TO_M3 = {
    "m3": 1.0,
    "cubic meter": 1.0,
    "cubic meters": 1.0,
    "cubic metre": 1.0,
    "cubic metres": 1.0,
    "metre cube": 1.0,
    "metres cubes": 1.0,
}
GAS_REPORTED_IN_GJ = {"giga joule", "gigajoule", "gigajoules", "gj"}
AREA_TO_M2 = {
    "square feet": M2_PER_SQFT,
    "sq ft": M2_PER_SQFT,
    "ft2": M2_PER_SQFT,
    "pieds carres": M2_PER_SQFT,
    "square meters": 1.0,
    "square metres": 1.0,
    "sq m": 1.0,
    "m2": 1.0,
    "metres carres": 1.0,
}

# French abbreviations are replaced before accents are folded, so "É.S." (école secondaire)
# never collides with the English "E.S." (elementary school). Longest first.
FRENCH_SCHOOL_ABBREVIATIONS = {
    "é.é.c.": "ecole elementaire catholique",
    "é.s.c.": "ecole secondaire catholique",
    "é.é.": "ecole elementaire",
    "é.s.": "ecole secondaire",
    "é.p.": "ecole publique",
}

# Applied per token after periods are stripped, so "S.S." and "SS" both arrive as "ss".
SCHOOL_ABBREVIATIONS = {
    "ss": "secondary school",
    "css": "catholic secondary school",
    "chs": "catholic high school",
    "hs": "high school",
    "ps": "public school",
    "es": "elementary school",
    "ces": "catholic elementary school",
    "ci": "collegiate institute",
    "cvi": "collegiate and vocational institute",
    "sec": "secondary",
    "elem": "elementary",
    "cath": "catholic",
    "pub": "public",
    "st": "saint",
    "ste": "sainte",
    "sr": "senior",
    "jr": "junior",
    "eec": "ecole elementaire catholique",
    "esc": "ecole secondaire catholique",
}

BOARD_ABBREVIATIONS = {
    "dsb": "district school board",
    "cdsb": "catholic district school board",
    "dcsb": "district catholic school board",
    "csb": "catholic school board",
    "sb": "school board",
    "sa": "school authority",
    # The Ministry directory abbreviates French-language board names; BPS files spell them out.
    "cs": "conseil scolaire",
    "csd": "conseil scolaire de district",
    "csdc": "conseil scolaire de district catholique",
    "cep": "conseil des ecoles publiques",
}
ORG_STOPWORDS = {"of", "the", "and", "de", "du", "des", "la", "le", "et"}

# Addresses canonicalize to the short form, the opposite direction to school names.
ADDRESS_ABBREVIATIONS = {
    "street": "st",
    "avenue": "ave",
    "road": "rd",
    "drive": "dr",
    "boulevard": "blvd",
    "crescent": "cres",
    "court": "crt",
    "place": "pl",
    "lane": "ln",
    "highway": "hwy",
    "parkway": "pkwy",
    "terrace": "terr",
    "square": "sq",
    "circle": "cir",
    "trail": "trl",
    "north": "n",
    "south": "s",
    "east": "e",
    "west": "w",
}

_POSTAL_CODE = re.compile(r"^[A-Z]\d[A-Z]\d[A-Z]\d$")


def is_missing(value: object) -> bool:
    return value is None or (not isinstance(value, str) and bool(pd.isna(value)))


def clean_text(value: object) -> str | None:
    """Strip whitespace; missing or blank values become None."""
    if is_missing(value):
        return None
    text = re.sub(r"\s+", " ", str(value)).strip()
    return text or None


def fold(value: object) -> str:
    """Lowercase, strip accents, collapse whitespace. Missing values become ""."""
    if is_missing(value):
        return ""
    decomposed = unicodedata.normalize("NFKD", str(value))
    ascii_text = "".join(ch for ch in decomposed if not unicodedata.combining(ch))
    return re.sub(r"\s+", " ", ascii_text).strip().lower()


def _tokens(folded: str) -> list[str]:
    text = folded.replace("&", " and ")
    text = re.sub(r"['’`.]", "", text)  # "St. Mary's" → "st marys", "S.S." → "ss"
    return re.sub(r"[^a-z0-9]+", " ", text).split()


def _expand(tokens: list[str], table: dict[str, str]) -> str:
    return " ".join(table.get(token, token) for token in tokens)


def normalize_header(header: object) -> str:
    return " ".join(_tokens(fold(header)))


def normalize_school_name(name: object) -> str:
    text = "" if is_missing(name) else str(name).lower()
    for abbreviation, expansion in FRENCH_SCHOOL_ABBREVIATIONS.items():
        text = text.replace(abbreviation, f" {expansion} ")
    return _expand(_tokens(fold(text)), SCHOOL_ABBREVIATIONS)


def normalize_org_name(name: object) -> str:
    return _expand(_tokens(fold(name)), BOARD_ABBREVIATIONS)


def board_key(name: object) -> str:
    """Board-name key insensitive to word order and filler words, so "District Catholic School
    Board" equals "Catholic District School Board" and "DSB of Niagara" equals "DSB Niagara"."""
    return " ".join(sorted(token for token in normalize_org_name(name).split() if token not in ORG_STOPWORDS))


def normalize_address(street: object) -> str:
    return _expand(_tokens(fold(street)), ADDRESS_ABBREVIATIONS)


def normalize_postal_code(value: object) -> str | None:
    compact = re.sub(r"[^A-Za-z0-9]", "", fold(value)).upper()
    return compact if _POSTAL_CODE.match(compact) else None


def slugify(*parts: object) -> str:
    return "-".join(token for part in parts for token in _tokens(fold(part)))


def stable_hash(*parts: object) -> str:
    return hashlib.sha256("|".join(str(part) for part in parts).encode("utf-8")).hexdigest()


def to_float(value: object) -> float | None:
    """Parse "1,234.5", "$1,234", or numeric cells. Blank, text, NaN, and inf become None."""
    if is_missing(value):
        return None
    if isinstance(value, (int, float)):
        number = float(value)
    else:
        try:
            number = float(re.sub(r"[,\s$]", "", str(value)))
        except ValueError:
            return None
    return number if math.isfinite(number) else None


def convert_quantity(
    quantity: object, unit: object, factors: dict[str, float]
) -> tuple[float | None, bool]:
    """Convert a quantity with a unit label. Returns (value, unit_recognized)."""
    amount = to_float(quantity)
    if amount is None:
        return None, True
    if amount == 0:
        return 0.0, True  # zero needs no unit; the source often leaves it blank for unused fuels
    factor = factors.get(normalize_header(unit))
    return (amount * factor, True) if factor is not None else (None, False)


def map_columns(columns: object, aliases: dict[str, list[str]]) -> dict[str, str]:
    """Return {canonical_field: source_header} for every alias present in `columns`."""
    lookup: dict[str, str] = {}
    for column in columns:  # type: ignore[attr-defined]
        lookup.setdefault(normalize_header(column), column)
    found: dict[str, str] = {}
    for canonical, variants in aliases.items():
        for variant in variants:
            source = lookup.get(normalize_header(variant))
            if source is not None:
                found[canonical] = source
                break
    return found
