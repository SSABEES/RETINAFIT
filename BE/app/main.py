from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.core.config import settings
from app.common.handlers import register_exception_handlers
from app.api.router import api_router

# ─── 앱 생성 ──────────────────────────────────────────────────
app = FastAPI(
    title="S14 Backend API",
    version="0.1.0",
    # 배포 환경에서는 docs 비활성화
    docs_url="/docs" if settings.DEBUG else None,
    redoc_url="/redoc" if settings.DEBUG else None,
)

# ─── CORS ─────────────────────────────────────────────────────
# FE(Svelte)에서 BE로 요청할 때 브라우저가 막는 것 방지
# 개발 중에는 전체 허용, 배포 시 FE 주소로 좁혀야 함 -> .env.local 파일에서 설정
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"] if settings.DEBUG else settings.ALLOWED_ORIGINS,
    allow_credentials=True,                 # 쿠키, Authorization 헤더 포함 요청 허용
    allow_methods=["*"],                    # GET, POST, PUT, DELETE 등 모든 HTTP 메서드 허용
    allow_headers=["*"],                    # 요청에 포함할 수 있는 헤더 제한 없음
)

# ─── 예외 핸들러 등록 ─────────────────────────────────────────
register_exception_handlers(app)

# ─── 라우터 등록 ──────────────────────────────────────────────
app.include_router(api_router, prefix="/api/v1")

# ─── 헬스체크 ─────────────────────────────────────────────────
# Docker, 배포 서버에서 서버 정상 여부 확인용
@app.get("/health", tags=["health"])
async def health_check():
    return {"status": "ok", "env": settings.APP_ENV}