from typing import Annotated

from fastapi import APIRouter, HTTPException, Path, Query

from app import api_models as m
from app.services import movies, performance
from app.services.search import search_index

router = APIRouter(prefix="/movies", tags=["movies"])

TitleId = Annotated[str, Path(pattern=r"^tt\d+$")]


def require_movie(title_id: str) -> None:
    if not movies.movie_exists(title_id):
        raise HTTPException(404, f"Movie {title_id} not found")


@router.get("/lookup")
def lookup_movies(
    q: Annotated[str, Query(min_length=1, max_length=100)],
    limit: Annotated[int, Query(ge=1, le=20)] = 10,
) -> m.MovieList:
    return m.MovieList(results=movies.lookup(q, limit))


@router.get("/{title_id}")
def get_movie(title_id: TitleId) -> m.MovieDetail:
    detail = movies.movie_detail(title_id)
    if detail is None:
        raise HTTPException(404, f"Movie {title_id} not found")
    return detail


@router.get("/{title_id}/availability")
def get_movie_availability(title_id: TitleId) -> m.Availability:
    require_movie(title_id)
    return movies.availability(title_id)


@router.get("/{title_id}/performance")
def get_movie_performance(
    title_id: TitleId,
    countries: Annotated[list[str], Query()] = [],
    platforms: Annotated[list[str], Query()] = [],
) -> m.Performance:
    require_movie(title_id)
    return performance.performance(title_id, countries, platforms)


@router.get("/{title_id}/similar")
def get_similar_movies(
    title_id: TitleId, limit: Annotated[int, Query(ge=1, le=20)] = 8
) -> m.ScoredMovieList:
    require_movie(title_id)
    ranked = search_index().similar(title_id, limit=limit)
    found = movies.summaries([tid for tid, _ in ranked])
    return m.ScoredMovieList(
        results=[m.ScoredMovie(movie=found[tid], score=score) for tid, score in ranked]
    )


@router.get("/{title_id}/insight")
def get_movie_insight(title_id: TitleId) -> m.Insight:
    detail = movies.movie_detail(title_id)
    if detail is None:
        raise HTTPException(404, f"Movie {title_id} not found")
    return performance.insight(title_id, detail.title)
