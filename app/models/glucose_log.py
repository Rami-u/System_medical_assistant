from datetime import datetime, timezone

from sqlalchemy import Column, DateTime, Enum, ForeignKey, Integer, Numeric, String
from sqlalchemy.orm import Mapped, mapped_column, relationship

from .database import Base


class GlucoseLog(Base):
    __tablename__ = "glucose_logs"

    id = Column(Integer, primary_key=True, autoincrement=True)
    patient_id: Mapped[int] = mapped_column(
        Integer, ForeignKey("patients.id", ondelete="CASCADE"), nullable=False
    )
    glucose_value: Mapped[float] = mapped_column(Numeric(5, 2), nullable=False)
    reading_type: Mapped[str] = mapped_column(
        Enum("fasting", "after_meal", "before_sleep", "random"), nullable=False
    )
    recorded_at: Mapped[datetime] = mapped_column(DateTime, nullable=False)
    notes: Mapped[str | None] = mapped_column(String(500), nullable=True)
    created_at: Mapped[datetime] = mapped_column(
        DateTime, nullable=False, default=lambda: datetime.now(timezone.utc)
    )

    # relationships
    patient: Mapped["Patient"] = relationship(back_populates="glucose_logs")
