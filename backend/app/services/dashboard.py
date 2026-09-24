"""Catalog KPIs, trends, breakdowns and movers for the dashboard (docs/04-metrics.md)."""

from dataclasses import dataclass
from datetime import date
from functools import cache
from typing import Any

from app import api_models as m
from app.db import fetch_all, fetch_one
from app.services import display, llm
from app.services.movies import summaries
from app.services.scope import (
    ConsumptionScope,
    first_of_month,
    months_between,
    shift_months,
)

GROWTH_MIN_PRIOR_STREAMS = 100
# Below this volume a single viewer moves the ratio; rankings would reward noise.
ENGAGEMENT_MIN_STREAMS = 100

BREAKDOWN_KEYS = {
    "platform": ("c.platform", "c.platform"),
    "country": ("c.country", "c.country"),
    "primary_genre": (
        "coalesce(mv.primary_genre, 'Unknown')",
        "coalesce(mv.primary_genre, 'Unknown')",
    ),
    "theme": ("mt.theme_id", "t.name"),
    "release_year": ("CAST(mv.year AS VARCHAR)", "CAST(mv.year AS VARCHAR)"),
}

TITLE_SORT_COLUMNS = {
    "streams": "streams",
    "viewing_hours": "minutes",
    "engagement": "engagement",
    "growth": "growth_pct",
}


class InvalidPeriod(ValueError):
    pass


@dataclass(frozen=True)
class DashboardRequest:
    scope: ConsumptionScope
    filters: m.DashboardFilters
    previous: ConsumptionScope | None


@cache
def data_months() -> tuple[date, date]:
    row = fetch_one("SELECT min(month) AS first, max(month) AS last FROM consumption")
    return row["first"], row["last"]


def resolve(
    start: str | None,
    end: str | None,
    countries: list[str],
    platforms: list[str],
    genres: list[str],
    themes: list[str],
    distributors: list[str],
) -> DashboardRequest:
    first_month, last_month = data_months()
    end_month = first_of_month(end) if end else last_month
    start_month = first_of_month(start) if start else max(shift_months(end_month, -11), first_month)
    if start_month > end_month:
        raise InvalidPeriod("start must not be after end")
    if end_month < first_month or start_month > last_month:
        raise InvalidPeriod(
            f"the period must overlap the data ({display.month_key(first_month)} to "
            f"{display.month_key(last_month)})"
        )

    scope = ConsumptionScope(
        start=start_month,
        end=end_month,
        countries=countries,
        platforms=platforms,
        genres=genres,
        themes=themes,
        distributors=distributors,
    )
    length = months_between(start_month, end_month)
    previous_start = shift_months(start_month, -length)
    previous = (
        scope.with_period(previous_start, shift_months(start_month, -1))
        if previous_start >= first_month
        else None
    )
    filters = m.DashboardFilters(
        start=display.month_key(start_month),
        end=display.month_key(end_month),
        countries=countries,
        platforms=platforms,
        genres=genres,
        themes=themes,
        distributors=distributors,
    )
    return DashboardRequest(scope=scope, filters=filters, previous=previous)


def period_range(scope: ConsumptionScope | None) -> m.MonthRange | None:
    if scope is None:
        return None
    return m.MonthRange(start=display.month_key(scope.start), end=display.month_key(scope.end))


def aggregates(scope: ConsumptionScope) -> dict[str, Any]:
    where, params = scope.where()
    return fetch_one(
        f"""
        WITH per_title AS (
            SELECT c.title_id,
                   sum(c.streams) AS streams,
                   sum(c.total_minutes) AS minutes,
                   sum(c.total_minutes) FILTER (WHERE mv.runtime_minutes IS NOT NULL)
                     AS minutes_with_runtime,
                   sum(c.streams * mv.runtime_minutes) AS runtime_minutes_streamed
            FROM consumption c
            JOIN movies mv USING (title_id)
            WHERE {where}
            GROUP BY c.title_id
        )
        SELECT coalesce(sum(streams), 0) AS streams,
               coalesce(sum(minutes), 0) AS minutes,
               count(*) FILTER (WHERE streams > 0) AS titles,
               sum(minutes_with_runtime) / nullif(sum(runtime_minutes_streamed), 0) AS engagement
        FROM per_title
        """,
        params,
    )


def relative_change(current: float | None, previous: float | None) -> float | None:
    if current is None or not previous:
        return None
    return (current - previous) / previous


def count_kpi(current: float, previous: float | None) -> m.Kpi:
    return m.Kpi(
        value=current,
        previous=previous,
        change_pct=relative_change(current, previous),
        change_pp=None,
    )


def ratio_kpi(current: float | None, previous: float | None) -> m.Kpi:
    change_pp = (current - previous) * 100 if current is not None and previous is not None else None
    return m.Kpi(value=current, previous=previous, change_pct=None, change_pp=change_pp)


def summary(request: DashboardRequest) -> m.DashboardSummary:
    current = aggregates(request.scope)
    previous = aggregates(request.previous) if request.previous else None

    def previous_value(key: str, divisor: float = 1) -> float | None:
        if previous is None or previous[key] is None:
            return None
        return previous[key] / divisor

    return m.DashboardSummary(
        filters=request.filters,
        previous_period=period_range(request.previous),
        streams=count_kpi(current["streams"], previous_value("streams")),
        viewing_hours=count_kpi(current["minutes"] / 60, previous_value("minutes", 60)),
        titles_with_consumption=count_kpi(current["titles"], previous_value("titles")),
        engagement=ratio_kpi(current["engagement"], previous_value("engagement")),
    )


def monthly_points(scope: ConsumptionScope, group_column: str | None) -> dict[str, list]:
    """Gap-filled monthly sums over the whole period, per value of `group_column` (or one total)."""
    where, params = scope.where()
    key = f"c.{group_column}" if group_column else "'total'"
    # The total always exists, even when no row matches, so the chart can show zeros.
    total_key = "" if group_column else "UNION SELECT 'total'"
    rows = fetch_all(
        f"""
        WITH months AS (
            SELECT CAST(unnest(generate_series(?::DATE, ?::DATE, INTERVAL 1 MONTH)) AS DATE)
                   AS month
        ),
        monthly AS (
            SELECT {key} AS key, month, sum(streams) AS streams, sum(total_minutes) AS minutes
            FROM consumption c
            WHERE {where}
            GROUP BY ALL
        ),
        keys AS (SELECT DISTINCT key FROM monthly {total_key})
        SELECT keys.key, strftime(months.month, '%Y-%m') AS month,
               coalesce(streams, 0) AS streams, coalesce(minutes, 0) AS minutes
        FROM keys
        CROSS JOIN months
        LEFT JOIN monthly ON monthly.key = keys.key AND monthly.month = months.month
        ORDER BY keys.key, months.month
        """,
        [scope.start, scope.end, *params],
    )
    points: dict[str, list] = {}
    for row in rows:
        points.setdefault(row["key"], []).append(
            m.MonthlyPoint(
                month=row["month"], streams=row["streams"], viewing_hours=row["minutes"] / 60
            )
        )
    return points


def trend(request: DashboardRequest, group_by: str | None = None) -> m.DashboardTrend:
    groups = monthly_points(request.scope, group_by) if group_by else {}
    return m.DashboardTrend(
        filters=request.filters,
        series=monthly_points(request.scope, None)["total"],
        groups=[
            m.TrendGroup(key=key, series=series)
            for key, series in sorted(
                groups.items(), key=lambda item: -sum(p.streams for p in item[1])
            )
        ],
    )


def breakdown_items(scope: ConsumptionScope, dimension: str) -> list[m.BreakdownItem]:
    key_sql, label_sql = BREAKDOWN_KEYS[dimension]
    where, params = scope.where()
    theme_join = "JOIN movie_themes mt USING (title_id) JOIN themes t USING (theme_id)"
    rows = fetch_all(
        f"""
        WITH per_title AS (
            SELECT {key_sql} AS key, {label_sql} AS label, c.title_id,
                   sum(c.streams) AS streams, sum(c.total_minutes) AS minutes
            FROM consumption c
            JOIN movies mv USING (title_id)
            {theme_join if dimension == "theme" else ""}
            WHERE {where}
            GROUP BY ALL
        )
        SELECT key, any_value(label) AS label,
               sum(streams) AS streams, sum(minutes) AS minutes,
               count(*) FILTER (WHERE streams > 0) AS titles
        FROM per_title
        GROUP BY key
        ORDER BY streams DESC, key
        """,
        params,
    )
    total = sum(row["streams"] for row in rows)
    return [
        m.BreakdownItem(
            key=row["key"],
            label=row["label"],
            streams=row["streams"],
            viewing_hours=row["minutes"] / 60,
            titles=row["titles"],
            streams_per_title=row["streams"] / row["titles"] if row["titles"] else None,
            share_of_streams=row["streams"] / total if total else 0,
        )
        for row in rows
    ]


def breakdown(request: DashboardRequest, dimension: str) -> m.DashboardBreakdown:
    return m.DashboardBreakdown(
        filters=request.filters,
        dimension=m.BreakdownDimension(dimension),
        items=breakdown_items(request.scope, dimension),
    )


def matrix(request: DashboardRequest) -> m.DashboardMatrix:
    where, params = request.scope.where()
    rows = fetch_all(
        f"""
        WITH per_title AS (
            SELECT platform, country, title_id, sum(streams) AS streams
            FROM consumption c
            WHERE {where}
            GROUP BY ALL
        )
        SELECT platform, country, sum(streams) AS streams,
               count(*) FILTER (WHERE streams > 0) AS titles
        FROM per_title
        GROUP BY platform, country
        ORDER BY platform, country
        """,
        params,
    )
    cells = [
        m.MatrixCell(
            platform=row["platform"],
            country=row["country"],
            streams=row["streams"],
            titles=row["titles"],
            streams_per_title=row["streams"] / row["titles"] if row["titles"] else None,
        )
        for row in rows
    ]
    return m.DashboardMatrix(
        filters=request.filters,
        platforms=sorted({cell.platform for cell in cells}),
        countries=sorted({cell.country for cell in cells}),
        cells=cells,
    )


def title_rows(request: DashboardRequest) -> list[dict[str, Any]]:
    scope = request.scope
    where, params = scope.where()
    last_month = scope.end
    prior_month = shift_months(last_month, -1)
    growth_where, growth_params = scope.with_period(prior_month, last_month).where()
    return fetch_all(
        f"""
        WITH per_title AS (
            SELECT c.title_id,
                   sum(c.streams) AS streams,
                   sum(c.total_minutes) AS minutes,
                   CASE WHEN sum(c.streams) >= {ENGAGEMENT_MIN_STREAMS}
                        THEN sum(c.total_minutes) FILTER (WHERE mv.runtime_minutes IS NOT NULL)
                             / nullif(sum(c.streams * mv.runtime_minutes), 0)
                   END AS engagement
            FROM consumption c
            JOIN movies mv USING (title_id)
            WHERE {where}
            GROUP BY c.title_id
            HAVING sum(c.streams) > 0
        ),
        growth AS (
            SELECT c.title_id,
                   coalesce(sum(c.streams) FILTER (WHERE c.month = ?), 0) AS last_streams,
                   coalesce(sum(c.streams) FILTER (WHERE c.month = ?), 0) AS prior_streams
            FROM consumption c
            WHERE {growth_where}
            GROUP BY c.title_id
        )
        SELECT per_title.*,
               CASE WHEN prior_streams >= {GROWTH_MIN_PRIOR_STREAMS}
                    THEN (last_streams - prior_streams) / prior_streams END AS growth_pct
        FROM per_title
        LEFT JOIN growth USING (title_id)
        """,
        [*params, last_month, prior_month, *growth_params],
    )


def titles(request: DashboardRequest, sort: str, limit: int, offset: int) -> m.DashboardTitles:
    column = TITLE_SORT_COLUMNS[sort]
    rows = sorted(
        title_rows(request),
        key=lambda row: (row[column] is None, -(row[column] or 0), row["title_id"]),
    )
    page = rows[offset : offset + limit]
    movies = summaries([row["title_id"] for row in page])
    return m.DashboardTitles(
        filters=request.filters,
        sort=m.TitleSort(sort),
        total=len(rows),
        offset=offset,
        limit=limit,
        items=[
            m.RankedTitle(
                rank=offset + position + 1,
                movie=movies[row["title_id"]],
                streams=row["streams"],
                viewing_hours=row["minutes"] / 60,
                engagement=row["engagement"],
                growth_pct=row["growth_pct"],
            )
            for position, row in enumerate(page)
        ],
    )


def streams_by_title(scope: ConsumptionScope) -> dict[str, int]:
    where, params = scope.where()
    rows = fetch_all(
        f"SELECT title_id, sum(streams) AS streams FROM consumption c WHERE {where} GROUP BY 1",
        params,
    )
    return {row["title_id"]: row["streams"] for row in rows}


def movers(request: DashboardRequest) -> tuple[list[m.Mover], list[m.Mover]]:
    current = streams_by_title(request.scope)
    previous = streams_by_title(request.previous)
    changes = [
        (title_id, current.get(title_id, 0), previous.get(title_id, 0))
        for title_id in current.keys() | previous.keys()
    ]
    changes.sort(key=lambda item: (-(item[1] - item[2]), item[0]))
    gainers = [c for c in changes if c[1] > c[2]][:5]
    decliners = [c for c in reversed(changes) if c[1] < c[2]][:5]
    movies = summaries([c[0] for c in gainers + decliners])

    def to_mover(item: tuple[str, int, int]) -> m.Mover:
        title_id, streams, previous_streams = item
        return m.Mover(
            movie=movies[title_id],
            streams=streams,
            previous_streams=previous_streams,
            change=streams - previous_streams,
        )

    return [to_mover(c) for c in gainers], [to_mover(c) for c in decliners]


def share_shifts(request: DashboardRequest) -> list[m.ShareShift]:
    shifts = []
    for dimension in ("platform", "country"):
        current = {i.key: i.share_of_streams for i in breakdown_items(request.scope, dimension)}
        previous = {i.key: i.share_of_streams for i in breakdown_items(request.previous, dimension)}
        for key in sorted(current.keys() | previous.keys()):
            share, previous_share = current.get(key, 0.0), previous.get(key, 0.0)
            shifts.append(
                m.ShareShift(
                    dimension=dimension,
                    key=key,
                    share=share,
                    previous_share=previous_share,
                    change_pp=(share - previous_share) * 100,
                )
            )
    return sorted(shifts, key=lambda shift: -abs(shift.change_pp))


def changes_display(
    request: DashboardRequest,
    gainers: list[m.Mover],
    decliners: list[m.Mover],
    shifts: list[m.ShareShift],
) -> dict[str, Any]:
    def period_label(scope: ConsumptionScope) -> str:
        return f"{display.month_label(scope.start)} to {display.month_label(scope.end)}"

    def mover_line(mover: m.Mover) -> str:
        return (
            f"{mover.movie.title}: {display.compact(mover.streams)} streams, "
            f"previously {display.compact(mover.previous_streams)}"
        )

    return {
        "current_period": period_label(request.scope),
        "previous_period": period_label(request.previous),
        "biggest_gainers": [mover_line(mover) for mover in gainers],
        "biggest_decliners": [mover_line(mover) for mover in decliners],
        "share_shifts": [
            f"{shift.key} ({shift.dimension}): {display.percent(shift.previous_share)} to "
            f"{display.percent(shift.share)}"
            for shift in shifts[:4]
        ],
    }


def changes(request: DashboardRequest) -> m.DashboardChanges:
    if request.previous is None:
        return m.DashboardChanges(
            filters=request.filters,
            previous_period=None,
            gainers=[],
            decliners=[],
            share_shifts=[],
            narrative=m.Narrative(status=m.LlmStatus("insufficient_evidence"), text=None),
        )
    gainers, decliners = movers(request)
    shifts = share_shifts(request)
    if gainers or decliners:
        narrative = llm.write_changes(changes_display(request, gainers, decliners, shifts))
    else:
        narrative = m.Narrative(status=m.LlmStatus("insufficient_evidence"), text=None)
    return m.DashboardChanges(
        filters=request.filters,
        previous_period=period_range(request.previous),
        gainers=gainers,
        decliners=decliners,
        share_shifts=shifts,
        narrative=narrative,
    )
