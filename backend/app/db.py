from functools import cache
from typing import Any

import duckdb

from app.config import settings


@cache
def connection() -> duckdb.DuckDBPyConnection:
    # File and network access are off and settings are locked, so no query (including the ones
    # written by the chat assistant) can read files, reach URLs or undo these limits.
    return duckdb.connect(
        str(settings.db_path),
        read_only=True,
        config={"enable_external_access": False, "lock_configuration": True},
    )


def fetch_all(sql: str, params: list[Any] | None = None) -> list[dict[str, Any]]:
    # FastAPI runs sync endpoints in a thread pool; a DuckDB connection must not be
    # shared across threads, so every call gets its own cursor.
    cursor = connection().cursor()
    try:
        cursor.execute(sql, params or [])
        columns = [column[0] for column in cursor.description]
        return [dict(zip(columns, row, strict=True)) for row in cursor.fetchall()]
    finally:
        cursor.close()


def fetch_one(sql: str, params: list[Any] | None = None) -> dict[str, Any] | None:
    rows = fetch_all(sql, params)
    return rows[0] if rows else None


def fetch_values(sql: str, params: list[Any] | None = None) -> list[Any]:
    return [next(iter(row.values())) for row in fetch_all(sql, params)]
