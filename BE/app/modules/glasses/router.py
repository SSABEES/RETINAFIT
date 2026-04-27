from fastapi import APIRouter, Depends
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import get_db
from app.modules.auth.dependencies import get_token
from app.modules.glasses.schemas import (
    GlassesCreate,
    GlassesUpdate,
    GlassesResponse,
)
from app.modules.glasses import service

router = APIRouter(tags=["glasses"])


@router.get("/glasses", response_model=list[GlassesResponse])
async def get_glasses_list(
    auth: dict = Depends(get_token),
    db: AsyncSession = Depends(get_db),
):
    """안경 목록 조회 (활성화된 것만)"""
    return await service.get_glasses_list(db)


@router.get("/glasses/{glasses_no}", response_model=GlassesResponse)
async def get_glasses(
    glasses_no: int,
    auth: dict = Depends(get_token),
    db: AsyncSession = Depends(get_db),
):
    """안경 단건 조회"""
    return await service.get_glasses(db, glasses_no)


@router.post("/admin/glasses", response_model=GlassesResponse, status_code=201)
async def create_glasses(
    request: GlassesCreate,
    auth: dict = Depends(get_token),
    db: AsyncSession = Depends(get_db),
):
    """안경 등록 (관리자)"""
    return await service.create_glasses(db, request)


@router.patch("/admin/glasses/{glasses_no}", response_model=GlassesResponse)
async def update_glasses(
    glasses_no: int,
    request: GlassesUpdate,
    auth: dict = Depends(get_token),
    db: AsyncSession = Depends(get_db),
):
    """안경 수정 (관리자)"""
    return await service.update_glasses(db, glasses_no, request)


@router.delete("/admin/glasses/{glasses_no}", status_code=204)
async def delete_glasses(
    glasses_no: int,
    auth: dict = Depends(get_token),
    db: AsyncSession = Depends(get_db),
):
    """안경 비활성화 (관리자)"""
    await service.delete_glasses(db, glasses_no)