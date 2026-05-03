from sqlalchemy import Column, Integer, Float, String, DateTime, ForeignKey
from sqlalchemy.orm import relationship
from app.core.database import Base
from datetime import datetime


class Meal(Base):
    __tablename__ = "meals"

    id        = Column(Integer, primary_key=True, autoincrement=True)
    name      = Column(String(150), nullable=False)
    calories  = Column(Float, nullable=True)
    carbs_g   = Column(Float, nullable=True)
    protein_g = Column(Float, nullable=True)
    fat_g     = Column(Float, nullable=True)
    fiber_g   = Column(Float, nullable=True)

    logs            = relationship("MealLog", back_populates="meal")
    recommendations = relationship("MealRecommendation", back_populates="meal")


class MealLog(Base):
    __tablename__ = "meal_logs"

    id         = Column(Integer, primary_key=True, autoincrement=True)
    patient_id = Column(Integer, ForeignKey("patients.id"), nullable=False)
    meal_id    = Column(Integer, ForeignKey("meals.id"), nullable=False)
    logged_at  = Column(DateTime, nullable=False)

    patient = relationship("Patient", back_populates="meal_logs")
    meal    = relationship("Meal", back_populates="logs")


class MealRecommendation(Base):
    __tablename__ = "meal_recommendations"

    id               = Column(Integer, primary_key=True, autoincrement=True)
    patient_id       = Column(Integer, ForeignKey("patients.id"), nullable=False)
    meal_id          = Column(Integer, ForeignKey("meals.id"), nullable=False)
    score_percentage = Column(Float, nullable=True)

    patient = relationship("Patient", back_populates="meal_recommendations")
    meal    = relationship("Meal", back_populates="recommendations")