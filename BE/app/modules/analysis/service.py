from app.modules.analysis.client import analyze_image
from app.modules.analysis.schemas import AnalysisRequest, AnalysisResponse


def request_analysis(payload: AnalysisRequest) -> AnalysisResponse:
    return analyze_image(payload)
