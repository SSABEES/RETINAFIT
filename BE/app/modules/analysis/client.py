from app.modules.analysis.schemas import AnalysisRequest, AnalysisResponse


def analyze_image(payload: AnalysisRequest) -> AnalysisResponse:
    return AnalysisResponse(
        face_shape=None,
        measurements={},
        recommendations=[],
    )
