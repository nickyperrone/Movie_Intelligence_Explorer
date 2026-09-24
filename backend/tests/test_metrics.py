"""API figures compared with pandas computations over the raw CSVs (docs/04-metrics.md)."""

import json

import pandas as pd
import pytest

from app.config import settings

API = "/api/v1"

FILTER_CASES = [
    {},
    {"countries": ["Brazil"]},
    {"platforms": ["Netflix"]},
    {"countries": ["Mexico", "Colombia"], "platforms": ["Amazon", "HBO Max"]},
    {"start": "2024-01", "end": "2024-12"},
    {"start": "2025-03", "end": "2025-03", "countries": ["Argentina"]},
    {"genres": ["Comedy"]},
    {"genres": ["Action", "Horror"], "platforms": ["Disney+"]},
    {"distributors": ["Sony"]},
    {"themes": ["t09"], "countries": ["Mexico"]},
    {"start": "2023-01", "end": "2026-06", "distributors": ["Netflix"], "countries": ["Brazil"]},
]


def filter_raw(consumption, movies, availability, case):
    end = case.get("end", "2026-06")
    start = case.get("start", "2025-07")
    rows = consumption[(consumption["month"] >= start) & (consumption["month"] <= end)]
    if case.get("countries"):
        rows = rows[rows["country"].isin(case["countries"])]
    if case.get("platforms"):
        rows = rows[rows["platform"].isin(case["platforms"])]
    if case.get("genres"):
        ids = movies.loc[movies["PRIMARY_GENRE"].isin(case["genres"]), "TITLE_ID"]
        rows = rows[rows["imdb_id"].isin(ids)]
    if case.get("themes"):
        themes = json.loads((settings.curated_dir / "themes.json").read_text())["themes"]
        ids = {tid for t in themes if t["theme_id"] in case["themes"] for tid in t["title_ids"]}
        rows = rows[rows["imdb_id"].isin(ids)]
    if case.get("distributors"):
        ids = availability.loc[
            availability["PARENT_DISTRIBUTOR"].isin(case["distributors"]), "IMDB_ID"
        ]
        rows = rows[rows["imdb_id"].isin(ids)]
    return rows


@pytest.mark.parametrize("case", FILTER_CASES)
def test_dashboard_totals_match_raw_data(
    client, raw_consumption, raw_movies, raw_availability, case
):
    expected = filter_raw(raw_consumption, raw_movies, raw_availability, case)
    summary = client.get(f"{API}/dashboard/summary", params=case).json()
    assert summary["streams"]["value"] == expected["streams"].sum()
    assert summary["viewing_hours"]["value"] == pytest.approx(expected["total_minutes"].sum() / 60)
    per_title = expected.groupby("imdb_id")["streams"].sum()
    assert summary["titles_with_consumption"]["value"] == (per_title > 0).sum()


@pytest.mark.parametrize("dimension", ["platform", "country", "primary_genre", "release_year"])
def test_breakdown_shares_add_up_to_one(client, dimension):
    items = client.get(f"{API}/dashboard/breakdown", params={"dimension": dimension}).json()[
        "items"
    ]
    assert sum(item["share_of_streams"] for item in items) == pytest.approx(1.0, abs=1e-9)


def test_engagement_is_a_ratio_of_sums(client, raw_consumption, raw_movies):
    rows = raw_consumption[(raw_consumption["month"] >= "2025-07")].merge(
        raw_movies[["TITLE_ID", "RUNTIME_MINUTES"]], left_on="imdb_id", right_on="TITLE_ID"
    )
    ratio_of_sums = rows["total_minutes"].sum() / (rows["streams"] * rows["RUNTIME_MINUTES"]).sum()
    per_title = rows.groupby("imdb_id").apply(
        lambda g: g["total_minutes"].sum() / (g["streams"] * g["RUNTIME_MINUTES"]).sum(),
        include_groups=False,
    )
    mean_of_ratios = per_title.replace([float("inf")], pd.NA).dropna().mean()
    engagement = client.get(f"{API}/dashboard/summary").json()["engagement"]["value"]
    assert engagement == pytest.approx(ratio_of_sums)
    assert engagement != pytest.approx(mean_of_ratios)


def test_previous_period_before_data_start_has_no_change(client):
    summary = client.get(f"{API}/dashboard/summary", params={"start": "2023-01", "end": "2023-06"})
    body = summary.json()
    assert body["previous_period"] is None
    assert body["streams"]["change_pct"] is None


def test_trend_covers_every_month_of_the_period(client):
    series = client.get(f"{API}/dashboard/trend", params={"start": "2024-01", "end": "2024-12"})
    assert [point["month"] for point in series.json()["series"]] == [
        f"2024-{month:02d}" for month in range(1, 13)
    ]


def test_movie_performance_matches_raw_data_with_multiple_availability_rows(
    client, raw_consumption, raw_availability
):
    # A movie with several availability rows in Brazil must not have its streams multiplied.
    brazil_rows = raw_availability[raw_availability["COUNTRY"] == "Brazil"]
    title_id = brazil_rows["IMDB_ID"].value_counts().index[0]
    assert brazil_rows["IMDB_ID"].value_counts().iloc[0] > 1

    expected = raw_consumption[raw_consumption["imdb_id"] == title_id]
    body = client.get(f"{API}/movies/{title_id}/performance").json()
    assert body["totals"]["streams"] == expected["streams"].sum()

    brazil = expected[expected["country"] == "Brazil"]["streams"].sum()
    filtered = client.get(f"{API}/movies/{title_id}/performance", params={"countries": "Brazil"})
    assert filtered.json()["totals"]["streams"] == brazil


def test_movie_series_is_gap_filled(client, raw_consumption):
    months = raw_consumption.groupby("imdb_id")["month"].agg(["min", "max", "nunique"])
    span = (
        pd.to_datetime(months["max"]).dt.to_period("M")
        - pd.to_datetime(months["min"]).dt.to_period("M")
    ).map(lambda offset: offset.n + 1)
    title_id = months[span > months["nunique"]].index[0]

    series = client.get(f"{API}/movies/{title_id}/performance").json()["series"]
    assert len(series) == span[title_id]
    assert any(point["streams"] == 0 for point in series)


def test_breakdowns_ignore_their_own_filter(client):
    title_id = "tt8036976"
    body = client.get(
        f"{API}/movies/{title_id}/performance",
        params={"countries": "Mexico", "platforms": "Disney+"},
    ).json()
    assert len(body["by_country"]) > 1
    assert {item["key"] for item in body["by_country"]} >= {"Mexico"}


def test_movie_without_matching_rows_returns_empty_series(client):
    body = client.get(
        f"{API}/movies/tt8036976/performance",
        params={"platforms": "Netflix", "countries": "Brazil"},
    ).json()
    assert body["period"] is None
    assert body["series"] == []
    assert body["totals"] == {"streams": 0, "viewing_hours": 0}


def test_collections_respect_size_and_rules(client):
    listing = client.get(f"{API}/collections").json()["collections"]
    assert listing
    for summary in listing:
        collection = client.get(f"{API}/collections/{summary['collection_id']}").json()
        assert 0 < len(collection["items"]) <= 30
    gems = client.get(f"{API}/collections/hidden-gems").json()["items"]
    assert all(item["movie"]["rating"] >= 8 for item in gems)


def test_grouped_trend_adds_up_to_the_total(client):
    params = {"start": "2025-01", "end": "2025-12", "group_by": "platform"}
    body = client.get(f"{API}/dashboard/trend", params=params).json()
    assert {group["key"] for group in body["groups"]} == {"Amazon", "Disney+", "HBO Max", "Netflix"}
    for index, point in enumerate(body["series"]):
        assert (
            sum(group["series"][index]["streams"] for group in body["groups"]) == point["streams"]
        )
    assert all(len(group["series"]) == 12 for group in body["groups"])
