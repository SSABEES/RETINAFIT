from fastapi import APIRouter

from app.modules.reports.schemas import ReportResponse

router = APIRouter()


@router.get("", response_model=list[ReportResponse])
def list_reports() -> list[ReportResponse]:
    return []
