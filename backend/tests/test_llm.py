import json

import httpx
import openai
import pytest

from app import api_models as m
from app import rate_limits
from app.services import llm
from app.services.movies import filter_options
from tests.fake_openai import FakeOpenAI


@pytest.fixture(autouse=True)
def clear_llm_cache():
    llm.complete_json.cache_clear()
    yield
    llm.complete_json.cache_clear()


def use_fake(monkeypatch, *replies) -> FakeOpenAI:
    fake = FakeOpenAI(*replies)
    monkeypatch.setattr(llm, "openai_client", lambda: fake)
    return fake


def interpretation(**fields) -> str:
    base = {
        "semantic_query": "comedy",
        "genres": [],
        "year_min": None,
        "year_max": None,
        "countries": [],
        "platforms": [],
        "people": [],
    }
    return json.dumps(base | fields)


def test_full_usage_counter_skips_the_model(monkeypatch):
    fake = use_fake(monkeypatch)
    monkeypatch.setattr(rate_limits.llm_per_day, "limit", 0)
    result = llm.interpret_query("comedies", filter_options())
    assert result.status.root == "rate_limited"
    assert fake.calls == []


def test_per_client_limit_counts_only_model_calls(monkeypatch):
    use_fake(monkeypatch, interpretation(), interpretation(semantic_query="drama"))
    monkeypatch.setattr(rate_limits.llm_per_client_minute, "limit", 2)
    assert llm.interpret_query("comedies", filter_options()).status.root == "ok"
    # Served from the cache: no model call, nothing counted.
    assert llm.interpret_query("comedies", filter_options()).status.root == "ok"
    assert llm.interpret_query("dramas", filter_options()).status.root == "ok"
    assert llm.interpret_query("thrillers", filter_options()).status.root == "rate_limited"


def test_spend_is_counted_saved_and_reset_each_day(monkeypatch):
    use_fake(monkeypatch, interpretation())
    llm.interpret_query("comedies", filter_options())
    spend = rate_limits.daily_spend
    assert spend.spent() == pytest.approx((1000 * 0.15 + 100 * 0.60) / 1_000_000)
    saved = rate_limits.DailySpend(spend.path)
    assert saved.spent() == pytest.approx(spend.spent())
    monkeypatch.setattr(rate_limits.DailySpend, "today", staticmethod(lambda: "2999-01-01"))
    assert saved.spent() == 0


def test_the_daily_budget_skips_the_model(monkeypatch):
    fake = use_fake(monkeypatch)
    rate_limits.daily_spend.add(5.0)
    assert llm.interpret_query("comedies", filter_options()).status.root == "rate_limited"
    assert fake.calls == []


def test_disabled_without_key(monkeypatch):
    monkeypatch.setattr(llm, "openai_client", lambda: None)
    result = llm.interpret_query("comedies", filter_options())
    assert result.status.root == "disabled"
    assert result.proposed_filters is None


def test_values_are_mapped_to_canonical_vocabularies(monkeypatch):
    use_fake(
        monkeypatch,
        interpretation(
            genres=["comedy"],
            platforms=["Netflix", "Nebula"],
            countries=["brazil"],
            year_min=2024,
            year_max=2024,
        ),
    )
    result = llm.interpret_query("comedias de 2024 en Netflix Brasil", filter_options())
    filters = result.proposed_filters
    assert result.status.root == "ok"
    assert filters.genres == ["Comedy"]
    assert filters.platforms == ["Netflix"]
    assert filters.countries == ["Brazil"]
    assert (filters.year_min, filters.year_max) == (2024, 2024)


def test_years_outside_catalog_and_inverted_ranges_are_dropped(monkeypatch):
    use_fake(monkeypatch, interpretation(year_min=1990, year_max=2025))
    assert llm.interpret_query("q", filter_options()).proposed_filters.year_min is None
    llm.complete_json.cache_clear()
    use_fake(monkeypatch, interpretation(year_min=2025, year_max=2024))
    filters = llm.interpret_query("q", filter_options()).proposed_filters
    assert (filters.year_min, filters.year_max) == (None, None)


def test_empty_semantic_query_falls_back_to_the_raw_query(monkeypatch):
    use_fake(monkeypatch, interpretation(semantic_query=" "))
    assert llm.interpret_query("space movies", filter_options()).semantic_query == "space movies"


def test_invalid_json_fails(monkeypatch):
    use_fake(monkeypatch, "not json")
    assert llm.interpret_query("q", filter_options()).status.root == "failed"


def test_timeout_fails(monkeypatch):
    request = httpx.Request("POST", "https://api.openai.com")
    use_fake(monkeypatch, openai.APITimeoutError(request=request))
    assert llm.interpret_query("q", filter_options()).status.root == "failed"


def test_identical_calls_hit_the_cache(monkeypatch):
    fake = use_fake(monkeypatch, interpretation())
    llm.interpret_query("same query", filter_options())
    llm.interpret_query("same query", filter_options())
    assert len(fake.calls) == 1


def test_summary_with_a_number_not_in_the_facts_is_rejected(monkeypatch):
    use_fake(monkeypatch, json.dumps({"summary": "It reached 99.9K streams."}))
    narrative = llm.write_insight({"total_streams": "12.4K"})
    assert narrative.status.root == "failed"
    assert narrative.text is None


def test_summary_quoting_the_facts_is_accepted(monkeypatch):
    use_fake(monkeypatch, json.dumps({"summary": "It reached 12.4K streams, mostly in Brazil."}))
    narrative = llm.write_insight({"total_streams": "12.4K", "top_country": "Brazil"})
    assert narrative.status.root == "ok"


def test_licensing_memo_skips_the_model_without_evidence(monkeypatch):
    fake = use_fake(monkeypatch)
    memo = llm.write_licensing_memo({}, m.DemandSignal("insufficient_evidence"))
    assert memo.status.root == "insufficient_evidence"
    assert memo.caveats == llm.DECISION_CAVEATS
    assert fake.calls == []


def test_licensing_memo_keeps_the_signal_from_code(monkeypatch):
    reply = {"headline": "Comparable titles did well", "evidence": ["Median 4.2K"], "risks": ["r"]}
    use_fake(monkeypatch, json.dumps(reply))
    memo = llm.write_licensing_memo({"median": "4.2K"}, m.DemandSignal("strong"))
    assert memo.status.root == "ok"
    assert memo.signal.root == "strong"
