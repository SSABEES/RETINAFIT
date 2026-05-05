from __future__ import annotations
from fastapi import APIRouter, Depends

# ── 요청/응답 DTO ──
# Pydantic BaseModel 을 상속한 클래스들. 자세한 건 schemas.py 참고.
from app.api.schemas import (
    FaceScriptRequest,
    FaceScriptResponse,
)

# DI provider 함수. Spring 의 @Bean 메서드 비슷한 역할.
# get_llm_provider() 는 LLMProvider 싱글턴을 반환하는 팩토리.
from app.core.deps import get_llm_provider
from app.llm.base import LLMProvider  # ← 인터페이스(=Java 의 interface). 구현은 dummy/gemini 둘 중 하나가 주입됨.
from app.services import report_service

# 라우터 인스턴스 생성. 이 객체에 데코레이터로 엔드포인트를 등록
router = APIRouter()


# ── Health ───────────────────────────────────────────────────────

# @router.get(...) ≈ Spring 의 @GetMapping(...).
# 인자 없는 단순 GET. 모니터링 / k8s liveness probe 가 200 으로 살았다 죽었다 판단.
# tags=["..."] 는 Swagger UI (/docs) 에서 그룹 표시용 라벨. 동작에는 영향 없음.
@router.get("/health", tags=["health"])
def health() -> dict[str, str]:
    # 반환값 dict 는 FastAPI 가 자동으로 JSON 직렬화 → application/json 응답.
    # Spring 에서 @ResponseBody + Map<String,String> 반환과 같은 효과.
    return {"status": "ok"}


# ── 리포트 (얼굴 측정 → 상담 스크립트) ─────────────────────────────

@router.post("/report/face-script", response_model=FaceScriptResponse, tags=["report"])
def report_face_script(
    payload: FaceScriptRequest,
    # ↓ DI 핵심.
    # `llm: LLMProvider = Depends(get_llm_provider)` 의 의미:
    #   "이 함수가 호출될 때 마다 get_llm_provider() 를 호출한 결과를 llm 에 주입해라."
    # Spring 으로 치면 메서드 파라미터에 @Autowired 한 것과 같음 (Spring 은 생성자 주입이 표준이지만 개념은 동일).
    # get_llm_provider 는 @lru_cache 라 첫 호출에만 진짜 객체 만들고 이후엔 같은 인스턴스 재사용 — 사실상 싱글턴.
    # 테스트에서는 app.dependency_overrides[get_llm_provider] = lambda: FakeLLM() 한 줄로 갈아끼울 수 있음.
    llm: LLMProvider = Depends(get_llm_provider),
) -> FaceScriptResponse:
    """얼굴 측정값 6항목 → 상담사 스크립트(JSON) 생성."""
    return report_service.generate_face_script(payload, llm=llm)
