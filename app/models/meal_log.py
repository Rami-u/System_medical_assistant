from datetime import datetime, timezone

from sqlalchemy import Column, DateTime, ForeignKey, Integer, Numeric, String
from sqlalchemy.orm import Mapped, mapped_column, relationship

from .database import Base


class MealLog(Base):
    __tablename__ = "meal_logs"

    id = Column(Integer, primary_key=True, autoincrement=True)
    patient_id: Mapped[int] = mapped_column(
        Integer, ForeignKey("patients.id", ondelete="CASCADE"), nullable=False
    )
    image_url: Mapped[str | None] = mapped_column(String(500), nullable=True)
    meal_name: Mapped[str | None] = mapped_column(String(150), nullable=True)
    total_carbs_g: Mapped[float | None] = mapped_column(Numeric(6, 2), nullable=True)
    total_calories: Mapped[int | None] = mapped_column(Integer, nullable=True)
    meal_time: Mapped[datetime] = mapped_column(DateTime, nullable=False)
    created_at: Mapped[datetime] = mapped_column(
        DateTime, nullable=False, default=lambda: datetime.now(timezone.utc)
    )

    # relationships
    patient: Mapped["Patient"] = relationship(back_populates="meal_logs")
    detected_items: Mapped[list["MealDetectedItem"]] = relationship(
        back_populates="meal_log", cascade="all, delete-orphan"
    )


class MealDetectedItem(Base):
    __tablename__ = "meal_detected_items"

    id = Column(Integer, primary_key=True, autoincrement=True)
    meal_log_id: Mapped[int] = mapped_column(
        Integer, ForeignKey("meal_logs.id", ondelete="CASCADE"), nullable=False
    )
    food_name: Mapped[str] = mapped_column(String(150), nullable=False)
    confidence_pct: Mapped[float | None] = mapped_column(Numeric(5, 2), nullable=True)
    quantity_desc: Mapped[str | None] = mapped_column(String(100), nullable=True)
    carbs_g: Mapped[float | None] = mapped_column(Numeric(6, 2), nullable=True)
    calories: Mapped[int | None] = mapped_column(Integer, nullable=True)
    protein_g: Mapped[float | None] = mapped_column(Numeric(6, 2), nullable=True)
    fat_g: Mapped[float | None] = mapped_column(Numeric(6, 2), nullable=True)

    # relationships
    meal_log: Mapped["MealLog"] = relationship(back_populates="detected_items")
