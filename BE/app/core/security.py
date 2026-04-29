from datetime import datetime, timedelta, timezone
from jose import JWTError, jwt

from app.core.config import settings
from app.common.exceptions import UnauthorizedException
from app.common.error_codes import ErrorCode


def create_admin_token() -> str:
    """
    관리자 JWT 발급
    - 만료시간: 1시간
    - payload에 role: admin 포함
    """
    expire = datetime.now(timezone.utc) + timedelta(hours=settings.ADMIN_TOKEN_EXPIRE_HOURS)
    payload = {
        "role": "admin",
        "exp": expire,
    }
    return jwt.encode(payload, settings.SECRET_KEY, algorithm=settings.ALGORITHM)


def verify_admin_token(token: str) -> dict:
    """
    관리자 JWT 검증
    - 만료되거나 유효하지 않으면 401 에러
    - role이 admin이 아니면 401 에러
    """
    try:
        payload = jwt.decode(token, settings.SECRET_KEY, algorithms=[settings.ALGORITHM])
        if payload.get("role") != "admin":
            raise UnauthorizedException(
                error_code=ErrorCode.UNAUTHORIZED,
                message="관리자 권한이 없습니다.",
            )
        return payload
    except JWTError:
        raise UnauthorizedException(
            error_code=ErrorCode.INVALID_TOKEN,
            message="유효하지 않은 토큰입니다.",
        )