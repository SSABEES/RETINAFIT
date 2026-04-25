from pydantic import BaseModel
from typing import Optional


# ─── 관리자 추천 옵션 CRUD ────────────────────────────────────

class RecommendOptionCreate(BaseModel):
    """추천 옵션 추가 요청"""
    option_name: str
    option_category: str
    display_order: int
    is_active: bool = True


class RecommendOptionUpdate(BaseModel):
    """추천 옵션 수정 요청"""
    option_name: Optional[str] = None
    option_category: Optional[str] = None
    is_active: Optional[bool] = None


class RecommendOptionOrderUpdate(BaseModel):
    """추천 옵션 순서 변경 요청"""
    display_order: int


class RecommendOptionResponse(BaseModel):
    """추천 옵션 응답"""
    option_no: int
    option_name: str
    option_category: str
    display_order: int
    is_active: bool

    model_config = {"from_attributes": True}


# ─── 안경사 추천 선택 ─────────────────────────────────────────

class RecommendSaveRequest(BaseModel):
    """안경사 추천 옵션 선택 저장 요청"""
    opt_recommend_json: dict    # 안경사가 선택한 추천 옵션 데이터


class RecommendSaveResponse(BaseModel):
    """안경사 추천 옵션 선택 저장 응답"""
    visit_no: int
    opt_recommend_json: Optional[dict] = None

    model_config = {"from_attributes": True}