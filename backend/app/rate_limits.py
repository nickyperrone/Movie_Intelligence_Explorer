"""Request and model call limits for a public deployment (docs/08-deployment.md, "Rate limits").

Counters live in memory: the app runs a single worker, and losing them on restart is acceptable.
"""

import threading
import time
from collections import defaultdict, deque
from contextvars import ContextVar

from fastapi import Request
from fastapi.responses import JSONResponse
from starlette.types import ASGIApp, Receive, Scope, Send

from app.config import settings

MINUTE = 60
DAY = 24 * 60 * 60
WHOLE_APP = "*"

# Set per request by the middleware, read by the LLM boundary, which has no access to the request.
client_key: ContextVar[str] = ContextVar("client_key", default="local")


class LlmRateLimited(Exception):
    pass


class SlidingWindow:
    def __init__(self, limit: int, seconds: int) -> None:
        self.limit = limit
        self.seconds = seconds
        self.hits: defaultdict[str, deque[float]] = defaultdict(deque)
        self.lock = threading.Lock()

    def allow(self, key: str) -> bool:
        """Records a hit and returns True, or returns False without recording when full."""
        now = time.monotonic()
        with self.lock:
            hits = self.hits[key]
            while hits and hits[0] <= now - self.seconds:
                hits.popleft()
            if len(hits) >= self.limit:
                return False
            hits.append(now)
            if len(self.hits) > 10_000:
                # Forget clients with no recent hits so the table cannot grow without bound.
                for idle in [k for k, v in self.hits.items() if not v]:
                    del self.hits[idle]
            return True

    def reset(self) -> None:
        with self.lock:
            self.hits.clear()


api_requests = SlidingWindow(settings.api_requests_per_client_minute, MINUTE)
llm_per_client_minute = SlidingWindow(settings.llm_calls_per_client_minute, MINUTE)
llm_per_client_day = SlidingWindow(settings.llm_calls_per_client_day, DAY)
llm_per_day = SlidingWindow(settings.llm_calls_per_day, DAY)


def spend_llm_call() -> None:
    """Takes one model call from every counter, or raises LlmRateLimited."""
    key = client_key.get()
    if not (
        llm_per_client_minute.allow(key)
        and llm_per_client_day.allow(key)
        and llm_per_day.allow(WHOLE_APP)
    ):
        raise LlmRateLimited


def client_address(request: Request) -> str:
    # Traefik appends the address it received the request from, so the last entry is the only
    # one a client cannot choose.
    forwarded = request.headers.get("x-forwarded-for", "")
    last = forwarded.split(",")[-1].strip()
    if last:
        return last
    return request.client.host if request.client else "unknown"


class RateLimitMiddleware:
    def __init__(self, app: ASGIApp, prefix: str) -> None:
        self.app = app
        self.prefix = prefix

    async def __call__(self, scope: Scope, receive: Receive, send: Send) -> None:
        path = scope.get("path", "")
        if scope["type"] != "http" or not path.startswith(self.prefix + "/"):
            await self.app(scope, receive, send)
            return
        key = client_address(Request(scope))
        client_key.set(key)
        if path != f"{self.prefix}/health" and not api_requests.allow(key):
            # Built here rather than with errors.envelope: errors imports the services, and the
            # LLM service imports this module.
            response = JSONResponse(
                status_code=429,
                content={
                    "error": {
                        "code": "rate_limited",
                        "message": "Too many requests. Try again in a minute.",
                    }
                },
                headers={"Retry-After": str(MINUTE)},
            )
            await response(scope, receive, send)
            return
        await self.app(scope, receive, send)
