from sqlalchemy import Boolean, Column, Integer, String

from app.core.database import Base


class RecommendOption(Base):
    __tablename__ = "recommend_option"

    option_no = Column(Integer, primary_key=True, autoincrement=True, comment="추천 옵션 ID")
    option_name = Column(String(50), nullable=False, comment="추천 옵션명 (예: 다초점, 변색, 사무직)")
    option_category = Column(String(50), nullable=False, comment="추천 옵션 카테고리 (예: 렌즈 종류, 코팅, 생활환경)")
    display_order = Column(Integer, nullable=False, comment="화면 표시 순서 (드래그로 변경 가능)")
    is_active = Column(Boolean, nullable=False, default=True, comment="비활성화 시 화면 미표시")
