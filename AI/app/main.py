from contextlib import asynccontextmanager

from fastapi import FastAPI

from app.api.router import router
from app.core.config import settings
from app.core.deps import get_vector_store


@asynccontextmanager
async def lifespan(app: FastAPI):
    # 부팅 시 벡터 스토어 디스크 캐시를 미리 로드해 첫 요청 지연을 줄인다.
    get_vector_store()
    yield


def create_app() -> FastAPI:
    app = FastAPI(
        title=settings.PROJECT_NAME,
        version=settings.VERSION,
        lifespan=lifespan,
    )
    app.include_router(router, prefix=settings.API_PREFIX)
    return app


app = create_app()
