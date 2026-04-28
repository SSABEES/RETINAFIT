from sqlalchemy.ext.asyncio import AsyncSession

from app.common.exceptions import NotFoundException
from app.common.error_codes import ErrorCode
from app.modules.reports import repository
from app.modules.reports.schemas import (
    InterimReportResponse,
    FinalReportCreate,
    FinalReportResponse,
)

from app.common.s3_utils import get_presigned_download_url

def _convert_file_urls(file_arr: list | None) -> list | None:
    """파일 배열의 key → 조회용 Presigned URL 변환"""
    if not file_arr:
        return file_arr
    return [get_presigned_download_url(key) if key else key for key in file_arr]


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
    data = InterimReportResponse.model_validate(visit)
    data.main_file = get_presigned_download_url(data.main_file) if data.main_file else None
    data.test_file_arr = _convert_file_urls(data.test_file_arr)
    return data


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
    data = FinalReportResponse.model_validate(visit)
    data.vp_file_arr = _convert_file_urls(data.vp_file_arr)
    return data


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
    data = FinalReportResponse.model_validate(visit)
    data.vp_file_arr = _convert_file_urls(data.vp_file_arr)
    return data