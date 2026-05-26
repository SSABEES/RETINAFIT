"""LLM 추상화 — Java 의 interface 와 동일한 역할.

Protocol = 구조적 타이핑. 클래스가 명시적으로 상속 안 해도 시그니처만 맞으면 LLMProvider 로 인정됨
(Java 인터페이스보다 느슨함 — duck typing). DummyLLMProvider / GeminiProvider 둘 다 상속 선언 없이
이 Protocol 을 만족.

@runtime_checkable 덕에 isinstance(obj, LLMProvider) 체크도 가능 (테스트에서 유용).
"""
from __future__ import annotations

from typing import Protocol, runtime_checkable


@runtime_checkable
class LLMProvider(Protocol):
    def generate(
        self,
        prompt: str,
        *,                                # 이후는 키워드 전용 인자 (Java 에는 없는 Python 문법).
        system: str | None = None,        # system instruction (옵션)
        temperature: float | None = None, # 호출 단위 override (None 이면 provider 기본값)
        max_tokens: int | None = None,
    ) -> str: ...                          # `...` = 본문 생략. interface 메서드 선언과 같은 효과.
