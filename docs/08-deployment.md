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
   - Serves the React app and the API on one port, `PORT` (default 4040).

One worker: each worker would load its own copy of the model (about 2.2 GB). Requests are short and
FastAPI runs sync endpoints in a thread pool, which is enough for this traffic.

The image layout mirrors the repository (`/app/backend`, `/app/data`, `/app/frontend/dist`), so the
paths in `app/config.py` work the same locally and in the container.

## Configuration

| Variable | Required | Default | Purpose |
|---|---|---|---|
| `OPENAI_API_KEY` | no | — | Enables LLM features |
| `OPENAI_MODEL` | no | `gpt-4o-mini` | Chat model for LLM features |
| `LOG_LEVEL` | no | `INFO` | Python logging level |
| `PORT` | no | `4040` | Port the container serves the app and the API on |

No secrets are baked into the image. `.env` is gitignored and excluded by `.dockerignore`.

## Local

Defaults work after a clone, with no configuration:

| Service | Default port | Override |
|---|---|---|
| API (FastAPI) | 5001 | `API_PORT` |
| Web (Vite dev server) | 5173 | `WEB_PORT` |

Port 5000 is avoided because recent macOS versions use it for the AirPlay receiver.

- First time: `make setup` (installs Python and Node dependencies, builds the data).
- Every day: `make dev` starts the API and the web app; open `http://localhost:5173`. Vite proxies
  `/api` to the API port.
- `docker compose up --build` builds the production image and serves everything on
  `http://localhost:4040`, reading `.env` if present.

## Dokploy

Either of these works; both build the same `Dockerfile`, which is the only file needed.

As an Application (recommended):

1. Create an Application from the GitHub repository, branch `main`.
2. Build type: Dockerfile, path `./Dockerfile`, context `.`.
3. Environment: `OPENAI_API_KEY` (optional), `OPENAI_MODEL` (optional).
4. Domains: add a domain with container port 4040. Traefik issues the HTTPS certificate.
5. Enable auto-deploy so every push to `main` rebuilds and redeploys.

As a Compose service: point Dokploy at `docker-compose.yml`; it builds the image and publishes
port 4040.

Server resources: at least 4 GB RAM (the container uses about 1 GB idle, more under load while the
model runs) and about 6 GB of disk for the image. The first build takes 15 to 30 minutes because it
embeds the catalog on CPU; later builds reuse the cached layers unless dependencies or data change.

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
