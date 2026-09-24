"""Request, model call and spend limits for a public deployment (docs/06-llm.md, "Usage limits";
docs/08-deployment.md, "Rate limits").

Counters live in memory: the app runs a single worker, and losing them on restart is acceptable.
The day's spend is also saved to a file, because losing it on a redeploy would lift the budget.
"""

import json
import logging
import threading
import time
import uuid
from collections import defaultdict, deque
from contextvars import ContextVar
from datetime import UTC, datetime
from pathlib import Path
from typing import Any

from fastapi import Request
from fastapi.responses import JSONResponse
from starlette.types import ASGIApp, Receive, Scope, Send

from app.config import settings

logger = logging.getLogger(__name__)

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

    def remaining(self, key: str) -> int:
        now = time.monotonic()
        with self.lock:
            hits = self.hits.get(key)
            if not hits:
                return self.limit
            while hits and hits[0] <= now - self.seconds:
                hits.popleft()
            return max(self.limit - len(hits), 0)

    def reset(self) -> None:
        with self.lock:
            self.hits.clear()


class DailySpend:
    """OpenAI spend for the current UTC day, saved to a small JSON file after every call."""

    def __init__(self, path: Path) -> None:
        self.path = path
        self.lock = threading.Lock()
        self.day, self.usd = self.load()

    @staticmethod
    def today() -> str:
        return datetime.now(UTC).date().isoformat()

    def load(self) -> tuple[str, float]:
        try:
            saved = json.loads(self.path.read_text())
            return str(saved["day"]), float(saved["usd"])
        except (OSError, ValueError, KeyError, TypeError):
            return self.today(), 0.0

    def spent(self) -> float:
        with self.lock:
            if self.day != self.today():
                self.day, self.usd = self.today(), 0.0
            return self.usd

    def exhausted(self) -> bool:
        return self.spent() >= settings.llm_daily_budget_usd

    def add(self, usd: float) -> None:
        self.spent()
        with self.lock:
            self.usd += usd
            snapshot = {"day": self.day, "usd": round(self.usd, 6)}
        try:
            self.path.parent.mkdir(parents=True, exist_ok=True)
            temporary = self.path.with_suffix(".tmp")
            temporary.write_text(json.dumps(snapshot))
            temporary.replace(self.path)
        except OSError as error:
            # The budget still holds in memory; only a restart would forget it.
            logger.warning("could not save the llm spend: %s", error)

    def reset(self) -> None:
        with self.lock:
            self.day, self.usd = self.today(), 0.0


api_requests = SlidingWindow(settings.api_requests_per_client_minute, MINUTE)
llm_per_client_minute = SlidingWindow(settings.llm_calls_per_client_minute, MINUTE)
llm_per_client_day = SlidingWindow(settings.llm_calls_per_client_day, DAY)
llm_per_day = SlidingWindow(settings.llm_calls_per_day, DAY)
chat_per_device = SlidingWindow(settings.chat_questions_per_device_day, DAY)
chat_per_ip = SlidingWindow(settings.chat_questions_per_ip_day, DAY)
daily_spend = DailySpend(settings.state_dir / "llm_spend.json")


def spend_llm_call() -> None:
    """Takes one model call from every counter, or raises LlmRateLimited."""
    if daily_spend.exhausted():
        raise LlmRateLimited
    key = client_key.get()
    if not (
        llm_per_client_minute.allow(key)
        and llm_per_client_day.allow(key)
        and llm_per_day.allow(WHOLE_APP)
    ):
        raise LlmRateLimited


def record_usage(usage: Any) -> None:
    """Adds a response's token cost to the day's spend; responses without usage cost nothing."""
    if usage is None:
        return
    prompt = getattr(usage, "prompt_tokens", 0) or 0
    completion = getattr(usage, "completion_tokens", 0) or 0
    daily_spend.add(
        (
            prompt * settings.llm_usd_per_million_input
            + completion * settings.llm_usd_per_million_output
        )
        / 1_000_000
    )


def device_key(device_id: str | None) -> str:
    """The browser's own id when it sends a valid one, otherwise the client's address."""
    if device_id:
        try:
            return f"device:{uuid.UUID(device_id)}"
        except ValueError:
            pass
    return f"ip:{client_key.get()}"


def take_chat_question(device_id: str | None) -> tuple[bool, int]:
    """Takes one question from the device's and the address's daily allowance.

    Returns whether the question may be asked and how many the device has left afterwards. A
    refused question takes nothing.
    """
    device, address = device_key(device_id), client_key.get()
    if daily_spend.exhausted():
        return False, questions_left(device_id)
    if chat_per_device.remaining(device) == 0 or chat_per_ip.remaining(address) == 0:
        return False, 0
    chat_per_device.allow(device)
    chat_per_ip.allow(address)
    return True, questions_left(device_id)


def questions_left(device_id: str | None) -> int:
    return min(
        chat_per_device.remaining(device_key(device_id)),
        chat_per_ip.remaining(client_key.get()),
    )


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
