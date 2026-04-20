from fastapi import APIRouter

from app.modules.staff.schemas import StaffResponse

router = APIRouter()


@router.get("", response_model=list[StaffResponse])
def list_staff() -> list[StaffResponse]:
    return []
