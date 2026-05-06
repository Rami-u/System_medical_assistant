from datetime import datetime, timezone

from sqlalchemy import Column, DateTime, Enum, ForeignKey, Integer, Numeric, String
from sqlalchemy.orm import Mapped, mapped_column, relationship

from .database import Base


class ScreeningType(Base):
    __tablename__ = "screening_types"

    id = Column(Integer, primary_key=True, autoincrement=True)
    name: Mapped[str] = mapped_column(String(100), nullable=False, unique=True)

    # relationships
    questions: Mapped[list["Question"]] = relationship(back_populates="screening_type")
    screenings: Mapped[list["Screening"]] = relationship(
        back_populates="screening_type"
    )


class Question(Base):
    __tablename__ = "questions"

    id = Column(Integer, primary_key=True, autoincrement=True)
    screening_type_id: Mapped[int] = mapped_column(
        Integer,
        ForeignKey("screening_types.id", ondelete="CASCADE"),
        nullable=False,
    )
    question_text: Mapped[str] = mapped_column(String(500), nullable=False)
    data_type: Mapped[str] = mapped_column(String(50), nullable=False)
    display_order: Mapped[int] = mapped_column(Integer, nullable=False, default=0)

    # relationships
    screening_type: Mapped["ScreeningType"] = relationship(
        back_populates="questions"
    )
    answers: Mapped[list["ScreeningAnswer"]] = relationship(back_populates="question")


class Screening(Base):
    __tablename__ = "screenings"

    id = Column(Integer, primary_key=True, autoincrement=True)
    patient_id: Mapped[int | None] = mapped_column(
        Integer, ForeignKey("patients.id", ondelete="SET NULL"), nullable=True
    )
    screening_type_id: Mapped[int] = mapped_column(
        Integer, ForeignKey("screening_types.id"), nullable=False
    )
    risk_score: Mapped[float | None] = mapped_column(Numeric(5, 2), nullable=True)
    risk_level: Mapped[str | None] = mapped_column(
        Enum("low", "moderate", "high"), nullable=True
    )
    created_at: Mapped[datetime] = mapped_column(
        DateTime, nullable=False, default=lambda: datetime.now(timezone.utc)
    )

    # relationships
    patient: Mapped["Patient"] = relationship(back_populates="screenings")
    screening_type: Mapped["ScreeningType"] = relationship(
        back_populates="screenings"
    )
    answers: Mapped[list["ScreeningAnswer"]] = relationship(
        back_populates="screening", cascade="all, delete-orphan"
    )


class ScreeningAnswer(Base):
    __tablename__ = "screening_answers"

    id = Column(Integer, primary_key=True, autoincrement=True)
    screening_id: Mapped[int] = mapped_column(
        Integer, ForeignKey("screenings.id", ondelete="CASCADE"), nullable=False
    )
    question_id: Mapped[int] = mapped_column(
        Integer, ForeignKey("questions.id", ondelete="CASCADE"), nullable=False
    )
    answer_value: Mapped[str] = mapped_column(String(255), nullable=False)

    # relationships
    screening: Mapped["Screening"] = relationship(back_populates="answers")
    question: Mapped["Question"] = relationship(back_populates="answers")
