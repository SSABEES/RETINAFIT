"""FastAPI DI provider 모음.

라우터에서 `Depends(get_llm_provider)` 로 주입
"""
from __future__ import annotations

from functools import lru_cache

from app.llm import build_llm_provider
from app.llm.base import LLMProvider


@lru_cache(maxsize=1)
def get_llm_provider() -> LLMProvider:
    """LLM 클라이언트 싱글턴. 첫 요청 때만 build, 이후엔 캐시 반환."""
    return build_llm_provider()


def reset_caches() -> None:
    """캐싱된 싱글턴 초기화. 테스트에서 settings 갈아끼운 뒤 새 provider 로 다시 빌드할 때 사용."""
    get_llm_provider.cache_clear()
