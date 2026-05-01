from __future__ import annotations

import hashlib
import re

import numpy as np


class DummyEmbeddingProvider:
    """Deterministic hash-based embeddings for local dev / tests.

    Not semantically meaningful, but stable and dependency-free, so the
    full RAG pipeline runs end-to-end without API keys. Uses character
    bigrams so it works on Korean text without a tokenizer.
    """

    def __init__(self, dimension: int = 256) -> None:
        self._dimension = dimension

    @property
    def dimension(self) -> int:
        return self._dimension

    def embed_documents(self, texts: list[str]) -> list[list[float]]:
        return [self._embed(text) for text in texts]

    def embed_query(self, text: str) -> list[float]:
        return self._embed(text)

    def _embed(self, text: str) -> list[float]:
        vec = np.zeros(self._dimension, dtype=np.float64)
        for token in _tokens(text):
            idx = int.from_bytes(hashlib.md5(token.encode("utf-8")).digest()[:4], "big") % self._dimension
            vec[idx] += 1.0
        norm = np.linalg.norm(vec)
        if norm > 0:
            vec = vec / norm
        return vec.tolist()


_WORD_RE = re.compile(r"[\w가-힣]+", re.UNICODE)


def _tokens(text: str) -> list[str]:
    text = text.lower()
    tokens: list[str] = []
    for word in _WORD_RE.findall(text):
        tokens.append(word)
        if len(word) >= 2:
            tokens.extend(word[i : i + 2] for i in range(len(word) - 1))
    return tokens
