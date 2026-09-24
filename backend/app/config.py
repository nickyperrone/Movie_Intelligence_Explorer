from pathlib import Path

from pydantic_settings import BaseSettings, SettingsConfigDict

ROOT_DIR = Path(__file__).resolve().parents[2]

API_VERSION = "1.2.0"


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=ROOT_DIR / ".env", extra="ignore")

    raw_dir: Path = ROOT_DIR / "data" / "raw"
    curated_dir: Path = ROOT_DIR / "data" / "curated"
    processed_dir: Path = ROOT_DIR / "data" / "processed"
    frontend_dist: Path = ROOT_DIR / "frontend" / "dist"
    api_spec_path: Path = ROOT_DIR / "docs" / "api" / "openapi.yaml"

    embedding_model: str = "intfloat/multilingual-e5-large"
    # A result is kept when its score is this many standard deviations above the mean score of
    # the whole catalog for the same query. Chosen with `make eval` (docs/05-search.md).
    min_relevance_z: float = 2.5

    openai_api_key: str | None = None
    openai_model: str = "gpt-4o-mini"
    log_level: str = "INFO"

    @property
    def db_path(self) -> Path:
        return self.processed_dir / "movies.duckdb"

    @property
    def embeddings_path(self) -> Path:
        return self.processed_dir / "embeddings.npy"

    @property
    def embedding_ids_path(self) -> Path:
        return self.processed_dir / "embedding_ids.json"

    @property
    def themes_path(self) -> Path:
        return self.curated_dir / "themes.json"

    @property
    def llm_enabled(self) -> bool:
        return bool(self.openai_api_key)


settings = Settings()
