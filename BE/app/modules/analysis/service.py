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
    return FaceAnalysisResponse.model_validate(visit)


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
    return VirtualFittingResponse.model_validate(visit)


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
    return RealFittingResponse.model_validate(visit)


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
    return RealFittingResponse.model_validate(visit)