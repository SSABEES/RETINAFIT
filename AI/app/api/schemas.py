from __future__ import annotations

from typing import Any

from pydantic import BaseModel, Field, HttpUrl


# ── 측정 / 분석 (기존) ───────────────────────────────────────────

class AnalysisRequest(BaseModel):
    image_url: HttpUrl


class AnalysisResponse(BaseModel):
    face_shape: str | None = None
    measurements: dict[str, float] = Field(default_factory=dict)
    recommendations: list[str] = Field(default_factory=list)


# ── RAG 공통 ────────────────────────────────────────────────────

class RetrievedChunk(BaseModel):
    id: str
    score: float
    text: str
    metadata: dict[str, Any] = Field(default_factory=dict)


class RagDebug(BaseModel):
    """디버깅·관찰용 메타데이터. 운영에서는 숨기거나 프로파일별로 노출 결정."""
    prompt: str | None = None
    context_chars: int | None = None


# ── /rag/query: 자유 질의응답 ────────────────────────────────────

class RagQueryRequest(BaseModel):
    question: str
    top_k: int | None = None
    filters: dict[str, Any] | None = None
    include_debug: bool = False


class RagQueryResponse(BaseModel):
    answer: str
    retrieved: list[RetrievedChunk] = Field(default_factory=list)
    debug: RagDebug | None = None


# ── /rag/recommend: 안경 추천 ────────────────────────────────────

class RagRecommendRequest(BaseModel):
    """BE의 visit/face/recommend 데이터를 그대로 받을 수 있도록 dict 기반."""
    face_measurements: dict[str, Any]                       # visited.test_json
    recommend_options: dict[str, Any] | list[Any]            # visited.opt_recommend_json
    glasses_catalog: list[dict[str, Any]] = Field(default_factory=list)
    top_k: int | None = None
    filters: dict[str, Any] | None = None
    include_debug: bool = False


class RagRecommendResponse(BaseModel):
    answer: str
    retrieved: list[RetrievedChunk] = Field(default_factory=list)
    debug: RagDebug | None = None


# ── /rag/report: 최종 리포트 본문 생성 ───────────────────────────

class RagReportRequest(BaseModel):
    visit_summary: dict[str, Any] = Field(default_factory=dict)
    measurements: dict[str, Any] = Field(default_factory=dict)         # test_json
    recommend_options: dict[str, Any] | list[Any] = Field(default_factory=dict)
    fitting: dict[str, Any] = Field(default_factory=dict)              # vp_json + real_vp_json
    top_k: int | None = None
    filters: dict[str, Any] | None = None
    include_debug: bool = False


class RagReportResponse(BaseModel):
    answer: str
    retrieved: list[RetrievedChunk] = Field(default_factory=list)
    debug: RagDebug | None = None


# ── /report/face-script: 얼굴 측정 → 상담사 스크립트 ──────────────

class FaceScriptRequest(BaseModel):
    """test_json의 필드를 그대로 받음 (FE/BE가 test_json을 펼쳐서 보내면 됨).
    누락된 값은 LLM이 해당 항목 멘트를 생략. 미래에 새 필드가 추가돼도 무시.
    """
    schema_version: int | None = None
    face_shape: str | None = None                                       # 'oval' 같은 라벨
    asymmetry_score: float | None = None                                # 작을수록 좌우 대칭 ↑
    face_shape_recommendations: list[dict[str, Any]] = Field(default_factory=list)
    skin_tone: dict[str, Any] | None = None                             # {tone: COOL/WARM, hue_deg, ...}
    skin_tone_recommendations: list[dict[str, Any]] = Field(default_factory=list)
    measurements: dict[str, dict[str, Any]] = Field(default_factory=dict)
    # measurements 형태: {face_width: {value_mm, value_px, source}, face_height: {...}, pd: {...}, right_pd: {...}, left_pd: {...}}
    face_ratio: float | None = None
    scale: dict[str, Any] | None = None                                 # 사용 안 함, 호환만
    include_debug: bool = False

    model_config = {"extra": "ignore"}


class FaceScriptItems(BaseModel):
    """LLM이 채울 항목별 멘트. 입력이 없는 항목은 None."""
    face_width: str | None = None
    face_height: str | None = None
    face_ratio: str | None = None
    face_shape: str | None = None       # 얼굴형 + 비대칭 + 추천 프레임 형태 통합
    pd: str | None = None               # PD + 좌/우 균형 통합
    skin_tone: str | None = None        # 퍼스널 컬러 톤 + 추천 색상 통합


class FaceScriptResponse(BaseModel):
    summary: str
    items: FaceScriptItems
    raw_answer: str | None = None  # 디버깅용 (LLM 원문)


# ── /rag/ingest: 지식베이스 인덱싱 ────────────────────────────────

class RagIngestRequest(BaseModel):
    knowledge_dir: str | None = None      # 미지정 시 settings.KNOWLEDGE_DIR
    reset: bool = False
    persist: bool = True


class RagIngestResponse(BaseModel):
    source: str
    documents: int
    chunks: int
    store_size: int
