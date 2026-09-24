"""Embedding index over the catalog (docs/05-search.md)."""

import json
from functools import cache

import numpy as np
from sentence_transformers import SentenceTransformer

from app import api_models as m
from app.config import settings
from app.services import llm, movies


class SearchIndex:
    def __init__(self, model: SentenceTransformer, vectors: np.ndarray, title_ids: list[str]):
        self.model = model
        self.vectors = vectors
        self.title_ids = title_ids
        self.row_of = {title_id: row for row, title_id in enumerate(title_ids)}

    def embed_query(self, text: str) -> np.ndarray:
        # e5 expects the "query: " prefix on queries ("passage: " was used for documents).
        return self.model.encode("query: " + text, normalize_embeddings=True).astype("float32")

    def vector_of(self, title_id: str) -> np.ndarray:
        return self.vectors[self.row_of[title_id]]

    def rank_vector(
        self,
        vector: np.ndarray,
        allowed_ids: set[str] | None = None,
        exclude_id: str | None = None,
        limit: int = 20,
        min_z: float | None = None,
    ) -> list[tuple[str, float]]:
        scores = self.vectors @ vector
        # e5 scores sit in a narrow band (0.75-0.85) for any text, so an absolute cutoff cannot
        # tell a real match from noise. The cutoff is relative to this query's score distribution.
        cutoff = scores.mean() + min_z * scores.std() if min_z is not None else None
        results = []
        for row in np.argsort(-scores):
            score = float(scores[row])
            if cutoff is not None and score < cutoff:
                break
            title_id = self.title_ids[row]
            if title_id == exclude_id or (allowed_ids is not None and title_id not in allowed_ids):
                continue
            results.append((title_id, round(score, 4)))
            if len(results) == limit:
                break
        return results

    def rank_text(
        self,
        text: str,
        allowed_ids: set[str] | None = None,
        limit: int = 20,
        min_z: float | None = None,
    ) -> list[tuple[str, float]]:
        return self.rank_vector(
            self.embed_query(text), allowed_ids=allowed_ids, limit=limit, min_z=min_z
        )

    def similar(
        self, title_id: str, limit: int = 8, allowed_ids: set[str] | None = None
    ) -> list[tuple[str, float]]:
        return self.rank_vector(
            self.vector_of(title_id), allowed_ids=allowed_ids, exclude_id=title_id, limit=limit
        )


@cache
def search_index() -> SearchIndex:
    return SearchIndex(
        model=SentenceTransformer(settings.embedding_model),
        vectors=np.load(settings.embeddings_path),
        title_ids=json.loads(settings.embedding_ids_path.read_text()),
    )


def merge_filters(explicit: m.SearchFilters, proposed: m.SearchFilters | None) -> m.SearchFilters:
    """Explicit request filters override the LLM's proposed filters, field by field."""
    if proposed is None:
        return explicit
    return m.SearchFilters(
        genres=explicit.genres or proposed.genres,
        year_min=explicit.year_min if explicit.year_min is not None else proposed.year_min,
        year_max=explicit.year_max if explicit.year_max is not None else proposed.year_max,
        countries=explicit.countries or proposed.countries,
        platforms=explicit.platforms or proposed.platforms,
        people=explicit.people or proposed.people,
    )


def search_catalog(
    query: str, interpret: bool, explicit: m.SearchFilters, limit: int
) -> m.SearchResponse:
    query = query.strip()
    if interpret:
        interpretation = llm.interpret_query(query, movies.filter_options())
    else:
        interpretation = m.Interpretation(
            status=m.LlmStatus("skipped"), semantic_query=None, proposed_filters=None
        )
    semantic_query = interpretation.semantic_query or query
    applied = merge_filters(explicit, interpretation.proposed_filters)
    if not applied.people and (person := movies.exact_person(query)):
        # A bare actor or director name becomes a people filter, with or without the LLM.
        applied = applied.model_copy(update={"people": [person]})
    allowed_ids = movies.candidate_ids(applied)
    # With filters the user has already chosen the candidates; they are ranked, not cut.
    ranked = search_index().rank_text(
        semantic_query,
        allowed_ids=allowed_ids,
        limit=limit,
        min_z=settings.min_relevance_z if allowed_ids is None else None,
    )
    found = movies.summaries([title_id for title_id, _ in ranked])
    return m.SearchResponse(
        query=query,
        semantic_query=semantic_query,
        interpretation=interpretation,
        applied_filters=applied,
        results=[m.ScoredMovie(movie=found[tid], score=score) for tid, score in ranked],
    )
