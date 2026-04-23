from sqlalchemy import Integer, String
from sqlalchemy.orm import DeclarativeBase, Mapped, mapped_column


class Base(DeclarativeBase):
    pass


class FittingCriteria(Base):
    __tablename__ = "fitting_criteria"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, index=True)
    name: Mapped[str] = mapped_column(String(100), index=True)
    description: Mapped[str | None] = mapped_column(String(500), nullable=True)
