from __future__ import annotations

from functools import lru_cache

from app.core.config import settings
from app.rag.embeddings import build_embedding_provider
from app.rag.embeddings.base import EmbeddingProvider
from app.rag.llm import build_llm_provider
from app.rag.llm.base import LLMProvider
from app.rag.retriever import Retriever
from app.rag.vector_store import build_vector_store
from app.rag.vector_store.base import VectorStore
from app.services.rag_service import RagService


@lru_cache(maxsize=1)
def get_embedding_provider() -> EmbeddingProvider:
    return build_embedding_provider()


@lru_cache(maxsize=1)
def get_llm_provider() -> LLMProvider:
    return build_llm_provider()


@lru_cache(maxsize=1)
def get_vector_store() -> VectorStore:
    embedder = get_embedding_provider()
    store = build_vector_store(dimension=embedder.dimension)
    store.load()
    return store


@lru_cache(maxsize=1)
def get_retriever() -> Retriever:
    return Retriever(
        embedder=get_embedding_provider(),
        store=get_vector_store(),
        top_k=settings.RETRIEVAL_TOP_K,
        score_threshold=settings.RETRIEVAL_SCORE_THRESHOLD,
    )


@lru_cache(maxsize=1)
def get_rag_service() -> RagService:
    return RagService(
        retriever=get_retriever(),
        llm=get_llm_provider(),
        embedder=get_embedding_provider(),
        store=get_vector_store(),
        chunk_size=settings.CHUNK_SIZE,
        chunk_overlap=settings.CHUNK_OVERLAP,
    )


def reset_caches() -> None:
    """Clear cached singletons. Used by tests / hot-reload scenarios."""
    for fn in (
        get_embedding_provider,
        get_llm_provider,
        get_vector_store,
        get_retriever,
        get_rag_service,
    ):
        fn.cache_clear()
