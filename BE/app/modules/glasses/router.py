from fastapi import APIRouter, Depends
from sqlalchemy.ext.asyncio import AsyncSession

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


# 관리자용 안경 목록 조회
@router.get("/admin/glasses", response_model=list[GlassesResponse])
async def get_glasses_list_admin(
    admin: dict = Depends(get_admin_token),
    db: AsyncSession = Depends(get_db),
):
    """안경 목록 조회 (관리자용)"""
    return await service.get_glasses_list(db)

@router.post("/admin/glasses", response_model=GlassesResponse, status_code=201)
async def create_glasses(
    request: GlassesCreate,
    admin: dict = Depends(get_admin_token),
    db: AsyncSession = Depends(get_db),
):
    """안경 등록 (관리자)"""
    return await service.create_glasses(db, request)


@router.patch("/admin/glasses/{glasses_no}", response_model=GlassesResponse)
async def update_glasses(
    glasses_no: int,
    request: GlassesUpdate,
    admin: dict = Depends(get_admin_token),
    db: AsyncSession = Depends(get_db),
):
    """안경 수정 (관리자)"""
    return await service.update_glasses(db, glasses_no, request)


@router.delete("/admin/glasses/{glasses_no}", status_code=204)
async def delete_glasses(
    glasses_no: int,
    admin: dict = Depends(get_admin_token),
    db: AsyncSession = Depends(get_db),
):
    """안경 비활성화 (관리자)"""
    await service.delete_glasses(db, glasses_no)


@router.post("/admin/glasses/files/img")
async def get_glasses_img_presigned_url(
    admin: dict = Depends(get_admin_token),
):
    """안경 대표 이미지 Presigned URL 발급 (.jpg)"""
    img_key = generate_object_key(0, "glasses/img")
    img_url = generate_presigned_url(img_key)
    return {"img_url": img_url, "img_key": img_key}


@router.post("/admin/glasses/files/3d")
async def get_glasses_3d_presigned_url(
    admin: dict = Depends(get_admin_token),
):
    """안경 3D 파일 Presigned URL 발급 (.glb)"""
    key_3d = generate_object_key(0, "glasses/3d", extension="glb")
    url_3d = generate_presigned_url(key_3d)
    return {"url_3d": url_3d, "key_3d": key_3d}