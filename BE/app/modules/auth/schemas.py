from pydantic import BaseModel


# ─── 요청 ─────────────────────────────────────────────────────

class LoginRequest(BaseModel):
    """FE → BE 로그인 요청"""
    id: str       # 안경원 아이디
    password: str # 안경원 비밀번호


# ─── 응답 ─────────────────────────────────────────────────────

class OptInfo(BaseModel):
    """안경원 정보"""
    opt_no: int
    opt_name: str
    company_tel: str


class MemberInfo(BaseModel):
    """안경사 정보"""
    member_no: int
    member_name: str
    mobile: str


class LoginResponse(BaseModel):
    """BE → FE 로그인 응답"""
    token: str
    token_no: str
    opt_info: OptInfo               # 안경원 정보
    member_list: list[MemberInfo]   # 안경사 목록


# ─── 관리자 로그인 ────────────────────────────────────────────

class AdminLoginRequest(BaseModel):
    """관리자 로그인 요청"""
    id: str
    password: str


class AdminLoginResponse(BaseModel):
    """관리자 로그인 응답"""
    admin_token: str