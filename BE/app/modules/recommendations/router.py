from fastapi import APIRouter

from app.modules.recommendations.schemas import RecommendationRequest, RecommendationResponse

router = APIRouter()


@router.post("", response_model=RecommendationResponse)
def recommend(payload: RecommendationRequest) -> RecommendationResponse:
    return RecommendationResponse(items=[])
