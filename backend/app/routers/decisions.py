from typing import Annotated

from fastapi import APIRouter, HTTPException, Query

from app import api_models as m
from app.services import comparables, concepts

router = APIRouter(prefix="/decisions", tags=["decisions"])

TitleId = Annotated[str, Query(pattern=r"^tt\d+$")]


@router.get("/licensing")
def get_licensing_assessment(
    title_id: TitleId, platform: str, country: str
) -> m.LicensingAssessment:
    assessment = comparables.licensing_assessment(title_id, platform, country)
    if assessment is None:
        raise HTTPException(404, f"Movie {title_id} not found")
    return assessment


@router.get("/markets")
def get_market_opportunities(title_id: TitleId) -> m.MarketOpportunities:
    opportunities = comparables.market_opportunities(title_id)
    if opportunities is None:
        raise HTTPException(404, f"Movie {title_id} not found")
    return opportunities


@router.get("/licensing/memo")
def get_licensing_memo(title_id: TitleId, platform: str, country: str) -> m.LicensingMemo:
    memo = comparables.licensing_memo(title_id, platform, country)
    if memo is None:
        raise HTTPException(404, f"Movie {title_id} not found")
    return memo


@router.post("/concepts")
def evaluate_concepts(request: m.ConceptsRequest) -> m.ConceptsEvaluation:
    return concepts.evaluate_concepts([logline.root for logline in request.loglines])


@router.post("/concepts/memo")
def get_concepts_memo(request: m.ConceptsRequest) -> m.ConceptsMemo:
    return concepts.concepts_memo([logline.root for logline in request.loglines])
