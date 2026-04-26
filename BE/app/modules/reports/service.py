from sqlalchemy.ext.asyncio import AsyncSession

from app.common.exceptions import NotFoundException
from app.common.error_codes import ErrorCode
from app.modules.reports import repository
from app.modules.reports.schemas import (
    InterimReportResponse,
    FinalReportCreate,
    FinalReportResponse,
)


async def get_interim_report(db: AsyncSession, visit_no: int) -> InterimReportResponse:
    """
    중간 리포트 조회
    - 얼굴 측정 사진(test_file_arr)과 측정 데이터(test_json) 반환
    """
    visit = await repository.get_visit(db, visit_no)
    if not visit:
        raise NotFoundException(
            error_code=ErrorCode.VISIT_NOT_FOUND,
            message="방문 정보를 찾을 수 없습니다.",
        )
    return InterimReportResponse.model_validate(visit)


async def create_final_report(
    db: AsyncSession,
    visit_no: int,
    request: FinalReportCreate,
) -> FinalReportResponse:
    """
    최종 리포트 생성
    - FE에서 전달한 report_json을 visited 테이블에 저장
    """
    visit = await repository.save_final_report(db, visit_no, request.report_json)
    if not visit:
        raise NotFoundException(
            error_code=ErrorCode.VISIT_NOT_FOUND,
            message="방문 정보를 찾을 수 없습니다.",
        )
    return FinalReportResponse.model_validate(visit)


async def get_final_report(db: AsyncSession, visit_no: int) -> FinalReportResponse:
    """
    최종 리포트 조회
    - report_json + 관련 데이터 반환
    """
    visit = await repository.get_visit(db, visit_no)
    if not visit:
        raise NotFoundException(
            error_code=ErrorCode.VISIT_NOT_FOUND,
            message="방문 정보를 찾을 수 없습니다.",
        )
    return FinalReportResponse.model_validate(visit)