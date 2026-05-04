from __future__ import annotations

from functools import lru_cache

from app.llm import build_llm_provider
from app.llm.base import LLMProvider


@lru_cache(maxsize=1)
def get_llm_provider() -> LLMProvider:
    return build_llm_provider()


def reset_caches() -> None:
    """Clear cached singletons. Used by tests / hot-reload scenarios."""
    get_llm_provider.cache_clear()
