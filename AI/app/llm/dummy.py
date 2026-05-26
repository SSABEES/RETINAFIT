from __future__ import annotations


class DummyLLMProvider:
    """Echo-style LLM stub for local dev / tests.

    프롬프트를 그대로 에코해서 파이프라인 동작을 검증할 때 사용.
    """

    def generate(
        self,
        prompt: str,
        *,
        system: str | None = None,
        temperature: float | None = None,  # dummy 는 무시 (실제 LLM 호출이 없으므로)
        max_tokens: int | None = None,
    ) -> str:
        # 프롬프트가 너무 길면 로그가 폭발하므로 적당히 자른다 — 테스트 어설션도 짧은 길이를 가정.
        header = "[dummy-llm]"
        sections = []
        if system:
            sections.append(f"system: {system.strip()[:200]}")
        sections.append(f"prompt:\n{prompt.strip()[:1200]}")
        body = "\n\n".join(sections)
        return f"{header}\n{body}"
