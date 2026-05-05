import boto3
from botocore.exceptions import ClientError
import uuid

from app.core.config import settings


def get_s3_client():
    """S3 클라이언트 생성"""
    return boto3.client(
        "s3",
        aws_access_key_id=settings.AWS_ACCESS_KEY_ID,
        aws_secret_access_key=settings.AWS_SECRET_ACCESS_KEY,
        region_name=settings.AWS_REGION,
    )


def generate_presigned_url(object_key: str, expires_in: int = 600, content_type: str = "image/jpeg") -> str:
    """
    S3 업로드용 Presigned URL 발급
    - expires_in: URL 만료 시간 (초, 기본 10분)
    - content_type: 업로드 파일 타입 (기본 image/jpeg)
    """
    s3_client = get_s3_client()
    try:
        url = s3_client.generate_presigned_url(
            "put_object",
            Params={
                "Bucket": settings.S3_BUCKET_NAME,
                "Key": object_key,
                "ContentType": content_type,
            },
            ExpiresIn=expires_in,
        )
        return url
    except ClientError as e:
        raise Exception(f"Presigned URL 발급 실패: {str(e)}")


def generate_object_key(visit_no: int = None, folder: str = None, filename: str = None, extension: str = "jpg") -> str:
    """
    S3 저장 경로 생성
    예: visits/1/test/bare/uuid.jpg   ← 방문 관련 파일
        glasses/img/uuid.jpg          ← 안경 이미지
        glasses/3d/uuid.glb           ← 안경 3D 파일
    """
    if not filename:
        filename = f"{uuid.uuid4()}.{extension}"
    if visit_no is not None:
        return f"visits/{visit_no}/{folder}/{filename}"
    return f"{folder}/{filename}"


def get_file_url(object_key: str) -> str:
    """
    S3 퍼블릭 URL 반환
    glasses/ 폴더처럼 퍼블릭 접근 허용된 경우 사용
    """
    return f"https://{settings.S3_BUCKET_NAME}.s3.{settings.AWS_REGION}.amazonaws.com/{object_key}"


def get_presigned_download_url(object_key: str, expires_in: int = 3600) -> str:
    """
    S3 조회용 Presigned URL 발급
    visits/ 폴더처럼 Private인 경우 사용
    - expires_in: URL 만료 시간 (초, 기본 1시간)
    """
    s3_client = get_s3_client()
    try:
        url = s3_client.generate_presigned_url(
            "get_object",
            Params={
                "Bucket": settings.S3_BUCKET_NAME,
                "Key": object_key,
            },
            ExpiresIn=expires_in,
        )
        return url
    except ClientError as e:
        raise Exception(f"조회용 Presigned URL 발급 실패: {str(e)}")