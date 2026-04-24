from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    # ─── DB ──────────────────────────────────────────────────
    DB_HOST: str                                # .env에서 DB_HOST 읽어서 str로 저장
    DB_PORT: int = 3306                         # .env에서 DB_PORT 읽어서 int로 변환, 없으면 기본값 3306
    DB_USER: str
    DB_PASSWORD: str
    DB_NAME: str

    # ─── 외부 API ─────────────────────────────────────────────
    EXTERNAL_API_BASE_URL: str

    # ─── AI 서버 ──────────────────────────────────────────────
    AI_SERVER_URL: str

    # ─── 앱 ───────────────────────────────────────────────────
    APP_ENV: str = "development"
    DEBUG: bool = True                          # .env에서 DEBUG 읽어서 bool로 변환

    # ─── FE ───────────────────────────────────────────────────
    ALLOWED_ORIGINS: list[str] = ["*"]  # 기본값은 전체허용

    @property
    def DATABASE_URL(self) -> str:
        # aiomysql: 비동기 MySQL 드라이버
        # SQLAlchemy는 실제 MySQL 서버랑 통신하는 드라이버가 필요함
        # FastAPI는 비동기 기반이라 드라이버도 비동기여야 함!
        return (
            f"mysql+aiomysql://{self.DB_USER}:{self.DB_PASSWORD}"
            f"@{self.DB_HOST}:{self.DB_PORT}/{self.DB_NAME}"
        )

    model_config = SettingsConfigDict(
        env_file=".env.local",                                                # .env.local 파일에서 자동으로 읽음
        env_file_encoding="utf-8",
        case_sensitive=True,                                            # DB_HOST ≠ db_host 구분
    )


# 앱 전체에서 이 객체 하나를 import해서 사용
# 예: from app.core.config import settings
settings = Settings()