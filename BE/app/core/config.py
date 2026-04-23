from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    PROJECT_NAME: str = "My Project API"
    VERSION: str = "0.1.0"
    API_PREFIX: str = "/api"
    DATABASE_URL: str = "postgresql+psycopg://my_project:my_project@db:5432/my_project"
    AI_BASE_URL: str = "http://ai:8001"
    JWT_SECRET_KEY: str = "change-me"
    JWT_ALGORITHM: str = "HS256"

    model_config = SettingsConfigDict(env_file=".env", env_file_encoding="utf-8")


settings = Settings()
