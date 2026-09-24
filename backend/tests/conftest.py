import pandas as pd
import pytest
from fastapi.testclient import TestClient

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
