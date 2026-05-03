from datetime import datetime
from sqlalchemy import Column, Integer, String, Float, DateTime, ForeignKey
from sqlalchemy.orm import relationship
from app.core.database import Base


class Patient(Base):
    __tablename__ = "patients"

    id               = Column(Integer, primary_key=True, autoincrement=True)
    user_id          = Column(Integer, ForeignKey("users.id"), unique=True, nullable=False)
    age              = Column(Integer, nullable=True)
    gender           = Column(String(10), nullable=True)
    height_cm        = Column(Float, nullable=True)
    weight_kg        = Column(Float, nullable=True)
    diabetes_type_id = Column(Integer, ForeignKey("lk_diabetes_types.id"), nullable=True)
    created_at       = Column(DateTime, default=datetime.utcnow)
    updated_at       = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    # Back to user
    user          = relationship("User", back_populates="patient_profile",
                                  foreign_keys=[user_id])
    diabetes_type = relationship("DiabetesType", back_populates="patients")

    # Forward to all patient-owned data
    glucose_readings     = relationship("GlucoseReading", back_populates="patient")
    ai_predictions       = relationship("AIPrediction", back_populates="patient")
    ai_insights          = relationship("AIInsight", back_populates="patient")
    meal_logs            = relationship("MealLog", back_populates="patient")
    meal_recommendations = relationship("MealRecommendation", back_populates="patient")
    alerts               = relationship("Alert", back_populates="patient")
    clinical_notes       = relationship("ClinicalNote", back_populates="patient")
    ai_conversations     = relationship("AIConversation", back_populates="patient")