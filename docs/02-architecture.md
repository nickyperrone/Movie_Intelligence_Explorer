# 02 — Architecture

## Overview

One Docker image serves everything. The build turns the raw CSVs into a DuckDB file and an
embedding matrix. At runtime FastAPI answers `/api/v1/*` and serves the React build for every other
path. The only external dependency is the OpenAI API, and every feature that uses it has a degraded
mode.

```mermaid
flowchart LR
    subgraph BUILD["Docker build"]
        RAW["data/raw/*.csv"] --> DB_BUILD["pipeline/build_db.py<br/>clean + validate"]
        THEMES["data/curated/themes.json"] --> DB_BUILD
        DB_BUILD --> DUCK[("movies.duckdb")]
        DUCK --> EMB_BUILD["pipeline/build_embeddings.py"]
        EMB_BUILD --> VECTORS[("embeddings.npy<br/>embedding_ids.json")]
        SRC["frontend/src"] --> VITE["vite build"] --> DIST["frontend/dist"]
    end

    subgraph RUNTIME["Container on Dokploy"]
        SPA["React app"] -->|"/api/v1/*"| ROUTERS["FastAPI routers"]
        ROUTERS --> SERVICES["services/*"]
        SERVICES --> INDEX["SearchIndex<br/>e5 model + vectors in memory"]
        SERVICES --> SQL["DuckDB (read-only)"]
        SERVICES --> LLM["services/llm.py"]
    end

    DIST -.served by.-> ROUTERS
    DUCK -.-> SQL
    VECTORS -.-> INDEX
    LLM --> OPENAI["OpenAI API"]

    subgraph OFFLINE["Run by hand, output reviewed and committed"]
        THEME_BUILD["pipeline/build_themes.py<br/>k-means + LLM naming"] --> THEMES
    end
```

## Search request

```mermaid
sequenceDiagram
    actor U as User
    participant UI as React
    participant R as routers/search.py
    participant L as services/llm.py
    participant M as services/movies.py
    participant S as services/search.py

    U->>UI: "comedies from 2024 on Netflix in Brazil"
    UI->>R: GET /api/v1/search?q=...&interpret=true
    R->>L: interpret_query(q, vocabularies)
    alt LLM available and valid output
        L-->>R: semantic_query + proposed filters
    else no key, error or invalid output
        L-->>R: status disabled/failed, semantic_query = q
    end
    R->>M: candidate_ids(applied filters)
    M-->>R: allowed title_ids
    R->>S: rank("query: " + semantic_query, allowed ids)
    S-->>R: (title_id, score) above threshold
    R->>M: movie summaries
    R-->>UI: results + interpretation + applied filters
    U->>UI: removes a filter chip
    UI->>R: GET /api/v1/search?q=<semantic_query>&interpret=false&...
```

## Licensing assessment request

```mermaid
sequenceDiagram
    participant UI as React
    participant R as routers/decisions.py
    participant C as services/comparables.py
    participant S as services/search.py
    participant L as services/llm.py

    UI->>R: GET /decisions/licensing?title_id&platform&country
    R->>C: licensing_assessment(...)
    C->>S: similar(title_id, candidates = same primary genre, year ±2)
    C->>C: first-6-month streams of comparables on target platform/country (SQL)
    C-->>R: facts, comparables, expected range, platform fit, whitespace
    R-->>UI: assessment
    UI->>R: GET /decisions/licensing/memo?same params
    R->>C: same facts (cached)
    R->>L: write_licensing_memo(facts)
    R-->>UI: memo + status
```

The memo is a separate request so the facts render immediately and the slower LLM call does not
block the page.

## Layers

| Layer | Location | Responsibility |
|---|---|---|
| Pipeline | `backend/pipeline/` | CSV → validated DuckDB tables; movies → vectors; offline themes |
| Routers | `backend/app/routers/` | Parse and validate HTTP input, call services, return generated models |
| Services | `backend/app/services/` | SQL, ranking, comparables, LLM calls |
| DB | `backend/app/db.py` | Read-only DuckDB connection, one cursor per call |
| API client | `frontend/src/api/` | Typed client and one TanStack Query hook per endpoint |
| Pages / components | `frontend/src/pages`, `components` | Rendering and URL state |

## Decisions

| Decision | Chosen | Rejected | Reason |
|---|---|---|---|
| Storage | DuckDB file, read-only | Postgres, Postgres + pgvector | 64K rows of analytics. Embedded, columnar, SQL, no extra service. pgvector becomes worth it with far more titles or writes. |
| Vector search | NumPy dot product in memory | FAISS, vector database | 1,590 × 384 floats = 2.4 MB. Exact search takes under a millisecond. |
| Embedding model | `intfloat/multilingual-e5-small`, local | OpenAI embeddings | Search, the core feature, keeps working without the external API. Multilingual for Spanish and Portuguese queries. |
| LLM | OpenAI API, model from `OPENAI_MODEL` | Local LLM | Server RAM is better spent on the embedding model; LLM use is optional per request. |
| Frontend | Vite SPA | Next.js | The backend already exists in Python. A static build served by FastAPI avoids a second server and CORS. |
| Deployment | One image, one container | Separate frontend and API services | One URL, one deploy, no CORS. |
| API versioning | Path prefix `/api/v1` | Header versioning | Visible, testable from a browser, works with any proxy. |
| Contract | Hand-written OpenAPI, types generated | Code-first OpenAPI | Spec-driven: the contract is reviewed before code; backend and frontend types cannot drift. |
| Themes | Precomputed, reviewed, committed JSON | Clustering at build time | Cluster names come from an LLM; a person reviews them once. Builds stay deterministic and need no API key. |
| Chat over data | LLM with two tools: validated read-only SQL and semantic search; answers show their SQL and rows | Free-form answers from the model; full text-to-SQL with write access | Every number is traceable to a query result, and the database cannot be modified or used to read files |
| Data build | Inside the Docker build | Commit processed files | Every image is rebuilt from the raw CSVs, so the data is reproducible. |

## Acceptance criteria

- `routers/` contains no SQL; `services/` does not import `fastapi`.
- The only modules importing `openai` are `services/llm.py`, `services/assistant.py` and
  `pipeline/build_themes.py`.
- The container serves `/`, `/discover`, `/movies/tt12042730` (SPA) and `/api/v1/health` (JSON).
