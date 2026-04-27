from fastapi import APIRouter, Depends
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import get_db
from app.modules.auth.dependencies import get_token
from app.modules.reports.schemas import (
    InterimReportResponse,
    FinalReportCreate,
    FinalReportResponse,
)
from app.modules.reports import service

router = APIRouter(tags=["reports"])


@router.get("/visits/{visit_no}/report/interim", response_model=InterimReportResponse)
async def get_interim_report(
    visit_no: int,
    auth: dict = Depends(get_token),
    db: AsyncSession = Depends(get_db),
):
    """
    중간 리포트 조회
    - 얼굴 측정 사진(test_file_arr)과 측정 데이터(test_json) 반환
    - FE에서 와이어프레임 + 측정값 표시에 사용
    """
    return await service.get_interim_report(db, visit_no)


@router.post("/visits/{visit_no}/report/final", response_model=FinalReportResponse)
async def create_final_report(
    visit_no: int,
    request: FinalReportCreate,
    auth: dict = Depends(get_token),
    db: AsyncSession = Depends(get_db),
):
    """
    최종 리포트 생성
    - FE에서 종합한 report_json 저장
    - visited 테이블의 report_json 업데이트
    """
    return await service.create_final_report(db, visit_no, request)


@router.get("/visits/{visit_no}/report/final", response_model=FinalReportResponse)
async def get_final_report(
    visit_no: int,
    auth: dict = Depends(get_token),
    db: AsyncSession = Depends(get_db),
):
    """
    최종 리포트 조회
    - report_json + 얼굴측정/추천/가상피팅/실제착용 데이터 반환
    """
    return await service.get_final_report(db, visit_no)