from fastapi import APIRouter, Depends
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import get_db
from app.modules.auth.dependencies import get_token, get_admin_token
from app.modules.recommendations.schemas import (
    RecommendOptionCreate,
    RecommendOptionUpdate,
    RecommendOptionOrderUpdate,
    RecommendOptionResponse,
    RecommendSaveRequest,
    RecommendSaveResponse,
)
from app.modules.recommendations import service

router = APIRouter(tags=["recommendations"])


# ─── 관리자 추천 옵션 CRUD ────────────────────────────────────

@router.get("/admin/recommend-options", response_model=list[RecommendOptionResponse])
async def get_options(
    auth: dict = Depends(get_admin_token),
    db: AsyncSession = Depends(get_db),
):
    """추천 옵션 목록 조회 (표시 순서대로)"""
    return await service.get_options(db)


@router.post("/admin/recommend-options", response_model=RecommendOptionResponse, status_code=201)
async def create_option(
    request: RecommendOptionCreate,
    auth: dict = Depends(get_admin_token),
    db: AsyncSession = Depends(get_db),
):
    """추천 옵션 추가"""
    return await service.create_option(db, request)


@router.patch("/admin/recommend-options/{option_no}", response_model=RecommendOptionResponse)
async def update_option(
    option_no: int,
    request: RecommendOptionUpdate,
    auth: dict = Depends(get_admin_token),
    db: AsyncSession = Depends(get_db),
):
    """추천 옵션 수정"""
    return await service.update_option(db, option_no, request)


@router.delete("/admin/recommend-options/{option_no}", status_code=204)
async def delete_option(
    option_no: int,
    auth: dict = Depends(get_admin_token),
    db: AsyncSession = Depends(get_db),
):
    """추천 옵션 삭제"""
    await service.delete_option(db, option_no)


@router.patch("/admin/recommend-options/{option_no}/order", response_model=RecommendOptionResponse)
async def update_option_order(
    option_no: int,
    request: RecommendOptionOrderUpdate,
    auth: dict = Depends(get_admin_token),
    db: AsyncSession = Depends(get_db),
):
    """추천 옵션 순서 변경"""
    return await service.update_option_order(db, option_no, request.display_order)


# ─── 안경사 추천 선택 ─────────────────────────────────────────

@router.post("/visits/{visit_no}/recommend", response_model=RecommendSaveResponse)
async def save_recommend(
    visit_no: int,
    request: RecommendSaveRequest,
    auth: dict = Depends(get_token),
    db: AsyncSession = Depends(get_db),
):
    """
    안경사 추천 옵션 선택 저장
    - visited 테이블의 opt_recommend_json 업데이트
    """
    return await service.save_recommend(db, visit_no, request)


@router.get("/visits/{visit_no}/recommend", response_model=RecommendSaveResponse)
async def get_recommend(
    visit_no: int,
    auth: dict = Depends(get_token),
    db: AsyncSession = Depends(get_db),
):
    """안경사 추천 옵션 조회"""
    return await service.get_recommend(db, visit_no)