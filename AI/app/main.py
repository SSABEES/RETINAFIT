from fastapi import FastAPI

from app.api.router import router
from app.core.config import settings


def create_app() -> FastAPI:
    # FastAPI 인스턴스
    app = FastAPI(title=settings.PROJECT_NAME, version=settings.VERSION)
    # prefix 를 일괄 적용 — 모든 엔드포인트가 `/api/v1/...` 로 노출
    app.include_router(router, prefix=settings.API_PREFIX)
    return app


# 모듈 로드 시점에 인스턴스 생성
app = create_app()
