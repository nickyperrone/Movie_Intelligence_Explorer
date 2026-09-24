# 06 — LLM

## Role

The LLM does two kinds of work:

1. Turn a natural-language query into structured filters.
2. Write short text from facts that were already computed in SQL.

It never computes, estimates or invents numbers, and it never makes a decision: demand signals and
rankings are computed in code (`04-metrics.md`). All calls live in `backend/app/services/llm.py`
(runtime) and `backend/pipeline/build_themes.py` (offline).

## Provider and configuration

| Setting | Env var | Default |
|---|---|---|
| API key | `OPENAI_API_KEY` | none → every LLM feature returns `disabled` |
| Model | `OPENAI_MODEL` | `gpt-4o-mini` (any chat model with JSON mode works) |

Every call uses the Chat Completions API with `response_format = {"type": "json_object"}` and
`temperature = 0`.

## Status values

Every response that includes LLM output carries a `status`:

| Status | Meaning | UI |
|---|---|---|
| `ok` | Valid output | Show the text with the label "Generated summary" |
| `skipped` | The caller asked not to use the LLM (`interpret=false`) | Nothing |
| `disabled` | No API key configured | "Summary unavailable: no language model configured." |
| `failed` | Timeout, API error, invalid JSON, or output rejected by validation | "Summary unavailable right now." |
| `insufficient_evidence` | Not enough facts to write about (decision memos only) | Explain which data is missing |

LLM problems never produce a 5xx response. Errors are logged with the function name, status and
latency. Prompts, keys and user text are not logged.

## Number guard

For every text output: each number in the text (regex `\d[\d.,]*`) must appear verbatim in the
facts sent to the model. Facts are sent already formatted for display ("12.4K streams",
"Apr–Jun 2026", "68.2%"), so the model can quote them but has no reason to compute. If any number
fails the check, the output is rejected and the status is `failed`.

## Caching

Each function has an in-process LRU cache keyed by its full input (serialized JSON). Sizes:
query interpretation 512, everything else 256. The cache resets when the container restarts.

## Functions

### `interpret_query(q, vocabularies) -> Interpretation`

Timeout 8 s.

System prompt:

```
You convert a movie search query into JSON for a search engine over a movie catalog.
Return an object with these keys:
- "semantic_query": the descriptive part of the query (themes, mood, plot, style), rewritten in
  English, without filter words. If nothing descriptive remains, use the genres in plain words.
- "genres": genres from ALLOWED_GENRES that the user explicitly asks for. Otherwise [].
- "year_min", "year_max": integers only if the user states years or a range. Otherwise null.
- "countries": values from ALLOWED_COUNTRIES that the user explicitly mentions. Otherwise [].
- "platforms": values from ALLOWED_PLATFORMS that the user explicitly mentions. Otherwise [].
- "people": names of actors or directors the user mentions. Otherwise [].
Only use values from the allowed lists, spelled exactly as listed. Never add filters the user did
not ask for.
```

User message: the allowed lists (genres, countries, platforms from B, year range) and the query,
inside `<query>` tags.

Validation, in order:

1. Parse into the `LlmQueryInterpretation` model (extra keys ignored).
2. Genres, countries and platforms are matched case-insensitively to the allowed lists and replaced
   by the canonical spelling. Unknown values are dropped.
3. Years outside the catalog range are dropped; if `year_min > year_max` both are dropped.
4. People: trimmed, at most 3, each 2–60 characters.
5. Empty `semantic_query` → the original `q`.

Example: `comedias de 2024 en Netflix Brasil` → `semantic_query: "comedy"`, `genres: ["Comedy"]`,
`year_min: 2024`, `year_max: 2024`, `platforms: ["Netflix"]`, `countries: ["Brazil"]`.

### `write_insight(facts) -> Narrative`

Timeout 10 s. Input: the movie's `InsightFacts` (`api/openapi.yaml`) formatted for display. Output
JSON `{"summary": "..."}`: 2 or 3 sentences, at most 70 words, describing where and when the movie
performed. Status `insufficient_evidence` when the movie has no consumption (no call is made).

### `write_changes(facts) -> Narrative`

Timeout 10 s. Input: dashboard movers and share shifts for the current filters. Output
`{"summary": "..."}`: at most 3 sentences, 80 words, naming the largest changes.

### `write_licensing_memo(facts) -> LicensingMemo`

Timeout 20 s. Input: licensing assessment facts, including the demand signal computed in code.
Output JSON:

```json
{
  "headline": "at most 15 words, consistent with the demand signal",
  "evidence": ["2 to 4 bullets, each citing facts"],
  "risks": ["1 to 3 bullets"]
}
```

The API adds `signal` (from code) and `caveats` (fixed text, below) to the memo; the model does not
write them. Status `insufficient_evidence` when the demand signal is `insufficient_evidence` (no
call is made).

Fixed caveats, always included:

- "Consumption data covers Argentina, Brazil, Colombia and Mexico on Amazon, Disney+, HBO Max and
  Netflix only."
- "Availability is a single snapshot (Jun 2026), not a history."
- "The expected range comes from comparable titles; it is not a forecast."

### `write_concepts_memo(facts) -> ConceptsMemo`

Timeout 20 s. Input: for each concept, its logline, demand index, saturation and top comparables,
plus the ranking computed in code. Output `{"summary": "...", "per_concept": ["one sentence per
concept, same order"]}`. The ranking itself comes from code. The API adds the fixed caveats. Status
`insufficient_evidence` when no concept has a demand index (no call is made).

### `name_theme(examples) -> {name, description}` (offline)

Used by `pipeline/build_themes.py`. Input: 10 movies closest to a cluster centroid (title, genres,
first 300 plot characters). Output `{"name": "at most 4 words", "description": "at most 20
words"}`. A person reviews all names before committing.

## Prompt injection

User text (queries, loglines) is placed inside tags in the user message, never in the system
prompt. Model output is only ever parsed as JSON and validated; it cannot trigger actions,
SQL or tool calls. The worst outcome of an injected instruction is a rejected or odd summary.

## Data sent to OpenAI

Catalog metadata, aggregated metrics, and the text the user typed. No personal data.

## Acceptance criteria

Tests use a fake client injected into `services/llm.py`; no test calls the real API.

- No `OPENAI_API_KEY` → every function returns `disabled` without network access.
- Invalid JSON → `failed`.
- `platforms: ["Netflix", "Nebula"]` → `["Netflix"]`.
- `genres: ["comedy"]` → `["Comedy"]`.
- A summary containing a number not present in the facts → `failed`.
- A timeout → `failed`, and the search still returns results with `semantic_query = q`.
- A second identical call hits the cache (the fake client is called once).
