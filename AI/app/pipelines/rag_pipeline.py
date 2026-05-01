from __future__ import annotations

from dataclasses import dataclass, field
from typing import Any

from app.rag.documents import RetrievedDocument
from app.rag.llm.base import LLMProvider
from app.rag.prompts import SYSTEM_PROMPT, build_query_prompt, format_context
from app.rag.retriever import Retriever


@dataclass
class RagResult:
    answer: str
    retrieved: list[RetrievedDocument] = field(default_factory=list)
    prompt: str = ""
    metadata: dict[str, Any] = field(default_factory=dict)


def run_rag_pipeline(
    query: str,
    *,
    retriever: Retriever,
    llm: LLMProvider,
    system_prompt: str = SYSTEM_PROMPT,
    top_k: int | None = None,
    filters: dict[str, Any] | None = None,
    prompt_builder=build_query_prompt,
    context_max_chars: int = 4000,
    temperature: float | None = None,
    max_tokens: int | None = None,
) -> RagResult:
    retrieved = retriever.retrieve(query, top_k=top_k, filters=filters)
    context = format_context(retrieved, max_chars=context_max_chars)
    prompt = prompt_builder(query, context)
    answer = llm.generate(
        prompt,
        system=system_prompt,
        temperature=temperature,
        max_tokens=max_tokens,
    )
    return RagResult(
        answer=answer,
        retrieved=retrieved,
        prompt=prompt,
        metadata={"context_chars": len(context)},
    )
