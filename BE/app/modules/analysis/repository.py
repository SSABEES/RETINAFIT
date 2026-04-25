from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from datetime import datetime, timezone

from app.modules.visit.models import Visit


async def get_visit(db: AsyncSession, visit_no: int) -> Visit | None:
    """방문 조회"""
    result = await db.execute(
        select(Visit).where(Visit.visit_no == visit_no)
    )
    return result.scalar_one_or_none()


async def update_face_analysis(
    db: AsyncSession,
    visit_no: int,
    main_file: str,
    test_file_arr: list,
    test_json: dict,
) -> Visit | None:
    """얼굴 측정 데이터 저장 - test_json, test_file_arr, test_dt 업데이트"""
    visit = await get_visit(db, visit_no)
    if not visit:
        return None

    visit.main_file = main_file
    visit.test_file_arr = test_file_arr
    visit.test_json = test_json
    visit.test_dt = datetime.now(timezone.utc)

    await db.commit()
    await db.refresh(visit)
    return visit


async def update_virtual_fitting(
    db: AsyncSession,
    visit_no: int,
    vp_file_arr: list,
    vp_json: dict,
) -> Visit | None:
    """가상 피팅 데이터 저장 - vp_json, vp_file_arr, vp_dt 업데이트"""
    visit = await get_visit(db, visit_no)
    if not visit:
        return None

    visit.vp_file_arr = vp_file_arr
    visit.vp_json = vp_json
    visit.vp_dt = datetime.now(timezone.utc)

    await db.commit()
    await db.refresh(visit)
    return visit


async def update_real_fitting(
    db: AsyncSession,
    visit_no: int,
    real_vp_json: dict,
) -> Visit | None:
    """실제 착용 데이터 저장 - real_vp_json, real_vp_dt 업데이트"""
    visit = await get_visit(db, visit_no)
    if not visit:
        return None

    visit.real_vp_json = real_vp_json
    visit.real_vp_dt = datetime.now(timezone.utc)

    await db.commit()
    await db.refresh(visit)
    return visit