from datetime import datetime
from sqlalchemy import Column, Integer, Float, String, DateTime, ForeignKey, Text
from sqlalchemy.orm import relationship
from app.core.database import Base


class ClinicalNote(Base):
    __tablename__ = "clinical_notes"

    id         = Column(Integer, primary_key=True, autoincrement=True)
    patient_id = Column(Integer, ForeignKey("patients.id"), nullable=False)
    doctor_id  = Column(Integer, ForeignKey("doctors.id"), nullable=False)
    note_text  = Column(Text, nullable=False)
    status     = Column(String(20), default="draft")
    created_at = Column(DateTime, default=datetime.utcnow)

    patient      = relationship("Patient", back_populates="clinical_notes")
    doctor       = relationship("Doctor", back_populates="clinical_notes")
    ai_snapshots = relationship("NoteAISnapshot", back_populates="note")


class NoteAISnapshot(Base):
    __tablename__ = "note_ai_snapshots"

    id              = Column(Integer, primary_key=True, autoincrement=True)
    note_id         = Column(Integer, ForeignKey("clinical_notes.id"), nullable=False)
    avg_glucose     = Column(Float, nullable=True)
    risk_level      = Column(String(20), nullable=True)
    trend           = Column(String(20), nullable=True)
    alerts_count_7d = Column(Integer, default=0)

    note            = relationship("ClinicalNote", back_populates="ai_snapshots")
    recommendations = relationship("NoteRecommendation", back_populates="snapshot")


class NoteRecommendation(Base):
    __tablename__ = "note_recommendations"

    id                  = Column(Integer, primary_key=True, autoincrement=True)
    snapshot_id         = Column(Integer, ForeignKey("note_ai_snapshots.id"), nullable=False)
    recommendation_text = Column(Text, nullable=False)

    snapshot = relationship("NoteAISnapshot", back_populates="recommendations")