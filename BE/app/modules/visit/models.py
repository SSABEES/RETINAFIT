from sqlalchemy import BigInteger, Column, DateTime, JSON, String
from sqlalchemy.dialects.mysql import TINYINT
from sqlalchemy.sql import func

from app.core.database import Base


class Visit(Base):
    __tablename__ = "visited"

    # ─── 기본 정보 ────────────────────────────────────────────
    visit_no = Column(BigInteger, primary_key=True, autoincrement=True, comment="방문 고유 ID")
    opt_no = Column(BigInteger, nullable=False, comment="안경원 번호(외부 API)")
    cust_no = Column(BigInteger, nullable=False, comment="고객 번호(외부 API)")
    cust_name = Column(String(50), nullable=False, comment="고객 이름")
    birthday = Column(String(10), nullable=False, comment="생년월일 (YYYY-MM-DD)")
    phone_no1 = Column(String(13), nullable=False, comment="고객 휴대폰 번호")
    phone_no2 = Column(String(13), nullable=True, comment="고객 예비 휴대폰 번호")
    sex = Column(TINYINT, nullable=False, comment="0: 남자 / 1: 여자")
    member_no = Column(BigInteger, nullable=False, comment="안경사 번호(외부 API)")

    # ─── 사진 / 측정 데이터 ───────────────────────────────────
    main_file = Column(String(500), nullable=True, comment="정면사진 URL")
    test_file_arr = Column(JSON, nullable=True, comment="측정 사진 파일들")
    test_json = Column(JSON, nullable=True, comment="측정한 내역")
    opt_recommend_json = Column(JSON, nullable=True, comment="안경사 추천 데이터")

    # ─── 가상 피팅 ────────────────────────────────────────────
    vp_file_arr = Column(JSON, nullable=True, comment="가상 피팅 사진들")
    vp_json = Column(JSON, nullable=True, comment="가상 피팅 데이터")

    # ─── 실제 착용 ────────────────────────────────────────────
    real_vp_json = Column(JSON, nullable=True, comment="실제 착용 측정 데이터")

    # ─── 리포트 ───────────────────────────────────────────────
    report_json = Column(JSON, nullable=True, comment="최종 리포트 데이터")

    # ─── 날짜 ─────────────────────────────────────────────────
    create_dt = Column(DateTime, nullable=False, server_default=func.now(), comment="최초 생성일시")
    test_dt = Column(DateTime, nullable=True, comment="얼굴 측정 완료 일시")
    vp_dt = Column(DateTime, nullable=True, comment="가상 피팅 완료 일시")
    real_vp_dt = Column(DateTime, nullable=True, comment="실제 착용 측정 완료 일시")
    update_dt = Column(DateTime, nullable=True, onupdate=func.now(), comment="마지막 수정일시")