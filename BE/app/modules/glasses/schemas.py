from pydantic import BaseModel


class GlassesResponse(BaseModel):
    id: int
    name: str
    frame_shape: str | None = None
