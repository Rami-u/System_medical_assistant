from datetime import datetime
from sqlalchemy import Column, Integer, Float, String, DateTime, ForeignKey
from sqlalchemy.orm import relationship
from app.core.database import Base


class GlucoseReading(Base):
    __tablename__ = "glucose_readings"

    id               = Column(Integer, primary_key=True, autoincrement=True)
    patient_id       = Column(Integer, ForeignKey("patients.id"), nullable=False, index=True)
    value_mg_dl      = Column(Float, nullable=False)
    measured_at      = Column(DateTime, nullable=False)
    measurement_type = Column(String(30), nullable=True)
    created_at       = Column(DateTime, default=datetime.utcnow)

    patient = relationship("Patient", back_populates="glucose_readings")
    alerts  = relationship("Alert", back_populates="glucose_reading")