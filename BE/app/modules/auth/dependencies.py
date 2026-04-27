from fastapi import Header
from typing import Annotated

from app.common.exceptions import UnauthorizedException
from app.common.error_codes import ErrorCode


async def get_token(
    token: Annotated[str | None, Header()] = None,
    token_no: Annotated[str | None, Header()] = None,
) -> dict:
    """
    모든 API 요청에서 token + token_no 검증
    헤더에 token, token_no 없으면 401 에러

    사용법:
    @router.get("/")
    async def some_api(auth: dict = Depends(get_token)):
        token = auth["token"]
        token_no = auth["token_no"]
    """
    if not token or not token_no:
        raise UnauthorizedException(
            error_code=ErrorCode.UNAUTHORIZED,
            message="token 또는 token_no가 없습니다."
        )

    return {"token": token, "token_no": token_no}