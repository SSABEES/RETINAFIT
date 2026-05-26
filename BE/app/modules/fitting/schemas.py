from pydantic import BaseModel
from typing import Optional, Literal


class FittingCriteriaCreate(BaseModel):
    """판단 기준 추가 요청"""
    criteria_label: str
    range_type: Literal["BELOW", "NORMAL", "ABOVE"]
    lower_bound: Optional[int] = None
    upper_bound: Optional[int] = None
    out_of_range_note: Optional[str] = None
    is_active: bool = True


class FittingCriteriaUpdate(BaseModel):
    """판단 기준 수정 요청"""
    criteria_label: Optional[str] = None
    range_type: Optional[Literal["BELOW", "NORMAL", "ABOVE"]] = None
    lower_bound: Optional[int] = None
    upper_bound: Optional[int] = None
    out_of_range_note: Optional[str] = None
    is_active: Optional[bool] = None


class FittingCriteriaResponse(BaseModel):
    """판단 기준 응답"""
    criteria_no: int
    criteria_label: str
    range_type: str
    lower_bound: Optional[int] = None
    upper_bound: Optional[int] = None
    out_of_range_note: Optional[str] = None
    is_active: bool

    model_config = {"from_attributes": True}