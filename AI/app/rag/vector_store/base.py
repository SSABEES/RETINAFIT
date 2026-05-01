from __future__ import annotations

from typing import Any, Protocol, runtime_checkable

from app.rag.documents import Document, RetrievedDocument


@runtime_checkable
class VectorStore(Protocol):
    @property
    def dimension(self) -> int: ...

    def upsert(self, documents: list[Document], embeddings: list[list[float]]) -> None: ...

    def search(
        self,
        embedding: list[float],
        top_k: int,
        filters: dict[str, Any] | None = None,
    ) -> list[RetrievedDocument]: ...

    def clear(self) -> None: ...

    def persist(self) -> None: ...

    def load(self) -> None: ...

    def size(self) -> int: ...
