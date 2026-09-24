from typing import Annotated

from fastapi import APIRouter, Depends, Query

from app import api_models as m
from app.services import dashboard
from app.services.dashboard import DashboardRequest

router = APIRouter(prefix="/dashboard", tags=["dashboard"])

MONTH_PATTERN = r"^(19|20)\d{2}-(0[1-9]|1[0-2])$"


def dashboard_request(
    start: Annotated[str | None, Query(pattern=MONTH_PATTERN)] = None,
    end: Annotated[str | None, Query(pattern=MONTH_PATTERN)] = None,
    countries: Annotated[list[str], Query()] = [],
    platforms: Annotated[list[str], Query()] = [],
    genres: Annotated[list[str], Query()] = [],
    distributors: Annotated[list[str], Query()] = [],
) -> DashboardRequest:
    return dashboard.resolve(start, end, countries, platforms, genres, distributors)


Request = Annotated[DashboardRequest, Depends(dashboard_request)]
# FastAPI reads plain Literal types from the query string, not the generated RootModel wrappers.
Dimension = m.BreakdownDimension.model_fields["root"].annotation
Sort = m.TitleSort.model_fields["root"].annotation


@router.get("/summary")
def get_dashboard_summary(request: Request) -> m.DashboardSummary:
    return dashboard.summary(request)


@router.get("/trend")
def get_dashboard_trend(request: Request) -> m.DashboardTrend:
    return dashboard.trend(request)


@router.get("/breakdown")
def get_dashboard_breakdown(request: Request, dimension: Dimension) -> m.DashboardBreakdown:
    return dashboard.breakdown(request, dimension)


@router.get("/matrix")
def get_dashboard_matrix(request: Request) -> m.DashboardMatrix:
    return dashboard.matrix(request)


@router.get("/titles")
def get_dashboard_titles(
    request: Request,
    sort: Sort = "streams",
    limit: Annotated[int, Query(ge=1, le=50)] = 20,
    offset: Annotated[int, Query(ge=0)] = 0,
) -> m.DashboardTitles:
    return dashboard.titles(request, sort, limit, offset)


@router.get("/changes")
def get_dashboard_changes(request: Request) -> m.DashboardChanges:
    return dashboard.changes(request)
