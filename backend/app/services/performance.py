"""Monthly consumption of one movie and the facts behind its insight (dataset C)."""

from typing import Any

from app import api_models as m
from app.db import fetch_all, fetch_one, fetch_values
from app.services import display, llm
from app.services.scope import ConsumptionScope


def monthly_series(scope: ConsumptionScope) -> list[m.MonthlyPoint]:
    """Monthly sums, gap-filled with zeros between the first and last month present."""
    where, params = scope.where()
    rows = fetch_all(
        f"""
        WITH monthly AS (
            SELECT month, sum(streams) AS streams, sum(total_minutes) AS minutes
            FROM consumption c
            WHERE {where}
            GROUP BY month
        ),
        months AS (
            SELECT CAST(unnest(generate_series(min(month), max(month), INTERVAL 1 MONTH)) AS DATE)
                   AS month
            FROM monthly
            HAVING count(*) > 0
        )
        SELECT strftime(months.month, '%Y-%m') AS month,
               coalesce(monthly.streams, 0) AS streams,
               coalesce(monthly.minutes, 0) AS minutes
        FROM months
        LEFT JOIN monthly USING (month)
        ORDER BY months.month
        """,
        params,
    )
    return [
        m.MonthlyPoint(
            month=row["month"], streams=row["streams"], viewing_hours=row["minutes"] / 60
        )
        for row in rows
    ]


def share_items(scope: ConsumptionScope, column: str) -> list[m.ShareItem]:
    where, params = scope.where()
    rows = fetch_all(
        f"""
        SELECT {column} AS key, sum(streams) AS streams, sum(total_minutes) AS minutes
        FROM consumption c
        WHERE {where}
        GROUP BY {column}
        ORDER BY streams DESC, key
        """,
        params,
    )
    total = sum(row["streams"] for row in rows)
    return [
        m.ShareItem(
            key=row["key"],
            streams=row["streams"],
            viewing_hours=row["minutes"] / 60,
            share_of_streams=row["streams"] / total if total else 0,
        )
        for row in rows
    ]


def performance(title_id: str, countries: list[str], platforms: list[str]) -> m.Performance:
    scope = ConsumptionScope(title_id=title_id, countries=countries, platforms=platforms)
    series = monthly_series(scope)
    period = m.MonthRange(start=series[0].month, end=series[-1].month) if series else None
    return m.Performance(
        title_id=title_id,
        applied_filters=m.ConsumptionFilters(countries=countries, platforms=platforms),
        options=m.ConsumptionFilters(
            countries=fetch_values(
                "SELECT DISTINCT country FROM consumption WHERE title_id = ? ORDER BY 1", [title_id]
            ),
            platforms=fetch_values(
                "SELECT DISTINCT platform FROM consumption WHERE title_id = ? ORDER BY 1",
                [title_id],
            ),
        ),
        period=period,
        totals=m.MetricTotals(
            streams=sum(point.streams for point in series),
            viewing_hours=sum(point.viewing_hours for point in series),
        ),
        series=series,
        # Each breakdown ignores its own dimension's filter so it still shows the full split.
        by_country=share_items(scope.without("countries"), "country"),
        by_platform=share_items(scope.without("platforms"), "platform"),
    )


def top_share(title_id: str, column: str) -> tuple[str | None, float | None]:
    items = share_items(ConsumptionScope(title_id=title_id), column)
    if not items or items[0].streams == 0:
        return None, None
    return items[0].key, items[0].share_of_streams


def insight_facts(title_id: str) -> m.InsightFacts:
    totals = fetch_one(
        """
        SELECT coalesce(sum(c.streams), 0) AS streams,
               coalesce(sum(c.total_minutes), 0) AS minutes,
               sum(c.total_minutes) FILTER (WHERE mv.runtime_minutes IS NOT NULL)
                 / nullif(sum(c.streams * mv.runtime_minutes), 0) AS engagement
        FROM consumption c
        JOIN movies mv USING (title_id)
        WHERE c.title_id = ?
        """,
        [title_id],
    )
    active = fetch_all(
        """
        SELECT strftime(month, '%Y-%m') AS month, sum(streams) AS streams
        FROM consumption
        WHERE title_id = ?
        GROUP BY month
        HAVING sum(streams) > 0
        ORDER BY month
        """,
        [title_id],
    )
    peak = max(active, key=lambda row: row["streams"]) if active else None
    top_country, top_country_share = top_share(title_id, "country")
    top_platform, top_platform_share = top_share(title_id, "platform")
    return m.InsightFacts(
        total_streams=totals["streams"],
        viewing_hours=totals["minutes"] / 60,
        months_with_data=len(active),
        first_month=active[0]["month"] if active else None,
        last_month=active[-1]["month"] if active else None,
        peak_month=peak["month"] if peak else None,
        peak_streams=peak["streams"] if peak else None,
        top_country=top_country,
        top_country_share=top_country_share,
        top_platform=top_platform,
        top_platform_share=top_platform_share,
        engagement=totals["engagement"],
    )


def insight_display(title: str, facts: m.InsightFacts) -> dict[str, Any]:
    return {
        "title": title,
        "total_streams": display.compact(facts.total_streams),
        "viewing_hours": display.compact(facts.viewing_hours),
        "months_with_streams": str(facts.months_with_data),
        "first_month": display.month_label(facts.first_month and facts.first_month.root),
        "last_month": display.month_label(facts.last_month and facts.last_month.root),
        "peak_month": display.month_label(facts.peak_month and facts.peak_month.root),
        "peak_month_streams": display.compact(facts.peak_streams),
        "top_country": facts.top_country,
        "top_country_share": display.percent(facts.top_country_share),
        "top_platform": facts.top_platform,
        "top_platform_share": display.percent(facts.top_platform_share),
        "engagement": display.percent(facts.engagement),
    }


def insight(title_id: str, title: str) -> m.Insight:
    facts = insight_facts(title_id)
    if facts.total_streams == 0:
        narrative = m.Narrative(status=m.LlmStatus("insufficient_evidence"), text=None)
    else:
        narrative = llm.write_insight(insight_display(title, facts))
    return m.Insight(title_id=title_id, facts=facts, narrative=narrative)
