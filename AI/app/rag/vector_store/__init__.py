from app.core.config import settings
from app.rag.vector_store.base import VectorStore
from app.rag.vector_store.inmemory import InMemoryVectorStore


def build_vector_store(dimension: int) -> VectorStore:
    provider = settings.VECTOR_STORE_PROVIDER.lower()
    if provider == "inmemory":
        return InMemoryVectorStore(
            dimension=dimension,
            persist_path=settings.VECTOR_STORE_PATH,
        )
    raise ValueError(f"Unknown vector store provider: {provider}")


__all__ = ["VectorStore", "build_vector_store"]
