from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from sqlalchemy.sql import func

from app.modules.recommendations.models import RecommendOption
from app.modules.visit.models import Visit


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
    await db.commit()
    await db.refresh(option)
    return option


async def update_option(db: AsyncSession, option_no: int, data: dict) -> RecommendOption | None:
    """추천 옵션 수정"""
    option = await get_option(db, option_no)
    if not option:
        return None
    for key, value in data.items():
        if value is not None:
            setattr(option, key, value)
    await db.commit()
    await db.refresh(option)
    return option


async def delete_option(db: AsyncSession, option_no: int) -> bool:
    """추천 옵션 삭제"""
    option = await get_option(db, option_no)
    if not option:
        return False
    await db.delete(option)
    await db.commit()
    return True


async def update_option_order(db: AsyncSession, option_no: int, display_order: int) -> RecommendOption | None:
    """추천 옵션 순서 변경"""
    option = await get_option(db, option_no)
    if not option:
        return None
    option.display_order = display_order
    await db.commit()
    await db.refresh(option)
    return option


# ─── 안경사 추천 선택 ─────────────────────────────────────────

async def get_visit(db: AsyncSession, visit_no: int) -> Visit | None:
    """방문 조회"""
    result = await db.execute(
        select(Visit).where(Visit.visit_no == visit_no)
    )
    return result.scalar_one_or_none()


async def save_recommend(db: AsyncSession, visit_no: int, opt_recommend_json: dict) -> Visit | None:
    """안경사 추천 옵션 선택 저장 - opt_recommend_json 업데이트"""
    visit = await get_visit(db, visit_no)
    if not visit:
        return None
    visit.opt_recommend_json = opt_recommend_json
    await db.commit()
    await db.refresh(visit)
    return visit