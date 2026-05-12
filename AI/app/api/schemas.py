# ── import ───────────────────────────────────────────
from __future__ import annotations
from typing import Any
from pydantic import BaseModel, Field


# ── /report/face-script: 얼굴 측정 → 상담사 스크립트 ──────────────

class FaceScriptRequest(BaseModel):
    """test_json의 필드를 그대로 받음 (FE/BE가 test_json을 펼쳐서 보내면 됨).
    누락된 값은 LLM이 해당 항목 멘트를 생략. 미래에 새 필드가 추가돼도 무시.
    """
    # 모든 필드가 Optional. 입력 형태가 클라이언트마다 다른 걸 허용.
    # Java 라면 @Nullable + 기본값 null 인 필드들. 받은 데이터 모양에 따라 LLM 이 적절히 멘트 구성.
    schema_version: int | None = None
    face_shape: str | None = None                                       # 'oval' 같은 라벨
    asymmetry_score: float | None = None                                # 작을수록 좌우 대칭 ↑
    # `list[dict[str, Any]]` ≈ List<Map<String, Object>>.
    # 내부 형태가 자유로운 nested JSON. 강타입 모델로 만들 수도 있지만,
    # 이 필드는 BE 에서 그대로 패스스루되므로 굳이 모델링 안 하고 dict 으로 받음.
    face_shape_recommendations: list[dict[str, Any]] = Field(default_factory=list)
    skin_tone: dict[str, Any] | None = None                             # {tone: COOL/WARM, hue_deg, ...}
    skin_tone_recommendations: list[dict[str, Any]] = Field(default_factory=list)
    measurements: dict[str, dict[str, Any]] = Field(default_factory=dict)
    # measurements 형태: {face_width: {value_mm, value_px, source}, face_height: {...}, pd: {...}, right_pd: {...}, left_pd: {...}}
    face_ratio: float | None = None
    scale: dict[str, Any] | None = None                                 # 사용 안 함, 호환만
    include_debug: bool = False

    # model_config: 클래스 단위 설정 (Pydantic v2 방식).
    # "extra": "ignore" 의 의미:
    #   - 요청 JSON 에 모델에 정의 안 된 필드가 와도 무시하고 통과.
    #   - 기본값은 "ignore" 라 명시 안 해도 같은 동작이지만, 의도를 코드에 박아둠.
    #   - 다른 옵션:
    #       "forbid" → 모르는 필드 오면 422 (엄격 모드)
    #       "allow"  → 모르는 필드를 인스턴스에 그대로 보존
    # Spring/Jackson 의 @JsonIgnoreProperties(ignoreUnknown=true) 와 같은 효과.
    model_config = {"extra": "ignore"}


class FaceScriptItems(BaseModel):
    """LLM이 채울 항목별 멘트. 입력이 없는 항목은 None."""
    # nested DTO. Java 의 inner DTO 와 같이, 응답 안의 한 객체 단위를 따로 모델링.
    # 응답 구조가 { summary, items: { face_width, face_height, ... } } 라서 items 를 별도 클래스로 분리.
    face_width: str | None = None
    face_height: str | None = None
    face_ratio: str | None = None
    face_shape: str | None = None       # 얼굴형 + 비대칭 + 추천 프레임 형태 통합
    pd: str | None = None               # PD + 좌/우 균형 통합
    skin_tone: str | None = None        # 퍼스널 컬러 톤 + 추천 색상 통합


class FaceScriptResponse(BaseModel):
    # 종합 멘트를 두 줄로 분리 — UI 에서 줄바꿈을 명시적으로 표현. 둘 중 하나라도 비어있으면 422.
    summary1: str
    summary2: str
    # 다른 BaseModel 을 필드 타입으로 — Java 의 nested DTO 참조와 동일.
    # 직렬화 시 자동으로 nested JSON object 로 펼쳐짐.
    items: FaceScriptItems
    raw_answer: str | None = None  # 디버깅용 (LLM 원문)
