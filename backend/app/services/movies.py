"""Movie metadata, availability, vocabularies and search candidates (datasets A and B)."""

from functools import cache
from typing import Any

from app import api_models as m
from app.db import fetch_all, fetch_one, fetch_values

SUMMARY_COLUMNS = """
    title_id, title, year, runtime_minutes, primary_genre, genres, rating, vote_count, image_url
"""


def to_summary(row: dict[str, Any]) -> m.MovieSummary:
    return m.MovieSummary(
        title_id=row["title_id"],
        title=row["title"],
        year=row["year"],
        runtime_minutes=row["runtime_minutes"],
        primary_genre=row["primary_genre"],
        genres=row["genres"] or [],
        rating=row["rating"],
        vote_count=row["vote_count"],
        image_url=row["image_url"],
    )


def summaries(title_ids: list[str]) -> dict[str, m.MovieSummary]:
    if not title_ids:
        return {}
    rows = fetch_all(
        f"SELECT {SUMMARY_COLUMNS} FROM movies WHERE list_contains(?, title_id)",
        [title_ids],
    )
    return {row["title_id"]: to_summary(row) for row in rows}


def movie_exists(title_id: str) -> bool:
    return fetch_one("SELECT 1 AS found FROM movies WHERE title_id = ?", [title_id]) is not None


def movie_detail(title_id: str) -> m.MovieDetail | None:
    row = fetch_one(
        f"""
        SELECT {SUMMARY_COLUMNS}, plot_summary, directors, principal_cast, cast_names, title_url,
               t.theme_id, t.name AS theme_name
        FROM movies
        LEFT JOIN movie_themes USING (title_id)
        LEFT JOIN themes t USING (theme_id)
        WHERE title_id = ?
        """,
        [title_id],
    )
    if row is None:
        return None
    summary = to_summary(row)
    theme = (
        m.ThemeOption(theme_id=row["theme_id"], name=row["theme_name"]) if row["theme_id"] else None
    )
    return m.MovieDetail(
        **summary.model_dump(),
        plot_summary=row["plot_summary"],
        directors=row["directors"] or [],
        principal_cast=row["principal_cast"] or [],
        cast=row["cast_names"] or [],
        title_url=row["title_url"],
        theme=theme,
    )


def lookup(text: str, limit: int) -> list[m.MovieSummary]:
    rows = fetch_all(
        f"""
        SELECT {SUMMARY_COLUMNS}
        FROM movies
        WHERE title ILIKE '%' || ? || '%'
        ORDER BY (title ILIKE ? || '%') DESC, vote_count DESC NULLS LAST, title
        LIMIT ?
        """,
        [text, text, limit],
    )
    return [to_summary(row) for row in rows]


def lookup_people(text: str, limit: int) -> list[m.Person]:
    rows = fetch_all(
        """
        WITH credits AS (
            SELECT unnest(directors) AS name, 'director' AS role, title_id FROM movies
            UNION ALL
            SELECT unnest(cast_names) AS name, 'cast' AS role, title_id FROM movies
        )
        SELECT name, list_sort(list(DISTINCT role)) AS roles, count(DISTINCT title_id) AS movies
        FROM credits
        WHERE name ILIKE '%' || ? || '%'
        GROUP BY name
        ORDER BY (name ILIKE ? || '%') DESC, movies DESC, name
        LIMIT ?
        """,
        [text, text, limit],
    )
    return [m.Person(name=r["name"], roles=r["roles"], movie_count=r["movies"]) for r in rows]


def exact_person(text: str) -> str | None:
    """The catalog spelling of a director or cast member named exactly `text`, if any."""
    row = fetch_one(
        """
        SELECT name FROM (
            SELECT unnest(list_concat(directors, cast_names)) AS name FROM movies
        )
        WHERE lower(name) = lower(?)
        LIMIT 1
        """,
        [text.strip()],
    )
    return row["name"] if row else None


def availability(title_id: str) -> m.Availability:
    offers = fetch_all(
        """
        SELECT platform, platform_type,
               any_value(original_flag) AS original_flag,
               bool_or(is_original) AS is_original,
               list_sort(list(DISTINCT country)) AS countries
        FROM availability
        WHERE title_id = ?
        GROUP BY platform, platform_type
        ORDER BY len(countries) DESC, platform
        """,
        [title_id],
    )
    snapshot = fetch_one(
        """
        SELECT strftime(max(snapshot_month), '%Y-%m') AS month
        FROM availability
        WHERE title_id = ?
        """,
        [title_id],
    )
    countries = sorted({country for offer in offers for country in offer["countries"]})
    return m.Availability(
        title_id=title_id,
        snapshot_month=snapshot["month"] if snapshot else None,
        countries=countries,
        offers=[m.PlatformOffer(**offer) for offer in offers],
    )


@cache
def filter_options() -> m.FilterOptions:
    years = fetch_one("SELECT min(year) AS min, max(year) AS max FROM movies")
    months = fetch_one(
        """
        SELECT strftime(min(month), '%Y-%m') AS start, strftime(max(month), '%Y-%m') AS end
        FROM consumption
        """
    )
    return m.FilterOptions(
        genres=fetch_values("SELECT DISTINCT unnest(genres) AS g FROM movies ORDER BY g"),
        primary_genres=fetch_values(
            "SELECT DISTINCT primary_genre FROM movies WHERE primary_genre IS NOT NULL ORDER BY 1"
        ),
        year_range=m.YearRange(**years),
        availability=m.VocabularyPair(
            countries=fetch_values("SELECT DISTINCT country FROM availability ORDER BY 1"),
            platforms=fetch_values("SELECT DISTINCT platform FROM availability ORDER BY 1"),
        ),
        consumption=m.VocabularyPair(
            countries=fetch_values("SELECT DISTINCT country FROM consumption ORDER BY 1"),
            platforms=fetch_values("SELECT DISTINCT platform FROM consumption ORDER BY 1"),
        ),
        consumption_months=m.MonthRange(**months),
        distributors=fetch_values("SELECT DISTINCT distributor FROM title_distributors ORDER BY 1"),
        themes=[
            m.ThemeOption(**row)
            for row in fetch_all("SELECT theme_id, name FROM themes ORDER BY name")
        ],
    )


def candidate_ids(filters: m.SearchFilters) -> set[str] | None:
    """Title ids allowed by the structured filters; None when no filter is set.

    Semantics in docs/05-search.md: genres must all match; countries and platforms are
    checked on the same availability row; people match directors or cast.
    """
    conditions: list[str] = []
    params: list[Any] = []
    if filters.genres:
        conditions.append("list_has_all(genres, ?)")
        params.append(filters.genres)
    if filters.year_min is not None:
        conditions.append("year >= ?")
        params.append(filters.year_min)
    if filters.year_max is not None:
        conditions.append("year <= ?")
        params.append(filters.year_max)
    if filters.people:
        # Joining the names into one string keeps the match a plain ILIKE per person.
        people_sql = " OR ".join(
            "array_to_string(list_concat(directors, cast_names), '|') ILIKE ?"
            for _ in filters.people
        )
        conditions.append(f"({people_sql})")
        params.extend(f"%{person}%" for person in filters.people)
    if filters.countries or filters.platforms:
        row_conditions = []
        if filters.countries:
            row_conditions.append("list_contains(?, country)")
            params.append(filters.countries)
        if filters.platforms:
            row_conditions.append("list_contains(?, platform)")
            params.append(filters.platforms)
        conditions.append(
            f"title_id IN (SELECT title_id FROM availability WHERE {' AND '.join(row_conditions)})"
        )
    if not conditions:
        return None
    return set(
        fetch_values(f"SELECT title_id FROM movies WHERE {' AND '.join(conditions)}", params)
    )
