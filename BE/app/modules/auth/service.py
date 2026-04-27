import httpx

from app.core.config import settings
from app.common.exceptions import ExternalAPIException
from app.modules.auth.schemas import LoginRequest, LoginResponse, OptInfo, MemberInfo


async def login(request: LoginRequest) -> LoginResponse:
    """
    외부 Retina API에 로그인 요청 후 응답 가공해서 반환

    외부 API 요청 형식:
    POST https://rapi.beta9.kr/retina/login
    {
        "data": {
            "p_nm": "PKG_RTN_SSAFY.SP_S_LOGIN",
            "in1": "아이디",
            "in2": "비밀번호",
            "out1": "cursor",
            "out2": "cursor",
            "out3": "num"
        },
        "token": "",
        "token_no": ""
    }
    """
    async with httpx.AsyncClient() as client:
        try:
            response = await client.post(
                url=f"{settings.EXTERNAL_API_BASE_URL}/retina/login",
                json={
                    "data": {
                        "p_nm": "PKG_RTN_SSAFY.SP_S_LOGIN",
                        "in1": request.id,
                        "in2": request.password,
                        "out1": "cursor",
                        "out2": "cursor",
                        "out3": "num"
                    },
                    "token": "",
                    "token_no": ""
                },
                timeout=10.0  # 10초 안에 응답 없으면 에러
            )
            response.raise_for_status()
            data = response.json()

        except httpx.TimeoutException:
            raise ExternalAPIException("외부 API 응답 시간이 초과됐습니다.")
        except httpx.HTTPError:
            raise ExternalAPIException("외부 API 호출에 실패했습니다.")

    # 로그인 성공 여부 확인 (out3 == 0 이면 성공)
    out3 = data.get("data", {}).get("out3")
    if out3 != 0:
        raise ExternalAPIException("아이디 또는 비밀번호가 올바르지 않습니다.")

    # 응답 가공
    opt = data["data"]["out1"][0]
    members = data["data"]["out2"]  # 안경사 목록 배열

    return LoginResponse(
        token=data["token"],
        token_no=data["token_no"],
        opt_info=OptInfo(
            opt_no=opt["OPT_NO"],
            opt_name=opt["OPT_NAME"],
            company_tel=opt["COMPANY_TEL"],
        ),
        member_list=[
            MemberInfo(
                member_no=member["MEMBER_NO"],
                member_name=member["MEMBER_NAME"],
                mobile=member["MOBILE"],
            )
            for member in members
        ]
    )