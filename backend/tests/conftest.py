import pandas as pd
import pytest
from fastapi.testclient import TestClient

from app import rate_limits
from app.config import settings
from app.main import app
from app.services import llm


@pytest.fixture(scope="session")
def client():
    with TestClient(app) as test_client:
        yield test_client


@pytest.fixture(autouse=True)
def no_real_llm(monkeypatch):
    # No test may reach the OpenAI API; tests that need replies install a FakeOpenAI.
    monkeypatch.setattr(llm, "openai_client", lambda: None)


@pytest.fixture(autouse=True)
def fresh_rate_limits(monkeypatch, tmp_path):
    # The contract test sends hundreds of requests from one client; limit tests lower this again.
    monkeypatch.setattr(rate_limits.api_requests, "limit", 1_000_000)
    for window in (
        rate_limits.api_requests,
        rate_limits.llm_per_client_minute,
        rate_limits.llm_per_client_day,
        rate_limits.llm_per_day,
        rate_limits.chat_per_device,
        rate_limits.chat_per_ip,
    ):
        window.reset()
    # Tests never touch the spend saved by a running app.
    monkeypatch.setattr(rate_limits.daily_spend, "path", tmp_path / "llm_spend.json")
    rate_limits.daily_spend.reset()


@pytest.fixture(scope="session")
def raw_movies() -> pd.DataFrame:
    return pd.read_csv(settings.raw_dir / "dataset_A.csv", encoding="utf-8-sig")


@pytest.fixture(scope="session")
def raw_availability() -> pd.DataFrame:
    return pd.read_csv(settings.raw_dir / "dataset_B.csv", encoding="utf-8-sig")


@pytest.fixture(scope="session")
def raw_consumption() -> pd.DataFrame:
    frame = pd.read_csv(settings.raw_dir / "dataset_C.csv", encoding="utf-8-sig")
    frame["month"] = frame["month"].str[:7]
    return frame
