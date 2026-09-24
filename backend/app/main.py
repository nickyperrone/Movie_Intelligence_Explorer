import logging
from collections.abc import AsyncIterator
from contextlib import asynccontextmanager
from pathlib import Path

import yaml
from fastapi import FastAPI, HTTPException
from fastapi.responses import FileResponse
from fastapi.staticfiles import StaticFiles
from starlette.responses import Response
from starlette.types import Scope

from app.config import API_VERSION, settings
from app.errors import register_error_handlers
from app.rate_limits import RateLimitMiddleware
from app.routers import assistant, collections, dashboard, decisions, movies, search, system
from app.services.movies import filter_options
from app.services.search import search_index

API_PREFIX = "/api/v1"

logging.basicConfig(level=settings.log_level, format="%(levelname)s %(name)s %(message)s")
logging.getLogger("httpx").setLevel(logging.WARNING)


@asynccontextmanager
async def lifespan(_: FastAPI) -> AsyncIterator[None]:
    # Load the embedding model and vocabularies before the first request, not during it.
    search_index()
    filter_options()
    yield


app = FastAPI(
    title="Movie Intelligence Explorer API",
    version=API_VERSION,
    lifespan=lifespan,
    docs_url="/api/docs",
    redoc_url=None,
    openapi_url=f"{API_PREFIX}/openapi.json",
)
register_error_handlers(app)
app.add_middleware(RateLimitMiddleware, prefix=API_PREFIX)

for router in (system, search, movies, dashboard, collections, decisions, assistant):
    app.include_router(router.router, prefix=API_PREFIX)


def hand_written_spec() -> dict:
    # The contract is written by hand in docs/api/openapi.yaml (spec first). The docs page serves
    # that file instead of the schema FastAPI would derive from the code.
    if app.openapi_schema is None:
        app.openapi_schema = yaml.safe_load(settings.api_spec_path.read_text())
    return app.openapi_schema


app.openapi = hand_written_spec


class HashedAssets(StaticFiles):
    # File names change with every build, so a cached copy can never be stale.
    async def get_response(self, path: str, scope: Scope) -> Response:
        response = await super().get_response(path, scope)
        if response.status_code == 200:
            response.headers["Cache-Control"] = "public, max-age=31536000, immutable"
        return response


if settings.frontend_dist.exists():
    app.mount("/assets", HashedAssets(directory=settings.frontend_dist / "assets"), name="assets")

    # HEAD too: uptime monitors and link previews check pages with it.
    @app.api_route("/{path:path}", methods=["GET", "HEAD"], include_in_schema=False)
    def single_page_app(path: str) -> FileResponse:
        if path.startswith("api/"):
            raise HTTPException(404, f"No endpoint at /{path}")
        file = (settings.frontend_dist / path).resolve()
        if path and file.is_file() and file.is_relative_to(settings.frontend_dist.resolve()):
            return FileResponse(file)
        # Never cached: it names the current build's files (docs/08-deployment.md).
        return FileResponse(
            Path(settings.frontend_dist) / "index.html", headers={"Cache-Control": "no-cache"}
        )
