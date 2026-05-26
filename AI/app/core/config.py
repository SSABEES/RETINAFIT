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
    # LLM_ENABLED: 기능 단위 ON/OFF 스위치.
    #   - False 면 LLM 의존 엔드포인트가 503 으로 즉시 응답 (provider 빌드 자체를 안 함).
    #   - LLM 외부 API 가 죽었을 때 운영자가 일시적으로 끄거나, 비용 제한 시 활용.
    #   - LLM_PROVIDER 와는 독립: ENABLED=true + PROVIDER=dummy 면 정상 동작(에코 응답).
    #   - 향후 다른 AI 기능(예: 이미지 분석) 추가 시 같은 패턴(`require_xxx_enabled`)으로 재사용.
    LLM_ENABLED: bool = True
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
