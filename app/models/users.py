from datetime import datetime 
from sqlalchemy import Column, Integer, String, DateTime 
from sqlalchemy.orm import relationship 
from app.core.database import Base 


class User(Base): 
    __tablename__ = "users" 

    id = Column(Integer, primary_key=True, autoincrement=True, index=True) 
    full_name = Column(String(150), nullable=False) 
    email = Column(String(150), unique=True, nullable=False, index=True) 
    password_hash = Column(String(255), nullable=False) 
    role = Column(String(20), nullable=False, default="patient") 
    created_at = Column(DateTime, default=datetime.utcnow, nullable=False) 
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow) 

    patient_profile = relationship(
        "Patient",
        back_populates="user",
        foreign_keys="Patient.user_id",
        uselist=False
    ) 

    doctor_profile = relationship(
        "Doctor",
        back_populates="user",
        uselist=False
    ) 

    ai_conversations = relationship(
        "AIConversation",
        back_populates="user"
    )