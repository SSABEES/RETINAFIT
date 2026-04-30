from sqlalchemy.ext.asyncio import AsyncSession

from app.common.exceptions import NotFoundException
from app.common.error_codes import ErrorCode
from app.modules.fitting import repository
from app.modules.fitting.schemas import (
    FittingCriteriaCreate,
    FittingCriteriaUpdate,
    FittingCriteriaResponse,
)


async def get_criterias(db: AsyncSession) -> list[FittingCriteriaResponse]:
    """판단 기준 목록 조회"""
    criterias = await repository.get_criterias(db)
    return [FittingCriteriaResponse.model_validate(c) for c in criterias]


async def create_criteria(db: AsyncSession, request: FittingCriteriaCreate) -> FittingCriteriaResponse:
    """판단 기준 추가"""
    criteria = await repository.create_criteria(db, request.model_dump())
    return FittingCriteriaResponse.model_validate(criteria)


async def update_criteria(db: AsyncSession, criteria_no: int, request: FittingCriteriaUpdate) -> FittingCriteriaResponse:
    """판단 기준 수정"""
    criteria = await repository.update_criteria(db, criteria_no, request.model_dump(exclude_unset=True))
    if not criteria:
        raise NotFoundException(
            error_code=ErrorCode.NOT_FOUND,
            message="판단 기준을 찾을 수 없습니다.",
        )
    return FittingCriteriaResponse.model_validate(criteria)


async def delete_criteria(db: AsyncSession, criteria_no: int) -> None:
    """판단 기준 삭제"""
    result = await repository.delete_criteria(db, criteria_no)
    if not result:
        raise NotFoundException(
            error_code=ErrorCode.NOT_FOUND,
            message="판단 기준을 찾을 수 없습니다.",
        )