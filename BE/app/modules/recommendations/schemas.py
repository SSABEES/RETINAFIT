from pydantic import BaseModel


class RecommendationRequest(BaseModel):
    customer_id: int | None = None
    face_shape: str | None = None


class RecommendationResponse(BaseModel):
    items: list[dict] = []
