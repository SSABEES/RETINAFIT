from http import HTTPStatus

from app.common.error_codes import ErrorCode


class AppException(Exception):
    """
    프로젝트 전체에서 사용하는 기본 예외 클래스
    모든 커스텀 예외는 이 클래스를 상속받음

    사용 예:
        raise AppException(
            status_code=404,
            error_code=ErrorCode.VISIT_NOT_FOUND,
            message="방문 정보를 찾을 수 없습니다."
        )
    """

    def __init__(
        self,
        status_code: int,
        error_code: ErrorCode,
        message: str,
    ):
        self.status_code = status_code
        self.error_code = error_code
        self.message = message
        super().__init__(message)


# ─── 자주 쓰는 예외 미리 정의 ────────────────────────────────
# 매번 status_code 외우지 않아도 되도록

class NotFoundException(AppException):
    def __init__(self, error_code: ErrorCode, message: str):
        super().__init__(
            status_code=HTTPStatus.NOT_FOUND,  # 404
            error_code=error_code,
            message=message,
        )


class UnauthorizedException(AppException):
    def __init__(self, error_code: ErrorCode, message: str):
        super().__init__(
            status_code=HTTPStatus.UNAUTHORIZED,  # 401
            error_code=error_code,
            message=message,
        )


class ForbiddenException(AppException):
    def __init__(self, error_code: ErrorCode, message: str):
        super().__init__(
            status_code=HTTPStatus.FORBIDDEN,  # 403
            error_code=error_code,
            message=message,
        )


class BadRequestException(AppException):
    def __init__(self, error_code: ErrorCode, message: str):
        super().__init__(
            status_code=HTTPStatus.BAD_REQUEST,  # 400
            error_code=error_code,
            message=message,
        )


class ExternalAPIException(AppException):
    """외부 API(안경원 시스템) 호출 실패"""
    def __init__(self, message: str):
        super().__init__(
            status_code=HTTPStatus.BAD_GATEWAY,  # 502
            error_code=ErrorCode.EXTERNAL_AUTH_FAILED,
            message=message,
        )


class AIServerException(AppException):
    """AI 서버 호출 실패"""
    def __init__(self, error_code: ErrorCode, message: str):
        super().__init__(
            status_code=HTTPStatus.BAD_GATEWAY,  # 502
            error_code=error_code,
            message=message,
        )