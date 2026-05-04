from datetime import datetime, timezone

from sqlalchemy import DateTime, Enum, ForeignKey, Integer, Text
from sqlalchemy.orm import Mapped, mapped_column, relationship

from .database import Base


class ClinicalNote(Base):
    __tablename__ = "clinical_notes"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    doctor_id: Mapped[int] = mapped_column(
        Integer, ForeignKey("doctors.id", ondelete="CASCADE"), nullable=False
    )
    patient_id: Mapped[int] = mapped_column(
        Integer, ForeignKey("patients.id", ondelete="CASCADE"), nullable=False
    )
    note_text: Mapped[str] = mapped_column(Text, nullable=False)
    priority: Mapped[str] = mapped_column(
        Enum("routine", "urgent", "critical"), nullable=False, default="routine"
    )
    status: Mapped[str] = mapped_column(
        Enum("draft", "published"), nullable=False, default="published"
    )
    created_at: Mapped[datetime] = mapped_column(
        DateTime, nullable=False, default=lambda: datetime.now(timezone.utc)
    )

    # relationships
    doctor: Mapped["Doctor"] = relationship(back_populates="clinical_notes")
    patient: Mapped["Patient"] = relationship(back_populates="clinical_notes")
