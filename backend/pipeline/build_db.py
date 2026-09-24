"""Build data/processed/movies.duckdb from the raw CSVs (docs/03-data.md).

Each table keeps the grain of its source. Tables are never pre-joined, so metrics
from `consumption` cannot be duplicated by availability rows.

Run: python -m pipeline.build_db
"""

import json
import re
from pathlib import Path

import duckdb
import pandas as pd

from app.config import settings

TITLE_ID_PATTERN = re.compile(r"^tt\d+$")


class DataValidationError(Exception):
    pass


def read_csv(path: Path) -> pd.DataFrame:
    # The files start with a byte order mark.
    frame = pd.read_csv(path, encoding="utf-8-sig")
    frame.columns = frame.columns.str.lower()
    return frame


def split_list(value: object) -> list[str]:
    if not isinstance(value, str):
        return []
    return [item.strip() for item in value.split(",") if item.strip()]


def blank_to_none(series: pd.Series) -> pd.Series:
    return series.map(lambda v: None if not isinstance(v, str) or not v.strip() else v.strip())


def to_whole_numbers(series: pd.Series, column: str) -> pd.Series:
    if (series.dropna() % 1 != 0).any():
        raise DataValidationError(f"{column}: values with a fractional part")
    return series.astype("Int64")


def load_movies(path: Path) -> pd.DataFrame:
    raw = read_csv(path)
    return pd.DataFrame(
        {
            "title_id": raw["title_id"],
            "title": raw["original_title"],
            "year": raw["year"].astype(int),
            "runtime_minutes": to_whole_numbers(raw["runtime_minutes"], "runtime_minutes"),
            "rating": raw["rating_value"].astype(float),
            "vote_count": to_whole_numbers(raw["rating_vote_count"], "rating_vote_count"),
            "title_url": blank_to_none(raw["imdb_url"]),
            "image_url": blank_to_none(raw["image_url"]),
            "primary_genre": blank_to_none(raw["primary_genre"]),
            "genres": raw["genres"].map(split_list),
            "directors": raw["directors"].map(split_list),
            "principal_cast": raw["principal_cast"].map(split_list),
            "cast_names": raw["cast_names"].map(split_list),
            "plot_summary": blank_to_none(raw["plot_summary"]),
        }
    )


def load_availability(path: Path) -> pd.DataFrame:
    raw = read_csv(path)
    original_flag = blank_to_none(raw["original_flag"])
    return pd.DataFrame(
        {
            "title_id": raw["imdb_id"],
            "listed_title": blank_to_none(raw["ampere_title"]),
            "country": raw["country"],
            "platform": raw["platform"],
            "platform_type": raw["platform_type"].str.upper(),
            "original_flag": original_flag,
            "is_original": original_flag.notna() & (original_flag != "Not An Original"),
            "original_platform": blank_to_none(raw["original_platform"]),
            "parent_distributor": blank_to_none(raw["parent_distributor"]),
            "snapshot_month": pd.to_datetime(raw["month_year"]).dt.date,
        }
    )


def load_consumption(path: Path) -> pd.DataFrame:
    raw = read_csv(path)
    return pd.DataFrame(
        {
            "title_id": raw["imdb_id"],
            "month": pd.to_datetime(raw["month"]).dt.date,
            "country": raw["country"],
            "platform": raw["platform"],
            "streams": to_whole_numbers(raw["streams"], "streams"),
            "total_minutes": to_whole_numbers(raw["total_minutes"], "total_minutes"),
        }
    )


def load_themes(path: Path) -> tuple[pd.DataFrame, pd.DataFrame]:
    if not path.exists():
        return (
            pd.DataFrame(columns=["theme_id", "name", "description"]),
            pd.DataFrame(columns=["title_id", "theme_id"]),
        )
    themes = json.loads(path.read_text())["themes"]
    theme_rows = pd.DataFrame(
        [{k: t[k] for k in ("theme_id", "name", "description")} for t in themes]
    )
    membership = pd.DataFrame(
        [{"title_id": tid, "theme_id": t["theme_id"]} for t in themes for tid in t["title_ids"]]
    )
    return theme_rows, membership


def validate(
    movies: pd.DataFrame,
    availability: pd.DataFrame,
    consumption: pd.DataFrame,
    themes: pd.DataFrame,
    movie_themes: pd.DataFrame,
) -> None:
    def check(condition: bool, message: str) -> None:
        if not condition:
            raise DataValidationError(message)

    check(movies["title_id"].is_unique, "movies: duplicated title_id")
    check(
        movies["title_id"].map(lambda v: bool(TITLE_ID_PATTERN.match(str(v)))).all(),
        "movies: title_id does not match ^tt\\d+$",
    )
    check(
        not availability.duplicated(["title_id", "country", "platform", "platform_type"]).any(),
        "availability: duplicated (title_id, country, platform, platform_type)",
    )
    check(
        not consumption.duplicated(["title_id", "month", "country", "platform"]).any(),
        "consumption: duplicated (title_id, month, country, platform)",
    )
    known_ids = set(movies["title_id"])
    check(set(availability["title_id"]) <= known_ids, "availability: unknown title_id")
    check(set(consumption["title_id"]) <= known_ids, "consumption: unknown title_id")
    check(
        bool((consumption[["streams", "total_minutes"]].fillna(0) >= 0).all().all()),
        "consumption: negative metrics",
    )
    check(
        set(availability["platform_type"]) <= {"SVOD", "AVOD"},
        "availability: platform_type outside SVOD/AVOD",
    )
    check(
        set(consumption["country"]) <= set(availability["country"]),
        "consumption: country missing from availability",
    )
    if not movie_themes.empty:
        check(movie_themes["title_id"].is_unique, "movie_themes: a movie has several themes")
        check(set(movie_themes["title_id"]) == known_ids, "movie_themes: movies without theme")
        check(
            set(movie_themes["theme_id"]) <= set(themes["theme_id"]),
            "movie_themes: unknown theme_id",
        )


def write_database(path: Path, tables: dict[str, pd.DataFrame]) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    path.unlink(missing_ok=True)
    with duckdb.connect(str(path)) as con:
        for name, frame in tables.items():
            con.register("frame", frame)
            con.execute(f"CREATE TABLE {name} AS SELECT * FROM frame")
            con.unregister("frame")
        con.execute(
            """
            CREATE TABLE title_distributors AS
            SELECT DISTINCT title_id, parent_distributor AS distributor
            FROM availability
            WHERE parent_distributor IS NOT NULL
            """
        )


def build(raw_dir: Path, themes_path: Path, db_path: Path) -> dict[str, int]:
    movies = load_movies(raw_dir / "dataset_A.csv")
    availability = load_availability(raw_dir / "dataset_B.csv")
    consumption = load_consumption(raw_dir / "dataset_C.csv")
    themes, movie_themes = load_themes(themes_path)
    validate(movies, availability, consumption, themes, movie_themes)

    tables = {
        "movies": movies,
        "availability": availability,
        "consumption": consumption,
        "themes": themes.astype({"theme_id": str, "name": str, "description": str}),
        "movie_themes": movie_themes.astype({"title_id": str, "theme_id": str}),
    }
    write_database(db_path, tables)
    return {name: len(frame) for name, frame in tables.items()}


def main() -> None:
    counts = build(settings.raw_dir, settings.themes_path, settings.db_path)
    for name, count in counts.items():
        print(f"{name}: {count:,}")
    print(f"Wrote {settings.db_path}")


if __name__ == "__main__":
    main()
