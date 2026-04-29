from fastapi import Header, Depends
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from typing import Annotated

from app.common.exceptions import UnauthorizedException
from app.common.error_codes import ErrorCode
from app.core.security import verify_admin_token

bearer_scheme = HTTPBearer()

async def get_token(
    token: Annotated[str | None, Header()] = None,
    token_no: Annotated[str | None, Header()] = None,
) -> dict:
    """
    모든 API 요청에서 token + token_no 검증
    헤더에 token, token_no 없으면 401 에러
    """
    if not token or not token_no:
        raise UnauthorizedException(
            error_code=ErrorCode.UNAUTHORIZED,
            message="token 또는 token_no가 없습니다."
        )
    return {"token": token, "token_no": token_no}


async def get_admin_token(
    credentials: HTTPAuthorizationCredentials = Depends(bearer_scheme),
) -> dict:
    """
    관리자 API 요청에서 JWT 검증
    Authorization: Bearer {token} 헤더 없으면 401 에러

    사용법:
    @router.post("/admin/glasses")
    async def create_glasses(
        admin: dict = Depends(get_admin_token)
    ):
    """
    return verify_admin_token(credentials.credentials)