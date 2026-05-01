from __future__ import annotations

import json
from dataclasses import dataclass
from typing import Any

from app.pipelines.ingestion_pipeline import IngestionResult, run_ingestion_pipeline
from app.pipelines.rag_pipeline import RagResult, run_rag_pipeline
from app.rag.embeddings.base import EmbeddingProvider
from app.rag.llm.base import LLMProvider
from app.rag.prompts import (
    build_recommend_prompt,
    build_report_prompt,
)
from app.rag.retriever import Retriever
from app.rag.vector_store.base import VectorStore


@dataclass
class RagService:
    """High-level RAG orchestrator used by the API layer."""

    retriever: Retriever
    llm: LLMProvider
    embedder: EmbeddingProvider
    store: VectorStore
    chunk_size: int
    chunk_overlap: int

    def query(
        self,
        question: str,
        *,
        top_k: int | None = None,
        filters: dict[str, Any] | None = None,
    ) -> RagResult:
        return run_rag_pipeline(
            question,
            retriever=self.retriever,
            llm=self.llm,
            top_k=top_k,
            filters=filters,
        )

    def recommend(
        self,
        *,
        face_measurements: dict[str, Any],
        recommend_options: dict[str, Any] | list[Any],
        glasses_catalog: list[dict[str, Any]],
        top_k: int | None = None,
        filters: dict[str, Any] | None = None,
    ) -> RagResult:
        retrieval_query = _build_recommend_retrieval_query(
            face_measurements, recommend_options, glasses_catalog
        )
        retrieved = self.retriever.retrieve(retrieval_query, top_k=top_k, filters=filters)
        from app.rag.prompts import format_context

        context = format_context(retrieved)
        prompt = build_recommend_prompt(
            profile=_pretty_json(face_measurements),
            options=_pretty_json(recommend_options),
            glasses_catalog=_pretty_glasses(glasses_catalog),
            context=context,
        )
        answer = self.llm.generate(prompt)
        return RagResult(answer=answer, retrieved=retrieved, prompt=prompt)

    def report(
        self,
        *,
        visit_summary: dict[str, Any],
        measurements: dict[str, Any],
        recommend_options: dict[str, Any] | list[Any],
        fitting: dict[str, Any],
        top_k: int | None = None,
        filters: dict[str, Any] | None = None,
    ) -> RagResult:
        retrieval_query = _build_report_retrieval_query(
            visit_summary, measurements, recommend_options
        )
        # 리포트는 용어 풀이·운영 톤·측정 해석·프레임/렌즈 추천을 모두 인용해야 해서 더 많은 컨텍스트가 필요.
        effective_k = top_k if top_k is not None else max(self.retriever.default_top_k, 8)
        retrieved = self.retriever.retrieve(retrieval_query, top_k=effective_k, filters=filters)
        from app.rag.prompts import format_context

        context = format_context(retrieved)
        prompt = build_report_prompt(
            visit_summary=_pretty_json(visit_summary),
            measurements=_pretty_json(measurements),
            options=_pretty_json(recommend_options),
            fitting=_pretty_json(fitting),
            context=context,
        )
        answer = self.llm.generate(prompt)
        return RagResult(answer=answer, retrieved=retrieved, prompt=prompt)

    def ingest(
        self,
        *,
        knowledge_dir: str,
        reset: bool = False,
        persist: bool = True,
    ) -> IngestionResult:
        return run_ingestion_pipeline(
            knowledge_dir=knowledge_dir,
            embedder=self.embedder,
            store=self.store,
            chunk_size=self.chunk_size,
            chunk_overlap=self.chunk_overlap,
            reset=reset,
            persist=persist,
        )


def _build_recommend_retrieval_query(
    measurements: dict[str, Any],
    options: dict[str, Any] | list[Any],
    catalog: list[dict[str, Any]],
) -> str:
    parts = ["프레임 추천", "얼굴형 매칭", "렌즈 옵션"]
    face_shape = measurements.get("face_shape") if isinstance(measurements, dict) else None
    if face_shape:
        parts.append(f"얼굴형={face_shape}")
    options_text = _flatten_options(options)
    if options_text:
        parts.append(f"옵션={options_text}")
    if catalog:
        names = [g.get("glasses_name") for g in catalog if g.get("glasses_name")]
        if names:
            parts.append("후보=" + ", ".join(names[:5]))
    return " / ".join(parts)


def _build_report_retrieval_query(
    visit: dict[str, Any],
    measurements: dict[str, Any],
    options: dict[str, Any] | list[Any],
) -> str:
    parts = [
        "최종 리포트",
        "측정 요약",
        "용어 풀이 PD OH BVD PT Wrap",
        "프레임 추천 얼굴형",
        "렌즈 옵션 누진 단초점 블루라이트 고굴절",
        "운영 톤 존칭",
        "사후 관리",
    ]
    options_text = _flatten_options(options)
    if options_text:
        parts.append(f"옵션={options_text}")
    if isinstance(measurements, dict):
        for key in ("PD", "OH", "BVD", "PT", "Wrap", "face_shape"):
            if key in measurements:
                parts.append(f"{key}={measurements[key]}")
    return " / ".join(parts)


def _flatten_options(options: dict[str, Any] | list[Any]) -> str:
    if isinstance(options, list):
        return ", ".join(str(item) for item in options)
    if isinstance(options, dict):
        flat: list[str] = []
        for key, value in options.items():
            if isinstance(value, (list, tuple)):
                flat.extend(f"{key}:{v}" for v in value)
            else:
                flat.append(f"{key}:{value}")
        return ", ".join(flat)
    return str(options)


def _pretty_json(payload: Any) -> str:
    try:
        return json.dumps(payload, ensure_ascii=False, indent=2)
    except TypeError:
        return str(payload)


def _pretty_glasses(catalog: list[dict[str, Any]]) -> str:
    lines: list[str] = []
    for g in catalog:
        no = g.get("glasses_no")
        name = g.get("glasses_name", "?")
        brand = g.get("glasses_brand", "")
        spec = g.get("glasses_spec_json") or {}
        spec_text = ", ".join(f"{k}={v}" for k, v in spec.items()) if isinstance(spec, dict) else ""
        lines.append(f"- #{no} {brand} {name} ({spec_text})".strip())
    return "\n".join(lines) if lines else "(후보 안경 없음)"
