from __future__ import annotations


class DummyLLMProvider:
    """Echo-style LLM stub for local dev / tests.

    Produces a deterministic, structured response that surfaces the
    retrieved context so we can verify the pipeline end-to-end without
    calling an external model.
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
