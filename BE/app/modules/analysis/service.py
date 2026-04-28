from sqlalchemy.ext.asyncio import AsyncSession

from app.common.exceptions import NotFoundException
from app.common.error_codes import ErrorCode
from app.modules.analysis import repository
from app.modules.analysis.schemas import (
    FaceAnalysisRequest,
    FaceAnalysisResponse,
    VirtualFittingRequest,
    VirtualFittingResponse,
    RealFittingRequest,
    RealFittingResponse,
)

from app.common.s3_utils import get_presigned_download_url

def _convert_file_urls(file_arr: list | None) -> list | None:
    """파일 배열의 key → 조회용 Presigned URL 변환"""
    if not file_arr:
        return file_arr
    return [get_presigned_download_url(key) if key else key for key in file_arr]

def _convert_real_vp_urls(real_vp_json: list | None) -> list | None:
    """real_vp_json의 파일 key → 조회용 Presigned URL 변환"""
    if not real_vp_json:
        return real_vp_json
    for attempt in real_vp_json:
        files = attempt.get("files", {})
        if files.get("front_key"):
            files["front_url"] = get_presigned_download_url(files["front_key"])
        if files.get("left_key"):
            files["left_url"] = get_presigned_download_url(files["left_key"])
        if files.get("right_key"):
            files["right_url"] = get_presigned_download_url(files["right_key"])
    return real_vp_json

# ─── 얼굴 측정 ────────────────────────────────────────────────

async def save_face_analysis(
    db: AsyncSession,
    visit_no: int,
    request: FaceAnalysisRequest,
) -> FaceAnalysisResponse:
    """얼굴 측정 데이터 저장"""
    visit = await repository.update_face_analysis(
        db=db,
        visit_no=visit_no,
        main_file=request.main_file,
        test_file_arr=request.test_file_arr,
        test_json=request.test_json,
    )
    if not visit:
        raise NotFoundException(
            error_code=ErrorCode.VISIT_NOT_FOUND,
            message="방문 정보를 찾을 수 없습니다.",
        )
    return FaceAnalysisResponse.model_validate(visit)


async def get_face_analysis(
    db: AsyncSession,
    visit_no: int,
) -> FaceAnalysisResponse:
    """얼굴 측정 결과 조회"""
    visit = await repository.get_visit(db, visit_no)
    if not visit:
        raise NotFoundException(
            error_code=ErrorCode.VISIT_NOT_FOUND,
            message="방문 정보를 찾을 수 없습니다.",
        )
    data = FaceAnalysisResponse.model_validate(visit)
    data.main_file = get_presigned_download_url(data.main_file) if data.main_file else None
    data.test_file_arr = _convert_file_urls(data.test_file_arr)
    return data


# ─── 가상 피팅 ────────────────────────────────────────────────

async def save_virtual_fitting(
    db: AsyncSession,
    visit_no: int,
    request: VirtualFittingRequest,
) -> VirtualFittingResponse:
    """가상 피팅 데이터 저장"""
    visit = await repository.update_virtual_fitting(
        db=db,
        visit_no=visit_no,
        vp_file_arr=request.vp_file_arr,
        vp_json=request.vp_json,
    )
    if not visit:
        raise NotFoundException(
            error_code=ErrorCode.VISIT_NOT_FOUND,
            message="방문 정보를 찾을 수 없습니다.",
        )
    return VirtualFittingResponse.model_validate(visit)


async def get_virtual_fitting(
    db: AsyncSession,
    visit_no: int,
) -> VirtualFittingResponse:
    """가상 피팅 결과 조회"""
    visit = await repository.get_visit(db, visit_no)
    if not visit:
        raise NotFoundException(
            error_code=ErrorCode.VISIT_NOT_FOUND,
            message="방문 정보를 찾을 수 없습니다.",
        )
    data = VirtualFittingResponse.model_validate(visit)
    data.vp_file_arr = _convert_file_urls(data.vp_file_arr)
    return data


# ─── 실제 착용 ────────────────────────────────────────────────

async def save_real_fitting(
    db: AsyncSession,
    visit_no: int,
    request: RealFittingRequest,
) -> RealFittingResponse:
    """실제 착용 데이터 저장"""
    visit = await repository.update_real_fitting(
        db=db,
        visit_no=visit_no,
        real_vp_json=request.real_vp_json,
    )
    if not visit:
        raise NotFoundException(
            error_code=ErrorCode.VISIT_NOT_FOUND,
            message="방문 정보를 찾을 수 없습니다.",
        )
    data = RealFittingResponse.model_validate(visit)
    data.real_vp_json = _convert_real_vp_urls(data.real_vp_json)
    return data


async def get_real_fitting(
    db: AsyncSession,
    visit_no: int,
) -> RealFittingResponse:
    """실제 착용 결과 조회"""
    visit = await repository.get_visit(db, visit_no)
    if not visit:
        raise NotFoundException(
            error_code=ErrorCode.VISIT_NOT_FOUND,
            message="방문 정보를 찾을 수 없습니다.",
        )
    data = RealFittingResponse.model_validate(visit)
    data.real_vp_json = _convert_real_vp_urls(data.real_vp_json)
    return data