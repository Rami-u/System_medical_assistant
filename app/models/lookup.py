from sqlalchemy import Integer, String
from sqlalchemy.orm import Mapped, mapped_column, relationship
from .database import Base


class LkDiabetesType(Base):
    __tablename__ = "lk_diabetes_types"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    type_name: Mapped[str] = mapped_column(String(50), nullable=False, unique=True)

    # relationships
    patients: Mapped[list["Patient"]] = relationship(back_populates="diabetes_type")


class LkSpecialization(Base):
    __tablename__ = "lk_specializations"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    spec_name: Mapped[str] = mapped_column(String(100), nullable=False, unique=True)

    # relationships
    doctors: Mapped[list["Doctor"]] = relationship(back_populates="specialization")
