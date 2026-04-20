from fastapi import APIRouter

from app.modules.glasses.schemas import GlassesResponse

router = APIRouter()


@router.get("", response_model=list[GlassesResponse])
def list_glasses() -> list[GlassesResponse]:
    return []
