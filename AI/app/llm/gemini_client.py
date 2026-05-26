from __future__ import annotations

import httpx

from app.common.exceptions import AIException
from app.common.logger import logger


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
        # httpx.Client 를 매 generate() 호출마다 만들지 않고 인스턴스 단위로 재사용.
        # deps.get_llm_provider() 가 @lru_cache 라 GeminiProvider 자체도 싱글턴 → Client 도 싱글턴.
        # 내부 connection pool 재사용으로 TLS 핸드셰이크 비용 절감.
        self._client = httpx.Client(timeout=timeout)

    def generate(
        self,
        prompt: str,
        *,
        system: str | None = None,
        temperature: float | None = None,
        max_tokens: int | None = None,
    ) -> str:
        # Gemini generateContent 요청 본문 — 공식 REST 스키마.
        # contents: 대화 턴 배열 (지금은 user 1턴만 보냄 — multi-turn 미사용).
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
            # systemInstruction 은 Gemini 의 system prompt 슬롯 — OpenAI 의 role:system 과 같은 역할.
            payload["systemInstruction"] = {"parts": [{"text": system}]}

        url = f"{self._base_url}/models/{self._model}:generateContent"
        try:
            response = self._client.post(url, json=payload, headers=self._headers)
        except httpx.TimeoutException as exc:
            logger.error("Gemini API timeout: model=%s url=%s", self._model, url)
            raise AIException("LLM API timeout") from exc
        except httpx.HTTPError as exc:
            logger.error("Gemini API HTTP error: model=%s url=%s err=%s", self._model, url, exc)
            raise AIException(f"LLM API request failed: {exc}") from exc

        if response.status_code >= 400:
            # 응답 본문은 길 수 있으므로 앞부분만 잘라 로그. 전체는 AIException 메시지로 전달.
            logger.error(
                "Gemini API error: status=%d model=%s body=%s",
                response.status_code,
                self._model,
                response.text[:500],
            )
            raise AIException(f"LLM API error {response.status_code}: {response.text}")

        # Gemini 응답 구조: { candidates: [{ content: { parts: [{ text: "..." }] } }, ...] }
        # 각 단계마다 빈 값일 수 있어 방어적으로 풀어낸다 — 비어 있으면 AIException 으로 일관 처리.
        data = response.json()
        candidates = data.get("candidates", [])
        if not candidates:
            logger.error("Gemini returned no candidates: model=%s data=%s", self._model, data)
            raise AIException("LLM returned no candidates")
        parts = candidates[0].get("content", {}).get("parts", [])
        if not parts:
            logger.error("Gemini returned no content parts: model=%s data=%s", self._model, data)
            raise AIException("LLM returned no content parts")
        text = parts[0].get("text")
        if not text:
            logger.error("Gemini returned empty text: model=%s data=%s", self._model, data)
            raise AIException("LLM returned empty text")
        return text
