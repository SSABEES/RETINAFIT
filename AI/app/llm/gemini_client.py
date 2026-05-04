from __future__ import annotations

import httpx

from app.common.exceptions import AIException


class GeminiProvider:
    """Google Gemini generateContent client over httpx.

    SSAFY GMS 경유 호출에 맞춤. base_url 예:
    https://gms.ssafy.io/gmsapi/generativelanguage.googleapis.com/v1beta
    """

    def __init__(
        self,
        model: str,
        api_key: str | None,
        base_url: str,
        temperature: float = 0.2,
        max_tokens: int = 1024,
        timeout: float = 60.0,
    ) -> None:
        if not api_key:
            raise AIException("LLM_API_KEY is not configured")
        self._model = model
        self._base_url = base_url.rstrip("/")
        self._headers = {
            "x-goog-api-key": api_key,
            "Content-Type": "application/json",
        }
        self._default_temperature = temperature
        self._default_max_tokens = max_tokens
        self._timeout = timeout

    def generate(
        self,
        prompt: str,
        *,
        system: str | None = None,
        temperature: float | None = None,
        max_tokens: int | None = None,
    ) -> str:
        payload: dict = {
            "contents": [
                {"role": "user", "parts": [{"text": prompt}]},
            ],
            "generationConfig": {
                "temperature": self._default_temperature if temperature is None else temperature,
                "maxOutputTokens": self._default_max_tokens if max_tokens is None else max_tokens,
            },
        }
        if system:
            payload["systemInstruction"] = {"parts": [{"text": system}]}

        url = f"{self._base_url}/models/{self._model}:generateContent"
        with httpx.Client(timeout=self._timeout) as client:
            response = client.post(url, json=payload, headers=self._headers)
        if response.status_code >= 400:
            raise AIException(f"LLM API error {response.status_code}: {response.text}")

        data = response.json()
        candidates = data.get("candidates", [])
        if not candidates:
            raise AIException("LLM returned no candidates")
        parts = candidates[0].get("content", {}).get("parts", [])
        if not parts:
            raise AIException("LLM returned no content parts")
        text = parts[0].get("text")
        if not text:
            raise AIException("LLM returned empty text")
        return text
