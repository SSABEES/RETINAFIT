from __future__ import annotations

from typing import Any

from app.rag.documents import RetrievedDocument
from app.rag.embeddings.base import EmbeddingProvider
from app.rag.vector_store.base import VectorStore


class Retriever:
    def __init__(
        self,
        embedder: EmbeddingProvider,
        store: VectorStore,
        *,
        top_k: int,
        score_threshold: float,
    ) -> None:
        self._embedder = embedder
        self._store = store
        self._top_k = top_k
        self._score_threshold = score_threshold

    @property
    def default_top_k(self) -> int:
        return self._top_k

    def retrieve(
        self,
        query: str,
        *,
        top_k: int | None = None,
        filters: dict[str, Any] | None = None,
        score_threshold: float | None = None,
    ) -> list[RetrievedDocument]:
        if not query.strip():
            return []
        if self._store.size() == 0:
            return []
        embedding = self._embedder.embed_query(query)
        k = top_k if top_k is not None else self._top_k
        threshold = score_threshold if score_threshold is not None else self._score_threshold
        results = self._store.search(embedding, top_k=k, filters=filters)
        if threshold > 0:
            results = [r for r in results if r.score >= threshold]
        return results
