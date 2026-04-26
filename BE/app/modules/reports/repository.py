from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select

from app.modules.visit.models import Visit


async def get_visit(db: AsyncSession, visit_no: int) -> Visit | None:
    """방문 조회"""
    result = await db.execute(
        select(Visit).where(Visit.visit_no == visit_no)
    )
    return result.scalar_one_or_none()


async def save_final_report(db: AsyncSession, visit_no: int, report_json: dict) -> Visit | None:
    """최종 리포트 저장 - report_json 업데이트"""
    visit = await get_visit(db, visit_no)
    if not visit:
        return None
    visit.report_json = report_json
    await db.commit()
    await db.refresh(visit)
    return visit