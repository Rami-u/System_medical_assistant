from datetime import datetime
from sqlalchemy import Column, Integer, DateTime, ForeignKey
from sqlalchemy.orm import relationship
from app.core.database import Base


class Doctor(Base):
    __tablename__ = "doctors"

    id                = Column(Integer, primary_key=True, autoincrement=True)
    user_id           = Column(Integer, ForeignKey("users.id"), unique=True, nullable=False)
    specialization_id = Column(Integer, ForeignKey("lk_specializations.id"), nullable=True)
    created_at        = Column(DateTime, default=datetime.utcnow)

    user           = relationship("User", back_populates="doctor_profile")
    specialization = relationship("Specialization", back_populates="doctors")
    clinical_notes = relationship("ClinicalNote", back_populates="doctor")