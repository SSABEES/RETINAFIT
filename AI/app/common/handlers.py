"""전역 예외 핸들러.

main.py 에서 register_exception_handlers(app) 으로 등록.
어떤 예외든 일관된 JSON 응답 형식으로 변환 + 로깅.
"""
from __future__ import annotations

from fastapi import FastAPI, Request
from fastapi.exceptions import RequestValidationError
from fastapi.responses import JSONResponse

from app.common.exceptions import AIException
from app.common.logger import logger


def register_exception_handlers(app: FastAPI) -> None:
    """앱 전역 예외 핸들러 등록."""

    @app.exception_handler(AIException)
    async def ai_exception_handler(request: Request, exc: AIException):
        """LLM 호출 실패 등 AI 도메인 예외. 502 로 반환."""
        logger.error(
            "AIException: %s %s - %s",
            request.method,
            request.url,
            exc,
            exc_info=True,
        )
        return JSONResponse(
            status_code=502,
            content={
                "success": False,
                "error_code": "AI_FAILURE",
                "message": str(exc),
            },
        )

    @app.exception_handler(RequestValidationError)
    async def validation_exception_handler(request: Request, exc: RequestValidationError):
        """Pydantic 입력 검증 실패. 422."""
        logger.warning(
            "ValidationError: %s %s - %s",
            request.method,
            request.url,
            exc.errors(),
        )
        return JSONResponse(
            status_code=422,
            content={
                "success": False,
                "error_code": "VALIDATION_ERROR",
                "message": str(exc.errors()),
            },
        )

    @app.exception_handler(Exception)
    async def unhandled_exception_handler(request: Request, exc: Exception):
        """예상치 못한 예외. 500 + 스택트레이스 로깅."""
        logger.error(
            "UnhandledException: %s %s - %s",
            request.method,
            request.url,
            exc,
            exc_info=True,
        )
        return JSONResponse(
            status_code=500,
            content={
                "success": False,
                "error_code": "INTERNAL_SERVER_ERROR",
                "message": "서버 내부 오류가 발생했습니다.",
            },
        )
