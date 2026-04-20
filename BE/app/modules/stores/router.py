from fastapi import APIRouter

from app.modules.stores.schemas import StoreResponse

router = APIRouter()


@router.get("", response_model=list[StoreResponse])
def list_stores() -> list[StoreResponse]:
    return []
