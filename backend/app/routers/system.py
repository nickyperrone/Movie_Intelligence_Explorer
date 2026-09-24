from typing import Annotated

from fastapi import APIRouter, Query

from app import api_models as m
from app.config import API_VERSION, settings
from app.services.movies import filter_options, lookup_people

router = APIRouter(tags=["system"])


@router.get("/health")
def get_health() -> m.Health:
    return m.Health(status="ok", api_version=API_VERSION, llm_enabled=settings.llm_enabled)


@router.get("/filters")
def get_filter_options() -> m.FilterOptions:
    return filter_options()


@router.get("/people/lookup", tags=["movies"])
def get_people(
    q: Annotated[str, Query(min_length=2, max_length=60)],
    limit: Annotated[int, Query(ge=1, le=20)] = 5,
) -> m.PersonList:
    return m.PersonList(results=lookup_people(q, limit))
