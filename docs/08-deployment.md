# 08 — Deployment

## Image

`Dockerfile` at the repository root, two stages:

1. `frontend` (`node:22-alpine`): `npm ci`, `npm run build` → `frontend/dist`.
2. `runtime` (`python:3.12-slim`):
   - Install `uv`, then `uv sync --frozen --no-dev` in `backend/` (CPU-only torch on Linux).
   - Copy `data/raw`, `data/curated` and `backend/`.
   - Run `python -m pipeline.build_db` and `python -m pipeline.build_embeddings`. The build fails if
     any data validation fails. The embedding model is downloaded here into `HF_HOME=/app/.cache/hf`,
     so the container starts without network access to Hugging Face.
   - Copy `frontend/dist` from stage 1.
   - Run as a non-root user.
   - `HEALTHCHECK` calls `GET /api/v1/health`.
   - `CMD uvicorn app.main:app --host 0.0.0.0 --port 8000 --workers 1`.

One worker: each worker would load its own copy of the model (about 500 MB). Requests are short and
FastAPI runs sync endpoints in a thread pool, which is enough for this traffic.

The image layout mirrors the repository (`/app/backend`, `/app/data`, `/app/frontend/dist`), so the
paths in `app/config.py` work the same locally and in the container.

## Configuration

| Variable | Required | Default | Purpose |
|---|---|---|---|
| `OPENAI_API_KEY` | no | — | Enables LLM features |
| `OPENAI_MODEL` | no | `gpt-4o-mini` | Chat model for LLM features |
| `LOG_LEVEL` | no | `INFO` | Python logging level |

No secrets are baked into the image. `.env` is gitignored and excluded by `.dockerignore`.

## Local

- `docker compose up --build` builds the image and serves the app on `http://localhost:8000`,
  reading `.env`.
- Without Docker: `make data`, then `make back` and `make front` (Vite on `http://localhost:5173`,
  proxying `/api`).

## Dokploy

1. Create an Application from the GitHub repository, branch `main`.
2. Build type: Dockerfile, path `./Dockerfile`, context `.`.
3. Environment: `OPENAI_API_KEY`, `OPENAI_MODEL`.
4. Port 8000. Add a domain; Dokploy's Traefik issues the HTTPS certificate.
5. Enable auto-deploy so every push to `main` rebuilds and redeploys.
6. Server resources: at least 2 GB RAM (model plus Python process), about 3 GB disk for the image.

## CI (`.github/workflows/ci.yml`)

Runs on pushes and pull requests to `main`.

| Job | Steps |
|---|---|
| `backend` | `uv sync`, `ruff check`, `ruff format --check`, `make data`, `pytest` (includes contract tests) |
| `frontend` | `npm ci`, `tsc --noEmit`, `oxlint`, `vitest run`, `vite build` |
| `codegen` | `make codegen`, then `git diff --exit-code` |

The Hugging Face cache is cached between runs to avoid downloading the model every time.

## Acceptance criteria

- `docker build .` succeeds from a clean clone without an `.env` file.
- The running container answers `GET /api/v1/health` with `200` and `llm_enabled: false` when no key
  is set.
- The image does not contain `.env` or any API key.
