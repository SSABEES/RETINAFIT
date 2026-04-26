from fastapi import APIRouter, Depends
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import get_db
from app.modules.auth.dependencies import get_token
from app.modules.analysis.schemas import (
    FaceAnalysisRequest,
    FaceAnalysisResponse,
    VirtualFittingRequest,
    VirtualFittingResponse,
    RealFittingRequest,
    RealFittingResponse,
)
from app.modules.analysis import service

router = APIRouter(tags=["analysis"])


# ─── 얼굴 측정 ────────────────────────────────────────────────

@router.post("/visits/{visit_no}/face", response_model=FaceAnalysisResponse)
async def save_face_analysis(
    visit_no: int,
    request: FaceAnalysisRequest,
    auth: dict = Depends(get_token),
    db: AsyncSession = Depends(get_db),
):
    """
    얼굴 측정 데이터 저장
    - FE에서 MediaPipe로 측정한 데이터 수신
    - visited 테이블의 main_file, test_file_arr, test_json, test_dt 업데이트
    """
    return await service.save_face_analysis(db, visit_no, request)


@router.get("/visits/{visit_no}/face", response_model=FaceAnalysisResponse)
async def get_face_analysis(
    visit_no: int,
    auth: dict = Depends(get_token),
    db: AsyncSession = Depends(get_db),
):
    """얼굴 측정 결과 조회"""
    return await service.get_face_analysis(db, visit_no)


# ─── 가상 피팅 ────────────────────────────────────────────────

@router.post("/visits/{visit_no}/vp", response_model=VirtualFittingResponse)
async def save_virtual_fitting(
    visit_no: int,
    request: VirtualFittingRequest,
    auth: dict = Depends(get_token),
    db: AsyncSession = Depends(get_db),
):
    """
    가상 피팅 데이터 저장
    - FE에서 AR로 가상 피팅한 사진 3장 + 데이터 수신
    - visited 테이블의 vp_file_arr, vp_json, vp_dt 업데이트
    """
    return await service.save_virtual_fitting(db, visit_no, request)


@router.get("/visits/{visit_no}/vp", response_model=VirtualFittingResponse)
async def get_virtual_fitting(
    visit_no: int,
    auth: dict = Depends(get_token),
    db: AsyncSession = Depends(get_db),
):
    """가상 피팅 결과 조회"""
    return await service.get_virtual_fitting(db, visit_no)


# ─── 실제 착용 ────────────────────────────────────────────────

@router.post("/visits/{visit_no}/real-vp", response_model=RealFittingResponse)
async def save_real_fitting(
    visit_no: int,
    request: RealFittingRequest,
    auth: dict = Depends(get_token),
    db: AsyncSession = Depends(get_db),
):
    """
    실제 착용 데이터 저장
    - 실제 안경 착용 후 측정 데이터 수신
    - visited 테이블의 real_vp_json, real_vp_dt 업데이트
    """
    return await service.save_real_fitting(db, visit_no, request)


@router.get("/visits/{visit_no}/real-vp", response_model=RealFittingResponse)
async def get_real_fitting(
    visit_no: int,
    auth: dict = Depends(get_token),
    db: AsyncSession = Depends(get_db),
):
    """실제 착용 결과 조회"""
    return await service.get_real_fitting(db, visit_no)