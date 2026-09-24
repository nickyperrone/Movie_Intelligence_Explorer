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
RUN pip install --no-cache-dir uv==0.12.18

WORKDIR /app/backend
COPY backend/pyproject.toml backend/uv.lock ./
RUN uv sync --frozen --no-dev --no-install-project

COPY backend/ ./
COPY data/raw /app/data/raw
COPY data/curated /app/data/curated
COPY docs/api/openapi.yaml /app/docs/api/openapi.yaml

# Fails the build if any data validation fails. Downloads the embedding model into the image, so
# the container starts without reaching Hugging Face.
RUN uv run --no-sync python -m pipeline.build_db && \
    uv run --no-sync python -m pipeline.build_embeddings

COPY --from=frontend /app/frontend/dist /app/frontend/dist

RUN useradd --create-home app && chown -R app /app
USER app
ENV HF_HUB_OFFLINE=1

EXPOSE 5001
HEALTHCHECK --interval=30s --timeout=5s --start-period=60s \
    CMD python -c "import urllib.request; urllib.request.urlopen('http://localhost:5001/api/v1/health')"
# One worker: each worker would load its own copy of the embedding model (about 2.2 GB).
CMD ["uv", "run", "--no-sync", "uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "5001", "--workers", "1"]
