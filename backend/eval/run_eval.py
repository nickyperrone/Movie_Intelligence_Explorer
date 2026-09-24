"""Measure search quality and pick the relevance threshold (docs/05-search.md).

Run: python -m eval.run_eval
"""

import re
from pathlib import Path
from typing import Any

import numpy as np
import yaml

from app.db import fetch_all
from app.services.search import SearchIndex, search_index

QUERIES_PATH = Path(__file__).with_name("queries.yaml")
Z_THRESHOLDS = [2.0, 2.5, 3.0, 3.5]


def matches(movie: dict[str, Any], rule: dict[str, Any]) -> bool:
    if "any_of" in rule:
        return any(matches(movie, sub_rule) for sub_rule in rule["any_of"])
    genres = set(movie["genres"] or [])
    if "genres_all" in rule and not set(rule["genres_all"]) <= genres:
        return False
    if "genres_any" in rule and not set(rule["genres_any"]) & genres:
        return False
    if "plot" in rule and not re.search(rule["plot"], movie["plot_summary"] or "", re.IGNORECASE):
        return False
    return True


def z_scores(index: SearchIndex, query: str) -> np.ndarray:
    scores = index.vectors @ index.embed_query(query)
    return (scores - scores.mean()) / scores.std()


def precision(relevant_flags: list[bool], k: int) -> float:
    return sum(relevant_flags[:k]) / k


def main() -> None:
    spec = yaml.safe_load(QUERIES_PATH.read_text())
    index = search_index()
    movies = {row["title_id"]: row for row in fetch_all("SELECT * FROM movies")}

    print("| # | Query | P@5 | P@10 | Top score |")
    print("|---|---|---|---|---|")
    p5_values = []
    positive_scores = []
    for number, case in enumerate(spec["positive"], start=1):
        ranked = index.rank_text(case["query"], limit=10)
        flags = [matches(movies[title_id], case) for title_id, _ in ranked]
        p5, p10 = precision(flags, 5), precision(flags, 10)
        p5_values.append(p5)
        positive_scores.append(z_scores(index, case["query"]))
        brief = " (brief)" if case.get("from_brief") else ""
        print(f"| {number} | {case['query']}{brief} | {p5:.2f} | {p10:.2f} | {ranked[0][1]:.3f} |")
    print(f"\nMean P@5: {sum(p5_values) / len(p5_values):.2f}\n")

    negative_scores = [z_scores(index, query) for query in spec["negative"]]
    print("| Minimum z | Min results (positive) | Max results (negative) |")
    print("|---|---|---|")
    for threshold in Z_THRESHOLDS:
        min_positive = min(int((z >= threshold).sum()) for z in positive_scores)
        max_negative = max(int((z >= threshold).sum()) for z in negative_scores)
        print(f"| {threshold:.1f} | {min_positive} | {max_negative} |")


if __name__ == "__main__":
    main()
