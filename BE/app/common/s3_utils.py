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


def generate_presigned_url(object_key: str, expires_in: int = 600) -> str:
    """
    S3 업로드용 Presigned URL 발급
    - expires_in: URL 만료 시간 (초, 기본 10분)
    """
    s3_client = get_s3_client()
    try:
        url = s3_client.generate_presigned_url(
            "put_object",
            Params={
                "Bucket": settings.S3_BUCKET_NAME,
                "Key": object_key,
            },
            ExpiresIn=expires_in,
        )
        return url
    except ClientError as e:
        raise Exception(f"Presigned URL 발급 실패: {str(e)}")


def generate_object_key(visit_no: int, folder: str, filename: str = None, extension: str = "jpg") -> str:
    """
    S3 저장 경로 생성
    예: visits/1/test/bare/uuid.jpg
        visits/0/glasses/3d/uuid.glb
    """
    if not filename:
        filename = f"{uuid.uuid4()}.{extension}"
    return f"visits/{visit_no}/{folder}/{filename}"


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