from fastapi import APIRouter

from app.api.schemas import AnalysisRequest, AnalysisResponse
from app.pipelines.measurement_pipeline import run_measurement_pipeline

router = APIRouter()


@router.post("/analyze", response_model=AnalysisResponse)
def analyze(payload: AnalysisRequest) -> AnalysisResponse:
    measurements = run_measurement_pipeline(payload.image_url)
    return AnalysisResponse(measurements=measurements, recommendations=[])
