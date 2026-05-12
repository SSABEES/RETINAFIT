import os
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

    # ─── AWS S3 ──────────────────────────────
    AWS_ACCESS_KEY_ID: str
    AWS_SECRET_ACCESS_KEY: str
    AWS_REGION: str = "ap-northeast-2"
    S3_BUCKET_NAME: str

    # ─── AWS CloudFront ───────────────────────────────────────
    CLOUDFRONT_DOMAIN: str | None = None
    CLOUDFRONT_KEY_ID: str | None = None
    CLOUDFRONT_PRIVATE_KEY_PATH: str | None = None

    # ─── 관리자 ───────────────────────────────────────────────
    ADMIN_ID: str
    ADMIN_PASSWORD: str
    SECRET_KEY: str
    ALGORITHM: str = "HS256"
    ADMIN_TOKEN_EXPIRE_HOURS: int = 1

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
        env_file=".env.prod" if os.getenv("APP_ENV") == "production" else ".env.local",
        env_file_encoding="utf-8",
        case_sensitive=True,                                            # DB_HOST ≠ db_host 구분
    )


# 앱 전체에서 이 객체 하나를 import해서 사용
# 예: from app.core.config import settings
settings = Settings()