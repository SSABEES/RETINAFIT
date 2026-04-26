from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select

from app.modules.fitting.models import FittingCriteria


async def get_criterias(db: AsyncSession) -> list[FittingCriteria]:
    """판단 기준 목록 조회"""
    result = await db.execute(
        select(FittingCriteria).order_by(FittingCriteria.criteria_no)
    )
    return result.scalars().all()


async def get_criteria(db: AsyncSession, criteria_no: int) -> FittingCriteria | None:
    """판단 기준 단건 조회"""
    result = await db.execute(
        select(FittingCriteria).where(FittingCriteria.criteria_no == criteria_no)
    )
    return result.scalar_one_or_none()


async def create_criteria(db: AsyncSession, data: dict) -> FittingCriteria:
    """판단 기준 추가"""
    criteria = FittingCriteria(**data)
    db.add(criteria)
    await db.commit()
    await db.refresh(criteria)
    return criteria


async def update_criteria(db: AsyncSession, criteria_no: int, data: dict) -> FittingCriteria | None:
    """판단 기준 수정"""
    criteria = await get_criteria(db, criteria_no)
    if not criteria:
        return None
    for key, value in data.items():
        if value is not None:
            setattr(criteria, key, value)
    await db.commit()
    await db.refresh(criteria)
    return criteria


async def delete_criteria(db: AsyncSession, criteria_no: int) -> bool:
    """판단 기준 삭제"""
    criteria = await get_criteria(db, criteria_no)
    if not criteria:
        return False
    await db.delete(criteria)
    await db.commit()
    return True