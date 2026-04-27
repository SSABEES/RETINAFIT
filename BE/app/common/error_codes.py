from enum import Enum


class ErrorCode(str, Enum):
    # ─── 공통 ──────────────────────────────────────────────────
    INTERNAL_SERVER_ERROR = "INTERNAL_SERVER_ERROR"
    NOT_FOUND = "NOT_FOUND"
    VALIDATION_ERROR = "VALIDATION_ERROR"
    DUPLICATE_ERROR = "DUPLICATE_ERROR"

    # ─── 인증 ──────────────────────────────────────────────────
    UNAUTHORIZED = "UNAUTHORIZED"  # 토큰 없음
    FORBIDDEN = "FORBIDDEN"  # 권한 없음
    TOKEN_EXPIRED = "TOKEN_EXPIRED"
    INVALID_TOKEN = "INVALID_TOKEN"
    EXTERNAL_AUTH_FAILED = "EXTERNAL_AUTH_FAILED"  # 외부 API 인증 실패

    # ─── 방문(Visit) ───────────────────────────────────────────
    VISIT_NOT_FOUND = "VISIT_NOT_FOUND"

    # ─── 피팅(Fitting) ─────────────────────────────────────────
    FITTING_NOT_FOUND = "FITTING_NOT_FOUND"

    # ─── 추천(Recommendations) ─────────────────────────────────
    RECOMMENDATION_NOT_FOUND = "RECOMMENDATION_NOT_FOUND"

    # ─── AI 서버 ───────────────────────────────────────────────
    AI_SERVER_ERROR = "AI_SERVER_ERROR"
    AI_SERVER_TIMEOUT = "AI_SERVER_TIMEOUT"
