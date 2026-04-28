from sqlalchemy.ext.asyncio import AsyncSession

from app.common.exceptions import NotFoundException
from app.common.error_codes import ErrorCode
from app.modules.glasses import repository
from app.modules.glasses.schemas import (
    GlassesCreate,
    GlassesUpdate,
    GlassesResponse,
)
from app.common.s3_utils import get_file_url


def _convert_glasses_urls(glasses) -> GlassesResponse:
    """안경 이미지 key → 퍼블릭 URL 변환"""
    data = GlassesResponse.model_validate(glasses)
    if data.glasses_img_url:
        data.glasses_img_url = get_file_url(data.glasses_img_url)
    if data.glasses_3d_url:
        data.glasses_3d_url = get_file_url(data.glasses_3d_url)
    return data


async def get_glasses_list(db: AsyncSession) -> list[GlassesResponse]:
    """안경 목록 조회"""
    glasses_list = await repository.get_glasses_list(db)
    return [_convert_glasses_urls(g) for g in glasses_list]


async def get_glasses(db: AsyncSession, glasses_no: int) -> GlassesResponse:
    """안경 단건 조회"""
    glasses = await repository.get_glasses(db, glasses_no)
    if not glasses:
        raise NotFoundException(
            error_code=ErrorCode.NOT_FOUND,
            message="안경 정보를 찾을 수 없습니다.",
        )
    return _convert_glasses_urls(glasses)


async def create_glasses(db: AsyncSession, request: GlassesCreate) -> GlassesResponse:
    """안경 등록"""
    glasses = await repository.create_glasses(db, request.model_dump())
    return _convert_glasses_urls(glasses)


async def update_glasses(db: AsyncSession, glasses_no: int, request: GlassesUpdate) -> GlassesResponse:
    """안경 수정"""
    glasses = await repository.update_glasses(db, glasses_no, request.model_dump(exclude_none=True))
    if not glasses:
        raise NotFoundException(
            error_code=ErrorCode.NOT_FOUND,
            message="안경 정보를 찾을 수 없습니다.",
        )
    return _convert_glasses_urls(glasses)


async def delete_glasses(db: AsyncSession, glasses_no: int) -> None:
    """안경 비활성화"""
    result = await repository.delete_glasses(db, glasses_no)
    if not result:
        raise NotFoundException(
            error_code=ErrorCode.NOT_FOUND,
            message="안경 정보를 찾을 수 없습니다.",
        )