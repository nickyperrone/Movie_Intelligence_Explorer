from typing import Annotated

from fastapi import APIRouter, Query

from app import api_models as m
from app.services.search import search_catalog

router = APIRouter(tags=["search"])


@router.get("/search")
def search_movies(
    q: Annotated[str, Query(min_length=2, max_length=200)],
    interpret: bool = True,
    genres: Annotated[list[str], Query()] = [],
    year_min: Annotated[int | None, Query(ge=1900, le=2100)] = None,
    year_max: Annotated[int | None, Query(ge=1900, le=2100)] = None,
    countries: Annotated[list[str], Query()] = [],
    platforms: Annotated[list[str], Query()] = [],
    people: Annotated[list[str], Query(max_length=3)] = [],
    limit: Annotated[int, Query(ge=1, le=50)] = 20,
) -> m.SearchResponse:
    explicit = m.SearchFilters(
        genres=genres,
        year_min=year_min,
        year_max=year_max,
        countries=countries,
        platforms=platforms,
        people=people,
    )
    return search_catalog(q, interpret, explicit, limit)
