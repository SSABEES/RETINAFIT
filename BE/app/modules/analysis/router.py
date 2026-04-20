from fastapi import APIRouter

from app.modules.analysis.schemas import AnalysisRequest, AnalysisResponse
from app.modules.analysis.service import request_analysis

router = APIRouter()


@router.post("", response_model=AnalysisResponse)
def analyze(payload: AnalysisRequest) -> AnalysisResponse:
    return request_analysis(payload)
