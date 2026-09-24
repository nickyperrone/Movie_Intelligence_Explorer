"""Every error response uses the envelope {"error": {"code", "message"}} (docs/api/openapi.yaml)."""

import logging

from fastapi import FastAPI, Request
from fastapi.exceptions import RequestValidationError
from fastapi.responses import JSONResponse
from starlette.exceptions import HTTPException

from app.services.comparables import InvalidTarget
from app.services.dashboard import InvalidPeriod

logger = logging.getLogger(__name__)


def envelope(
    status: int, code: str, message: str, headers: dict[str, str] | None = None
) -> JSONResponse:
    return JSONResponse(
        status_code=status,
        content={"error": {"code": code, "message": message}},
        headers=headers,
    )


def validation_message(error: RequestValidationError) -> str:
    first = error.errors()[0]
    location = ".".join(str(part) for part in first["loc"] if part not in ("query", "path", "body"))
    return f"{location}: {first['msg']}" if location else first["msg"]


def register_error_handlers(app: FastAPI) -> None:
    @app.exception_handler(HTTPException)
    async def http_error(_: Request, error: HTTPException) -> JSONResponse:
        if error.status_code == 404:
            return envelope(404, "not_found", str(error.detail))
        if error.status_code == 405:
            # Keep the Allow header Starlette sets on 405 responses.
            return envelope(405, "method_not_allowed", str(error.detail), error.headers)
        if error.status_code in (400, 422):
            return envelope(422, "validation_error", str(error.detail))
        return envelope(error.status_code, "internal_error", str(error.detail))

    @app.exception_handler(RequestValidationError)
    async def request_validation_error(_: Request, error: RequestValidationError) -> JSONResponse:
        return envelope(422, "validation_error", validation_message(error))

    @app.exception_handler(InvalidPeriod)
    @app.exception_handler(InvalidTarget)
    async def invalid_input(_: Request, error: ValueError) -> JSONResponse:
        return envelope(422, "validation_error", str(error))

    @app.exception_handler(Exception)
    async def unexpected_error(_: Request, error: Exception) -> JSONResponse:
        logger.exception("unhandled error", exc_info=error)
        return envelope(500, "internal_error", "Unexpected server error.")
