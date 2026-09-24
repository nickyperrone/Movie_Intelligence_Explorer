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
| `API_REQUESTS_PER_CLIENT_MINUTE` | no | `300` | Requests per client per minute to `/api/v1` |
| `LLM_CALLS_PER_CLIENT_MINUTE` | no | `20` | Model calls per client per minute (`06-llm.md`) |
| `LLM_CALLS_PER_CLIENT_DAY` | no | `200` | Model calls per client per day |
| `LLM_CALLS_PER_DAY` | no | `2000` | Model calls per day for the whole app |
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

## New deploys and open tabs

Every build gives the page files new hashed names and removes the old ones. A tab opened before a
deploy still holds the old `index.html`, so opening a page it has not loaded yet asks for a file
that no longer exists.

- `index.html` (and every route that serves it) is sent with `Cache-Control: no-cache`, so a
  reload always gets the current build. Hashed files under `/assets/` are sent with
  `Cache-Control: public, max-age=31536000, immutable`.
- When a page file fails to load, the app reloads itself once to pick up the new build. A marker in
  `sessionStorage` (cleared after 30 seconds) stops it from reloading in a loop if the server is
  really down.
- Dokploy stops the old container once the new one is running. Requests in that window may get a
  404 from Traefik; enabling Dokploy's health check on `/api/v1/health` shortens it.

## Rate limits

Two layers, both in memory in the single uvicorn worker (counters reset on restart):

- **Requests:** each client may make `API_REQUESTS_PER_CLIENT_MINUTE` requests to `/api/v1` per
  minute (`/health` is exempt). Above that the API answers `429` with the error code
  `rate_limited` and a `Retry-After` header. A page load makes about 10 requests, so normal use
  never reaches the limit; it stops scripts from tying up the CPU with embedding queries.
- **Model calls:** the per-client and daily caps in `06-llm.md` ("Usage limits"). They protect the
  API key's spend; the features degrade to `rate_limited` instead of failing.

The client is the last address in `X-Forwarded-For` (the one Traefik adds), or the socket address
when the header is missing. If port 4040 is also reachable without Traefik, a client can forge the
header and escape the per-client limits, but not the daily cap. Also set a monthly budget on the
OpenAI project.

## Analytics

Page views are counted with a self-hosted [Rybbit](https://github.com/rybbit-io/rybbit) instance
(open source, no cookies) at `rybbit.argy.dev`. The script tag in `frontend/index.html` loads with
`defer`, so it never delays the app; if it fails to load, nothing else changes.

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
