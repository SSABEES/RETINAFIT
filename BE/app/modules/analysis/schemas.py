from pydantic import BaseModel, HttpUrl


class AnalysisRequest(BaseModel):
    image_url: HttpUrl


class AnalysisResponse(BaseModel):
    face_shape: str | None = None
    measurements: dict[str, float] = {}
    recommendations: list[str] = []
