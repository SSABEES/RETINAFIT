"""애플리케이션 설정
"""
import os

from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    # 필드 이름이 그대로 환경변수 이름과 매핑됨
    PROJECT_NAME: str = "RETINA FIT AI SERVER"
    VERSION: str = "0.1.0"
    API_PREFIX: str = "/api/v1"
    MODEL_DIR: str = "data/models"

    # ── LLM ──
    LLM_PROVIDER: str = "dummy"          # dummy | gemini
    LLM_MODEL: str = "gemini-2.5-flash-lite"
    LLM_API_KEY: str | None = None       # None 이면 GeminiProvider 가 시작 시 예외
    LLM_BASE_URL: str = "https://generativelanguage.googleapis.com/v1beta"
    LLM_TEMPERATURE: float = 0.2
    LLM_MAX_TOKENS: int = 1024

    # APP_ENV=production 이면 .env.prod, 아니면 .env (BE 와 동일 패턴)
    # extra="ignore": .env 에 모르는 키가 있어도 무시
    model_config = SettingsConfigDict(
        env_file=".env.prod" if os.getenv("APP_ENV") == "production" else ".env",
        env_file_encoding="utf-8",
        extra="ignore",
    )


# 모듈 import 시점에 단 한 번 인스턴스화
settings = Settings()
