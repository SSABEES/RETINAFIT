"""LLM 팩토리.

설정값(LLM_PROVIDER 환경변수) 에 따라 구체 구현체를 골라 반환.
Spring 의 @ConditionalOnProperty 로 빈을 갈아끼우는 것과 동일한 패턴.
"""
from app.common.exceptions import AIException
from app.core.config import settings
from app.llm.base import LLMProvider
from app.llm.dummy import DummyLLMProvider
from app.llm.gemini_client import GeminiProvider


def build_llm_provider() -> LLMProvider:
    """LLM_PROVIDER 설정값에 따라 구체 클래스 인스턴스를 만든다.

    실제 호출은 deps.get_llm_provider 가 한 번만 빌드해 캐시하므로,
    이 함수는 사실상 부팅 시 1회 실행.
    """
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
        # 로컬 개발/테스트용 echo provider — 실제 LLM 호출 없이 프롬프트를 그대로 반환.
        return DummyLLMProvider()
    # 알 수 없는 provider 값은 도메인 예외로 일관화.
    # raw ValueError 로 두면 전역 핸들러의 unhandled_exception_handler 가 500 으로 잡아버려서
    # "설정 오류"라는 의미가 응답·로그에서 드러나지 않음. AIException 으로 던지면
    # ai_exception_handler 가 502 + error_code=AI_FAILURE 로 일관 응답.
    raise AIException(f"Unknown LLM provider: {provider}")


# 외부에서 `from app.llm import ...` 로 가져올 공개 심볼.
__all__ = ["LLMProvider", "build_llm_provider"]
