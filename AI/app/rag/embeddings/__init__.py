from app.core.config import settings
from app.rag.embeddings.base import EmbeddingProvider
from app.rag.embeddings.dummy import DummyEmbeddingProvider
from app.rag.embeddings.openai_client import OpenAIEmbeddingProvider


def build_embedding_provider() -> EmbeddingProvider:
    provider = settings.EMBEDDING_PROVIDER.lower()
    if provider == "openai":
        return OpenAIEmbeddingProvider(
            model=settings.EMBEDDING_MODEL,
            api_key=settings.EMBEDDING_API_KEY,
            base_url=settings.EMBEDDING_BASE_URL,
            dimension=settings.EMBEDDING_DIM,
        )
    if provider == "dummy":
        return DummyEmbeddingProvider(dimension=settings.EMBEDDING_DIM)
    raise ValueError(f"Unknown embedding provider: {provider}")


__all__ = ["EmbeddingProvider", "build_embedding_provider"]
