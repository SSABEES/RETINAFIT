from __future__ import annotations

import json
import threading
from pathlib import Path
from typing import Any

import numpy as np

from app.common.exceptions import AIException
from app.rag.documents import Document, RetrievedDocument


class InMemoryVectorStore:
    """numpy-backed cosine-similarity store with file persistence.

    Suitable for small to mid-size knowledge bases. The store keeps
    embeddings in a single (N, dim) matrix and the corresponding
    Document records in a parallel list, persisted as `vectors.npy`
    and `documents.jsonl`.
    """

    def __init__(self, dimension: int, persist_path: str) -> None:
        self._dimension = dimension
        self._persist_dir = Path(persist_path)
        self._lock = threading.RLock()
        self._matrix: np.ndarray = np.zeros((0, dimension), dtype=np.float32)
        self._documents: list[Document] = []
        self._index: dict[str, int] = {}

    @property
    def dimension(self) -> int:
        return self._dimension

    def size(self) -> int:
        with self._lock:
            return len(self._documents)

    def clear(self) -> None:
        with self._lock:
            self._matrix = np.zeros((0, self._dimension), dtype=np.float32)
            self._documents = []
            self._index = {}

    def upsert(self, documents: list[Document], embeddings: list[list[float]]) -> None:
        if len(documents) != len(embeddings):
            raise AIException("documents and embeddings must have the same length")
        if not documents:
            return
        new_vecs = np.asarray(embeddings, dtype=np.float32)
        if new_vecs.shape[1] != self._dimension:
            raise AIException(
                f"embedding dimension mismatch: expected {self._dimension}, got {new_vecs.shape[1]}"
            )
        new_vecs = _l2_normalize(new_vecs)

        with self._lock:
            for doc, vec in zip(documents, new_vecs):
                if doc.id in self._index:
                    pos = self._index[doc.id]
                    self._documents[pos] = doc
                    self._matrix[pos] = vec
                else:
                    pos = len(self._documents)
                    self._documents.append(doc)
                    self._matrix = np.vstack([self._matrix, vec[np.newaxis, :]])
                    self._index[doc.id] = pos

    def search(
        self,
        embedding: list[float],
        top_k: int,
        filters: dict[str, Any] | None = None,
    ) -> list[RetrievedDocument]:
        with self._lock:
            if not self._documents:
                return []
            query = _l2_normalize(np.asarray(embedding, dtype=np.float32)[np.newaxis, :])[0]
            scores = self._matrix @ query
            order = np.argsort(-scores)
            results: list[RetrievedDocument] = []
            for idx in order:
                if filters and not _matches(self._documents[idx].metadata, filters):
                    continue
                results.append(
                    RetrievedDocument(document=self._documents[idx], score=float(scores[idx]))
                )
                if len(results) >= top_k:
                    break
            return results

    def persist(self) -> None:
        with self._lock:
            self._persist_dir.mkdir(parents=True, exist_ok=True)
            np.save(self._persist_dir / "vectors.npy", self._matrix)
            with (self._persist_dir / "documents.jsonl").open("w", encoding="utf-8") as fp:
                for doc in self._documents:
                    fp.write(
                        json.dumps(
                            {"id": doc.id, "text": doc.text, "metadata": doc.metadata},
                            ensure_ascii=False,
                        )
                        + "\n"
                    )

    def load(self) -> None:
        vectors_path = self._persist_dir / "vectors.npy"
        docs_path = self._persist_dir / "documents.jsonl"
        if not vectors_path.exists() or not docs_path.exists():
            return
        with self._lock:
            matrix = np.load(vectors_path)
            documents: list[Document] = []
            with docs_path.open("r", encoding="utf-8") as fp:
                for line in fp:
                    line = line.strip()
                    if not line:
                        continue
                    raw = json.loads(line)
                    documents.append(
                        Document(text=raw["text"], metadata=raw.get("metadata", {}), id=raw["id"])
                    )
            if matrix.shape[0] != len(documents):
                raise AIException("vector store on-disk mismatch: matrix rows != document count")
            self._matrix = matrix.astype(np.float32, copy=False)
            self._documents = documents
            self._index = {doc.id: i for i, doc in enumerate(documents)}


def _l2_normalize(matrix: np.ndarray) -> np.ndarray:
    norm = np.linalg.norm(matrix, axis=1, keepdims=True)
    norm = np.where(norm == 0, 1.0, norm)
    return matrix / norm


def _matches(metadata: dict[str, Any], filters: dict[str, Any]) -> bool:
    for key, value in filters.items():
        actual = metadata.get(key)
        if isinstance(value, (list, tuple, set)):
            if isinstance(actual, list):
                if not any(v in actual for v in value):
                    return False
            elif actual not in value:
                return False
        else:
            if isinstance(actual, list):
                if value not in actual:
                    return False
            elif actual != value:
                return False
    return True
