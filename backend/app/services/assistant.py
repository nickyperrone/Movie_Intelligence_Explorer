"""Ask the data: a chat that answers only from read-only SQL and semantic search (docs/06-llm.md).

Safety is enforced in code, not in the prompt: one SELECT statement per call, a read-only
connection with file and network access disabled, a row cap and a time limit. Answers whose
numbers cannot be found in the tool results are withheld.
"""

import json
import logging
import re
import threading
import time
from datetime import date
from decimal import Decimal
from typing import Any

import duckdb
import openai

from app import api_models as m
from app.config import settings
from app.db import connection
from app.services import llm
from app.services.search import search_index

logger = logging.getLogger(__name__)

MAX_TOOL_CALLS = 6
GROUNDING_RETRIES = 1
STATUSES = {"answered", "no_data", "out_of_scope", "conversation"}
ROW_LIMIT = 200
SQL_TIMEOUT_SECONDS = 5
EXCHANGE_TIMEOUT_SECONDS = 60
RELATIVE_TOLERANCE = 0.01
# A number, optionally followed by a compact suffix (12.4K, 3.1M) or a percent sign.
NUMBER_IN_TEXT = re.compile(r"(?<![\w.])(\d[\d,]*(?:\.\d+)?)(?:([KkMm])(?![A-Za-z])|\s?(%))?")

SYSTEM_PROMPT = """You are Reel, the Movie Intelligence assistant: friendly, plain and brief.
You help a film studio in LATAM answer questions about its movie streaming data.
You can only learn facts by calling the tools. Use at most 4 tool calls.

Tables (DuckDB SQL):
- movies: one row per movie. title_id, title, year, runtime_minutes, rating (1-10, whole numbers),
  vote_count, primary_genre, genres VARCHAR[], directors VARCHAR[], principal_cast VARCHAR[],
  cast_names VARCHAR[], plot_summary, image_url, title_url.
- availability: current availability snapshot (Jun 2026), one row per movie x country x platform x
  platform_type. title_id, listed_title, country, platform, platform_type ('SVOD' or 'AVOD'),
  original_flag, is_original, original_platform, parent_distributor, snapshot_month.
  Countries: Argentina, Brazil, Chile, Colombia, Ecuador, Mexico, Peru, Venezuela.
- consumption: monthly consumption, one row per movie x month x country x platform. title_id,
  month (DATE, first day of month, 2023-01-01 to 2026-06-01), country (Argentina, Brazil,
  Colombia, Mexico), platform (Amazon, Disney+, HBO Max, Netflix), streams, total_minutes.
- title_distributors: title_id, distributor (distinct values from availability).
- themes (theme_id, name, description) and movie_themes (title_id, theme_id): AI-built themes.

Rules for SQL:
- Viewing hours = sum(total_minutes) / 60. Engagement = sum(total_minutes) /
  sum(streams * runtime_minutes), a ratio of sums.
- Never join availability and consumption row by row: it multiplies streams. Reduce one side to one
  row per title_id first (for example with title_id IN (SELECT ...)).
- Use list_contains(genres, 'Comedy') for list columns. Use ILIKE for names and titles.
- Return small, aggregated results with clear column names. Always add ORDER BY and LIMIT.
- Compute every number you will mention inside the SQL: growth, differences, shares, averages and
  rankings. Round percentages to one decimal in SQL. Join movies to return titles, not only ids.
- Year over year, for example:
  SELECT platform,
         sum(streams) FILTER (WHERE year(month) = 2024) AS streams_2024,
         sum(streams) FILTER (WHERE year(month) = 2025) AS streams_2025,
         round(100.0 * (streams_2025 - streams_2024) / streams_2024, 1) AS growth_pct
  FROM consumption WHERE country = 'Mexico' GROUP BY platform ORDER BY growth_pct DESC
- Sony titles (or any distributor): WHERE title_id IN
  (SELECT title_id FROM title_distributors WHERE distributor = 'Sony')

Rules for the answer:
- Every number you write must appear in a tool result from this conversation. Never estimate,
  extrapolate, round differently than the result, or use outside knowledge for facts or figures.
- If a query returns no rows, use status "no_data" and say which condition had no data. If a query
  fails, fix it and run it again; a failed query is not missing data.
- Share of a total, for example: SELECT round(100.0 * sum(streams) FILTER (WHERE country = 'Brazil')
  / sum(streams), 1) AS brazil_share_pct FROM consumption WHERE year(month) = 2025
- If the question needs data these tables do not have (box office, revenue, budgets, audience
  demographics, other countries or platforms, months outside the range), use status
  "out_of_scope" and name the missing data. Do not call tools for it.
- Answer in the language of the question, like an analyst talking to a colleague: warm, plain and
  direct, never robotic. Structure:
  1. One sentence that answers the question directly.
  2. Up to 4 short bullets starting with "- " with the supporting figures (a short label, then the
     figure), when there is more than one figure to show.
  3. One short last line on what the figures cover (period, countries, platforms).
  Separate the parts with a blank line. Write numbers with thousands separators (177,760) or compact
  units (341.9K). Use **bold** only for the key figure. At most 120 words. Refer to movies by title,
  never by id.
- End every reply with a short, friendly offer of further help in the same language, for example
  "Can I help you with anything else?" or "¿Te ayudo con algo más?".
- For greetings, thanks, questions about what you can do, or when you need to ask the user to
  clarify, use status "conversation". Say briefly what you can answer (performance by title,
  country, platform, genre or period; availability; search by theme). A "conversation" reply must
  not contain figures.

When you are done, reply with only this JSON object:
{"status": "answered" | "no_data" | "out_of_scope" | "conversation", "answer": "..."}"""

TOOLS = [
    {
        "type": "function",
        "function": {
            "name": "run_sql",
            "description": "Run one read-only DuckDB SELECT query. Returns at most 200 rows.",
            "parameters": {
                "type": "object",
                "properties": {
                    "sql": {"type": "string", "description": "A single SELECT statement."},
                    "purpose": {
                        "type": "string",
                        "description": "One short sentence: what this query finds.",
                    },
                },
                "required": ["sql", "purpose"],
            },
        },
    },
    {
        "type": "function",
        "function": {
            "name": "search_movies",
            "description": "Semantic search over plots and genres. Use it for themes or topics.",
            "parameters": {
                "type": "object",
                "properties": {
                    "text": {"type": "string"},
                    "limit": {"type": "integer", "minimum": 1, "maximum": 10},
                },
                "required": ["text"],
            },
        },
    },
]


class UnsafeQuery(ValueError):
    pass


def json_value(value: Any) -> str | float | int | bool | None:
    if isinstance(value, Decimal):
        return float(value)
    if isinstance(value, date):
        return value.isoformat()
    if isinstance(value, list):
        return ", ".join(str(item) for item in value)
    return value


def run_sql(sql: str, purpose: str) -> m.Evidence:
    cursor = connection().cursor()
    timer = threading.Timer(SQL_TIMEOUT_SECONDS, cursor.interrupt)
    try:
        statements = cursor.extract_statements(sql)
        if len(statements) != 1 or statements[0].type != duckdb.StatementType.SELECT:
            raise UnsafeQuery("Only one SELECT statement is allowed.")
        timer.start()
        query = sql.strip().rstrip(";")
        total = cursor.execute(f"SELECT count(*) FROM ({query})").fetchone()[0]
        cursor.execute(f"SELECT * FROM ({query}) LIMIT {ROW_LIMIT}")
        columns = [column[0] for column in cursor.description]
        rows = [[json_value(value) for value in row] for row in cursor.fetchall()]
        return m.Evidence(
            tool="run_sql",
            purpose=purpose,
            sql=sql,
            columns=columns,
            rows=rows,
            row_count=total,
            error=None,
        )
    except (UnsafeQuery, duckdb.Error) as error:
        return m.Evidence(
            tool="run_sql",
            purpose=purpose,
            sql=sql,
            columns=[],
            rows=[],
            row_count=0,
            error=str(error).splitlines()[0][:300],
        )
    finally:
        timer.cancel()
        cursor.close()


def search_movies(text: str, limit: int = 10) -> m.Evidence:
    ranked = search_index().rank_text(
        text, limit=max(1, min(limit, 10)), min_z=settings.min_relevance_z
    )
    titles = {
        row[0]: row[1:]
        for row in connection()
        .cursor()
        .execute(
            "SELECT title_id, title, year FROM movies WHERE list_contains(?, title_id)",
            [[tid for tid, _ in ranked]],
        )
        .fetchall()
    }
    return m.Evidence(
        tool="search_movies",
        purpose=f"Movies matching: {text}",
        sql=None,
        columns=["title_id", "title", "year", "score"],
        rows=[[tid, *titles[tid], score] for tid, score in ranked],
        row_count=len(ranked),
        error=None,
    )


def run_tool(name: str, arguments: str) -> m.Evidence:
    try:
        args = json.loads(arguments)
    except json.JSONDecodeError:
        args = {}
    if name == "run_sql" and isinstance(args.get("sql"), str):
        return run_sql(args["sql"], str(args.get("purpose", "")))
    if name == "search_movies" and isinstance(args.get("text"), str):
        return search_movies(args["text"], int(args.get("limit", 10)))
    return m.Evidence(
        tool="run_sql" if name == "run_sql" else "search_movies",
        purpose="",
        sql=None,
        columns=[],
        rows=[],
        row_count=0,
        error="Invalid tool call arguments.",
    )


def tool_result_message(call_id: str, evidence: m.Evidence) -> dict[str, Any]:
    payload = (
        {"error": evidence.error}
        if evidence.error
        else {"columns": evidence.columns, "rows": evidence.rows, "row_count": evidence.row_count}
    )
    return {"role": "tool", "tool_call_id": call_id, "content": json.dumps(payload, default=str)}


def evidence_numbers(evidence: list[m.Evidence]) -> list[float]:
    numbers: list[float] = []
    for item in evidence:
        numbers.append(float(item.row_count))
        for row in item.rows:
            for cell in row:
                if isinstance(cell, bool):
                    continue
                if isinstance(cell, int | float):
                    numbers.append(float(cell))
                elif isinstance(cell, str):
                    numbers.extend(
                        float(n.replace(",", "")) for n, *_ in NUMBER_IN_TEXT.findall(cell)
                    )
    return numbers


def close_to_any(value: float, candidates: list[float]) -> bool:
    return any(abs(value - c) <= max(RELATIVE_TOLERANCE * abs(c), 0.05) for c in candidates)


def ungrounded_numbers(answer: str, evidence: list[m.Evidence], context: str) -> list[str]:
    """Numbers in the answer that match no tool result, allowing display rounding."""
    candidates = evidence_numbers(evidence)
    missing = []
    for raw, compact_suffix, percent_sign in NUMBER_IN_TEXT.findall(answer):
        suffix = compact_suffix or percent_sign
        value = float(raw.replace(",", ""))
        exempt = value.is_integer() and (1900 <= value <= 2100 or value <= 12)
        if exempt and raw in context:
            continue
        options = {
            "k": [value * 1_000],
            "m": [value * 1_000_000],
            "%": [value / 100, value],
        }.get(suffix.lower(), [value])
        if not any(close_to_any(option, candidates) for option in options):
            missing.append(raw + suffix)
    return missing


def reply(status: str, answer: str | None, evidence: list[m.Evidence]) -> m.AssistantReply:
    return m.AssistantReply(status=m.AssistantStatus(status), answer=answer, evidence=evidence)


def run_exchange(
    client: Any, conversation: list[dict[str, Any]], evidence: list[m.Evidence], deadline: float
) -> Any:
    """Lets the model call tools until it writes a final message; returns that message's JSON."""
    while True:
        budget_left = MAX_TOOL_CALLS - len(evidence)
        response = client.chat.completions.create(
            model=settings.openai_model,
            messages=conversation,
            tools=TOOLS,
            tool_choice="auto" if budget_left > 0 else "none",
            response_format={"type": "json_object"},
            temperature=0,
            timeout=max(deadline - time.monotonic(), 1),
        )
        message = response.choices[0].message
        if not message.tool_calls:
            conversation.append({"role": "assistant", "content": message.content})
            return json.loads(message.content or "")
        conversation.append(
            {
                "role": "assistant",
                "content": message.content,
                "tool_calls": [
                    {
                        "id": call.id,
                        "type": "function",
                        "function": {
                            "name": call.function.name,
                            "arguments": call.function.arguments,
                        },
                    }
                    for call in message.tool_calls
                ],
            }
        )
        for call in message.tool_calls:
            result = run_tool(call.function.name, call.function.arguments)
            evidence.append(result)
            conversation.append(tool_result_message(call.id, result))
        if time.monotonic() > deadline:
            raise TimeoutError


def answer(messages: list[m.ChatMessage]) -> m.AssistantReply:
    client = llm.openai_client()
    if client is None:
        return reply("disabled", None, [])

    conversation: list[dict[str, Any]] = [{"role": "system", "content": SYSTEM_PROMPT}]
    conversation += [{"role": msg.role, "content": msg.content} for msg in messages]
    evidence: list[m.Evidence] = []
    deadline = time.monotonic() + EXCHANGE_TIMEOUT_SECONDS
    started = time.monotonic()

    try:
        for attempt in range(GROUNDING_RETRIES + 1):
            final = run_exchange(client, conversation, evidence, deadline)
            status = final.get("status") if isinstance(final, dict) else None
            text = final.get("answer") if isinstance(final, dict) else None
            if status not in STATUSES or not isinstance(text, str):
                return reply("failed", None, evidence)
            if status == "conversation":
                # Small talk carries no data: any figure in it would be unverifiable.
                has_figures = bool(
                    ungrounded_numbers(text, [], " ".join(m.content for m in messages))
                )
                return reply("failed" if has_figures else "conversation", text.strip(), evidence)
            if status != "answered":
                return reply(status, text.strip(), evidence)
            succeeded = [item for item in evidence if item.error is None]
            context = " ".join([msg.content for msg in messages] + [e.sql or "" for e in evidence])
            missing = ungrounded_numbers(text, succeeded, context) if succeeded else ["(no query)"]
            if not missing:
                return reply("answered", text.strip(), evidence)
            logger.warning("assistant answer not grounded (attempt %d)", attempt + 1)
            # One more turn: the model can query for these numbers or drop them.
            conversation.append(
                {
                    "role": "user",
                    "content": (
                        f"These numbers are not in any query result: {', '.join(missing)}. "
                        "Run a query that returns them already computed, or answer without them."
                    ),
                }
            )
        return reply("failed", None, evidence)
    except (openai.OpenAIError, ValueError, TimeoutError) as error:
        # ValueError covers JSON decoding errors from the final message.
        logger.warning("assistant failed: %s", type(error).__name__)
        return reply("failed", None, evidence)
    finally:
        logger.info(
            "assistant tool_calls=%d latency_ms=%d",
            len(evidence),
            (time.monotonic() - started) * 1000,
        )
