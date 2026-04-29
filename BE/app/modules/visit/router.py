from fastapi import APIRouter, Depends
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import get_db
from app.modules.auth.dependencies import get_token
from app.modules.visit.schemas import (
    CustomerCreateRequest,
    CustomerSearchResponse,
    VisitCreateRequest,
    VisitCreateResponse,
    VisitResponse,
    VisitHistoryResponse,
    VisitUpdateRequest,
)
from app.modules.visit import service

router = APIRouter(tags=["visit"])


# ─── 고객 ─────────────────────────────────────────────────────

@router.get("/customers/search", response_model=list[CustomerSearchResponse], summary="전화번호 기준 고객 검색")
async def search_customer(
    phone_no: str,                              # Query parameter: ?phone_no=01012341234
    opt_no: int,                                # Query parameter: ?opt_no=190
    auth: dict = Depends(get_token),            # 헤더에서 token, token_no 추출
):
    """
    전화번호로 고객 검색 (외부 Retina API 중계)
    - phone_no: 검색할 전화번호
    - opt_no: 안경원 번호 (로그인 응답의 opt_no)
    """
    return await service.search_customer(
        phone_no=phone_no,
        opt_no=opt_no,
        token=auth["token"],
        token_no=auth["token_no"],
    )


@router.post("/customers/register", status_code=201, summary="신규 고객 등록")
async def create_customer(
    request: CustomerCreateRequest,
    opt_no: int,                                # Query parameter: ?opt_no=190
    auth: dict = Depends(get_token),
):
    """
    신규 고객 등록 (외부 Retina API 중계)
    - 전화번호 하이픈 자동 제거
    """
    await service.create_customer(
        request=request,
        opt_no=opt_no,
        token=auth["token"],
        token_no=auth["token_no"],
    )
    return {"message": "고객이 등록됐습니다."}


@router.get("/customers/{cust_no}/visit-history", response_model=VisitHistoryResponse, summary="선택 고객 방문 이력 조회")
async def get_visit_history(
    cust_no: int,
    auth: dict = Depends(get_token),
    db: AsyncSession = Depends(get_db),
):
    """
    고객 방문 이력 조회 (우리 DB)
    - cust_no: 고객 번호
    - 최신순으로 반환
    - 각 방문의 visit_no 포함 (FE가 sessionStorage에 저장)
    """
    return await service.get_visit_history(db, cust_no)


# ─── 방문 ─────────────────────────────────────────────────────

@router.post("/visits", response_model=VisitCreateResponse, status_code=201, summary="신규 방문 생성")
async def create_visit(
    request: VisitCreateRequest,
    auth: dict = Depends(get_token),
    db: AsyncSession = Depends(get_db),
):
    """
    방문 생성 - visited 테이블에 row 추가
    - 응답으로 visit_no 반환 (FE가 sessionStorage에 저장)
    """
    return await service.create_visit(db, request)


@router.get("/visits/{visit_no}", response_model=VisitResponse, summary="방문 전체(목록) 조회")
async def get_visit(
    visit_no: int,
    auth: dict = Depends(get_token),
    db: AsyncSession = Depends(get_db),
):
    """방문 단건 상세 조회"""
    return await service.get_visit(db, visit_no)

@router.patch("/visits/{visit_no}", response_model=VisitResponse, summary="특정 방문 데이터 업데이트")
async def update_visit(
    visit_no: int,
    request: VisitUpdateRequest,
    auth: dict = Depends(get_token),
    db: AsyncSession = Depends(get_db),
):
    """방문 데이터 업데이트 - 변경된 필드만 전달"""
    return await service.update_visit(db, visit_no, request)