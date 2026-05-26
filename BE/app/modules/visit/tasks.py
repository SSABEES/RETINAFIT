"""AI 서버 /report/face-script 호출."""
from __future__ import annotations

import logging
from typing import Any

import httpx

from app.core.config import settings
from app.core.http_client import http_client

logger = logging.getLogger(__name__)

AI_REQUEST_TIMEOUT_SEC = 60.0


async def call_face_script(test_json: dict[str, Any]) -> dict | None:  # ← visit_no 제거, 반환타입 수정
    """AI face-script 호출만 담당 - 저장은 하지 않음"""
    url = f"{settings.AI_SERVER_URL.rstrip('/')}/api/v1/report/face-script"
    try:
        response = await http_client.post(url, json=test_json, timeout=AI_REQUEST_TIMEOUT_SEC)
        response.raise_for_status()
        data = response.json()
    except httpx.TimeoutException:
        logger.warning("AI face-script timeout url=%s", url)
        return None
    except httpx.HTTPError as e:
        logger.warning("AI face-script HTTP error err=%s", e)
        return None
    except Exception as e:
        logger.warning("AI face-script unexpected error err=%s", e)
        return None

    if not isinstance(data, dict):
        logger.warning("AI face-script invalid response (not dict)")
        return None

    return data