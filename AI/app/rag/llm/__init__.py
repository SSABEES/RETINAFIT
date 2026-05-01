from app.core.config import settings
from app.rag.llm.base import LLMProvider
from app.rag.llm.dummy import DummyLLMProvider
from app.rag.llm.gemini_client import GeminiProvider


def build_llm_provider() -> LLMProvider:
    provider = settings.LLM_PROVIDER.lower()
    if provider == "gemini":
        return GeminiProvider(
            model=settings.LLM_MODEL,
            api_key=settings.LLM_API_KEY,
            base_url=settings.LLM_BASE_URL,
            temperature=settings.LLM_TEMPERATURE,
            max_tokens=settings.LLM_MAX_TOKENS,
        )
    if provider == "dummy":
        return DummyLLMProvider()
    raise ValueError(f"Unknown LLM provider: {provider}")


__all__ = ["LLMProvider", "build_llm_provider"]
