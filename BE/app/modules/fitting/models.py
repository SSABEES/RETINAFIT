from sqlalchemy import Boolean, Column, Enum, Integer, String, VARCHAR

from app.core.database import Base


class FittingCriteria(Base):
    __tablename__ = "fitting_criteria"

    criteria_no = Column(Integer, primary_key=True, autoincrement=True, comment="판단 기준 ID")
    criteria_label = Column(String(100), nullable=False, comment="판단 결과 유형 (예: 정상범위, 개별 가공 필요...)")
    range_type = Column(
        Enum("BELOW", "NORMAL", "ABOVE"),
        nullable=False,
        comment="기준 범위 유형: 하한값 미만 / 정상 / 상한값 초과"
    )
    lower_bound = Column(Integer, nullable=True, comment="판단 기준 하한선 (단위: mm)")
    upper_bound = Column(Integer, nullable=True, comment="판단 기준 상한선 (단위: mm)")
    out_of_range_note = Column(VARCHAR(500), nullable=True, comment="판단 결과 BELOW 또는 ABOVE인 경우 설명 (예: 속눈썹 닿음 위험)")
    is_active = Column(Boolean, nullable=False, default=True, comment="해당 항목으로 판단할건지 여부")