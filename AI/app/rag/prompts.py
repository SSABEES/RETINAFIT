from __future__ import annotations

from app.rag.documents import RetrievedDocument

SYSTEM_PROMPT = (
    "당신은 안경원 현장에서 안경사를 보조하는 RetinAI 어시스턴트입니다. "
    "주어진 컨텍스트(사내 가이드 문서)에 근거해 정확하고 간결한 한국어로 답변하세요. "
    "컨텍스트에 없는 정보는 추정하지 말고 모른다고 답하세요. "
    "수치를 인용할 때는 반드시 단위를 표기하고, 컨텍스트에 출처가 있으면 [source] 형식으로 표시하세요."
)


def format_context(retrieved: list[RetrievedDocument], *, max_chars: int = 4000) -> str:
    if not retrieved:
        return "(관련 문서를 찾지 못함)"
    blocks: list[str] = []
    used = 0
    for i, item in enumerate(retrieved, start=1):
        meta = item.document.metadata
        title = meta.get("title") or meta.get("filename") or item.document.id
        category = meta.get("category", "")
        source = meta.get("source", "")
        header = f"[{i}] {title}" + (f" · {category}" if category else "")
        if source:
            header += f" ({source})"
        block = f"{header}\nscore={item.score:.3f}\n{item.document.text.strip()}"
        if used + len(block) > max_chars and blocks:
            break
        blocks.append(block)
        used += len(block)
    return "\n\n---\n\n".join(blocks)


def build_query_prompt(question: str, context: str) -> str:
    return (
        f"### 질문\n{question.strip()}\n\n"
        f"### 컨텍스트\n{context}\n\n"
        f"### 지시\n"
        f"- 컨텍스트에 직접적인 근거가 있을 때만 답변하세요.\n"
        f"- 답변 끝에 사용한 컨텍스트 번호를 [n] 형식으로 표기하세요."
    )


def build_recommend_prompt(
    profile: str,
    options: str,
    glasses_catalog: str,
    context: str,
) -> str:
    return (
        f"### 고객 프로필 / 측정값\n{profile}\n\n"
        f"### 안경사 선택 옵션\n{options}\n\n"
        f"### 후보 안경 목록\n{glasses_catalog}\n\n"
        f"### 사내 가이드 컨텍스트\n{context}\n\n"
        f"### 지시\n"
        f"- 후보 목록 중 적합도 상위 3개를 선정하고 각 선정 이유를 2~3문장으로 설명하세요.\n"
        f"- 얼굴형/측정값/옵션 중 어떤 근거를 사용했는지 명시하세요.\n"
        f"- 응답은 JSON으로, top: [{{glasses_no, score(0~1), reason}}]와 summary 필드를 포함하세요."
    )


REPORT_OUTPUT_SCHEMA = """{
  "title": "string",                              // 한 줄 제목 (예: "OOO 고객님 맞춤 안경 리포트")
  "greeting": "string",                            // 인사말 1~2문장
  "sections": [
    {
      "heading": "측정 요약",
      "summary": "string",                         // 손님에게 직접 말하듯 1~2문장
      "items": [                                    // 표 형태로 보여줄 행들
        {"label": "동공 사이 거리(PD)", "value": "64.5 mm", "note": "양쪽이 거의 대칭이에요"}
      ]
    }
  ],
  "highlights": ["string"],                        // 손님이 꼭 기억해야 할 포인트 2~4개 (불릿)
  "care_tips": ["string"],                         // 사후 관리 팁 2~3개 (불릿)
  "closing": "string"                              // 마무리 인사 1문장
}"""


FACE_SCRIPT_OUTPUT_SCHEMA = """{
  "summary": "string",                              // 1~2문장 종합 코멘트
  "items": {                                         // 입력에 없는 항목은 키 자체를 생략
    "face_width": "string?",                         // 얼굴 너비 멘트 (1~2문장)
    "face_height": "string?",                        // 얼굴 길이 멘트
    "face_ratio": "string?",                         // 얼굴 비율 멘트 (1:1.41 식으로 표시 가능)
    "face_shape": "string?",                         // 얼굴형 + 비대칭 + 추천 프레임 형태 통합
    "pd": "string?",                                 // PD + 좌/우 균형 통합
    "skin_tone": "string?"                           // 퍼스널 컬러 톤 + 추천 색상 통합
  }
}"""


# 도메인 정상 범위 — RAG retrieval 없이 프롬프트에 직접 박아서 환각 방지.
_FACE_SCRIPT_NORMAL_RANGES = """\
- PD (눈 사이 거리): 성인 평균 60~66 mm. 여성 평균 ≈ 62 mm, 남성 평균 ≈ 64 mm.
- 좌/우 PD 차이: 1 mm 이내면 균형이 잘 잡힌 상태. 그 이상이면 살짝 비대칭.
- 얼굴 너비: 성인 평균 130~145 mm.
- 얼굴 길이: 성인 평균 180~200 mm.
- 얼굴 비율 (길이 ÷ 너비): 1.30~1.50 사이가 황금비에 가까움. 1.30 미만은 가로형, 1.50 초과는 세로형으로 인지됨.
- 비대칭 점수 (asymmetry_score): 0에 가까울수록 좌우 대칭이 좋음. 값이 클수록 비대칭이 두드러짐. 구체적 임계값은 임의로 만들지 말고 입력 값을 그대로 인용.
- 스킨 톤 라벨: COOL = 쿨톤(푸른/차가운 계열의 색이 잘 어울림), WARM = 웜톤(노란/따뜻한 계열이 잘 어울림). 추천 색상은 입력에 동봉된 목록만 인용.
- 얼굴형 라벨(face_shape): oval=계란형, round=둥근형, square=사각형, heart=하트형, oblong=긴형 등. 추천 프레임 형태(face_shape_recommendations)는 입력 그대로 인용.\
"""


def build_face_script_prompt(measurements_json: str) -> str:
    """얼굴 측정값 → 상담사 스크립트 생성 프롬프트.

    RAG 미사용. 정상 범위와 도메인 라벨은 프롬프트에 직접 내장.
    """
    return (
        "당신은 안경원에서 안경사가 손님에게 측정 결과를 설명할 때 읽을 상담 스크립트를 작성하는 작성자입니다.\n\n"
        f"### 측정값 (입력)\n{measurements_json}\n\n"
        f"### 도메인 정상 범위 / 라벨 사전 (참고용 — 멘트에 인용 가능)\n{_FACE_SCRIPT_NORMAL_RANGES}\n\n"
        "### 작성 지시 (반드시 준수)\n"
        "1. 어투: 존칭, '~해요/~예요' 어미. 손님에게 직접 말하듯 친근하게.\n"
        "2. 모든 수치는 단위와 함께 표기. 예) 63 mm. 입력 수치는 새로 만들지 말고 그대로 인용.\n"
        "3. 측정값이 누락된(null/없는) 항목은 items에서 키 자체를 생략.\n"
        "4. 정상 범위·임계값 인용은 위 '도메인 정상 범위' 목록에 있는 값만 사용. 새 수치/임계값을 만들지 말 것.\n"
        "5. 의학적 진단·도수 단정 금지. '예상돼요/추천드려요' 같은 부드러운 어조.\n"
        "6. summary는 1~2문장 종합 코멘트.\n"
        "7. items 각 멘트는 1~2문장.\n"
        "8. items.face_shape: 얼굴형 라벨을 한국어로 풀어 설명하고, asymmetry_score가 있으면 함께 언급. recommended_frames 목록이 있으면 'OO/OO 형태가 잘 어울려요' 식으로 자연스럽게 녹임.\n"
        "9. items.pd: pd_mm을 메인으로 멘트하고, right_pd_mm/left_pd_mm이 있으면 좌우 균형(차이가 1 mm 이내면 양호)을 같이 짚음.\n"
        "10. items.skin_tone: tone 라벨을 한국어(쿨톤/웜톤)로 풀어주고, recommended_colors가 있으면 'OO/OO 색이 잘 어울려요' 식으로 녹임. hue_deg는 굳이 노출하지 않음 (내부 값).\n"
        "11. 출력은 아래 JSON 스키마만 반환. 코드 블록·설명·인사말 금지.\n\n"
        f"### 출력 JSON 스키마\n{FACE_SCRIPT_OUTPUT_SCHEMA}"
    )


def build_report_prompt(
    visit_summary: str,
    measurements: str,
    options: str,
    fitting: str,
    context: str,
) -> str:
    return (
        "당신은 안경원 최종 리포트를 손님이 읽기 쉬운 한국어로 풀어쓰는 작성자입니다.\n\n"
        f"### 방문 요약\n{visit_summary}\n\n"
        f"### 얼굴 측정값 (MediaPipe / 실측)\n{measurements}\n\n"
        f"### 안경사 추천 옵션\n{options}\n\n"
        f"### 가상/실제 피팅 결과\n{fitting}\n\n"
        f"### 사내 가이드 컨텍스트\n{context}\n\n"
        "### 작성 지시 (중요)\n"
        "1. 어투: 컨텍스트의 콘텐츠 작성 규칙을 따르세요 — 존칭, '~해요' 어미, 손님을 직접 부르듯 친근하게.\n"
        "2. 전문용어는 괄호로 풀어 설명하세요. 예) 'PD(동공 사이 거리)', 'OH(렌즈 위에서 동공까지 높이)', "
        "'BVD(눈과 렌즈 사이 거리)', 'PT(렌즈 기울기)', 'Wrap(안경이 얼굴을 감싸는 정도)'.\n"
        "3. 모든 수치는 단위를 함께 표기하세요. 예) 64.5 mm, 9.5°.\n"
        "4. 정상 범위·경고 기준은 컨텍스트에 명시된 값만 인용하세요 (예: OH 18~25 mm, BVD 12~14 mm). "
        "컨텍스트에 없는 의학적 진단은 절대 단정하지 않습니다.\n"
        "5. 추천 사유는 '얼굴형/측정값 → 어떤 프레임·렌즈가 잘 어울려요' 흐름으로 풀어주세요.\n"
        "6. 다음 섹션을 반드시 포함: 측정 요약, 어울리는 프레임, 렌즈·옵션 안내, 피팅 결과, 사후 관리 팁.\n"
        "7. 출력은 아래 JSON 스키마를 정확히 따르세요. 코드 블록·설명 없이 JSON만 반환.\n\n"
        f"### 출력 JSON 스키마\n{REPORT_OUTPUT_SCHEMA}"
    )
