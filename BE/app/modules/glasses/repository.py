from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select

from app.modules.glasses.models import Glasses


async def get_glasses_list(db: AsyncSession) -> list[Glasses]:
    """안경 목록 조회 (활성화된 것만)"""
    result = await db.execute(
        select(Glasses)
        .where(Glasses.is_active == True)
        .order_by(Glasses.glasses_no)
    )
    return result.scalars().all()


async def get_glasses(db: AsyncSession, glasses_no: int) -> Glasses | None:
    """안경 단건 조회"""
    result = await db.execute(
        select(Glasses).where(Glasses.glasses_no == glasses_no)
    )
    return result.scalar_one_or_none()


async def create_glasses(db: AsyncSession, data: dict) -> Glasses:
    """안경 등록"""
    glasses = Glasses(**data)
    db.add(glasses)
    await db.flush()
    await db.refresh(glasses)
    return glasses


async def update_glasses(db: AsyncSession, glasses_no: int, data: dict) -> Glasses | None:
    """안경 수정"""
    glasses = await get_glasses(db, glasses_no)
    if not glasses:
        return None
    for key, value in data.items():
        setattr(glasses, key, value)
    await db.flush()
    await db.refresh(glasses)
    return glasses


async def delete_glasses(db: AsyncSession, glasses_no: int) -> bool:
    """안경 비활성화 (is_active = False)"""
    glasses = await get_glasses(db, glasses_no)
    if not glasses:
        return False
    glasses.is_active = False
    await db.flush()
    return True