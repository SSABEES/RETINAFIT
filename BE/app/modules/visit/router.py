from fastapi import APIRouter

from app.modules.visit.schemas import VisitCreate, VisitResponse

router = APIRouter()


@router.get("", response_model=list[VisitResponse])
def list_visits() -> list[VisitResponse]:
    return []


@router.post("", response_model=VisitResponse)
def create_visit(payload: VisitCreate) -> VisitResponse:
    return VisitResponse(id=1, **payload.model_dump())
