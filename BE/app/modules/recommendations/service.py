from sqlalchemy.ext.asyncio import AsyncSession

from app.common.exceptions import NotFoundException
from app.common.error_codes import ErrorCode
from app.modules.recommendations import repository
from app.modules.recommendations.schemas import (
    RecommendOptionCreate,
    RecommendOptionUpdate,
    RecommendOptionResponse,
)


# ─── 관리자 추천 옵션 CRUD ────────────────────────────────────

async def get_options(db: AsyncSession) -> list[RecommendOptionResponse]:
    """추천 옵션 목록 조회"""
    options = await repository.get_options(db)
    return [RecommendOptionResponse.model_validate(o) for o in options]


async def create_option(db: AsyncSession, request: RecommendOptionCreate) -> RecommendOptionResponse:
    """추천 옵션 추가"""
    option = await repository.create_option(db, request.model_dump())
    return RecommendOptionResponse.model_validate(option)


async def update_option(db: AsyncSession, option_no: int, request: RecommendOptionUpdate) -> RecommendOptionResponse:
    """추천 옵션 수정"""
    option = await repository.update_option(db, option_no, request.model_dump(exclude_unset=True))
    if not option:
        raise NotFoundException(
            error_code=ErrorCode.NOT_FOUND,
            message="추천 옵션을 찾을 수 없습니다.",
        )
    return RecommendOptionResponse.model_validate(option)


async def delete_option(db: AsyncSession, option_no: int) -> None:
    """추천 옵션 삭제"""
    result = await repository.delete_option(db, option_no)
    if not result:
        raise NotFoundException(
            error_code=ErrorCode.NOT_FOUND,
            message="추천 옵션을 찾을 수 없습니다.",
        )