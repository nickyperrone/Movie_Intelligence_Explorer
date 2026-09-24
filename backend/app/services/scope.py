"""Filters over the consumption table, shared by movie performance and the dashboard.

Movie-level filters (genres, distributors) become `title_id IN (subquery)` so they can never
repeat consumption rows (docs/03-data.md, "Integration rules").
"""

from dataclasses import dataclass, field, replace
from datetime import date
from typing import Any


def first_of_month(month: str) -> date:
    year, number = month.split("-")
    return date(int(year), int(number), 1)


def shift_months(month: date, months: int) -> date:
    index = month.year * 12 + month.month - 1 + months
    return date(index // 12, index % 12 + 1, 1)


def months_between(start: date, end: date) -> int:
    return (end.year - start.year) * 12 + end.month - start.month + 1


@dataclass(frozen=True)
class ConsumptionScope:
    title_id: str | None = None
    start: date | None = None
    end: date | None = None
    countries: list[str] = field(default_factory=list)
    platforms: list[str] = field(default_factory=list)
    genres: list[str] = field(default_factory=list)
    distributors: list[str] = field(default_factory=list)

    def without(self, *names: str) -> "ConsumptionScope":
        empty: dict[str, Any] = {
            name: [] if isinstance(getattr(self, name), list) else None for name in names
        }
        return replace(self, **empty)

    def with_period(self, start: date, end: date) -> "ConsumptionScope":
        return replace(self, start=start, end=end)

    def where(self, alias: str = "c") -> tuple[str, list[Any]]:
        conditions = ["TRUE"]
        params: list[Any] = []
        if self.title_id is not None:
            conditions.append(f"{alias}.title_id = ?")
            params.append(self.title_id)
        if self.start is not None:
            conditions.append(f"{alias}.month >= ?")
            params.append(self.start)
        if self.end is not None:
            conditions.append(f"{alias}.month <= ?")
            params.append(self.end)
        if self.countries:
            conditions.append(f"list_contains(?, {alias}.country)")
            params.append(self.countries)
        if self.platforms:
            conditions.append(f"list_contains(?, {alias}.platform)")
            params.append(self.platforms)
        if self.genres:
            conditions.append(
                f"{alias}.title_id IN "
                "(SELECT title_id FROM movies WHERE list_contains(?, primary_genre))"
            )
            params.append(self.genres)
        if self.distributors:
            conditions.append(
                f"{alias}.title_id IN "
                "(SELECT title_id FROM title_distributors WHERE list_contains(?, distributor))"
            )
            params.append(self.distributors)
        return " AND ".join(conditions), params
