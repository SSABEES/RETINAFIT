from fastapi import APIRouter

from app.modules.auth.schemas import LoginRequest, LoginResponse
from app.modules.auth import service

router = APIRouter(prefix="/auth", tags=["auth"])


@router.post("/login", response_model=LoginResponse)
async def login(request: LoginRequest):
    """
    안경사 로그인

    - 외부 Retina API에 로그인 요청 중계
    - 안경원 정보 + 안경사 정보 + token 반환
    """
    return await service.login(request)

@router.post("/logout")
async def logout():
    """
    로그아웃
    - 외부 API 로그아웃 없음
    - FE에서 sessionStorage 비우는 것으로 처리
    - BE는 200 반환만 함
    """
    return {"message": "로그아웃 되었습니다."}