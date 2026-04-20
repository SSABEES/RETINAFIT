from fastapi import APIRouter

from app.modules.fitting.schemas import FittingRequest, FittingResponse

router = APIRouter()


@router.post("", response_model=FittingResponse)
def create_fitting(payload: FittingRequest) -> FittingResponse:
    return FittingResponse(result_image_url=payload.image_url)
