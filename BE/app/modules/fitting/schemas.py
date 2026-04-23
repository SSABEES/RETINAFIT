from pydantic import BaseModel, HttpUrl


class FittingRequest(BaseModel):
    image_url: HttpUrl
    glasses_id: int


class FittingResponse(BaseModel):
    result_image_url: HttpUrl
