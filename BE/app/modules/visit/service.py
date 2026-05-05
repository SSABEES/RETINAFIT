import httpx
from sqlalchemy.ext.asyncio import AsyncSession
from fastapi import BackgroundTasks

from app.core.config import settings
from app.common.s3_utils import get_presigned_download_url
from app.common.exceptions import ExternalAPIException, NotFoundException
from app.common.error_codes import ErrorCode
from app.modules.visit import repository
from app.modules.visit.tasks import generate_and_save_face_script
from app.modules.visit.schemas import (
    CustomerCreateRequest,
    CustomerSearchResponse,
    VisitCreateRequest,
    VisitCreateResponse,
    VisitResponse,
    VisitHistoryResponse,
    VisitUpdateRequest,
)

def _convert_visit_urls(visit: VisitResponse) -> VisitResponse:
    """visit 이미지 key → 조회용 Presigned URL 변환"""
    if visit.main_file:
        visit.main_file = get_presigned_download_url(visit.main_file)
    if visit.test_file_arr:
        visit.test_file_arr = [get_presigned_download_url(k) for k in visit.test_file_arr]
    if visit.vp_file_arr:
        visit.vp_file_arr = [get_presigned_download_url(k) for k in visit.vp_file_arr]
    return visit

def _check_token_expired(data: dict):
    """토큰 만료 체크 - O_TOKEN이 -1이면 만료"""
    if data.get("O_TOKEN") == "-1":
        raise ExternalAPIException("토큰이 만료됐습니다. 다시 로그인해주세요.")


def _check_external_error(data: dict):
    """외부 API 에러 체크 - RESULT 필드 있으면 에러"""
    if "RESULT" in data.get("data", {}):
        raise ExternalAPIException(f"외부 API 오류: {data['data']['RESULT']}")


# ─── 고객 검색 ────────────────────────────────────────────────

async def search_customer(
    phone_no: str,
    opt_no: int,
    token: str,
    token_no: str,
) -> list[CustomerSearchResponse]:
    """전화번호로 고객 검색 (외부 Retina API 중계)"""
    async with httpx.AsyncClient() as client:
        try:
            response = await client.post(
                url=f"{settings.EXTERNAL_API_BASE_URL}/retina/request",
                json={
                    "data": {
                        "p_nm": "PKG_RTN_SSAFY.SP_L_CUST_PHONE",
                        "in1": str(opt_no),
                        "in2": phone_no.replace("-", "").replace(" ", ""),
                        "out1": "cursor",
                        "out2": "num",
                    },
                    "token": token,
                    "token_no": token_no,
                },
                timeout=10.0,
            )
            response.raise_for_status()
            data = response.json()

        except httpx.TimeoutException:
            raise ExternalAPIException("외부 API 응답 시간이 초과됐습니다.")
        except httpx.HTTPError:
            raise ExternalAPIException("외부 API 호출에 실패했습니다.")

    _check_token_expired(data)
    _check_external_error(data)

    customers = data.get("data", {}).get("out1", [])
    return [
        CustomerSearchResponse(
            cust_no=c["CUST_NO"],
            cust_name=c["CUST_NAME"],
            phone1=c["PHONE1"],
            phone2=c.get("PHONE2"),
            birthday=c["BIRTHDAY"],
            sex=int(c["SEX"]),
        )
        for c in customers
    ]


# ─── 고객 등록 ────────────────────────────────────────────────

async def create_customer(
    request: CustomerCreateRequest,
    opt_no: int,
    token: str,
    token_no: str,
) -> bool:
    """신규 고객 등록 (외부 Retina API 중계)"""
    async with httpx.AsyncClient() as client:
        try:
            response = await client.post(
                url=f"{settings.EXTERNAL_API_BASE_URL}/retina/request",
                json={
                    "data": {
                        "p_nm": "PKG_RTN_SSAFY.SP_I_CUST",
                        "in1": str(opt_no),
                        "in2": request.cust_name,
                        "in3": request.phone1,
                        "in4": request.phone2 or "",
                        "in5": request.birthday,
                        "in6": str(request.sex),
                        "out1": "num",
                        "out2": "num",
                        "out3": "num",
                    },
                    "token": token,
                    "token_no": token_no,
                },
                timeout=10.0,
            )
            response.raise_for_status()
            data = response.json()

        except httpx.TimeoutException:
            raise ExternalAPIException("외부 API 응답 시간이 초과됐습니다.")
        except httpx.HTTPError:
            raise ExternalAPIException("외부 API 호출에 실패했습니다.")

    _check_token_expired(data)
    _check_external_error(data)

    # 성공 조건: out2 == "1" and out3 == "0"
    out2 = str(data.get("data", {}).get("out2", ""))
    out3 = str(data.get("data", {}).get("out3", ""))
    if out2 != "1" or out3 != "0":
        raise ExternalAPIException("고객 등록에 실패했습니다.")

    return True


# ─── 방문 생성 ────────────────────────────────────────────────

async def create_visit(
    db: AsyncSession,
    request: VisitCreateRequest,
) -> VisitCreateResponse:
    """방문 생성 - visited 테이블에 row 추가 후 visit_no 반환"""
    visit = await repository.create_visit(db, request.model_dump())
    return VisitCreateResponse(
        visit_no=visit.visit_no,
        create_dt=visit.create_dt,
    )


# ─── 방문 이력 조회 ───────────────────────────────────────────

async def get_visit_history(
    db: AsyncSession,
    cust_no: int,
) -> VisitHistoryResponse:
    """고객 방문 이력 조회"""
    visits = await repository.get_visits_by_cust(db, cust_no)
    return VisitHistoryResponse(
        cust_no=cust_no,
        visits=[_convert_visit_urls(VisitResponse.model_validate(v)) for v in visits],
    )


# ─── 방문 단건 조회 ───────────────────────────────────────────

async def get_visit(
    db: AsyncSession,
    visit_no: int,
) -> VisitResponse:
    """방문 단건 상세 조회"""
    visit = await repository.get_visit(db, visit_no)
    if not visit:
        raise NotFoundException(
            error_code=ErrorCode.VISIT_NOT_FOUND,
            message="방문 정보를 찾을 수 없습니다.",
        )
    return _convert_visit_urls(VisitResponse.model_validate(visit))


async def update_visit(
    db: AsyncSession,
    visit_no: int,
    request: VisitUpdateRequest,
    background_tasks: BackgroundTasks,
) -> VisitResponse:
    """방문 데이터 업데이트"""
    visit = await repository.update_visit(
        db, visit_no, request.model_dump(exclude_unset=True)
    )
    if not visit:
        raise NotFoundException(
            error_code=ErrorCode.VISIT_NOT_FOUND,
            message="방문 정보를 찾을 수 없습니다.",
        )

    # test_json 새로 들어오면 백그라운드로 AI face-script 요청
    if request.test_json is not None:
        background_tasks.add_task(
            generate_and_save_face_script,
            visit_no,
            request.test_json,
        )

    return _convert_visit_urls(VisitResponse.model_validate(visit))