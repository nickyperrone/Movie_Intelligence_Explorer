import json
import uuid

import pytest

from app import rate_limits
from app.services import assistant, llm
from tests.fake_openai import FakeOpenAI, tool_call

COUNT_SQL = "SELECT count(*) AS movies FROM movies"


DEVICE = "0b6f0a3e-6a53-4c43-9d8f-3d2a1c9f2b10"


def ask(monkeypatch, *replies, question="How many movies are there?", device=DEVICE):
    fake = FakeOpenAI(*replies)
    monkeypatch.setattr(llm, "openai_client", lambda: fake)
    message = assistant.m.ChatMessage(role="user", content=question)
    return assistant.answer([message], device), fake


def sql_call(sql: str, call_id: str = "call_1") -> dict:
    return {"tool_calls": [tool_call(call_id, "run_sql", json.dumps({"sql": sql, "purpose": "p"}))]}


def final(status: str, answer: str) -> str:
    return json.dumps({"status": status, "answer": answer})


def test_disabled_without_key(monkeypatch):
    monkeypatch.setattr(llm, "openai_client", lambda: None)
    result = assistant.answer([assistant.m.ChatMessage(role="user", content="hi")])
    assert result.status.root == "disabled"


def test_usage_limit_stops_the_exchange(monkeypatch):
    monkeypatch.setattr(rate_limits.llm_per_client_minute, "limit", 1)
    result, fake = ask(
        monkeypatch, sql_call(COUNT_SQL), final("answered", "The catalog has 1,590 movies.")
    )
    assert result.status.root == "rate_limited"
    assert len(fake.calls) == 1
    assert result.evidence[0].sql == COUNT_SQL


def test_grounded_answer_returns_evidence(monkeypatch):
    result, _ = ask(
        monkeypatch, sql_call(COUNT_SQL), final("answered", "The catalog has 1,590 movies.")
    )
    assert result.status.root == "answered"
    assert result.evidence[0].sql == COUNT_SQL
    assert result.evidence[0].rows == [[1590]]


def test_number_not_in_results_is_rejected_after_one_retry(monkeypatch):
    result, fake = ask(
        monkeypatch,
        sql_call(COUNT_SQL),
        final("answered", "There are 2,000 movies."),
        final("answered", "There are 2,000 movies."),
    )
    assert result.status.root == "failed"
    assert result.answer is None
    assert "2,000" in fake.calls[-1]["messages"][-1]["content"]


def test_retry_can_fix_an_ungrounded_answer(monkeypatch):
    result, _ = ask(
        monkeypatch,
        sql_call(COUNT_SQL),
        final("answered", "There are 2,000 movies."),
        final("answered", "There are 1,590 movies."),
    )
    assert result.status.root == "answered"
    assert result.answer == "There are 1,590 movies."


def test_compact_numbers_and_percentages_are_matched(monkeypatch):
    sql = "SELECT 12431 AS streams, 0.724 AS engagement"
    result, _ = ask(
        monkeypatch, sql_call(sql), final("answered", "It had 12.4K streams and 72.4% engagement.")
    )
    assert result.status.root == "answered"


def test_text_cells_with_numbers_are_read(monkeypatch):
    sql = "SELECT '28 Years Later' AS title, 4521 AS streams"
    result, _ = ask(
        monkeypatch, sql_call(sql), final("answered", "28 Years Later had 4.5K streams.")
    )
    assert result.status.root == "answered"


def test_answer_without_tool_call_is_rejected(monkeypatch):
    result, _ = ask(
        monkeypatch, final("answered", "There are 42 movies."), final("answered", "Still 42.")
    )
    assert result.status.root == "failed"


def test_no_data_answer_is_shown(monkeypatch):
    sql = "SELECT * FROM consumption WHERE country = 'Chile'"
    result, _ = ask(
        monkeypatch,
        sql_call(sql),
        final("no_data", "There is no consumption data for Chile."),
        question="How did movies do in Chile?",
    )
    assert result.status.root == "no_data"
    assert result.evidence[0].row_count == 0
    assert "Chile" in result.answer


def test_conversation_needs_no_query(monkeypatch):
    result, _ = ask(
        monkeypatch,
        final("conversation", "Hi! Ask me about streams by title, country or platform."),
        question="hola",
    )
    assert result.status.root == "conversation"
    assert result.evidence == []


def test_conversation_with_figures_is_rejected(monkeypatch):
    result, _ = ask(monkeypatch, final("conversation", "Sure, Brazil had 3.7M streams."))
    assert result.status.root == "failed"


def test_out_of_scope_answer_is_shown(monkeypatch):
    result, _ = ask(monkeypatch, final("out_of_scope", "The datasets have no box office revenue."))
    assert result.status.root == "out_of_scope"


@pytest.mark.parametrize(
    "sql",
    [
        "DROP TABLE movies",
        "INSERT INTO movies (title_id) VALUES ('tt1')",
        "SELECT 1; DROP TABLE movies",
        "SELECT * FROM read_csv('/etc/passwd')",
        "COPY movies TO 'leak.csv'",
        "ATTACH 'other.db'",
    ],
)
def test_unsafe_sql_is_rejected_and_database_is_unchanged(sql):
    evidence = assistant.run_sql(sql, "attack")
    assert evidence.error is not None
    assert assistant.connection().execute("SELECT count(*) FROM movies").fetchone()[0] == 1590


def test_rows_are_capped(monkeypatch):
    evidence = assistant.run_sql("SELECT * FROM consumption", "all rows")
    assert len(evidence.rows) == assistant.ROW_LIMIT
    assert evidence.row_count == 62022


def test_tool_budget_is_enforced(monkeypatch):
    replies = [sql_call(COUNT_SQL, f"call_{n}") for n in range(assistant.MAX_TOOL_CALLS)]
    result, fake = ask(monkeypatch, *replies, final("answered", "1,590 movies."))
    assert result.status.root == "answered"
    assert fake.calls[-1]["tool_choice"] == "none"


def test_each_device_gets_ten_questions_a_day(monkeypatch):
    lefts = [ask(monkeypatch, final("conversation", "Hi!"))[0].questions_left for _ in range(10)]
    assert lefts == list(range(9, -1, -1))
    refused, fake = ask(monkeypatch, final("conversation", "Hi!"))
    assert refused.status.root == "rate_limited"
    assert refused.questions_left == 0
    assert fake.calls == []
    # Another device on the same address still has its own questions.
    other, _ = ask(monkeypatch, final("conversation", "Hi!"), device=str(uuid.uuid4()))
    assert other.status.root == "conversation"
    assert other.questions_left == 9


def test_an_address_is_capped_across_devices(monkeypatch):
    monkeypatch.setattr(rate_limits.chat_per_ip, "limit", 2)
    for _ in range(2):
        ask(monkeypatch, final("conversation", "Hi!"), device=str(uuid.uuid4()))
    refused, fake = ask(monkeypatch, final("conversation", "Hi!"), device=str(uuid.uuid4()))
    assert refused.status.root == "rate_limited"
    assert fake.calls == []


def test_an_invalid_device_id_counts_against_the_address(monkeypatch):
    monkeypatch.setattr(rate_limits.chat_per_device, "limit", 1)
    ask(monkeypatch, final("conversation", "Hi!"), device="not-a-uuid")
    refused, _ = ask(monkeypatch, final("conversation", "Hi!"), device=None)
    assert refused.status.root == "rate_limited"


def test_the_daily_budget_stops_the_chat(monkeypatch):
    monkeypatch.setattr(assistant.settings, "llm_daily_budget_usd", 0.0005)
    first, _ = ask(monkeypatch, final("conversation", "Hi!"))
    assert first.status.root == "conversation"
    # 1,000 input and 100 output tokens cost 0.00021 USD; three calls pass the budget.
    ask(monkeypatch, final("conversation", "Hi!"))
    ask(monkeypatch, final("conversation", "Hi!"))
    refused, fake = ask(monkeypatch, final("conversation", "Hi!"))
    assert refused.status.root == "rate_limited"
    assert fake.calls == []
    assert refused.questions_left == 7
