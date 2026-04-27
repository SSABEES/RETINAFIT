from pydantic import BaseModel
from datetime import datetime
from typing import Optional


class GlassesCreate(BaseModel):
    """안경 등록 요청"""
    glasses_name: str
    glasses_brand: str
    glasses_img_url: str
    glasses_3d_url: Optional[str] = None
    glasses_spec_json: dict
    is_active: bool = True


class GlassesUpdate(BaseModel):
    """안경 수정 요청"""
    glasses_name: Optional[str] = None
    glasses_brand: Optional[str] = None
    glasses_img_url: Optional[str] = None
    glasses_3d_url: Optional[str] = None
    glasses_spec_json: Optional[dict] = None
    is_active: Optional[bool] = None


class GlassesResponse(BaseModel):
    """안경 응답"""
    glasses_no: int
    glasses_name: str
    glasses_brand: str
    glasses_img_url: str
    glasses_3d_url: Optional[str] = None
    glasses_spec_json: dict
    is_active: bool
    created_at: datetime

    model_config = {"from_attributes": True}