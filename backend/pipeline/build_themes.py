"""Cluster the catalog into themes and name them with the LLM (docs/05-search.md, "Themes").

Run by hand (needs OPENAI_API_KEY): python -m pipeline.build_themes
A person reviews every name in data/curated/themes.json before committing it.
"""

import json

import numpy as np
from pydantic import BaseModel
from sklearn.cluster import KMeans
from sklearn.metrics import silhouette_score

from app.config import settings
from app.db import fetch_all
from app.services import llm

K_RANGE = range(16, 33)
EXAMPLES_PER_THEME = 10

THEME_PROMPT = """You name a group of movies for a streaming catalog browser. You get the movies
closest to the center of the group. Return JSON: {"name": "at most 4 words, specific and plain,
title case", "description": "at most 20 words on what these movies have in common"}. No marketing
words, no quotes, no numbers."""


class ThemeName(BaseModel):
    name: str
    description: str


def choose_k(vectors: np.ndarray) -> tuple[KMeans, float]:
    best: tuple[KMeans, float] | None = None
    for k in K_RANGE:
        model = KMeans(n_clusters=k, random_state=42, n_init=10).fit(vectors)
        score = silhouette_score(vectors, model.labels_, metric="cosine")
        print(f"k={k} silhouette={score:.4f}")
        if best is None or score > best[1]:
            best = (model, score)
    return best


def name_theme(examples: list[dict]) -> ThemeName:
    lines = [
        f"- {e['title']} ({', '.join(e['genres'])}): {(e['plot_summary'] or '')[:300]}"
        for e in examples
    ]
    status, parsed = llm.call_model(
        "name_theme", THEME_PROMPT, "Movies:\n" + "\n".join(lines), 30, ThemeName
    )
    if parsed is None:
        raise SystemExit(f"Theme naming failed with status {status.root}; nothing was written.")
    return parsed


def main() -> None:
    if not settings.llm_enabled:
        raise SystemExit("OPENAI_API_KEY is not set.")
    vectors = np.load(settings.embeddings_path)
    title_ids = json.loads(settings.embedding_ids_path.read_text())
    movies = {row["title_id"]: row for row in fetch_all("SELECT * FROM movies")}

    model, silhouette = choose_k(vectors)
    themes = []
    for cluster in range(model.n_clusters):
        rows = np.where(model.labels_ == cluster)[0]
        centroid = model.cluster_centers_[cluster]
        closest = rows[np.argsort(-(vectors[rows] @ centroid))][:EXAMPLES_PER_THEME]
        named = name_theme([movies[title_ids[row]] for row in closest])
        themes.append(
            {
                "theme_id": f"t{cluster + 1:02d}",
                "name": named.name.strip(),
                "description": named.description.strip(),
                "title_ids": sorted(title_ids[row] for row in rows),
            }
        )
        print(f"t{cluster + 1:02d} {named.name} ({len(rows)} movies)")

    output = {
        "generator": "pipeline/build_themes.py",
        "model": settings.openai_model,
        "k": model.n_clusters,
        "silhouette": round(float(silhouette), 4),
        "themes": themes,
    }
    settings.themes_path.parent.mkdir(parents=True, exist_ok=True)
    settings.themes_path.write_text(json.dumps(output, indent=2, ensure_ascii=False) + "\n")
    print(f"Wrote {settings.themes_path}. Review the names, then run `make data`.")


if __name__ == "__main__":
    main()
