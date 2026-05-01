from __future__ import annotations

from fastapi import APIRouter, Depends

from app.api.schemas import (
    AnalysisRequest,
    AnalysisResponse,
    FaceScriptRequest,
    FaceScriptResponse,
    RagDebug,
    RagIngestRequest,
    RagIngestResponse,
    RagQueryRequest,
    RagQueryResponse,
    RagRecommendRequest,
    RagRecommendResponse,
    RagReportRequest,
    RagReportResponse,
    RetrievedChunk,
)
from app.core.config import settings
from app.core.deps import get_llm_provider, get_rag_service
from app.pipelines.measurement_pipeline import run_measurement_pipeline
from app.pipelines.rag_pipeline import RagResult
from app.rag.llm.base import LLMProvider
from app.services.rag_service import RagService
from app.services import report_service

router = APIRouter()


# ── Health ───────────────────────────────────────────────────────

@router.get("/health", tags=["health"])
def health() -> dict[str, str]:
    return {"status": "ok"}


# ── 측정 (기존) ──────────────────────────────────────────────────

@router.post("/analyze", response_model=AnalysisResponse, tags=["analysis"])
def analyze(payload: AnalysisRequest) -> AnalysisResponse:
    measurements = run_measurement_pipeline(payload.image_url)
    return AnalysisResponse(measurements=measurements, recommendations=[])


# ── 리포트 (RAG 미사용, 순수 LLM) ────────────────────────────────

@router.post("/report/face-script", response_model=FaceScriptResponse, tags=["report"])
def report_face_script(
    payload: FaceScriptRequest,
    llm: LLMProvider = Depends(get_llm_provider),
) -> FaceScriptResponse:
    """얼굴 측정값 6항목 → 상담사 스크립트(JSON) 생성. RAG 미사용."""
    return report_service.generate_face_script(payload, llm=llm)


# ── RAG ─────────────────────────────────────────────────────────

@router.post("/rag/query", response_model=RagQueryResponse, tags=["rag"])
def rag_query(
    payload: RagQueryRequest,
    service: RagService = Depends(get_rag_service),
) -> RagQueryResponse:
    result = service.query(payload.question, top_k=payload.top_k, filters=payload.filters)
    return RagQueryResponse(
        answer=result.answer,
        retrieved=_to_chunks(result),
        debug=_to_debug(result, include=payload.include_debug),
    )


@router.post("/rag/recommend", response_model=RagRecommendResponse, tags=["rag"])
def rag_recommend(
    payload: RagRecommendRequest,
    service: RagService = Depends(get_rag_service),
) -> RagRecommendResponse:
    result = service.recommend(
        face_measurements=payload.face_measurements,
        recommend_options=payload.recommend_options,
        glasses_catalog=payload.glasses_catalog,
        top_k=payload.top_k,
        filters=payload.filters,
    )
    return RagRecommendResponse(
        answer=result.answer,
        retrieved=_to_chunks(result),
        debug=_to_debug(result, include=payload.include_debug),
    )


@router.post("/rag/report", response_model=RagReportResponse, tags=["rag"])
def rag_report(
    payload: RagReportRequest,
    service: RagService = Depends(get_rag_service),
) -> RagReportResponse:
    result = service.report(
        visit_summary=payload.visit_summary,
        measurements=payload.measurements,
        recommend_options=payload.recommend_options,
        fitting=payload.fitting,
        top_k=payload.top_k,
        filters=payload.filters,
    )
    return RagReportResponse(
        answer=result.answer,
        retrieved=_to_chunks(result),
        debug=_to_debug(result, include=payload.include_debug),
    )


@router.post("/rag/ingest", response_model=RagIngestResponse, tags=["rag"])
def rag_ingest(
    payload: RagIngestRequest,
    service: RagService = Depends(get_rag_service),
) -> RagIngestResponse:
    result = service.ingest(
        knowledge_dir=payload.knowledge_dir or settings.KNOWLEDGE_DIR,
        reset=payload.reset,
        persist=payload.persist,
    )
    return RagIngestResponse(
        source=result.source,
        documents=result.documents,
        chunks=result.chunks,
        store_size=service.store.size(),
    )


# ── helpers ──────────────────────────────────────────────────────

def _to_chunks(result: RagResult) -> list[RetrievedChunk]:
    return [
        RetrievedChunk(
            id=item.document.id,
            score=item.score,
            text=item.document.text,
            metadata=item.document.metadata,
        )
        for item in result.retrieved
    ]


def _to_debug(result: RagResult, *, include: bool) -> RagDebug | None:
    if not include:
        return None
    return RagDebug(
        prompt=result.prompt,
        context_chars=result.metadata.get("context_chars"),
    )
