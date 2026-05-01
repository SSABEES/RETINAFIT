from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    PROJECT_NAME: str = "My Project AI"
    VERSION: str = "0.1.0"
    API_PREFIX: str = "/api"
    MODEL_DIR: str = "data/models"

    # ── RAG: LLM ──
    LLM_PROVIDER: str = "dummy"          # dummy | openai
    LLM_MODEL: str = "gpt-4o-mini"
    LLM_API_KEY: str | None = None
    LLM_BASE_URL: str = "https://api.openai.com/v1"
    LLM_TEMPERATURE: float = 0.2
    LLM_MAX_TOKENS: int = 1024

    # ── RAG: Embedding ──
    EMBEDDING_PROVIDER: str = "dummy"    # dummy | openai
    EMBEDDING_MODEL: str = "text-embedding-3-small"
    EMBEDDING_DIM: int = 1536
    EMBEDDING_API_KEY: str | None = None
    EMBEDDING_BASE_URL: str = "https://api.openai.com/v1"

    # ── RAG: Vector store ──
    VECTOR_STORE_PROVIDER: str = "inmemory"
    VECTOR_STORE_PATH: str = "data/vectorstore"

    # ── RAG: Knowledge & retrieval ──
    KNOWLEDGE_DIR: str = "data/knowledge"
    RETRIEVAL_TOP_K: int = 5
    RETRIEVAL_SCORE_THRESHOLD: float = 0.0
    CHUNK_SIZE: int = 800
    CHUNK_OVERLAP: int = 120

    model_config = SettingsConfigDict(env_file=".env", env_file_encoding="utf-8", extra="ignore")


settings = Settings()
