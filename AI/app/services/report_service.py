"""리포트 관련 서비스 (RAG 미사용).

face_script: 얼굴 측정값 6항목 → 상담사 스크립트(JSON) 생성. 순수 LLM 호출.
"""
from __future__ import annotations

import json
import re
from typing import Any

from app.api.schemas import FaceScriptItems, FaceScriptRequest, FaceScriptResponse
from app.common.logger import logger
from app.llm.base import LLMProvider
from app.prompts import build_face_script_prompt


def generate_face_script(payload: FaceScriptRequest, *, llm: LLMProvider) -> FaceScriptResponse:
    """얼굴 측정 6항목 → 상담사 스크립트 JSON.

    입력 dict에서 None 값은 제외해서 프롬프트에 넘김 → LLM이 누락 항목 멘트는 생략.
    LLM 응답이 JSON 형식 어긋나도 500 안 던지고 폴백 응답 반환.
    """
    measurements = _build_measurements_payload(payload)
    measurements_json = json.dumps(measurements, ensure_ascii=False, indent=2)
    prompt = build_face_script_prompt(measurements_json)

    answer = llm.generate(prompt)
    return _parse_face_script(answer, include_debug=payload.include_debug)


def _build_measurements_payload(payload: FaceScriptRequest) -> dict[str, Any]:
    """test_json 필드를 LLM 친화적인 평탄 dict로 정리.

    - measurements 안의 {value_mm, value_px, source} 중 value_mm만 추출.
    - face_shape/skin_tone에 추천 라벨을 같이 묶어 단일 블록으로 전달.
    - 입력에 없는 항목은 출력 dict에서 키 자체 생략 (LLM이 멘트 생략하도록).
    """
    out: dict[str, Any] = {}

    # 얼굴형 + 비대칭 + 추천 프레임 형태 통합
    if payload.face_shape:
        face_shape_block: dict[str, Any] = {"label": payload.face_shape}
        if payload.asymmetry_score is not None:
            face_shape_block["asymmetry_score"] = payload.asymmetry_score
        recommended_frames = [
            r.get("name") for r in payload.face_shape_recommendations if isinstance(r, dict) and r.get("name")
        ]
        if recommended_frames:
            face_shape_block["recommended_frames"] = recommended_frames
        out["face_shape"] = face_shape_block

    # 측정값에서 value_mm 추출
    measurements = payload.measurements or {}
    face_width_mm = _value_mm(measurements.get("face_width"))
    if face_width_mm is not None:
        out["face_width_mm"] = face_width_mm
    face_height_mm = _value_mm(measurements.get("face_height"))
    if face_height_mm is not None:
        out["face_height_mm"] = face_height_mm

    # 얼굴 비율
    if payload.face_ratio is not None:
        out["face_ratio"] = payload.face_ratio

    # PD + 좌/우 통합 (LLM이 좌우 균형 멘트하기 쉽게)
    pd_block: dict[str, Any] = {}
    pd_mm = _value_mm(measurements.get("pd"))
    if pd_mm is not None:
        pd_block["pd_mm"] = pd_mm
    right_pd_mm = _value_mm(measurements.get("right_pd"))
    if right_pd_mm is not None:
        pd_block["right_pd_mm"] = right_pd_mm
    left_pd_mm = _value_mm(measurements.get("left_pd"))
    if left_pd_mm is not None:
        pd_block["left_pd_mm"] = left_pd_mm
    if pd_block:
        out["pd"] = pd_block

    # 스킨 톤 + 추천 색상 통합
    if payload.skin_tone:
        skin_tone_block: dict[str, Any] = {}
        tone = payload.skin_tone.get("tone")
        if tone:
            skin_tone_block["tone"] = tone
        hue_deg = payload.skin_tone.get("hue_deg")
        if hue_deg is not None:
            skin_tone_block["hue_deg"] = hue_deg
        recommended_colors = [
            r.get("label") for r in payload.skin_tone_recommendations if isinstance(r, dict) and r.get("label")
        ]
        if recommended_colors:
            skin_tone_block["recommended_colors"] = recommended_colors
        if skin_tone_block:
            out["skin_tone"] = skin_tone_block

    return out


def _value_mm(measurement: Any) -> float | None:
    """measurements 항목에서 value_mm만 안전하게 꺼낸다."""
    if not isinstance(measurement, dict):
        return None
    value = measurement.get("value_mm")
    if isinstance(value, (int, float)):
        return float(value)
    return None


def _strip_code_fence(text: str) -> str:
    """Gemini 등이 ```json ... ``` 펜스로 감싸 오는 경우를 벗긴다.

    펜스 없으면 원문 그대로 반환. 첫 번째 { ~ 마지막 } 블록만 추출.
    """
    if not text:
        return text
    stripped = text.strip()
    fence_match = re.search(r"```(?:json)?\s*(.*?)```", stripped, flags=re.DOTALL)
    if fence_match:
        stripped = fence_match.group(1).strip()
    first_brace = stripped.find("{")
    last_brace = stripped.rfind("}")
    if first_brace != -1 and last_brace > first_brace:
        return stripped[first_brace : last_brace + 1]
    return stripped


def _parse_face_script(raw_answer: str, *, include_debug: bool) -> FaceScriptResponse:
    """LLM JSON 문자열 → FaceScriptResponse. 실패 시 폴백."""
    raw_answer_for_debug = raw_answer if include_debug else None
    try:
        data = json.loads(_strip_code_fence(raw_answer))
        if not isinstance(data, dict):
            raise ValueError("face script payload is not an object")
        items_raw = data.get("items") or {}
        if not isinstance(items_raw, dict):
            items_raw = {}
        items = FaceScriptItems(
            face_width=_str_or_none(items_raw.get("face_width")),
            face_height=_str_or_none(items_raw.get("face_height")),
            face_ratio=_str_or_none(items_raw.get("face_ratio")),
            face_shape=_str_or_none(items_raw.get("face_shape")),
            pd=_str_or_none(items_raw.get("pd")),
            skin_tone=_str_or_none(items_raw.get("skin_tone")),
        )
        # summary1: 메타포 한 줄, summary2: 관찰+추천 본문. 둘 다 못 받으면 빈 문자열.
        # 구버전 LLM 응답(summary 단일 필드)도 들어올 수 있어 호환 처리: summary → summary2 로 흘림.
        summary1 = _str_or_none(data.get("summary1")) or ""
        summary2 = (
            _str_or_none(data.get("summary2"))
            or _str_or_none(data.get("summary"))
            or ""
        )
        return FaceScriptResponse(
            summary1=summary1,
            summary2=summary2,
            items=items,
            raw_answer=raw_answer_for_debug,
        )
    except (json.JSONDecodeError, ValueError, TypeError) as exc:
        # 폴백 진입 — LLM 이 JSON 형식을 어겼거나 형태가 안 맞을 때.
        # 운영 중 LLM/프롬프트 회귀를 감지하려면 반드시 가시화 필요.
        logger.warning(
            "face_script JSON parse failed, falling back to raw text: err=%s raw=%s",
            exc,
            (raw_answer or "")[:300],
        )
        return FaceScriptResponse(
            summary1="",
            summary2=raw_answer.strip() if raw_answer else "",
            items=FaceScriptItems(),
            raw_answer=raw_answer_for_debug,
        )


def _str_or_none(value: Any) -> str | None:
    if value is None:
        return None
    if isinstance(value, str):
        stripped = value.strip()
        return stripped or None
    return str(value)
