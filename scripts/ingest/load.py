"""Idempotent Supabase upserts.

Every table has a natural-key unique index (board_number, school_number, source_key,
facility_id + reporting_year), so re-running the same source updates rows in place — which is
also what makes retrying a failed request safe.
"""

from __future__ import annotations

import json
import math
import time
from collections.abc import Callable, Iterator
from datetime import date, datetime
from typing import Any, TypeVar

import httpx
import numpy as np
import pandas as pd
from supabase import Client, create_client

MAX_ROWS_PER_REQUEST = 500
# Energy records carry their full source row, so batches are also capped by size.
MAX_BYTES_PER_REQUEST = 512_000
RETRIES = 5

T = TypeVar("T")


def json_safe(value: Any) -> Any:
    """Convert pandas/numpy values to plain JSON types; NaN, NaT, and NA become None."""
    if value is None or value is pd.NA or value is pd.NaT:
        return None
    if isinstance(value, dict):
        return {str(key): json_safe(item) for key, item in value.items()}
    if isinstance(value, (list, tuple)):
        return [json_safe(item) for item in value]
    if isinstance(value, (datetime, date)):
        return value.isoformat()
    if isinstance(value, np.generic):
        value = value.item()
    if isinstance(value, float) and not math.isfinite(value):
        return None
    return value


def batches(rows: list[dict[str, Any]]) -> Iterator[list[dict[str, Any]]]:
    batch: list[dict[str, Any]] = []
    size = 0
    for row in rows:
        row_size = len(json.dumps(row, ensure_ascii=False))
        if batch and (len(batch) >= MAX_ROWS_PER_REQUEST or size + row_size > MAX_BYTES_PER_REQUEST):
            yield batch
            batch, size = [], 0
        batch.append(row)
        size += row_size
    if batch:
        yield batch


def with_retries(action: Callable[[], T]) -> T:
    """Retry transient network failures (dropped or reset connections) with backoff."""
    for attempt in range(RETRIES):
        try:
            return action()
        except httpx.TransportError:
            if attempt == RETRIES - 1:
                raise
            time.sleep(2**attempt)
    raise AssertionError("unreachable")


class SupabaseLoader:
    def __init__(self, url: str, service_role_key: str) -> None:
        self._client: Client = create_client(url, service_role_key)

    def upsert(self, table: str, rows: list[dict[str, Any]], on_conflict: tuple[str, ...]) -> list[dict[str, Any]]:
        """Upsert in batches and return the stored rows (including generated ids)."""
        payload = [json_safe(row) for row in rows]
        keys = [tuple(row[column] for column in on_conflict) for row in payload]
        # PostgreSQL rejects a batch that touches the same row twice; the pipeline dedupes
        # upstream, so a repeat here is a bug, not data to silently drop.
        if len(set(keys)) != len(keys):
            raise ValueError(f"Duplicate {on_conflict} keys in {table} payload")
        stored: list[dict[str, Any]] = []
        conflict = ",".join(on_conflict)
        for batch in batches(payload):
            response = with_retries(lambda: self._client.table(table).upsert(batch, on_conflict=conflict).execute())
            stored.extend(response.data)
        return stored

    def insert(self, table: str, row: dict[str, Any]) -> None:
        with_retries(lambda: self._client.table(table).insert(json_safe(row)).execute())
