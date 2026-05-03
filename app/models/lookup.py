from sqlalchemy import Column, Integer, String
from sqlalchemy.orm import relationship
from app.core.database import Base


class DiabetesType(Base):
    """lk_diabetes_types — standardized diabetes classifications"""
    __tablename__ = "lk_diabetes_types"

    id = Column(Integer, primary_key=True, autoincrement=True, index=True)
    type_name = Column(String(50), nullable=False, unique=True)

    # Relationship: one type → many patients
    patients = relationship("Patient", back_populates="diabetes_type")


class Specialization(Base):
    """lk_specializations — standardized doctor specializations"""
    __tablename__ = "lk_specializations"

    id = Column(Integer, primary_key=True, autoincrement=True, index=True)
    spec_name = Column(String(100), nullable=False, unique=True)

    # Relationship: one specialization → many doctors
    doctors = relationship("Doctor", back_populates="specialization")