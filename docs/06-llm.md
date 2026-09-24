# 06 — LLM

## Role

The LLM does two kinds of work:

1. Turn a natural-language query into structured filters.
2. Write short text from facts that were already computed in SQL.

It never computes, estimates or invents numbers, and it never makes a decision: demand signals and
rankings are computed in code (`04-metrics.md`). All calls live in `backend/app/services/llm.py`
and `backend/app/services/assistant.py` (runtime) and `backend/pipeline/build_themes.py` (offline).

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
| `rate_limited` | A usage limit was reached, so the model was not called (added in 1.5.0) | "AI summaries are paused: the usage limit was reached. Try again later." |
| `insufficient_evidence` | Not enough facts to write about (decision memos only) | Explain which data is missing |

LLM problems never produce a 5xx response. Errors are logged with the function name, status and
latency. Prompts, keys and user text are not logged.

## Usage limits

The app is public and the API key is paid, so spend is capped at about 1 US dollar a day.

**Daily budget (the hard cap).** Every model response reports its tokens. Their cost is added to
the day's spend (UTC day) with the model's prices. Before each call, if the day's spend has reached
the budget, the model is not called. Each response is capped at `LLM_MAX_OUTPUT_TOKENS`, so a single
call cannot overshoot by more than about a tenth of a cent. The spend is saved to
`$STATE_DIR/llm_spend.json` after each call, so restarts and redeploys keep it when that directory
is on a volume (`08-deployment.md`).

**Chat questions.** Each device may ask 10 questions a day, and each IP address 30 (several people
in one office share an address). A device is the random id the browser keeps in `localStorage`
and sends as `X-Device-Id`; without a valid id, the IP address is used. Replies carry
`questions_left`, the smaller of the two counts remaining after that question.

**Call counters.** Every model call (each step of a chat exchange included) also takes one unit
from three counters, which stop a burst before it reaches the budget.

| Limit | Default | Env var |
|---|---|---|
| Daily budget | 1.00 USD | `LLM_DAILY_BUDGET_USD` |
| Price per million input tokens | 0.15 USD (`gpt-4o-mini`) | `LLM_USD_PER_MILLION_INPUT` |
| Price per million output tokens | 0.60 USD (`gpt-4o-mini`) | `LLM_USD_PER_MILLION_OUTPUT` |
| Output tokens per call | 700 | `LLM_MAX_OUTPUT_TOKENS` |
| Chat questions per device, per day | 10 | `CHAT_QUESTIONS_PER_DEVICE_DAY` |
| Chat questions per IP address, per day | 30 | `CHAT_QUESTIONS_PER_IP_DAY` |
| Model calls per client, per minute | 20 | `LLM_CALLS_PER_CLIENT_MINUTE` |
| Model calls per client, per day | 200 | `LLM_CALLS_PER_CLIENT_DAY` |
| Model calls for the whole app, per day | 2,000 | `LLM_CALLS_PER_DAY` |

- Answers served from the cache do not call the model and cost nothing.
- When a limit is reached, the model is not called and the feature returns `rate_limited`; the rest
  of the response is unchanged (search still runs on embeddings only). A chat question that is
  refused does not count against the device.
- With a different `OPENAI_MODEL`, set its prices, or the budget is computed with the wrong ones.
- The question and call counters live in memory in the single worker and reset on restart; only the
  spend is saved. A monthly budget on the OpenAI project is the last line of defense.

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
plus the ranking and the decision (status and headline) computed in code; the memo must agree with
the decision. Output `{"summary": "...", "per_concept": ["one sentence per
concept, same order"]}`. The ranking itself comes from code. The API adds the fixed caveats. Status
`insufficient_evidence` when no concept has a demand index (no call is made).

### `name_theme(examples) -> {name, description}` (offline)

Used by `pipeline/build_themes.py`. Input: 10 movies closest to a cluster centroid (title, genres,
first 300 plot characters). Output `{"name": "at most 4 words", "description": "at most 20
words"}`. A person reviews all names before committing.

## Ask the data (`services/assistant.py`)

The chat is the Movie Intelligence assistant. It has no name: friendly, plain and brief. It greets,
explains what it can do, answers from the data, and ends every reply by offering further help in the
language of the conversation ("Can I help you with anything else?").

A chat that answers questions about the datasets. The model can only reach the data through two
tools, and every answer carries the evidence it came from.

### Request flow

1. The client sends the conversation (`POST /api/v1/assistant/answer`): at most 12 messages, the last
   one from the user, each at most 1,000 characters. The server keeps no conversation state.
2. The model receives the system prompt below and the conversation, with tool calling enabled.
3. Up to 4 tool calls are executed. Each result is returned to the model and recorded as evidence.
4. The model ends with a JSON object: `{"status": "answered" | "no_data" | "out_of_scope" |
   "conversation", "answer": "..."}`. `conversation` is for greetings, thanks, questions about what
   the assistant can do, and clarifying questions back to the user; it needs no tool call.
5. The server validates the answer (below). If the number guard rejects it and tool calls remain,
   the model gets one more turn with the numbers that could not be found, to query for them or
   drop them. Then the answer is returned with the evidence. Timeout for the whole exchange: 60 s.

### Tools

| Tool | Arguments | Behavior |
|---|---|---|
| `run_sql` | `sql`, `purpose` | Runs one read-only query. Returns columns, up to 200 rows and the total row count |
| `search_movies` | `text`, `limit` (≤ 10) | Semantic search (`05-search.md`). Returns title_id, title, year, score |

`run_sql` safety, enforced in code, not in the prompt:

- Exactly one statement, and DuckDB must classify it as `SELECT` (`extract_statements`).
- The app's only DuckDB connection is read-only with `enable_external_access = false` and
  `lock_configuration = true`, so no query can read files, URLs or change settings.
- Only the tables `movies`, `availability`, `consumption`, `title_distributors`, `themes`,
  `movie_themes` exist in that database.
- The query runs as `SELECT * FROM (<sql>) LIMIT 200`.
- A 5-second limit; the connection is interrupted when it is exceeded.
- Errors are returned to the model as tool results so it can correct the query (they count toward the
  4 calls).

### System prompt (summary; full text in code)

- The schema of each table with its grain (`03-data.md`) and the metric definitions
  (`04-metrics.md`): viewing hours = minutes / 60, engagement as a ratio of sums.
- Integration rule: never join `availability` and `consumption` row by row.
- Coverage: consumption only for Argentina, Brazil, Colombia, Mexico on Amazon, Disney+, HBO Max,
  Netflix, from 2023-01 to 2026-06; availability is a single snapshot (2026-06); no revenue, box
  office, audience demographics or data for other countries.
- The SQL must return every number the answer will mention already computed: growth, shares,
  differences and rankings are calculated in the query, not by the model. The prompt includes
  example queries for a year-over-year comparison and for the distributor filter.
- Rules: every number in the answer must come from a tool result in this conversation. Never
  estimate, extrapolate or use outside knowledge for figures. If a query returns no rows, answer with
  `no_data` and say which filter had no data. If the question needs data the datasets do not have,
  answer with `out_of_scope` and name the missing data. English is the default: reply in another
  language only when the user's message is clearly written in it. Query purposes and column names
  are always in English.
- Style: conversational, like an analyst answering a colleague. First sentence answers the question
  directly; then up to 4 short bullets (`- `) with the supporting figures; last, one short line on
  what the figures cover (period, countries, platforms). Numbers with thousands separators or
  compact units (341.9K). `**bold**` only for the key figure. At most 120 words.

### Answer validation

- `answered` without any successful tool call → rejected (`failed`).
- Number guard: each number in the answer must match a value in the tool results, allowing display
  rounding (within 1% relative), compact suffixes (K, M) and percentages of ratios. Years 1900–2100
  and integers up to 12 are exempt when they appear in the question or the SQL. A mismatch →
  `failed` with the message "The answer could not be checked against the data, so it is not shown."
- `no_data` and `out_of_scope` answers are always shown, with the evidence that led to them.

### Status values

`answered`, `no_data`, `out_of_scope`, `conversation`, `disabled` (no API key), `failed`,
`rate_limited` (a usage limit was reached before or during the exchange; added in 1.5.0).

A `conversation` reply may not contain figures: any number other than a year or an integer up to 12
turns it into `failed`, so data can only enter through tool results. The UI shows a label for
each (`07-frontend.md`).

### Acceptance criteria

- A scripted fake client that calls `run_sql` and answers with a number from the result → `answered`
  with one evidence item containing the SQL, columns and rows.
- `DROP TABLE movies`, `INSERT ...`, two statements, and `SELECT * FROM read_csv('/etc/passwd')` are
  rejected with a tool error; the database is unchanged.
- A query that returns no rows followed by a `no_data` answer → `no_data`, answer shown.
- An `answered` reply with a number not in any tool result → `failed`.
- An `answered` reply with no tool call → `failed`.
- No API key → `disabled` with no network access.
- A full usage counter → `rate_limited`, and the fake client receives no call.
- A day's spend at the budget → `rate_limited` with no call; a new UTC day starts from zero.
- An 11th question from one device in a day → `rate_limited` with `questions_left = 0`, and no call.

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
