from fastapi import APIRouter, Depends
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import get_db
from app.modules.auth.dependencies import get_token, get_admin_token
from app.modules.fitting.schemas import (
    FittingCriteriaCreate,
    FittingCriteriaUpdate,
    FittingCriteriaResponse,
)
from app.modules.fitting import service

router = APIRouter(tags=["fitting"])


@router.get("/admin/fitting-criteria", response_model=list[FittingCriteriaResponse])
async def get_criterias(
    admin: dict = Depends(get_admin_token),
    db: AsyncSession = Depends(get_db),
):
    """판단 기준 목록 조회"""
    return await service.get_criterias(db)


@router.post("/admin/fitting-criteria", response_model=FittingCriteriaResponse, status_code=201)
async def create_criteria(
    request: FittingCriteriaCreate,
    admin: dict = Depends(get_admin_token),
    db: AsyncSession = Depends(get_db),
):
    """판단 기준 추가"""
    return await service.create_criteria(db, request)


@router.patch("/admin/fitting-criteria/{criteria_no}", response_model=FittingCriteriaResponse)
async def update_criteria(
    criteria_no: int,
    request: FittingCriteriaUpdate,
    admin: dict = Depends(get_admin_token),
    db: AsyncSession = Depends(get_db),
):
    """판단 기준 수정"""
    return await service.update_criteria(db, criteria_no, request)


@router.delete("/admin/fitting-criteria/{criteria_no}", status_code=204)
async def delete_criteria(
    criteria_no: int,
    admin: dict = Depends(get_admin_token),
    db: AsyncSession = Depends(get_db),
):
    """판단 기준 삭제"""
    await service.delete_criteria(db, criteria_no)

# 안경사용 판단 기준 조회
@router.get("/fitting-criteria", response_model=list[FittingCriteriaResponse])
async def get_criterias_for_optician(
    auth: dict = Depends(get_token),
    db: AsyncSession = Depends(get_db),
):
    """판단 기준 목록 조회 (안경사용)"""
    return await service.get_criterias(db)