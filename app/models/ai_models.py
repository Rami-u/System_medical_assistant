from datetime import datetime
from sqlalchemy import Column, Integer, Float, String, DateTime, ForeignKey, Text
from sqlalchemy.orm import relationship
from app.core.database import Base


class AIPrediction(Base):
    __tablename__ = "ai_predictions"

    id               = Column(Integer, primary_key=True, autoincrement=True)
    patient_id       = Column(Integer, ForeignKey("patients.id"), nullable=False)
    predicted_value  = Column(Float, nullable=False)
    prediction_time  = Column(DateTime, default=datetime.utcnow)
    horizon_minutes  = Column(Integer, nullable=False)
    confidence_score = Column(Float, nullable=True)
    created_at       = Column(DateTime, default=datetime.utcnow)

    patient  = relationship("Patient", back_populates="ai_predictions")
    insights = relationship("AIInsight", back_populates="prediction")
    alerts   = relationship("Alert", back_populates="prediction")


class AIInsight(Base):
    __tablename__ = "ai_insights"

    id               = Column(Integer, primary_key=True, autoincrement=True)
    patient_id       = Column(Integer, ForeignKey("patients.id"), nullable=False)
    prediction_id    = Column(Integer, ForeignKey("ai_predictions.id"), nullable=True)
    explanation_text = Column(Text, nullable=True)
    risk_level       = Column(String(20), nullable=True)
    created_at       = Column(DateTime, default=datetime.utcnow)

    patient    = relationship("Patient", back_populates="ai_insights")
    prediction = relationship("AIPrediction", back_populates="insights")
    factors    = relationship("InsightFactor", back_populates="insight")


class InsightFactor(Base):
    __tablename__ = "insight_factors"

    id          = Column(Integer, primary_key=True, autoincrement=True)
    insight_id  = Column(Integer, ForeignKey("ai_insights.id"), nullable=False)
    factor_type = Column(String(50), nullable=False)
    value_text  = Column(String(255), nullable=True)

    insight = relationship("AIInsight", back_populates="factors")