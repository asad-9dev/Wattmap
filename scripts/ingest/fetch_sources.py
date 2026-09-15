"""Download the official Ontario source files into data/raw/ and record their provenance.

    python scripts/ingest/fetch_sources.py

Resources are discovered through the Ontario Data Catalogue (CKAN) API rather than hardcoded,
so a newly published reporting year is picked up by re-running this script. Existing files
with a matching size are skipped. data/raw/manifest.json records URL, resource id, SHA-256,
and download time for every file.
"""

from __future__ import annotations

import hashlib
import json
import sys
import urllib.request
from datetime import datetime, timezone
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
RAW_DIR = ROOT / "data" / "raw"
CKAN = "https://data.ontario.ca/api/3/action/package_show?id="
USER_AGENT = "WattMap-ingest/0.1 (independent open-data project)"

BPS_PACKAGE = "energy-use-and-greenhouse-gas-emissions-for-the-broader-public-sector"
SCHOOLS_PACKAGE = "ontario-public-school-contact-information"
SIF_PACKAGE = "school-information-and-student-demographics"

# Ontario publishes each file in English and French; WattMap ingests the English editions.
FRENCH_MARKERS = ("french", "les_donnees", "rapports_de", "normalisees", "_fr.")


def _get(url: str) -> bytes:
    request = urllib.request.Request(url, headers={"User-Agent": USER_AGENT})
    with urllib.request.urlopen(request, timeout=120) as response:
        return response.read()


def _resources(package: str) -> list[dict]:
    payload = json.loads(_get(CKAN + package))
    if not payload.get("success"):
        raise RuntimeError(f"CKAN lookup failed for {package}")
    return payload["result"]["resources"]


def _is_english(url: str) -> bool:
    lowered = url.lower()
    return not any(marker in lowered for marker in FRENCH_MARKERS)


def select_resources() -> list[tuple[str, dict]]:
    """Return (subdirectory, resource) pairs for every file WattMap needs."""
    selected: list[tuple[str, dict]] = []
    for resource in _resources(BPS_PACKAGE):
        url = resource["url"].lower()
        if not _is_english(url) or not url.endswith(".xlsx") or "non-reporters" in url:
            continue
        # Of the normalized series, only the school-board file is relevant.
        if "normalized" in url and "school_board" not in url:
            continue
        selected.append(("bps", resource))
    schools = [r for r in _resources(SCHOOLS_PACKAGE) if _is_english(r["url"]) and r["url"].lower().endswith(".xlsx")]
    selected.extend(("schools", resource) for resource in schools)
    # Newest School Information edition only, used solely for its official coordinates.
    sif = sorted((r for r in _resources(SIF_PACKAGE) if r["url"].lower().endswith("_en.xlsx")), key=lambda r: r["url"])
    selected.extend(("sif", resource) for resource in sif[-1:])
    return selected


def main() -> int:
    manifest_path = RAW_DIR / "manifest.json"
    manifest = json.loads(manifest_path.read_text(encoding="utf-8")) if manifest_path.exists() else {}
    for subdirectory, resource in select_resources():
        url = resource["url"]
        target = RAW_DIR / subdirectory / url.rsplit("/", 1)[-1]
        target.parent.mkdir(parents=True, exist_ok=True)
        entry = manifest.get(str(target.relative_to(RAW_DIR).as_posix()))
        if target.exists() and entry and entry.get("bytes") == target.stat().st_size:
            print(f"skip   {target.name}")
            continue
        data = _get(url)
        target.write_bytes(data)
        manifest[target.relative_to(RAW_DIR).as_posix()] = {
            "name": resource.get("name"),
            "resource_id": resource.get("id"),
            "url": url,
            "bytes": len(data),
            "sha256": hashlib.sha256(data).hexdigest(),
            "downloaded_at": datetime.now(timezone.utc).isoformat(),
        }
        print(f"fetch  {target.name}  ({len(data) / 1e6:.1f} MB)")
    manifest_path.write_text(json.dumps(manifest, indent=2, sort_keys=True), encoding="utf-8")
    return 0


if __name__ == "__main__":
    sys.exit(main())
