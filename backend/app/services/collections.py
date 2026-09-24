"""Discover shelves. Each collection is one row in `collection_definitions` (docs/04-metrics.md)."""

import re
from collections.abc import Callable
from dataclasses import dataclass
from datetime import date
from functools import cache
from typing import Any

from app import api_models as m
from app.db import fetch_all
from app.services import display
from app.services.dashboard import GROWTH_MIN_PRIOR_STREAMS, data_months
from app.services.movies import summaries
from app.services.scope import shift_months

COLLECTION_SIZE = 30
PREVIEW_SIZE = 4

Ranking = list[tuple[str, float | None]]


@dataclass(frozen=True)
class CollectionDefinition:
    collection_id: str
    title: str
    description: str
    section: str
    metric_label: str
    rank: Callable[[], Ranking]


def slug(text: str) -> str:
    return re.sub(r"[^a-z0-9]+", "-", text.lower().replace("+", " plus")).strip("-")


def ranked(sql: str, params: list[Any]) -> Ranking:
    rows = fetch_all(sql + f" LIMIT {COLLECTION_SIZE}", params)
    return [(row["title_id"], row["value"]) for row in rows]


def top_streams(start: date, end: date, column: str | None = None, value: str | None = None):
    condition = f"AND {column} = ?" if column else ""

    def rank() -> Ranking:
        return ranked(
            f"""
            SELECT title_id, sum(streams) AS value
            FROM consumption
            WHERE month BETWEEN ? AND ? {condition}
            GROUP BY title_id
            HAVING sum(streams) > 0
            ORDER BY value DESC, title_id
            """,
            [start, end, *([value] if column else [])],
        )

    return rank


def rising_now(last: date) -> Callable[[], Ranking]:
    prior = shift_months(last, -1)

    def rank() -> Ranking:
        return ranked(
            f"""
            WITH months AS (
                SELECT title_id,
                       coalesce(sum(streams) FILTER (WHERE month = ?), 0) AS last_streams,
                       coalesce(sum(streams) FILTER (WHERE month = ?), 0) AS prior_streams
                FROM consumption
                WHERE month IN (?, ?)
                GROUP BY title_id
            )
            SELECT title_id, (last_streams - prior_streams) / prior_streams AS value
            FROM months
            WHERE prior_streams >= {GROWTH_MIN_PRIOR_STREAMS} AND last_streams > prior_streams
            ORDER BY value DESC, last_streams DESC, title_id
            """,
            [last, prior, last, prior],
        )

    return rank


def evergreen(last: date) -> Callable[[], Ranking]:
    def rank() -> Ranking:
        return ranked(
            """
            WITH active AS (
                SELECT title_id, month, sum(streams) AS streams
                FROM consumption
                GROUP BY title_id, month
                HAVING sum(streams) > 0
            ),
            per_title AS (
                SELECT title_id, count(*) AS active_months, sum(streams) AS streams,
                       date_diff('month', min(month), ?::DATE) + 1 AS months_since_first
                FROM active
                GROUP BY title_id
            )
            SELECT title_id, active_months / months_since_first AS value
            FROM per_title
            WHERE months_since_first >= 12
            ORDER BY value DESC, streams DESC, title_id
            """,
            [last],
        )

    return rank


def binge_worthy() -> Ranking:
    return ranked(
        """
        SELECT c.title_id,
               sum(c.total_minutes) / nullif(sum(c.streams * mv.runtime_minutes), 0) AS value
        FROM consumption c
        JOIN movies mv USING (title_id)
        WHERE mv.runtime_minutes IS NOT NULL
        GROUP BY c.title_id
        HAVING sum(c.streams) >= 5000 AND value <= 1
        ORDER BY value DESC, sum(c.streams) DESC, c.title_id
        """,
        [],
    )


def hidden_gems() -> Ranking:
    return ranked(
        """
        WITH per_title AS (
            SELECT title_id, sum(streams) AS streams
            FROM consumption
            GROUP BY title_id
            HAVING sum(streams) > 0
        )
        SELECT mv.title_id, mv.rating AS value
        FROM per_title
        JOIN movies mv USING (title_id)
        WHERE mv.rating >= 8
          AND per_title.streams < (SELECT median(streams) FROM per_title)
        ORDER BY mv.rating DESC, mv.vote_count DESC, mv.title_id
        """,
        [],
    )


def theme_ranking(theme_id: str, start: date, end: date) -> Callable[[], Ranking]:
    def rank() -> Ranking:
        return ranked(
            """
            SELECT mt.title_id, coalesce(sum(c.streams), 0) AS value
            FROM movie_themes mt
            LEFT JOIN consumption c ON c.title_id = mt.title_id AND c.month BETWEEN ? AND ?
            WHERE mt.theme_id = ?
            GROUP BY mt.title_id
            ORDER BY value DESC, mt.title_id
            """,
            [start, end, theme_id],
        )

    return rank


@cache
def collection_definitions() -> tuple[CollectionDefinition, ...]:
    _, last = data_months()
    three_months = (shift_months(last, -2), last)
    twelve_months = (shift_months(last, -11), last)
    window = f"{display.month_label(three_months[0])[:3]}–{display.month_label(last)}"
    countries = [
        r["country"] for r in fetch_all("SELECT DISTINCT country FROM consumption ORDER BY 1")
    ]
    platforms = [
        r["platform"] for r in fetch_all("SELECT DISTINCT platform FROM consumption ORDER BY 1")
    ]
    themes = fetch_all("SELECT theme_id, name, description FROM themes ORDER BY name")

    definitions = [
        CollectionDefinition(
            f"top-{slug(country)}",
            f"Top in {country}",
            f"Most streams in {country}, {window}",
            "country",
            "Streams",
            top_streams(*three_months, "country", country),
        )
        for country in countries
    ]
    definitions += [
        CollectionDefinition(
            "rising-now",
            "Rising now",
            f"Largest growth in {display.month_label(last)} vs the month before",
            "now",
            "Growth",
            rising_now(last),
        ),
        CollectionDefinition(
            "top-2025",
            "Top of 2025",
            "Most streams from Jan to Dec 2025",
            "now",
            "Streams",
            top_streams(date(2025, 1, 1), date(2025, 12, 1)),
        ),
        CollectionDefinition(
            "evergreen",
            "Evergreen",
            "Streamed in most months since release, at least 12 months of history",
            "now",
            "Share of months streamed",
            evergreen(last),
        ),
        CollectionDefinition(
            "binge-worthy",
            "Binge-worthy",
            "Highest share of the runtime watched per stream, 5K+ streams",
            "now",
            "Engagement",
            binge_worthy,
        ),
        CollectionDefinition(
            "hidden-gems",
            "Hidden gems",
            "Rated 8 or more, with fewer streams than the typical title",
            "now",
            "Rating",
            hidden_gems,
        ),
    ]
    definitions += [
        CollectionDefinition(
            f"top-{slug(platform)}",
            f"Top on {platform}",
            f"Most streams on {platform}, {window}",
            "platform",
            "Streams",
            top_streams(*three_months, "platform", platform),
        )
        for platform in platforms
    ]
    definitions += [
        CollectionDefinition(
            f"theme-{theme['theme_id']}",
            theme["name"],
            theme["description"],
            "theme",
            "Streams, last 12 months",
            theme_ranking(theme["theme_id"], *twelve_months),
        )
        for theme in themes
    ]
    return tuple(definitions)


@cache
def ranking_of(collection_id: str) -> Ranking:
    definition = next(d for d in collection_definitions() if d.collection_id == collection_id)
    return definition.rank()


def list_collections() -> m.CollectionList:
    rankings = {d.collection_id: ranking_of(d.collection_id) for d in collection_definitions()}
    preview_ids = [tid for ranking in rankings.values() for tid, _ in ranking[:PREVIEW_SIZE]]
    movies = summaries(preview_ids)
    return m.CollectionList(
        collections=[
            m.CollectionSummary(
                collection_id=d.collection_id,
                title=d.title,
                description=d.description,
                section=m.CollectionSection(d.section),
                metric_label=d.metric_label,
                preview=[movies[tid] for tid, _ in rankings[d.collection_id][:PREVIEW_SIZE]],
            )
            for d in collection_definitions()
            if rankings[d.collection_id]
        ]
    )


def get_collection(collection_id: str) -> m.Collection | None:
    definition = next(
        (d for d in collection_definitions() if d.collection_id == collection_id), None
    )
    if definition is None:
        return None
    ranking = ranking_of(collection_id)
    movies = summaries([tid for tid, _ in ranking])
    return m.Collection(
        collection_id=definition.collection_id,
        title=definition.title,
        description=definition.description,
        section=m.CollectionSection(definition.section),
        metric_label=definition.metric_label,
        items=[
            m.CollectionItem(rank=position, movie=movies[tid], metric_value=value)
            for position, (tid, value) in enumerate(ranking, start=1)
        ],
    )
