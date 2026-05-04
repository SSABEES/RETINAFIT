from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    PROJECT_NAME: str = "RETINA FIT AI SERVER"
    VERSION: str = "0.1.0"
    API_PREFIX: str = "/api/v1"
    MODEL_DIR: str = "data/models"

    # ── LLM ──
    LLM_PROVIDER: str = "dummy"          # dummy | gemini
    LLM_MODEL: str = "gemini-2.5-flash-lite"
    LLM_API_KEY: str | None = None
    LLM_BASE_URL: str = "https://generativelanguage.googleapis.com/v1beta"
    LLM_TEMPERATURE: float = 0.2
    LLM_MAX_TOKENS: int = 1024

    model_config = SettingsConfigDict(env_file=".env", env_file_encoding="utf-8", extra="ignore")


settings = Settings()
