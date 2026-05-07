from pydantic import BaseModel, field_validator
from datetime import datetime
from typing import Optional

# ─── 고객 검색 ────────────────────────────────────────────────

class CustomerSearchResponse(BaseModel):
    """고객 검색 응답 - 고객 목록"""
    cust_no: int
    cust_name: str
    phone1: str
    phone2: Optional[str] = None
    birthday: str
    sex: int  # 0: 남자, 1: 여자
    has_face_analysis: bool = False  # 얼굴분석 완료 여부
    has_lifestyle: bool = False  # 생활패턴(추천옵션) 완료 여부


# ─── 고객 등록 ────────────────────────────────────────────────

class CustomerCreateRequest(BaseModel):
    """신규 고객 등록 요청"""
    cust_name: str
    phone1: str
    phone2: Optional[str] = None
    birthday: str   # YYYY-MM-DD
    sex: int        # 0: 남자, 1: 여자

    @field_validator("phone1", "phone2", mode="before")
    @classmethod
    def remove_hyphen(cls, v):
        """전화번호 하이픈 제거 (010-1234-1234 → 01012341234)"""
        if v:
            return v.replace("-", "").replace(" ", "")
        return v


# ─── 방문 생성 ────────────────────────────────────────────────

class VisitCreateRequest(BaseModel):
    """방문 생성 요청 - 고객 선택 후 새 방문 시작"""
    opt_no: int
    cust_no: int
    cust_name: str
    birthday: str
    phone_no1: str
    phone_no2: Optional[str] = None
    sex: int
    member_no: int

class VisitCreateResponse(BaseModel):
    """방문 생성 응답 - visit_no 반환"""
    visit_no: int
    create_dt: datetime


# ─── 방문 조회/업데이트 공통 응답 ─────────────────────────────

class VisitResponse(BaseModel):
    """방문 전체 데이터 응답"""
    visit_no: int
    opt_no: int
    cust_no: int
    cust_name: str
    birthday: str
    phone_no1: str
    phone_no2: Optional[str] = None
    sex: int
    member_no: int
    main_file: Optional[str] = None
    test_file_arr: Optional[list] = None
    test_json: Optional[dict] = None
    opt_recommend_json: Optional[dict] = None
    vp_file_arr: Optional[list] = None
    vp_json: Optional[dict] = None
    real_vp_json: Optional[dict] = None
    report_json: Optional[dict] = None
    create_dt: datetime
    test_dt: Optional[datetime] = None
    vp_dt: Optional[datetime] = None
    real_vp_dt: Optional[datetime] = None
    update_dt: Optional[datetime] = None

    model_config = {"from_attributes": True}


class VisitUpdateRequest(BaseModel):
    """방문 데이터 업데이트 요청 - 변경된 필드만 전달"""
    main_file: Optional[str] = None
    test_file_arr: Optional[list] = None
    test_json: Optional[dict] = None
    opt_recommend_json: Optional[dict] = None
    vp_file_arr: Optional[list] = None
    vp_json: Optional[dict] = None
    real_vp_json: Optional[dict] = None
    report_json: Optional[dict] = None
    test_dt: Optional[datetime] = None
    vp_dt: Optional[datetime] = None
    real_vp_dt: Optional[datetime] = None


# ─── 방문 이력 조회 ───────────────────────────────────────────

class VisitHistoryResponse(BaseModel):
    """고객 방문 이력 목록"""
    cust_no: int
    visits: list[VisitResponse]