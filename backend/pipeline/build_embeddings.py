"""Embed every movie once and save the vectors (docs/05-search.md).

Run: python -m pipeline.build_embeddings   (after pipeline.build_db)
"""

import json

import duckdb
import numpy as np
from sentence_transformers import SentenceTransformer

from app.config import settings


def build_document(genres: list[str], plot: str | None) -> str:
    # Title, director and cast are left out: in the evaluation their words pulled unrelated
    # movies up ("dark" matched "Orion and the Dark"). See docs/05-search.md.
    lines = []
    if genres:
        lines.append(f"Genres: {', '.join(genres)}")
    if plot:
        lines.append(f"Plot: {plot}")
    # e5 models are trained with "passage: " on documents and "query: " on queries.
    return "passage: " + "\n".join(lines)


def main() -> None:
    with duckdb.connect(str(settings.db_path), read_only=True) as con:
        rows = con.execute(
            "SELECT title_id, genres, plot_summary FROM movies ORDER BY title_id"
        ).fetchall()

    title_ids = [row[0] for row in rows]
    documents = [build_document(*row[1:]) for row in rows]

    model = SentenceTransformer(settings.embedding_model)
    vectors = model.encode(
        documents, batch_size=64, normalize_embeddings=True, show_progress_bar=True
    ).astype("float32")

    np.save(settings.embeddings_path, vectors)
    settings.embedding_ids_path.write_text(json.dumps(title_ids))
    print(f"Saved {vectors.shape} embeddings to {settings.embeddings_path}")


if __name__ == "__main__":
    main()
