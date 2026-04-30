from fastapi import APIRouter, Depends
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import get_db
from app.modules.auth.dependencies import get_admin_token
from app.modules.recommendations.schemas import (
    RecommendOptionCreate,
    RecommendOptionUpdate,
    RecommendOptionResponse,
)
from app.modules.recommendations import service

router = APIRouter(tags=["recommendations"])


# ─── 관리자 추천 옵션 CRUD ────────────────────────────────────

@router.get("/admin/recommend-options", response_model=list[RecommendOptionResponse], summary="(관리자) 추천 옵션 목록 조회")
async def get_options(
    auth: dict = Depends(get_admin_token),
    db: AsyncSession = Depends(get_db),
):
    """추천 옵션 목록 조회 (표시 순서대로)"""
    return await service.get_options(db)


@router.post("/admin/recommend-options", response_model=RecommendOptionResponse, status_code=201, summary="(관리자) 추천 옵션 등록")
async def create_option(
    request: RecommendOptionCreate,
    auth: dict = Depends(get_admin_token),
    db: AsyncSession = Depends(get_db),
):
    """추천 옵션 추가"""
    return await service.create_option(db, request)


@router.patch("/admin/recommend-options/{option_no}", response_model=RecommendOptionResponse, summary="(관리자) 추천 옵션 수정")
async def update_option(
    option_no: int,
    request: RecommendOptionUpdate,
    auth: dict = Depends(get_admin_token),
    db: AsyncSession = Depends(get_db),
):
    """추천 옵션 수정"""
    return await service.update_option(db, option_no, request)


@router.delete("/admin/recommend-options/{option_no}", status_code=204, summary="(관리자) 추천 옵션 삭제")
async def delete_option(
    option_no: int,
    auth: dict = Depends(get_admin_token),
    db: AsyncSession = Depends(get_db),
):
    """추천 옵션 삭제"""
    await service.delete_option(db, option_no)