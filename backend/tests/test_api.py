import schemathesis
from schemathesis.specs.openapi.checks import positive_data_acceptance

from app.config import settings
from app.main import app
from app.services.comparables import eligibility_cutoff, licensing_assessment

API = "/api/v1"


def test_health_reports_llm_disabled_without_key(client):
    assert client.get(f"{API}/health").json() == {
        "status": "ok",
        "api_version": "1.2.0",
        "llm_enabled": settings.llm_enabled,
    }


def test_error_envelopes(client):
    missing = client.get(f"{API}/movies/tt0000001")
    assert missing.status_code == 404
    assert missing.json()["error"]["code"] == "not_found"

    invalid = client.get(f"{API}/movies/not-an-id")
    assert invalid.status_code == 422
    assert invalid.json()["error"]["code"] == "validation_error"

    inverted = client.get(f"{API}/dashboard/summary", params={"start": "2026-06", "end": "2026-01"})
    assert inverted.status_code == 422


def test_search_returns_results_for_brief_queries(client):
    for query in ["animated adventures", "movies about artificial intelligence"]:
        body = client.get(f"{API}/search", params={"q": query}).json()
        assert len(body["results"]) >= 5
        assert body["interpretation"]["status"] == "disabled"


def test_exact_plot_ranks_its_movie_first(client, raw_movies):
    movie = raw_movies.iloc[10]
    body = client.get(
        f"{API}/search", params={"q": movie["PLOT_SUMMARY"][:200], "interpret": False}
    ).json()
    assert body["results"][0]["movie"]["title_id"] == movie["TITLE_ID"]


def test_country_and_platform_match_the_same_availability_row(client, raw_availability):
    rows = raw_availability
    on_netflix_elsewhere = set(
        rows[(rows["PLATFORM"] == "Netflix") & (rows["COUNTRY"] != "Brazil")]["IMDB_ID"]
    )
    netflix_brazil = set(
        rows[(rows["PLATFORM"] == "Netflix") & (rows["COUNTRY"] == "Brazil")]["IMDB_ID"]
    )
    in_brazil = set(rows[rows["COUNTRY"] == "Brazil"]["IMDB_ID"])
    trap = (on_netflix_elsewhere & in_brazil) - netflix_brazil
    assert trap, (
        "the data should contain a movie on Netflix elsewhere and on another platform in Brazil"
    )

    body = client.get(
        f"{API}/search",
        params={
            "q": "movie",
            "interpret": False,
            "countries": "Brazil",
            "platforms": "Netflix",
            "limit": 50,
        },
    ).json()
    found = {result["movie"]["title_id"] for result in body["results"]}
    assert found <= netflix_brazil


def test_genres_filter_requires_all_genres(client):
    body = client.get(
        f"{API}/search",
        params={
            "q": "adventure",
            "interpret": False,
            "genres": ["Animation", "Adventure"],
            "limit": 50,
        },
    ).json()
    assert body["results"]
    assert all({"Animation", "Adventure"} <= set(r["movie"]["genres"]) for r in body["results"])


def test_people_filter_matches_directors(client):
    body = client.get(
        f"{API}/search",
        params={"q": "thriller", "interpret": False, "people": "raimi", "limit": 50},
    ).json()
    assert "Send Help" in {r["movie"]["title"] for r in body["results"]}


def test_unrelated_filters_return_an_empty_list(client):
    body = client.get(f"{API}/search", params={"q": "space", "interpret": False, "year_min": 2100})
    assert body.status_code == 200
    assert body.json()["results"] == []


def test_people_lookup_and_exact_name_search(client):
    people = client.get(f"{API}/people/lookup", params={"q": "sam rai"}).json()["results"]
    assert people[0]["name"] == "Sam Raimi"
    assert "director" in people[0]["roles"]

    body = client.get(f"{API}/search", params={"q": "sam raimi", "interpret": False}).json()
    assert body["applied_filters"]["people"] == ["Sam Raimi"]
    assert "Send Help" in {r["movie"]["title"] for r in body["results"]}


def test_market_opportunities_cover_every_target(client):
    body = client.get(f"{API}/decisions/markets", params={"title_id": "tt8036976"}).json()
    assert len(body["targets"]) == 16
    ratios = [t["ratio"] for t in body["targets"] if t["ratio"] is not None]
    assert ratios == sorted(ratios, reverse=True)
    assert (
        client.get(f"{API}/decisions/markets", params={"title_id": "tt0000001"}).status_code == 404
    )


def test_similar_never_returns_the_movie_itself(client):
    body = client.get(f"{API}/movies/tt8036976/similar", params={"limit": 20}).json()
    assert "tt8036976" not in {r["movie"]["title_id"] for r in body["results"]}


def test_licensing_comparables_follow_the_rules():
    assessment = licensing_assessment("tt8036976", "Netflix", "Mexico")
    target = assessment.movie
    for comparable in assessment.comparables:
        assert comparable.movie.title_id != target.title_id
        assert abs(comparable.movie.year - target.year) <= 2
        assert comparable.movie.primary_genre == target.primary_genre
    assert assessment.expected_range.eligible_count == sum(
        c.eligible for c in assessment.comparables
    )
    assert eligibility_cutoff().isoformat() == "2026-01-01"


def test_licensing_rejects_countries_without_consumption(client):
    response = client.get(
        f"{API}/decisions/licensing",
        params={"title_id": "tt8036976", "platform": "Netflix", "country": "Chile"},
    )
    assert response.status_code == 422


def test_spa_routes_do_not_shadow_the_api(client):
    assert client.get("/api/v2/nothing").status_code == 404


schema = schemathesis.openapi.from_asgi("/api/v1/openapi.json", app)


@schema.include(method="GET").parametrize()
def test_get_endpoints_follow_the_contract(case):
    # Every response must match the hand-written contract, including the error envelope.
    # positive_data_acceptance is excluded: some schema-valid inputs break business rules
    # (start after end, a country without consumption data) and correctly return the
    # documented 422.
    case.call_and_validate(excluded_checks=[positive_data_acceptance])
