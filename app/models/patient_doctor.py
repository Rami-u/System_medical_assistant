from datetime import datetime, timezone

from sqlalchemy import (
    Column,
    DateTime,
    Enum,
    ForeignKey,
    Integer,
    Numeric,
    String,
    Table,
    Date,
)
from sqlalchemy.orm import Mapped, mapped_column, relationship

from .database import Base


# ── many-to-many association table ──────────────────────────
doctor_patient_table = Table(
    "doctor_patient",
    Base.metadata,
    Column(
        "doctor_id",
        Integer,
        ForeignKey("doctors.id", ondelete="CASCADE"),
        primary_key=True,
    ),
    Column(
        "patient_id",
        Integer,
        ForeignKey("patients.id", ondelete="CASCADE"),
        primary_key=True,
    ),
    Column(
        "assigned_at",
        DateTime,
        nullable=False,
        default=lambda: datetime.now(timezone.utc),
    ),
    Column("is_primary", Integer, nullable=False, default=1),
)


class Doctor(Base):
    __tablename__ = "doctors"

    id = Column(Integer, primary_key=True, autoincrement=True)
    user_id: Mapped[int] = mapped_column(
        Integer,
        ForeignKey("users.id", ondelete="CASCADE"),
        nullable=False,
        unique=True,
    )
    full_name: Mapped[str] = mapped_column(String(150), nullable=False)
    specialization_id: Mapped[int | None] = mapped_column(
        Integer,
        ForeignKey("lk_specializations.id", ondelete="SET NULL"),
        nullable=True,
    )
    created_at: Mapped[datetime] = mapped_column(
        DateTime, nullable=False, default=lambda: datetime.now(timezone.utc)
    )

    # relationships
    user: Mapped["User"] = relationship(back_populates="doctor")
    specialization: Mapped["LkSpecialization"] = relationship(
        back_populates="doctors"
    )
    patients: Mapped[list["Patient"]] = relationship(
        secondary=doctor_patient_table, back_populates="doctors"
    )
    clinical_notes: Mapped[list["ClinicalNote"]] = relationship(
        back_populates="doctor"
    )


class Patient(Base):
    __tablename__ = "patients"

    id = Column(Integer, primary_key=True, autoincrement=True)
    user_id: Mapped[int] = mapped_column(
        Integer,
        ForeignKey("users.id", ondelete="CASCADE"),
        nullable=False,
        unique=True,
        index=True,
    )
    full_name: Mapped[str] = mapped_column(String(150), nullable=False)
    dob: Mapped[Date | None] = mapped_column(Date, nullable=True)
    gender: Mapped[str | None] = mapped_column(
        Enum("male", "female", "other"), nullable=True
    )
    height_cm: Mapped[float | None] = mapped_column(Numeric(5, 2), nullable=True)
    weight_kg: Mapped[float | None] = mapped_column(Numeric(5, 2), nullable=True)
    diabetes_type_id: Mapped[int | None] = mapped_column(
        Integer,
        ForeignKey("lk_diabetes_types.id", ondelete="SET NULL"),
        nullable=True,
    )
    created_at: Mapped[datetime] = mapped_column(
        DateTime, nullable=False, default=lambda: datetime.now(timezone.utc)
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime,
        nullable=False,
        default=lambda: datetime.now(timezone.utc),
        onupdate=lambda: datetime.now(timezone.utc),
    )

    # relationships
    user: Mapped["User"] = relationship(back_populates="patient")
    diabetes_type: Mapped["LkDiabetesType"] = relationship(back_populates="patients")
    doctors: Mapped[list["Doctor"]] = relationship(
        secondary=doctor_patient_table, back_populates="patients"
    )
    health_preferences: Mapped["HealthPreferences"] = relationship(
        back_populates="patient", uselist=False
    )
    glucose_logs: Mapped[list["GlucoseLog"]] = relationship(back_populates="patient")
    meal_logs: Mapped[list["MealLog"]] = relationship(back_populates="patient")
    screenings: Mapped[list["Screening"]] = relationship(back_populates="patient")
    alerts: Mapped[list["Alert"]] = relationship(back_populates="patient")
    clinical_notes: Mapped[list["ClinicalNote"]] = relationship(
        back_populates="patient"
    )
    ai_conversations: Mapped[list["AiConversation"]] = relationship(
        back_populates="patient"
    )
