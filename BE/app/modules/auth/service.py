from app.core.security import create_access_token
from app.modules.auth.schemas import LoginRequest, TokenResponse


def login(payload: LoginRequest) -> TokenResponse:
    token = create_access_token(subject=payload.email)
    return TokenResponse(access_token=token)
