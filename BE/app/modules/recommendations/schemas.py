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
    display_order: Optional[int] = None
    is_active: Optional[bool] = None


class RecommendOptionResponse(BaseModel):
    """추천 옵션 응답"""
    option_no: int
    option_name: str
    option_category: str
    display_order: int
    is_active: bool

    model_config = {"from_attributes": True}
