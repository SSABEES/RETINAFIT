from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker, create_async_engine
from sqlalchemy.orm import DeclarativeBase

from app.core.config import settings

# MySQL에 접속하는 연결 풀을 만들고, 요청마다 DB 세션을 나눠주는 역할!

# ─── 엔진 ────────────────────────────────────────────────────
# create_async_engine: 비동기 DB 연결 풀 생성
# echo=True: 실행되는 SQL을 콘솔에 출력 (개발 중 디버깅용, 배포 시 False로)
engine = create_async_engine(
    settings.DATABASE_URL,
    echo=settings.DEBUG,
    pool_pre_ping=True,  # 연결이 끊겼을 때 자동으로 재연결
)

# ─── 세션 팩토리 ──────────────────────────────────────────────
# 요청마다 DB 세션을 새로 만들어주는 팩토리
AsyncSessionLocal = async_sessionmaker(
    bind=engine,
    class_=AsyncSession,
    expire_on_commit=False,  # commit 후에도 객체 속성 접근 가능
)


# ─── Base 클래스 ──────────────────────────────────────────────
# 모든 ORM 모델이 이 클래스를 상속받음
# 공통 컬럼을 정의하는 곳 (예: created_at, visited_at)
class Base(DeclarativeBase):
    pass


# ─── 의존성 주입용 함수 ───────────────────────────────────────
# FastAPI 라우터에서 Depends(get_db)로 사용
# 요청 시작 → DB 세션 생성 → 작업 → 요청 종료 시 세션 자동 닫힘
async def get_db() -> AsyncSession:
    async with AsyncSessionLocal() as session:
        try:
            yield session                               # 라우터에 DB세션 전달
            await session.commit()                      # 성공 시 저장
        except Exception:
            await session.rollback()                    # 에러 발생 시 롤백
            raise