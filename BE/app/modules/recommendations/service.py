from sqlalchemy.ext.asyncio import AsyncSession

from app.common.exceptions import NotFoundException
from app.common.error_codes import ErrorCode
from app.modules.recommendations import repository
from app.modules.recommendations.schemas import (
    RecommendOptionCreate,
    RecommendOptionUpdate,
    RecommendOptionResponse,
    RecommendSaveRequest,
    RecommendSaveResponse,
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
    option = await repository.update_option(db, option_no, request.model_dump(exclude_none=True))
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


async def update_option_order(db: AsyncSession, option_no: int, display_order: int) -> RecommendOptionResponse:
    """추천 옵션 순서 변경"""
    option = await repository.update_option_order(db, option_no, display_order)
    if not option:
        raise NotFoundException(
            error_code=ErrorCode.NOT_FOUND,
            message="추천 옵션을 찾을 수 없습니다.",
        )
    return RecommendOptionResponse.model_validate(option)


# ─── 안경사 추천 선택 ─────────────────────────────────────────

async def save_recommend(db: AsyncSession, visit_no: int, request: RecommendSaveRequest) -> RecommendSaveResponse:
    """안경사 추천 옵션 선택 저장"""
    visit = await repository.save_recommend(db, visit_no, request.opt_recommend_json)
    if not visit:
        raise NotFoundException(
            error_code=ErrorCode.VISIT_NOT_FOUND,
            message="방문 정보를 찾을 수 없습니다.",
        )
    return RecommendSaveResponse.model_validate(visit)


async def get_recommend(db: AsyncSession, visit_no: int) -> RecommendSaveResponse:
    """안경사 추천 옵션 조회"""
    visit = await repository.get_visit(db, visit_no)
    if not visit:
        raise NotFoundException(
            error_code=ErrorCode.VISIT_NOT_FOUND,
            message="방문 정보를 찾을 수 없습니다.",
        )
    return RecommendSaveResponse.model_validate(visit)