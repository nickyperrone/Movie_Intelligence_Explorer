# 00 — Conventions

Rules for every file in the repository. Reviews reject changes that break them.

## Language

English for code, identifiers, comments, docs, UI copy and commit messages.

## Writing (docs, README, UI copy)

- Short, factual sentences. State the decision and the reason.
- No introductions ("In this section we will..."), no closing summaries.
- No marketing words: seamless, powerful, robust, leverage, unlock, cutting-edge, delve, elevate.
- No emojis.
- Numbers carry units and the period they cover ("12.4K streams, Apr–Jun 2026").
- Text written by the LLM is labeled "Generated summary" in the UI and is shown next to the facts it
  was written from.

## Code

- Comments explain why: a data quirk, a trade-off, a non-obvious constraint. They never restate the
  code.
- No abstraction with a single implementation: no base classes, factories, plugin registries or
  interfaces created "for later".
- No dead code, commented-out code, unused parameters, or TODO comments on `main`.
- Names come from the domain: `consumption`, `availability`, `comparables`, `semantic_query`.
  Forbidden module and variable names: `utils`, `helpers`, `misc`, `data`, `info`, `manager`,
  `handler` (except FastAPI exception handlers).
- A function does one thing and fits on one screen.
- Catch specific exceptions. The only broad `except Exception` is at the LLM boundary in
  `services/llm.py`, where the error is logged and converted into `status: "failed"`.
- No global mutable state except caches created once at startup (DuckDB connection, embedding
  index) and bounded LRU caches.

### Backend

- Layers: `routers/` (HTTP only) → `services/` (logic and SQL) → `db.py` (connection).
  Routers never contain SQL; services never import FastAPI.
- Every SQL statement is parameterized. User input is never formatted into SQL text. Dynamic parts
  (column names for sorting, dimensions) come from fixed allow-lists.
- Response models are the generated classes in `app/api_models.py`.
- Formatting and lint: `ruff format`, `ruff check` (rules E, F, I, B, UP), line length 100.

### Frontend

- Components never call `fetch`. Data access goes through the hooks in `src/api/queries.ts`.
- Page state that a user may want to share (search text, filters, selected tabs) lives in the URL.
- One component per file, named after what it renders (`PerformanceChart`, not `Chart2`).
- Tailwind utility classes; shadcn/ui components only where they are used.
- Formatting and lint: Prettier defaults, oxlint from the Vite template, `tsc --noEmit` strict.

## Generated files

Generated files start with a header naming the generator and are never edited by hand:

- `backend/app/api_models.py` (datamodel-code-generator)
- `frontend/src/api/schema.d.ts` (openapi-typescript)
- `data/curated/themes.json` (pipeline/build_themes.py, reviewed by a person before commit)

## Commits

- Commit and push after each finished feature or group of specs, not after each file.
- Group related changes in one commit. Avoid small commits for trivial edits.
- Message: one line in English, plain B1 level, at most 14 words, starting with an imperative verb
  (`Add data spec with tables and validations`).
- No prefixes (`feat:`), no trailers, no mention of AI tools or assistants.
- One concern per commit. A spec change is committed before the code that implements it.

## Acceptance criteria

- `ruff check`, `ruff format --check`, `tsc --noEmit` and `oxlint` pass in CI.
- `grep -rniE "seamless|leverage|robust|cutting-edge|delve" docs frontend/src backend/app README.md`
  returns nothing.
- `grep -rn "TODO" backend/app frontend/src` returns nothing.
