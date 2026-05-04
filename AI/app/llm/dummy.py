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
        temperature: float | None = None,
        max_tokens: int | None = None,
    ) -> str:
        header = "[dummy-llm]"
        sections = []
        if system:
            sections.append(f"system: {system.strip()[:200]}")
        sections.append(f"prompt:\n{prompt.strip()[:1200]}")
        body = "\n\n".join(sections)
        return f"{header}\n{body}"
