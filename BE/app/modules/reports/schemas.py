from pydantic import BaseModel
from datetime import datetime
from typing import Optional


# ─── 중간 리포트 ──────────────────────────────────────────────

class InterimReportResponse(BaseModel):
    """중간 리포트 응답 - 얼굴 분석 결과"""
    visit_no: int
    main_file: Optional[str] = None
    test_file_arr: Optional[list] = None
    test_json: Optional[dict] = None
    test_dt: Optional[datetime] = None

    model_config = {"from_attributes": True}


# ─── 최종 리포트 ──────────────────────────────────────────────

class FinalReportCreate(BaseModel):
    """최종 리포트 생성 요청"""
    report_json: dict


class FinalReportResponse(BaseModel):
    """최종 리포트 응답"""
    visit_no: int
    report_json: Optional[dict] = None
    test_json: Optional[dict] = None
    opt_recommend_json: Optional[dict] = None
    vp_file_arr: Optional[list] = None
    real_vp_json: Optional[dict] = None
    update_dt: Optional[datetime] = None

    model_config = {"from_attributes": True}