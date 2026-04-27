from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select

from app.modules.visit.models import Visit


async def create_visit(db: AsyncSession, visit_data: dict) -> Visit:
    """방문 생성 - visited 테이블에 row 추가"""
    visit = Visit(**visit_data)
    db.add(visit)
    await db.commit()
    await db.refresh(visit)  # visit_no 자동 채워짐
    return visit


async def get_visit(db: AsyncSession, visit_no: int) -> Visit | None:
    """방문 단건 조회"""
    result = await db.execute(
        select(Visit).where(Visit.visit_no == visit_no)
    )
    return result.scalar_one_or_none()


async def get_visits_by_cust(db: AsyncSession, cust_no: int) -> list[Visit]:
    """고객 번호로 방문 이력 조회 (최신순)"""
    result = await db.execute(
        select(Visit)
        .where(Visit.cust_no == cust_no)
        .order_by(Visit.create_dt.desc())
    )
    return result.scalars().all()