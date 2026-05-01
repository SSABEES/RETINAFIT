from __future__ import annotations

import httpx

from app.common.exceptions import AIException


class OpenAIEmbeddingProvider:
    """OpenAI-compatible embeddings via HTTP (works with any OpenAI-API
    compatible endpoint by overriding base_url)."""

    def __init__(
        self,
        model: str,
        api_key: str | None,
        base_url: str,
        dimension: int,
        timeout: float = 30.0,
    ) -> None:
        if not api_key:
            raise AIException("EMBEDDING_API_KEY is not configured")
        self._model = model
        self._base_url = base_url.rstrip("/")
        self._dimension = dimension
        self._headers = {"Authorization": f"Bearer {api_key}"}
        self._timeout = timeout

    @property
    def dimension(self) -> int:
        return self._dimension

    def embed_documents(self, texts: list[str]) -> list[list[float]]:
        if not texts:
            return []
        return self._call(texts)

    def embed_query(self, text: str) -> list[float]:
        return self._call([text])[0]

    def _call(self, texts: list[str]) -> list[list[float]]:
        payload = {"model": self._model, "input": texts}
        with httpx.Client(timeout=self._timeout) as client:
            response = client.post(
                f"{self._base_url}/embeddings",
                json=payload,
                headers=self._headers,
            )
        if response.status_code >= 400:
            raise AIException(f"Embedding API error {response.status_code}: {response.text}")
        data = response.json().get("data", [])
        return [item["embedding"] for item in data]
