"""LLM calls: query interpretation and short texts written from computed facts (docs/06-llm.md).

The model never computes numbers or makes decisions. Every text output passes the number guard:
each number it contains must appear verbatim in the facts it was given.
"""

import json
import logging
import re
import time
from functools import cache, lru_cache
from typing import Any

import openai
from pydantic import BaseModel, Field

from app import api_models as m
from app.config import settings
from app.rate_limits import LlmRateLimited, spend_llm_call

logger = logging.getLogger(__name__)

NUMBER_PATTERN = re.compile(r"\d[\d.,]*")

DECISION_CAVEATS = [
    "Consumption data covers Argentina, Brazil, Colombia and Mexico on Amazon, Disney+, HBO Max "
    "and Netflix only.",
    "Availability is a single snapshot (Jun 2026), not a history.",
    "The expected range comes from comparable titles; it is not a forecast.",
]

INTERPRET_PROMPT = """You convert a movie search query into JSON for a search engine over a movie
catalog. Return an object with these keys:
- "semantic_query": the descriptive part of the query (themes, mood, plot, style), rewritten in
  English, without filter words. If nothing descriptive remains, use the genres in plain words.
- "genres": genres from ALLOWED_GENRES that the user explicitly asks for. Otherwise [].
- "year_min", "year_max": integers only if the user states years or a range. Otherwise null.
- "countries": values from ALLOWED_COUNTRIES that the user explicitly mentions. Otherwise [].
- "platforms": values from ALLOWED_PLATFORMS that the user explicitly mentions. Otherwise [].
- "people": names of actors or directors the user mentions. Otherwise [].
Only use values from the allowed lists, spelled exactly as listed. Never add filters the user did
not ask for."""

FACTS_RULES = """Use only the facts provided. Quote numbers exactly as written in the facts; never
compute, round, estimate or add numbers. Plain, factual business English. No marketing words."""

INSIGHT_PROMPT = f"""You write a short performance summary of one movie for studio analysts.
Return JSON: {{"summary": "2 or 3 sentences, at most 70 words, on where and when the movie
performed"}}. {FACTS_RULES}"""

CHANGES_PROMPT = f"""You summarize what changed in streaming consumption between two periods for
studio executives. Return JSON: {{"summary": "at most 3 sentences, 80 words, naming the largest
changes"}}. {FACTS_RULES}"""

LICENSING_PROMPT = f"""You write a licensing decision memo for a studio sales team. The demand
signal was computed from comparable titles and is final; your headline must be consistent with it.
Return JSON: {{"headline": "at most 15 words", "evidence": ["2 to 4 bullets citing facts"],
"risks": ["1 to 3 bullets"]}}. {FACTS_RULES}"""

CONCEPTS_PROMPT = f"""You compare project concepts for a studio development team. The ranking was
computed from comparable titles and is final; do not change it. Return JSON: {{"summary": "at most
3 sentences", "per_concept": ["one sentence per concept, in the order given"]}}. {FACTS_RULES}"""


class LlmUnavailable(Exception):
    pass


class LlmQueryInterpretation(BaseModel):
    semantic_query: str = ""
    genres: list[str] = Field(default_factory=list)
    year_min: int | None = None
    year_max: int | None = None
    countries: list[str] = Field(default_factory=list)
    platforms: list[str] = Field(default_factory=list)
    people: list[str] = Field(default_factory=list)


class LlmSummary(BaseModel):
    summary: str


class LlmLicensingMemo(BaseModel):
    headline: str
    evidence: list[str]
    risks: list[str]


class LlmConceptsMemo(BaseModel):
    summary: str
    per_concept: list[str]


@cache
def openai_client() -> openai.OpenAI | None:
    if not settings.llm_enabled:
        return None
    return openai.OpenAI(api_key=settings.openai_api_key, max_retries=0)


@lru_cache(maxsize=1024)
def complete_json(system: str, user: str, timeout: float) -> str:
    """Return the raw JSON text of a completion. Failures raise and are not cached."""
    client = openai_client()
    if client is None:
        raise LlmUnavailable
    spend_llm_call()
    response = client.chat.completions.create(
        model=settings.openai_model,
        messages=[{"role": "system", "content": system}, {"role": "user", "content": user}],
        response_format={"type": "json_object"},
        temperature=0,
        timeout=timeout,
    )
    return response.choices[0].message.content or ""


def call_model[T: BaseModel](
    name: str, system: str, user: str, timeout: float, output: type[T]
) -> tuple[m.LlmStatus, T | None]:
    started = time.monotonic()
    status = "failed"
    try:
        parsed = output.model_validate_json(complete_json(system, user, timeout))
        status = "ok"
        return m.LlmStatus("ok"), parsed
    except LlmUnavailable:
        status = "disabled"
        return m.LlmStatus("disabled"), None
    except LlmRateLimited:
        status = "rate_limited"
        return m.LlmStatus("rate_limited"), None
    except (openai.OpenAIError, ValueError) as error:
        # ValueError covers invalid JSON and schema mismatches (pydantic.ValidationError).
        logger.warning("llm %s failed: %s", name, type(error).__name__)
        return m.LlmStatus("failed"), None
    finally:
        logger.info(
            "llm %s status=%s latency_ms=%d", name, status, (time.monotonic() - started) * 1000
        )


def numbers_are_grounded(texts: list[str], facts: str) -> bool:
    return all(
        number.rstrip(".,") in facts for text in texts for number in NUMBER_PATTERN.findall(text)
    )


def facts_message(facts: dict[str, Any]) -> str:
    return "Facts:\n" + json.dumps(facts, ensure_ascii=False, indent=1)


def canonical(values: list[str], allowed: list[str]) -> list[str]:
    by_lower = {value.lower(): value for value in allowed}
    found = [by_lower[v.strip().lower()] for v in values if v.strip().lower() in by_lower]
    return list(dict.fromkeys(found))


def interpret_query(query: str, options: m.FilterOptions) -> m.Interpretation:
    user = (
        f"ALLOWED_GENRES: {options.genres}\n"
        f"ALLOWED_COUNTRIES: {options.availability.countries}\n"
        f"ALLOWED_PLATFORMS: {options.availability.platforms}\n"
        f"CATALOG_YEARS: {options.year_range.min}-{options.year_range.max}\n"
        f"<query>{query}</query>"
    )
    status, parsed = call_model(
        "interpret_query", INTERPRET_PROMPT, user, 8, LlmQueryInterpretation
    )
    if parsed is None:
        return m.Interpretation(status=status, semantic_query=None, proposed_filters=None)

    years = range(options.year_range.min, options.year_range.max + 1)
    year_min = parsed.year_min if parsed.year_min in years else None
    year_max = parsed.year_max if parsed.year_max in years else None
    if year_min is not None and year_max is not None and year_min > year_max:
        year_min = year_max = None
    people = [p.strip() for p in parsed.people if 2 <= len(p.strip()) <= 60][:3]
    return m.Interpretation(
        status=status,
        semantic_query=parsed.semantic_query.strip() or query,
        proposed_filters=m.SearchFilters(
            genres=canonical(parsed.genres, options.genres),
            year_min=year_min,
            year_max=year_max,
            countries=canonical(parsed.countries, options.availability.countries),
            platforms=canonical(parsed.platforms, options.availability.platforms),
            people=people,
        ),
    )


def write_summary(name: str, system: str, facts: dict[str, Any], timeout: float) -> m.Narrative:
    message = facts_message(facts)
    status, parsed = call_model(name, system, message, timeout, LlmSummary)
    if parsed is None:
        return m.Narrative(status=status, text=None)
    if not numbers_are_grounded([parsed.summary], message):
        logger.warning("llm %s rejected: number not in facts", name)
        return m.Narrative(status=m.LlmStatus("failed"), text=None)
    return m.Narrative(status=status, text=parsed.summary.strip())


def write_insight(facts: dict[str, Any]) -> m.Narrative:
    return write_summary("write_insight", INSIGHT_PROMPT, facts, 10)


def write_changes(facts: dict[str, Any]) -> m.Narrative:
    return write_summary("write_changes", CHANGES_PROMPT, facts, 10)


def write_licensing_memo(facts: dict[str, Any], signal: m.DemandSignal) -> m.LicensingMemo:
    def memo(status: str, parsed: LlmLicensingMemo | None = None) -> m.LicensingMemo:
        return m.LicensingMemo(
            status=m.LlmStatus(status),
            signal=signal,
            headline=parsed.headline.strip() if parsed else None,
            evidence=parsed.evidence[:4] if parsed else [],
            risks=parsed.risks[:3] if parsed else [],
            caveats=DECISION_CAVEATS,
        )

    if signal.root == "insufficient_evidence":
        return memo("insufficient_evidence")
    message = facts_message(facts)
    status, parsed = call_model(
        "write_licensing_memo", LICENSING_PROMPT, message, 20, LlmLicensingMemo
    )
    if parsed is None:
        return memo(status.root)
    if not numbers_are_grounded([parsed.headline, *parsed.evidence, *parsed.risks], message):
        logger.warning("llm write_licensing_memo rejected: number not in facts")
        return memo("failed")
    return memo("ok", parsed)


def write_concepts_memo(facts: dict[str, Any], concept_count: int) -> m.ConceptsMemo:
    def memo(status: str, parsed: LlmConceptsMemo | None = None) -> m.ConceptsMemo:
        return m.ConceptsMemo(
            status=m.LlmStatus(status),
            summary=parsed.summary.strip() if parsed else None,
            per_concept=parsed.per_concept[:concept_count] if parsed else [],
            caveats=DECISION_CAVEATS,
        )

    message = facts_message(facts)
    status, parsed = call_model(
        "write_concepts_memo", CONCEPTS_PROMPT, message, 20, LlmConceptsMemo
    )
    if parsed is None:
        return memo(status.root)
    if not numbers_are_grounded([parsed.summary, *parsed.per_concept], message):
        logger.warning("llm write_concepts_memo rejected: number not in facts")
        return memo("failed")
    return memo("ok", parsed)
