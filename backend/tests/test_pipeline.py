import json

import numpy as np
import pandas as pd
import pytest

from app.config import settings
from app.db import fetch_one
from pipeline.build_db import (
    DataValidationError,
    load_availability,
    load_consumption,
    load_movies,
    to_whole_numbers,
    validate,
)


@pytest.fixture(scope="module")
def frames():
    return (
        load_movies(settings.raw_dir / "dataset_A.csv"),
        load_availability(settings.raw_dir / "dataset_B.csv"),
        load_consumption(settings.raw_dir / "dataset_C.csv"),
    )


def run_validate(movies, availability, consumption, themes=None, movie_themes=None):
    validate(
        movies,
        availability,
        consumption,
        themes if themes is not None else pd.DataFrame(columns=["theme_id"]),
        movie_themes if movie_themes is not None else pd.DataFrame(columns=["title_id"]),
    )


def test_raw_data_passes_validation(frames):
    run_validate(*frames)


def test_duplicated_movie_id_fails(frames):
    movies, availability, consumption = frames
    with pytest.raises(DataValidationError, match="duplicated title_id"):
        run_validate(pd.concat([movies, movies.head(1)]), availability, consumption)


def test_malformed_movie_id_fails(frames):
    movies, availability, consumption = frames
    bad = movies.copy()
    bad.loc[0, "title_id"] = "12345"
    with pytest.raises(DataValidationError, match="does not match"):
        run_validate(bad, availability, consumption)


def test_duplicated_availability_grain_fails(frames):
    movies, availability, consumption = frames
    with pytest.raises(DataValidationError, match="availability: duplicated"):
        run_validate(movies, pd.concat([availability, availability.head(1)]), consumption)


def test_duplicated_consumption_grain_fails(frames):
    movies, availability, consumption = frames
    with pytest.raises(DataValidationError, match="consumption: duplicated"):
        run_validate(movies, availability, pd.concat([consumption, consumption.head(1)]))


def test_unknown_title_in_consumption_fails(frames):
    movies, availability, consumption = frames
    bad = consumption.copy()
    bad.loc[0, "title_id"] = "tt0000000"
    with pytest.raises(DataValidationError, match="consumption: unknown title_id"):
        run_validate(movies, availability, bad)


def test_negative_metric_fails(frames):
    movies, availability, consumption = frames
    bad = consumption.copy()
    bad.loc[0, "streams"] = -1
    with pytest.raises(DataValidationError, match="negative"):
        run_validate(movies, availability, bad)


def test_unknown_platform_type_fails(frames):
    movies, availability, consumption = frames
    bad = availability.copy()
    bad.loc[0, "platform_type"] = "TVOD"
    with pytest.raises(DataValidationError, match="platform_type"):
        run_validate(movies, bad, consumption)


def test_consumption_country_missing_from_availability_fails(frames):
    movies, availability, consumption = frames
    bad = consumption.copy()
    bad.loc[0, "country"] = "Uruguay"
    with pytest.raises(DataValidationError, match="country missing"):
        run_validate(movies, availability, bad)


def test_movie_without_theme_fails(frames):
    movies, availability, consumption = frames
    themes = pd.DataFrame({"theme_id": ["t01"]})
    movie_themes = pd.DataFrame({"title_id": movies["title_id"].iloc[1:], "theme_id": "t01"})
    with pytest.raises(DataValidationError, match="without theme"):
        run_validate(movies, availability, consumption, themes, movie_themes)


def test_fractional_metric_fails():
    with pytest.raises(DataValidationError, match="fractional"):
        to_whole_numbers(pd.Series([1.0, 2.5]), "streams")


def test_database_matches_raw_files():
    raw_c = pd.read_csv(settings.raw_dir / "dataset_C.csv", encoding="utf-8-sig")
    counts = {
        table: fetch_one(f"SELECT count(*) AS n FROM {table}")["n"]
        for table in ("movies", "availability", "consumption")
    }
    total_streams = fetch_one("SELECT sum(streams) AS total FROM consumption")["total"]
    assert counts == {"movies": 1590, "availability": 10358, "consumption": 62022}
    assert total_streams == raw_c["streams"].sum()


def test_embeddings_are_normalized_and_aligned():
    vectors = np.load(settings.embeddings_path)
    ids = json.loads(settings.embedding_ids_path.read_text())
    assert vectors.shape == (1590, 1024)
    assert ids == sorted(ids)
    np.testing.assert_allclose(np.linalg.norm(vectors, axis=1), 1.0, atol=1e-4)
