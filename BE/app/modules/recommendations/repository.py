from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select

from app.modules.recommendations.models import RecommendOption


# ─── 추천 옵션 관리 ───────────────────────────────────────────

async def get_options(db: AsyncSession) -> list[RecommendOption]:
    """추천 옵션 목록 조회 (표시 순서대로)"""
    result = await db.execute(
        select(RecommendOption)
        .order_by(RecommendOption.display_order)
    )
    return result.scalars().all()


async def get_option(db: AsyncSession, option_no: int) -> RecommendOption | None:
    """추천 옵션 단건 조회"""
    result = await db.execute(
        select(RecommendOption).where(RecommendOption.option_no == option_no)
    )
    return result.scalar_one_or_none()


async def create_option(db: AsyncSession, data: dict) -> RecommendOption:
    """추천 옵션 추가"""
    option = RecommendOption(**data)
    db.add(option)
    await db.flush()
    await db.refresh(option)
    return option


async def update_option(db: AsyncSession, option_no: int, data: dict) -> RecommendOption | None:
    """추천 옵션 수정"""
    option = await get_option(db, option_no)
    if not option:
        return None
    for key, value in data.items():
        setattr(option, key, value)
    await db.flush()
    await db.refresh(option)
    return option


async def delete_option(db: AsyncSession, option_no: int) -> bool:
    """추천 옵션 삭제"""
    option = await get_option(db, option_no)
    if not option:
        return False
    await db.delete(option)
    await db.flush()
    return True
