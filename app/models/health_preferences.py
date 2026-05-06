from sqlalchemy import Column, Integer, String, Numeric, ForeignKey
from sqlalchemy.orm import Mapped, mapped_column, relationship
from .database import Base


class HealthPreferences(Base):
    __tablename__ = "health_preferences"

    id = Column(Integer, primary_key=True, autoincrement=True)
    patient_id: Mapped[int] = mapped_column(
        Integer, ForeignKey("patients.id", ondelete="CASCADE"), nullable=False, unique=True
    )
    min_glucose: Mapped[float] = mapped_column(Numeric(5, 2), nullable=False, default=70)
    max_glucose: Mapped[float] = mapped_column(Numeric(5, 2), nullable=False, default=140)
    carb_limit_g: Mapped[float] = mapped_column(Numeric(5, 2), nullable=False, default=60)
    diet_type: Mapped[str | None] = mapped_column(String(50), nullable=True)

    # relationships
    patient: Mapped["Patient"] = relationship(back_populates="health_preferences")
