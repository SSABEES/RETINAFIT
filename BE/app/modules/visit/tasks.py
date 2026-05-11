"""AI 서버 /report/face-script 호출 + 결과 저장.

PATCH /visits/{visit_no} 에서 test_json 이 새로 들어오면 BackgroundTasks 로 호출된다.
실패해도 예외를 던지지 않고 logger.warning 만 — visit 응답 자체는 성공으로 응답하기 위함.
"""
from __future__ import annotations

import logging
from typing import Any

import httpx

from app.core.config import settings
from app.core.database import AsyncSessionLocal
from app.modules.visit import repository

logger = logging.getLogger(__name__)

AI_REQUEST_TIMEOUT_SEC = 30.0


async def generate_and_save_face_script(visit_no: int, test_json: dict[str, Any]) -> None:
    url = f"{settings.AI_SERVER_URL.rstrip('/')}/api/v1/report/face-script"
    try:
        async with httpx.AsyncClient() as client:
            response = await client.post(url, json=test_json, timeout=AI_REQUEST_TIMEOUT_SEC)
            response.raise_for_status()
            data = response.json()
    except httpx.TimeoutException:
        logger.warning("AI face-script timeout: visit_no=%s url=%s", visit_no, url)
        return
    except httpx.HTTPError as e:
        logger.warning("AI face-script HTTP error: visit_no=%s err=%s", visit_no, e)
        return
    except Exception as e:
        logger.warning("AI face-script unexpected error: visit_no=%s err=%s", visit_no, e)
        return

    if not isinstance(data, dict):
        logger.warning("AI face-script invalid response (not dict): visit_no=%s", visit_no)
        return

    async with AsyncSessionLocal() as session:
        try:
            await repository.update_report_json(session, visit_no, data)
            await session.commit()
        except Exception as e:
            await session.rollback()
            logger.warning("AI face-script save failed: visit_no=%s err=%s", visit_no, e)