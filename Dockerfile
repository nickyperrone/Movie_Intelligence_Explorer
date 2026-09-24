# Stage 1: build the React app.
FROM node:22-alpine AS frontend
WORKDIR /app/frontend
COPY frontend/package.json frontend/package-lock.json ./
RUN npm ci
COPY frontend/ ./
RUN npm run build

# Stage 2: Python runtime with the data and embeddings built into the image.
FROM python:3.12-slim AS runtime
ENV PYTHONUNBUFFERED=1 \
    UV_COMPILE_BYTECODE=1 \
    UV_LINK_MODE=copy \
    HF_HOME=/app/.cache/hf
RUN pip install --no-cache-dir uv==0.12.18 && \
    useradd --create-home app && \
    mkdir -p /app/backend && chown -R app:app /app

# Everything below runs as the non-root user and is copied with its ownership, so no layer has to
# re-own (and duplicate) the files afterwards.
USER app
WORKDIR /app/backend
COPY --chown=app:app backend/pyproject.toml backend/uv.lock ./
RUN uv sync --frozen --no-dev --no-install-project

COPY --chown=app:app backend/ ./
COPY --chown=app:app data/raw /app/data/raw
COPY --chown=app:app data/curated /app/data/curated
COPY --chown=app:app docs/api/openapi.yaml /app/docs/api/openapi.yaml

# Fails the build if any data validation fails. Downloads the embedding model into the image, so
# the container starts without reaching Hugging Face.
RUN uv run --no-sync python -m pipeline.build_db && \
    uv run --no-sync python -m pipeline.build_embeddings

COPY --chown=app:app --from=frontend /app/frontend/dist /app/frontend/dist

ENV HF_HUB_OFFLINE=1 \
    PORT=4040

# One port serves the React app and the API (/api/v1). Set PORT to change it.
EXPOSE 4040
HEALTHCHECK --interval=30s --timeout=5s --start-period=90s \
    CMD python -c "import os, urllib.request; urllib.request.urlopen(f'http://localhost:{os.environ[\"PORT\"]}/api/v1/health')"
# One worker: each worker would load its own copy of the embedding model (about 2.2 GB).
CMD exec uv run --no-sync uvicorn app.main:app --host 0.0.0.0 --port "$PORT" --workers 1
