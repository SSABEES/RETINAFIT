from fastapi import APIRouter

from app.modules.auth.schemas import LoginRequest, TokenResponse
from app.modules.auth.service import login

router = APIRouter()


@router.post("/login", response_model=TokenResponse)
def login_staff(payload: LoginRequest) -> TokenResponse:
    return login(payload)
