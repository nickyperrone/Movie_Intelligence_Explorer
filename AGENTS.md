# AGENTS.md

Instructions for coding agents working in this repository.

## Project

Movie Intelligence Explorer: a web app for studio decision makers to explore movie performance,
streaming availability and consumption in LATAM, with semantic search over the catalog.

- `docs/` holds the specs. `docs/api/openapi.yaml` is the API contract.
- `backend/` is FastAPI + DuckDB + sentence-transformers. `backend/pipeline/` builds the data offline.
- `frontend/` is React + TypeScript + Vite.
- `data/raw/` holds the three source CSVs. `data/processed/` is generated and gitignored.
  `data/curated/` holds generated files that are reviewed and committed.

## Workflow: spec first

1. Read the relevant spec in `docs/` before changing behavior.
2. If the change alters behavior, update the spec first, in its own commit.
3. After editing `docs/api/openapi.yaml`, run `make codegen`. Never edit the generated files
   (`backend/app/api_models.py`, `frontend/src/api/schema.d.ts`) by hand.
4. Write or update the tests listed in the spec's acceptance criteria, then the code.
5. Run `make test` before committing.

## Commands

| Command | What it does |
|---|---|
| `make setup` | Install backend and frontend dependencies and build the data (first run) |
| `make dev` | Run the API on :5001 and the web app on :5173 together |
| `make codegen` | Regenerate Pydantic and TypeScript types from the OpenAPI spec |
| `make data` | Build DuckDB and embeddings from `data/raw/` |
| `make themes` | Rebuild `data/curated/themes.json` (needs `OPENAI_API_KEY`; review the output) |
| `make back` | Run the API on :5001 with reload |
| `make front` | Run the Vite dev server on :5173 (proxies `/api`) |
| `make test` | ruff, pytest, tsc, oxlint, vitest |
| `make eval` | Run the search evaluation set |
| `make up` | Build and run the Docker image locally |

## Data rules

- The three datasets have different grains. See `docs/03-data.md`.
- Never join `availability` (dataset B) with `consumption` (dataset C) row by row. Aggregate each on
  its own grain.
- Metric definitions live in `docs/04-metrics.md`. Ratios are computed as ratio of sums.
- All SQL lives in `backend/app/services/`. Queries are parameterized; never format user input
  into SQL.

## Code conventions

Full list in `docs/00-conventions.md`. The non-negotiable ones:

- English everywhere: code, comments, docs, UI copy, commit messages.
- Comments explain why, never what.
- No emojis. No marketing language in docs or UI.
- No abstractions with a single implementation. No dead code, no commented-out code, no TODOs on
  `main`.
- Domain names only. No `utils`, `helpers`, `data`, `info`, `manager`.
- Routers handle HTTP only; services hold logic; only services run SQL.
- Frontend components never call `fetch`; they use hooks from `frontend/src/api/queries.ts`.
- LLM calls live only in `backend/app/services/llm.py` and `backend/app/services/assistant.py`. The LLM never produces numbers: it writes
  text from facts computed in SQL. Every LLM feature must work in a degraded mode without a key.
- Catch specific exceptions. The only broad catch is at the LLM boundary, which logs and returns a
  documented status.

## Commits

- Commit and push after each finished feature or group of specs, not after each file.
- Group related changes in one commit. Avoid small commits for trivial edits.
- Message: one line in English, plain B1 level, at most 14 words.
- The first word is a verb in imperative form (`Add`, `Fix`, `Update`, `Remove`).
- No prefixes (`feat:`), no trailers, no mention of AI tools or assistants.
- One concern per commit. Spec changes are committed before the code that implements them.

## Secrets

Never commit `.env` or API keys. Configuration comes from environment variables listed in
`.env.example`.
