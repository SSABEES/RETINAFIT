from fastapi import APIRouter, Depends, Query
from sqlalchemy.ext.asyncio import AsyncSession
from typing import Literal
from app.core.config import settings

from app.core.database import get_db
from app.modules.auth.dependencies import get_token, get_admin_token
from app.modules.glasses.schemas import (
    GlassesCreate,
    GlassesUpdate,
    GlassesResponse,
)
from app.modules.glasses import service
from app.common.s3_utils import generate_presigned_url, generate_object_key

router = APIRouter(tags=["glasses"])


# ─── 안경사용 ─────────────────────────────────────────────────

@router.get("/glasses", response_model=list[GlassesResponse], summary="안경 전체(목록) 조회")
async def get_glasses_list(
    auth: dict = Depends(get_token),
    db: AsyncSession = Depends(get_db),
):
    """안경 목록 조회"""
    return await service.get_glasses_list(db)


@router.get("/glasses/{glasses_no}", response_model=GlassesResponse, summary="선택 안경 상세 조회")
async def get_glasses(
    glasses_no: int,
    auth: dict = Depends(get_token),
    db: AsyncSession = Depends(get_db),
):
    """안경 상세 조회"""
    return await service.get_glasses(db, glasses_no)


# ─── 관리자용 ─────────────────────────────────────────────────

@router.get("/admin/glasses", response_model=list[GlassesResponse], summary="(관리자) 안경 목록 조회")
async def get_glasses_list_admin(
    admin: dict = Depends(get_admin_token),
    db: AsyncSession = Depends(get_db),
):
    """안경 목록 조회 (관리자)"""
    return await service.get_glasses_list(db)


@router.post("/admin/glasses", response_model=GlassesResponse, status_code=201, summary="(관리자) 안경 등록")
async def create_glasses(
    request: GlassesCreate,
    admin: dict = Depends(get_admin_token),
    db: AsyncSession = Depends(get_db),
):
    """안경 등록"""
    return await service.create_glasses(db, request)


@router.patch("/admin/glasses/{glasses_no}", response_model=GlassesResponse, summary="(관리자) 안경 수정")
async def update_glasses(
    glasses_no: int,
    request: GlassesUpdate,
    admin: dict = Depends(get_admin_token),
    db: AsyncSession = Depends(get_db),
):
    """안경 수정"""
    return await service.update_glasses(db, glasses_no, request)


@router.delete("/admin/glasses/{glasses_no}", status_code=204, summary="(관리자) 안경 삭제")
async def delete_glasses(
    glasses_no: int,
    admin: dict = Depends(get_admin_token),
    db: AsyncSession = Depends(get_db),
):
    """안경 삭제"""
    await service.delete_glasses(db, glasses_no)


@router.post("/admin/glasses/upload", summary="(관리자) 안경 이미지/3D 업로드 URL 발급")
async def get_glasses_upload_url(
    type: Literal["img", "3d"] = Query(description="업로드 파일 타입: img 또는 3d"),
    admin: dict = Depends(get_admin_token),
):
    """
    안경 이미지/3D 파일 업로드 URL 발급
    - type=img → 대표 이미지 (.jpg)
    - type=3d  → 3D 파일 (.glb)
    """
    if type == "img":
        key = generate_object_key(folder=settings.S3_GLASSES_IMG_PATH)
        url = generate_presigned_url(key)
        return {"url": url, "key": key}
    else:
        key = generate_object_key(folder=settings.S3_GLASSES_3D_PATH, extension="glb")
        url = generate_presigned_url(key, content_type="application/octet-stream")
        return {"url": url, "key": key}