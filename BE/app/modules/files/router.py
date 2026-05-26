from fastapi import APIRouter, Depends
import uuid

from app.modules.auth.dependencies import get_token
from app.modules.files.schemas import (
    TestFilePresignedRequest,
    TestFilePresignedResponse,
    VpFilePresignedRequest,
    VpFilePresignedResponse,
    RealVpFilePresignedResponse,
)
from app.common.s3_utils import generate_presigned_url, generate_object_key

file_router = APIRouter(tags=["files"])


@file_router.post("/visits/{visit_no}/files/face-photos", response_model=TestFilePresignedResponse, summary="얼굴 분석 사진 업로드 URL 발급")
async def get_test_file_presigned_urls(
    visit_no: int,
    request: TestFilePresignedRequest,
    auth: dict = Depends(get_token),
):
    """
    얼굴 분석 사진 Presigned URL 발급 (3장)
    - type: bare    → 미착용 3장 (필수)
    - type: glasses → 안경 착용 3장 (선택)
    - bare 정면이 main_file로 자동 저장됨
    """
    folder = f"test/{request.type}"
    front_key = generate_object_key(visit_no, folder, "front.jpg")
    left_key = generate_object_key(visit_no, folder, "left.jpg")
    right_key = generate_object_key(visit_no, folder, "right.jpg")

    return TestFilePresignedResponse(
        type=request.type,
        front_url=generate_presigned_url(front_key),
        left_url=generate_presigned_url(left_key),
        right_url=generate_presigned_url(right_key),
        front_key=front_key,
        left_key=left_key,
        right_key=right_key,
    )


@file_router.post("/visits/{visit_no}/files/fitting-photos", response_model=VpFilePresignedResponse, summary="가상 피팅 사진 업로드 URL 발급")
async def get_vp_file_presigned_urls(
    visit_no: int,
    request: VpFilePresignedRequest,
    auth: dict = Depends(get_token),
):
    """
    AR 피팅 사진 Presigned URL 발급 (안경 1개당 3장)
    - glasses_no별로 저장 경로 구분
    - 여러 번 호출 가능 (안경마다 호출)
    """
    folder = f"vp/{request.glasses_no}"
    front_key = generate_object_key(visit_no, folder, "front.jpg")
    left_key = generate_object_key(visit_no, folder, "left.jpg")
    right_key = generate_object_key(visit_no, folder, "right.jpg")

    return VpFilePresignedResponse(
        glasses_no=request.glasses_no,
        front_url=generate_presigned_url(front_key),
        left_url=generate_presigned_url(left_key),
        right_url=generate_presigned_url(right_key),
        front_key=front_key,
        left_key=left_key,
        right_key=right_key,
    )


@file_router.post("/visits/{visit_no}/files/real-wearing-photos", response_model=RealVpFilePresignedResponse, summary="실제 착용 사진 업로드 URL 발급")
async def get_real_vp_file_presigned_urls(
    visit_no: int,
    auth: dict = Depends(get_token),
):
    """
    실제 착용 사진 Presigned URL 발급 (3장)
    - 여러 번 호출 가능 (분석마다 호출)
    - attempt_id로 중복 방지
    """
    attempt_id = str(uuid.uuid4())[:8]
    folder = f"real-vp/{attempt_id}"

    front_key = generate_object_key(visit_no, folder, "front.jpg")
    left_key = generate_object_key(visit_no, folder, "left.jpg")
    right_key = generate_object_key(visit_no, folder, "right.jpg")

    return RealVpFilePresignedResponse(
        front_url=generate_presigned_url(front_key),
        left_url=generate_presigned_url(left_key),
        right_url=generate_presigned_url(right_key),
        front_key=front_key,
        left_key=left_key,
        right_key=right_key,
    )