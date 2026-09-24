"""Decision Studio evidence built from comparable titles (docs/04-metrics.md, docs/05-search.md).

A comparable's "first-6-month streams" start at its first month with streams on the target
platform and country. Titles whose window is not fully observed are excluded, not extrapolated.
"""

from dataclasses import dataclass
from datetime import date
from functools import lru_cache
from statistics import median
from typing import Any

import numpy as np

from app import api_models as m
from app.db import fetch_all, fetch_one, fetch_values
from app.services import display, llm
from app.services.dashboard import data_months
from app.services.movies import filter_options, summaries
from app.services.scope import shift_months
from app.services.search import search_index

COMPARABLE_COUNT = 20
YEAR_WINDOW = 2
MIN_EVIDENCE = 3
STRONG_RATIO = 1.2
MODERATE_RATIO = 0.8

# The only mapping between consumption (C) and availability (B) platform names (docs/03-data.md).
AVAILABILITY_PLATFORMS = {
    "Amazon": ["Amazon Prime Video", "Amazon Other"],
    "Disney+": ["Disney+"],
    "HBO Max": ["HBO Max"],
    "Netflix": ["Netflix"],
}


class InvalidTarget(ValueError):
    pass


@dataclass(frozen=True)
class WindowStreams:
    first_month: date
    streams: int


def eligibility_cutoff() -> date:
    return shift_months(data_months()[1], -5)


def first_six_months(
    title_ids: list[str] | None, platform: str | None = None, country: str | None = None
) -> dict[str, WindowStreams]:
    """First-6-month streams per title, on one platform and country or across all of them."""
    conditions, params = ["TRUE"], []
    if platform is not None:
        conditions.append("platform = ?")
        params.append(platform)
    if country is not None:
        conditions.append("country = ?")
        params.append(country)
    if title_ids is not None:
        conditions.append("list_contains(?, title_id)")
        params.append(title_ids)
    rows = fetch_all(
        f"""
        WITH monthly AS (
            SELECT title_id, month, sum(streams) AS streams
            FROM consumption
            WHERE {" AND ".join(conditions)}
            GROUP BY title_id, month
        ),
        first_month AS (
            SELECT title_id, min(month) AS first_month
            FROM monthly
            WHERE streams > 0
            GROUP BY title_id
        )
        SELECT title_id, first_month,
               sum(streams) FILTER (
                   WHERE month BETWEEN first_month AND first_month + INTERVAL 5 MONTH
               ) AS streams
        FROM monthly
        JOIN first_month USING (title_id)
        GROUP BY title_id, first_month
        """,
        params,
    )
    return {row["title_id"]: WindowStreams(row["first_month"], row["streams"]) for row in rows}


@lru_cache(maxsize=64)
def benchmark(platform: str, country: str) -> float | None:
    cutoff = eligibility_cutoff()
    values = [
        window.streams
        for window in first_six_months(None, platform, country).values()
        if window.first_month <= cutoff
    ]
    return float(median(values)) if values else None


def expected_range(values: list[int], benchmark_value: float | None) -> m.ExpectedRange:
    if len(values) < MIN_EVIDENCE:
        return m.ExpectedRange(
            status="insufficient_evidence",
            p25=None,
            median=None,
            p75=None,
            benchmark=benchmark_value,
            eligible_count=len(values),
        )
    p25, p50, p75 = (float(v) for v in np.percentile(values, [25, 50, 75]))
    return m.ExpectedRange(
        status="ok",
        p25=p25,
        median=p50,
        p75=p75,
        benchmark=benchmark_value,
        eligible_count=len(values),
    )


def demand_signal(evidence: m.ExpectedRange) -> m.DemandSignal:
    if evidence.status == "insufficient_evidence" or not evidence.benchmark:
        return m.DemandSignal("insufficient_evidence")
    ratio = evidence.median / evidence.benchmark
    if ratio >= STRONG_RATIO:
        return m.DemandSignal("strong")
    if ratio >= MODERATE_RATIO:
        return m.DemandSignal("moderate")
    return m.DemandSignal("weak")


def licensing_comparables(title_id: str) -> list[tuple[str, float]]:
    target = fetch_one("SELECT primary_genre, year FROM movies WHERE title_id = ?", [title_id])
    candidates = set(
        fetch_values(
            """
            SELECT title_id FROM movies
            WHERE primary_genre IS NOT DISTINCT FROM ? AND abs(year - ?) <= ? AND title_id <> ?
            """,
            [target["primary_genre"], target["year"], YEAR_WINDOW, title_id],
        )
    )
    return search_index().similar(title_id, limit=COMPARABLE_COUNT, allowed_ids=candidates)


def platform_fit(comparable_ids: list[str], country: str) -> list[m.PlatformFitItem]:
    rows = fetch_all(
        """
        WITH per_title AS (
            SELECT platform, title_id, sum(streams) AS streams
            FROM consumption
            WHERE country = ? AND list_contains(?, title_id)
            GROUP BY platform, title_id
            HAVING sum(streams) > 0
        )
        SELECT platform, count(*) AS titles, sum(streams) / count(*) AS streams_per_title
        FROM per_title
        GROUP BY platform
        ORDER BY streams_per_title DESC
        """,
        [country, comparable_ids],
    )
    return [m.PlatformFitItem(**row) for row in rows]


def whitespace(title_id: str, comparable_ids: list[str]) -> list[m.WhitespaceItem]:
    rows = fetch_all(
        """
        SELECT country, count(DISTINCT title_id) AS comparables_with_streams
        FROM consumption
        WHERE list_contains(?, title_id) AND streams > 0
          AND country NOT IN (SELECT country FROM availability WHERE title_id = ?)
        GROUP BY country
        HAVING count(DISTINCT title_id) >= ?
        ORDER BY comparables_with_streams DESC, country
        """,
        [comparable_ids, title_id, MIN_EVIDENCE],
    )
    return [m.WhitespaceItem(**row) for row in rows]


def validate_target(platform: str, country: str) -> None:
    vocabulary = filter_options().consumption
    if platform not in vocabulary.platforms:
        raise InvalidTarget(f"platform must be one of {vocabulary.platforms}")
    if country not in vocabulary.countries:
        raise InvalidTarget(f"country must be one of {vocabulary.countries}")


@lru_cache(maxsize=128)
def licensing_assessment(
    title_id: str, platform: str, country: str
) -> m.LicensingAssessment | None:
    validate_target(platform, country)
    movie = summaries([title_id]).get(title_id)
    if movie is None:
        return None

    ranked = licensing_comparables(title_id)
    comparable_ids = [tid for tid, _ in ranked]
    windows = first_six_months(comparable_ids, platform, country)
    cutoff = eligibility_cutoff()
    movies = summaries(comparable_ids)
    comparables = [
        m.Comparable(
            movie=movies[tid],
            similarity=score,
            first_six_month_streams=windows[tid].streams if tid in windows else None,
            eligible=tid in windows and windows[tid].first_month <= cutoff,
        )
        for tid, score in ranked
    ]
    evidence = expected_range(
        [c.first_six_month_streams for c in comparables if c.eligible],
        benchmark(platform, country),
    )
    totals = fetch_one(
        """
        SELECT coalesce(sum(streams), 0) AS streams, coalesce(sum(total_minutes), 0) AS minutes
        FROM consumption WHERE title_id = ?
        """,
        [title_id],
    )
    already_on_target = bool(
        fetch_one(
            """
            SELECT 1 AS found FROM availability
            WHERE title_id = ? AND country = ? AND list_contains(?, platform)
            """,
            [title_id, country, AVAILABILITY_PLATFORMS[platform]],
        )
    )
    return m.LicensingAssessment(
        movie=movie,
        target=m.LicensingTarget(platform=platform, country=country),
        already_on_target=already_on_target,
        title_totals=m.MetricTotals(
            streams=totals["streams"], viewing_hours=totals["minutes"] / 60
        ),
        availability_countries=fetch_values(
            "SELECT DISTINCT country FROM availability WHERE title_id = ? ORDER BY 1", [title_id]
        ),
        comparables=comparables,
        expected_range=evidence,
        signal=demand_signal(evidence),
        platform_fit=platform_fit(comparable_ids, country),
        whitespace=whitespace(title_id, comparable_ids),
    )


def market_opportunities(title_id: str) -> m.MarketOpportunities | None:
    movie = summaries([title_id]).get(title_id)
    if movie is None:
        return None
    comparable_ids = [tid for tid, _ in licensing_comparables(title_id)]
    cutoff = eligibility_cutoff()
    vocabulary = filter_options().consumption
    available = {
        (row["country"], row["platform"])
        for row in fetch_all(
            "SELECT DISTINCT country, platform FROM availability WHERE title_id = ?", [title_id]
        )
    }
    targets = []
    for platform in vocabulary.platforms:
        for country in vocabulary.countries:
            windows = first_six_months(comparable_ids, platform, country)
            evidence = expected_range(
                [w.streams for w in windows.values() if w.first_month <= cutoff],
                benchmark(platform, country),
            )
            ratio = (
                evidence.median / evidence.benchmark
                if evidence.median is not None and evidence.benchmark
                else None
            )
            targets.append(
                m.MarketOpportunity(
                    platform=platform,
                    country=country,
                    signal=demand_signal(evidence),
                    median=evidence.median,
                    benchmark=evidence.benchmark,
                    ratio=ratio,
                    eligible_count=evidence.eligible_count,
                    already_available=any(
                        (country, name) in available for name in AVAILABILITY_PLATFORMS[platform]
                    ),
                )
            )
    targets.sort(key=lambda t: (t.ratio is None, -(t.ratio or 0), t.platform, t.country))
    return m.MarketOpportunities(movie=movie, comparable_count=len(comparable_ids), targets=targets)


def licensing_display(assessment: m.LicensingAssessment) -> dict[str, Any]:
    evidence = assessment.expected_range
    return {
        "title": f"{assessment.movie.title} ({assessment.movie.year})",
        "target": f"{assessment.target.platform} in {assessment.target.country}",
        "demand_signal": assessment.signal.root,
        "already_available_on_target": assessment.already_on_target,
        "comparables_with_full_window": str(evidence.eligible_count),
        "comparables_first_6_month_streams_p25": display.compact(evidence.p25),
        "comparables_first_6_month_streams_median": display.compact(evidence.median),
        "comparables_first_6_month_streams_p75": display.compact(evidence.p75),
        "benchmark_median_all_titles_on_target": display.compact(evidence.benchmark),
        "title_own_streams_all_markets": display.compact(assessment.title_totals.streams),
        "title_available_in": assessment.availability_countries,
        "platform_fit_in_country": [
            f"{fit.platform}: {display.compact(fit.streams_per_title)} streams per title "
            f"({fit.titles} comparables)"
            for fit in assessment.platform_fit
        ],
        "whitespace_countries": [item.country for item in assessment.whitespace],
        "closest_comparables": [c.movie.title for c in assessment.comparables[:5]],
    }


def licensing_memo(title_id: str, platform: str, country: str) -> m.LicensingMemo | None:
    assessment = licensing_assessment(title_id, platform, country)
    if assessment is None:
        return None
    return llm.write_licensing_memo(licensing_display(assessment), assessment.signal)
