from fastapi import APIRouter

from app import api_models as m
from app.config import API_VERSION, settings
from app.services.movies import filter_options

router = APIRouter(tags=["system"])


@router.get("/health")
def get_health() -> m.Health:
    return m.Health(status="ok", api_version=API_VERSION, llm_enabled=settings.llm_enabled)


@router.get("/filters")
def get_filter_options() -> m.FilterOptions:
    return filter_options()
