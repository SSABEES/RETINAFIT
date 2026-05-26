import logging

from fastapi import FastAPI

from app.api.router import router
from app.common.handlers import register_exception_handlers
from app.core.config import settings

# ─── 로깅 설정 ────────────────────────────────────────────────
# logger 인스턴스는 app/common/logger.py 에 정의돼 있지만, basicConfig 가 없으면
# 핸들러/포맷이 미적용되어 실제 출력이 안 됨. 앱 부팅 시점에 한 번 호출.
logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s %(levelname)s %(name)s %(message)s",
)


def create_app() -> FastAPI:
    # FastAPI 인스턴스
    app = FastAPI(title=settings.PROJECT_NAME, version=settings.VERSION)
    # 전역 예외 핸들러 등록 — AIException / ValidationError / Exception
    register_exception_handlers(app)
    # prefix 를 일괄 적용 — 모든 엔드포인트가 `/api/v1/...` 로 노출
    app.include_router(router, prefix=settings.API_PREFIX)
    return app


# 모듈 로드 시점에 인스턴스 생성
app = create_app()
