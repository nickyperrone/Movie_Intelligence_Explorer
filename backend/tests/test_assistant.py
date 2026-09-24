import json

import pytest

from app.services import assistant, llm
from tests.fake_openai import FakeOpenAI, tool_call

COUNT_SQL = "SELECT count(*) AS movies FROM movies"


def ask(monkeypatch, *replies, question="How many movies are there?"):
    fake = FakeOpenAI(*replies)
    monkeypatch.setattr(llm, "openai_client", lambda: fake)
    return assistant.answer([assistant.m.ChatMessage(role="user", content=question)]), fake


def sql_call(sql: str, call_id: str = "call_1") -> dict:
    return {"tool_calls": [tool_call(call_id, "run_sql", json.dumps({"sql": sql, "purpose": "p"}))]}


def final(status: str, answer: str) -> str:
    return json.dumps({"status": status, "answer": answer})


def test_disabled_without_key(monkeypatch):
    monkeypatch.setattr(llm, "openai_client", lambda: None)
    result = assistant.answer([assistant.m.ChatMessage(role="user", content="hi")])
    assert result.status.root == "disabled"


def test_grounded_answer_returns_evidence(monkeypatch):
    result, _ = ask(
        monkeypatch, sql_call(COUNT_SQL), final("answered", "The catalog has 1,590 movies.")
    )
    assert result.status.root == "answered"
    assert result.evidence[0].sql == COUNT_SQL
    assert result.evidence[0].rows == [[1590]]


def test_number_not_in_results_is_rejected(monkeypatch):
    result, _ = ask(monkeypatch, sql_call(COUNT_SQL), final("answered", "There are 2,000 movies."))
    assert result.status.root == "failed"
    assert result.answer is None


def test_compact_numbers_and_percentages_are_matched(monkeypatch):
    sql = "SELECT 12431 AS streams, 0.724 AS engagement"
    result, _ = ask(
        monkeypatch, sql_call(sql), final("answered", "It had 12.4K streams and 72.4% engagement.")
    )
    assert result.status.root == "answered"


def test_answer_without_tool_call_is_rejected(monkeypatch):
    result, _ = ask(monkeypatch, final("answered", "There are 42 movies."))
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
