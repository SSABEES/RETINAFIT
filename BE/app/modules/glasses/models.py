from sqlalchemy import BigInteger, Boolean, Column, DateTime, JSON, String
from sqlalchemy.sql import func

from app.core.database import Base


class Glasses(Base):
    __tablename__ = "glasses"

    glasses_no = Column(BigInteger, primary_key=True, autoincrement=True, comment="안경 고유 ID")
    glasses_name = Column(String(100), nullable=False, comment="안경 제품명")
    glasses_brand = Column(String(50), nullable=False, comment="안경 브랜드명")
    glasses_img_url = Column(String(500), nullable=False, comment="안경 대표 이미지")
    glasses_3d_url = Column(String(500), nullable=True, comment="안경 3D 이미지 S3 URL")
    glasses_spec_json = Column(JSON, nullable=False, comment="안경 스펙 정보")
    is_active = Column(Boolean, nullable=False, default=True, comment="비활성화시 추천에서 제외")
    created_at = Column(DateTime, nullable=False, server_default=func.now(), comment="등록 일시")