import boto3
from botocore.exceptions import ClientError
from botocore.signers import CloudFrontSigner
import uuid
from datetime import datetime, timezone, timedelta
from cryptography.hazmat.primitives import serialization, hashes
from cryptography.hazmat.primitives.asymmetric import padding

from app.core.config import settings

# 모듈 레벨에서 S3 클라이언트 한 번만 생성
_s3_client = boto3.client(
    "s3",
    aws_access_key_id=settings.AWS_ACCESS_KEY_ID,
    aws_secret_access_key=settings.AWS_SECRET_ACCESS_KEY,
    region_name=settings.AWS_REGION,
)

# CloudFront Signer - CloudFront 설정 있을 때만 생성
_cf_signer = None
if settings.CLOUDFRONT_DOMAIN and settings.CLOUDFRONT_KEY_ID and settings.CLOUDFRONT_PRIVATE_KEY_PATH:
    def _rsa_signer(message):
        with open(settings.CLOUDFRONT_PRIVATE_KEY_PATH, 'rb') as f:
            private_key = serialization.load_pem_private_key(f.read(), password=None)
        return private_key.sign(message, padding.PKCS1v15(), hashes.SHA1())
    _cf_signer = CloudFrontSigner(settings.CLOUDFRONT_KEY_ID, _rsa_signer)

def get_s3_client():
    """S3 클라이언트 반환 (싱글톤)"""
    return _s3_client


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
    S3 이미지 URL 반환
    - CloudFront 설정 있으면 CloudFront URL ← 수정
    - 없으면 S3 퍼블릭 URL
    """
    if _cf_signer:
        return f"{settings.CLOUDFRONT_DOMAIN}/{object_key}"
    return f"https://{settings.S3_BUCKET_NAME}.s3.{settings.AWS_REGION}.amazonaws.com/{object_key}"


def get_presigned_download_url(object_key: str, expires_in: int = 3600) -> str:
    """
    S3 조회용 CloudFrontURL 발급
    - CloudFront 설정 있으면 CloudFront Signed URL
    - 없으면 S3 Presigned URL
    """
    if _cf_signer:  # ← 추가
        expire_date = datetime.now(timezone.utc) + timedelta(seconds=expires_in)
        return _cf_signer.generate_presigned_url(
            f"{settings.CLOUDFRONT_DOMAIN}/{object_key}",
            date_less_than=expire_date,
        )

    # 기존 S3 Presigned URL
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