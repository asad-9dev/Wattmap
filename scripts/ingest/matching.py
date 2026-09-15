"""Facility → Ministry school matching.

Tiers run from most to least deterministic and stop at the first tier that finds candidates.
A tier's result is accepted only when it yields exactly one school; several candidates make
the facility `ambiguous` and send it to the human review queue instead of being guessed.
Tier 5 (fuzzy) never auto-accepts: its candidates are for review only.
"""

from __future__ import annotations

import csv
from collections.abc import Callable
from dataclasses import dataclass, field
from difflib import SequenceMatcher
from pathlib import Path
from typing import Any

from normalize import board_key, fold, normalize_address, normalize_school_name

School = dict[str, Any]

SIMILAR_NAME_MIN = 0.9
SIMILAR_NAME_MARGIN = 0.05
FUZZY_MIN = 0.75
FUZZY_CANDIDATES = 3


@dataclass(frozen=True)
class MatchResult:
    status: str  # matched | ambiguous | unmatched | rejected (mirrors the match_status enum)
    method: str | None = None
    confidence: float | None = None
    school_number: str | None = None
    candidates: list[dict[str, Any]] = field(default_factory=list)


UNMATCHED = MatchResult(status="unmatched")


@dataclass(frozen=True)
class Override:
    decision: str  # "match" or "no_match"
    school_number: str | None


def _read_csv_rows(path: Path) -> list[tuple[int, dict[str, str]]]:
    if not path.exists():
        return []
    with path.open(newline="", encoding="utf-8") as handle:
        return [(line, {k: (v or "").strip() for k, v in row.items()}) for line, row in enumerate(csv.DictReader(handle), start=2)]


def load_overrides(path: Path) -> dict[str, Override]:
    """Human-verified decisions keyed by facility source_key. Malformed rows are errors."""
    overrides: dict[str, Override] = {}
    for line, row in _read_csv_rows(path):
        key, decision, school_number = row.get("facility_key", ""), row.get("decision", "").lower(), row.get("school_number") or None
        if not key or decision not in {"match", "no_match"}:
            raise ValueError(f"{path.name}:{line}: need facility_key and decision match|no_match")
        if decision == "match" and school_number is None:
            raise ValueError(f"{path.name}:{line}: decision 'match' requires school_number")
        overrides[key] = Override(decision, school_number)
    return overrides


def load_board_aliases(path: Path, known_boards: set[str]) -> dict[str, str]:
    """Map normalized BPS organization names (e.g. a board's former name) → board number."""
    aliases: dict[str, str] = {}
    for line, row in _read_csv_rows(path):
        organization, board_number = row.get("organization_name", ""), row.get("board_number", "")
        if not organization or board_number not in known_boards:
            raise ValueError(f"{path.name}:{line}: need organization_name and a board_number from the school directory")
        aliases[board_key(organization)] = board_number
    return aliases


def build_board_lookup(boards: list[dict[str, Any]]) -> dict[str, str]:
    """Map board-name key → board number. A key shared by two boards maps to neither."""
    lookup: dict[str, str] = {}
    shared: set[str] = set()
    for board in boards:
        key = board_key(board["name"])
        if key in lookup and lookup[key] != board["board_number"]:
            shared.add(key)
        lookup[key] = board["board_number"]
    return {key: number for key, number in lookup.items() if key not in shared}


def similarity(a: str, b: str) -> float:
    """Token-order-insensitive similarity in 0–1 ("Ben R McMullin PS" vs "McMullin Ben R PS")."""
    return SequenceMatcher(None, " ".join(sorted(a.split())), " ".join(sorted(b.split()))).ratio()


def _ranked(name: str, pool: list[School]) -> list[tuple[float, School]]:
    return sorted(((similarity(name, normalize_school_name(s["name"])), s) for s in pool), key=lambda p: p[0], reverse=True)


class SchoolIndex:
    """Lookup tables over the Ministry school directory, scoped by board number."""

    def __init__(self, schools: list[School]) -> None:
        self.numbers = {school["school_number"] for school in schools}
        self._by_board: dict[str, list[School]] = {}
        self._by_name: dict[tuple[str, str], list[School]] = {}
        self._by_address: dict[tuple[str, str, str], list[School]] = {}
        for school in schools:
            board = school["board_number"]
            self._by_board.setdefault(board, []).append(school)
            self._by_name.setdefault((board, normalize_school_name(school["name"])), []).append(school)
            address = normalize_address(school.get("street"))
            if address:
                self._by_address.setdefault((board, address, fold(school.get("city"))), []).append(school)

    def exact_name(self, facility: dict[str, Any], board: str) -> list[School]:
        return self._by_name.get((board, normalize_school_name(facility["facility_name"])), [])

    def address(self, facility: dict[str, Any], board: str) -> list[School]:
        address = normalize_address(facility.get("street"))
        if not address:
            return []
        return self._by_address.get((board, address, fold(facility.get("city"))), [])

    def similar_name_same_city(self, facility: dict[str, Any], board: str) -> list[School]:
        """Tier 4: strongly similar name in the same city and board.

        Accepts a single school scoring ≥ 0.9 that beats the runner-up by 0.05; a near-tie
        returns both, which surfaces as ambiguous rather than a guess.
        """
        city = fold(facility.get("city"))
        pool = [s for s in self._by_board.get(board, []) if fold(s.get("city")) == city]
        scored = _ranked(normalize_school_name(facility["facility_name"]), pool)
        if not scored or scored[0][0] < SIMILAR_NAME_MIN:
            return []
        if len(scored) > 1 and scored[0][0] - scored[1][0] < SIMILAR_NAME_MARGIN:
            return [scored[0][1], scored[1][1]]
        return [scored[0][1]]

    def fuzzy(self, facility: dict[str, Any], board: str) -> list[School]:
        """Tier 5: loose similarity anywhere in the board. Review candidates only."""
        scored = _ranked(normalize_school_name(facility["facility_name"]), self._by_board.get(board, []))
        return [school for score, school in scored[:FUZZY_CANDIDATES] if score >= FUZZY_MIN]


def match_facility(
    facility: dict[str, Any],
    board_number: str | None,
    index: SchoolIndex,
    overrides: dict[str, Override],
) -> MatchResult:
    override = overrides.get(facility["source_key"])
    if override is not None:
        if override.decision == "no_match":
            return MatchResult(status="rejected", method="override")
        if override.school_number not in index.numbers:
            raise ValueError(f"Override for {facility['source_key']} names unknown school {override.school_number}")
        return MatchResult("matched", "override", 1.0, override.school_number)

    # Every automatic tier is board-scoped; without a board there is nothing safe to compare.
    if board_number is None:
        return UNMATCHED

    tiers: list[tuple[str, float, Callable[[dict[str, Any], str], list[School]]]] = [
        ("exact_name_board", 1.0, index.exact_name),
        ("address_board", 0.95, index.address),
        ("name_city_board", 0.85, index.similar_name_same_city),
    ]
    for method, confidence, find in tiers:
        candidates = find(facility, board_number)
        if len(candidates) == 1:
            return MatchResult("matched", method, confidence, candidates[0]["school_number"])
        if len(candidates) > 1:
            return MatchResult("ambiguous", method, confidence, None, _listed(candidates, method, confidence))

    fuzzy = index.fuzzy(facility, board_number)
    if fuzzy:
        return MatchResult("ambiguous", "fuzzy", 0.5, None, _listed(fuzzy, "fuzzy", 0.5))
    return UNMATCHED


def _listed(candidates: list[School], method: str, score: float) -> list[dict[str, Any]]:
    return [
        {"school_number": s["school_number"], "school_name": s["name"], "method": method, "score": score}
        for s in candidates
    ]
