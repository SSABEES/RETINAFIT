"""FastAPI DI provider 모음.

라우터에서 `Depends(get_llm_provider)` 로 주입
"""
from __future__ import annotations

from functools import lru_cache

from fastapi import HTTPException

from app.core.config import settings
from app.llm import build_llm_provider
from app.llm.base import LLMProvider


@lru_cache(maxsize=1)
def get_llm_provider() -> LLMProvider:
    """LLM 클라이언트 싱글턴. 첫 요청 때만 build, 이후엔 캐시 반환."""
    return build_llm_provider()


def reset_caches() -> None:
    """캐싱된 싱글턴 초기화. 테스트에서 settings 갈아끼운 뒤 새 provider 로 다시 빌드할 때 사용."""
    get_llm_provider.cache_clear()


def require_llm_enabled() -> None:
    """LLM 기능 ON/OFF 가드 의존성.

    사용 패턴:
        @router.post(
            "/report/face-script",
            dependencies=[Depends(require_llm_enabled)],   # 라우트 진입 직전에 평가
            ...
        )

    동작:
        - settings.LLM_ENABLED == False 면 즉시 HTTPException(503) → 핸들러 본문 미실행.
        - True 면 아무 일도 안 하고 통과 (return None).

    왜 라우트-레벨 `dependencies=[]` 에 두는가:
        - FastAPI 가 핸들러 파라미터 의존성(`Depends(get_llm_provider)`)보다 먼저 평가.
        - 따라서 비활성화 상태에서는 GeminiProvider 빌드/HTTP Client 생성 자체가 안 일어남.
        - Spring 으로 치면 @PreAuthorize 같은 인터셉터 위치. 핸들러 안에서 if 로 거르는 것보다
          선언적이고, 새 LLM 엔드포인트 추가 시 데코레이터에 한 줄만 추가하면 됨.

    응답 형식 주의:
        - HTTPException 은 FastAPI 기본 포맷 `{"detail": "..."}` 으로 응답.
        - AIException 핸들러의 `{"success": false, "error_code": ..., "message": ...}` 와 다름.
        - "비활성화"는 운영자가 의도적으로 켠 상태라 별도 포맷 통일은 일단 보류.
          포맷을 맞추려면 전용 예외 클래스 + 핸들러를 추가하면 됨.
    """
    if not settings.LLM_ENABLED:
        raise HTTPException(
            status_code=503,
            detail="LLM 기능이 비활성화돼 있습니다 (LLM_ENABLED=false).",
        )
