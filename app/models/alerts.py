from datetime import datetime
from sqlalchemy import Column, Integer, Float, String, DateTime, ForeignKey, Text
from sqlalchemy.orm import relationship
from app.core.database import Base


class Alert(Base):
    __tablename__ = "alerts"

    id                 = Column(Integer, primary_key=True, autoincrement=True)
    patient_id         = Column(Integer, ForeignKey("patients.id"), nullable=False)
    glucose_reading_id = Column(Integer, ForeignKey("glucose_readings.id"), nullable=True)
    prediction_id      = Column(Integer, ForeignKey("ai_predictions.id"), nullable=True)
    alert_type         = Column(String(50), nullable=False)
    severity           = Column(String(20), nullable=False)
    title              = Column(String(150), nullable=False)
    message            = Column(Text, nullable=True)
    value              = Column(Float, nullable=True)
    threshold_value    = Column(Float, nullable=True)
    status             = Column(String(20), default="new", nullable=False)
    created_at         = Column(DateTime, default=datetime.utcnow)

    patient         = relationship("Patient", back_populates="alerts")
    glucose_reading = relationship("GlucoseReading", back_populates="alerts")
    prediction      = relationship("AIPrediction", back_populates="alerts")