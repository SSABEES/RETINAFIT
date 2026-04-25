from pydantic import BaseModel
from datetime import datetime
from typing import Optional


# ─── 얼굴 측정 ────────────────────────────────────────────────

class FaceAnalysisRequest(BaseModel):
    """얼굴 측정 데이터 저장 요청"""
    main_file: str                          # 정면사진 S3 URL
    test_file_arr: list[str]                # 측정 사진 파일들 [정면, 측면, 기존안경]
    test_json: dict                         # MediaPipe 측정값


class FaceAnalysisResponse(BaseModel):
    """얼굴 측정 결과 조회 응답"""
    visit_no: int
    main_file: Optional[str] = None
    test_file_arr: Optional[list] = None
    test_json: Optional[dict] = None
    test_dt: Optional[datetime] = None

    model_config = {"from_attributes": True}


# ─── 가상 피팅 ────────────────────────────────────────────────

class VirtualFittingRequest(BaseModel):
    """가상 피팅 데이터 저장 요청"""
    vp_file_arr: list[str]                  # 가상 피팅 사진 3장 S3 URL
    vp_json: dict                           # 가상 피팅 데이터


class VirtualFittingResponse(BaseModel):
    """가상 피팅 결과 조회 응답"""
    visit_no: int
    vp_file_arr: Optional[list] = None
    vp_json: Optional[dict] = None
    vp_dt: Optional[datetime] = None

    model_config = {"from_attributes": True}


# ─── 실제 착용 ────────────────────────────────────────────────

class RealFittingRequest(BaseModel):
    """실제 착용 데이터 저장 요청"""
    real_vp_json: dict                      # 실제 착용 측정 데이터


class RealFittingResponse(BaseModel):
    """실제 착용 결과 조회 응답"""
    visit_no: int
    real_vp_json: Optional[dict] = None
    real_vp_dt: Optional[datetime] = None

    model_config = {"from_attributes": True}