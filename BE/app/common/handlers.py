import logging
from fastapi import FastAPI, Request
from fastapi.responses import JSONResponse
from fastapi.exceptions import RequestValidationError

from app.common.error_codes import ErrorCode
from app.common.exceptions import AppException

logger = logging.getLogger(__name__)

def register_exception_handlers(app: FastAPI) -> None:
    """
    main.py에서 호출해서 전역 예외 핸들러 등록
    앱 어디서든 예외가 발생하면 여기서 잡아서 일관된 JSON 형식으로 반환
    """

    @app.exception_handler(AppException)
    async def app_exception_handler(request: Request, exc: AppException):
        """
        커스텀 예외 처리
        raise NotFoundException(...)

        응답 형식:
        {
            "success": false,
            "error_code": "VISIT_NOT_FOUND",
            "message": "방문 정보를 찾을 수 없습니다."
        }
        """
        logger.warning(
            "AppException: %s %s - [%s] %s",
            request.method,
            request.url,
            exc.error_code.value,
            exc.message,
            exc_info=True,
        )
        return JSONResponse(
            status_code=exc.status_code,
            content={
                "success": False,
                "error_code": exc.error_code.value,
                "message": exc.message,
            },
        )

    @app.exception_handler(RequestValidationError)
    async def validation_exception_handler(request: Request, exc: RequestValidationError):
        """
        Pydantic 유효성 검사 실패 처리
        예: 필수 필드 누락, 타입 불일치 등
        """
        logger.warning(
            "ValidationError: %s %s - %s",
            request.method,
            request.url,
            exc.errors(),
            exc_info=True,
        )
        return JSONResponse(
            status_code=422,
            content={
                "success": False,
                "error_code": ErrorCode.VALIDATION_ERROR.value,
                "message": str(exc.errors()),
            },
        )

    @app.exception_handler(Exception)
    async def unhandled_exception_handler(request: Request, exc: Exception):
        """
        예상치 못한 에러 처리 (500)
        """
        logger.error(
            "UnhandledException: %s %s - %s",
            request.method,
            request.url,
            exc,
            exc_info=True,  # traceback 포함
        )
        return JSONResponse(
            status_code=500,
            content={
                "success": False,
                "error_code": ErrorCode.INTERNAL_SERVER_ERROR.value,
                "message": "서버 내부 오류가 발생했습니다.",
            },
        )