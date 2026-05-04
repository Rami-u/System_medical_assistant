"""Patient profile & dashboard schemas."""

from datetime import date, datetime
from typing import Optional

from pydantic import BaseModel, ConfigDict, Field


# ── RESPONSE ────────────────────────────────────────────────
class PatientProfileResponse(BaseModel):
    """Full patient profile for the frontend."""

    model_config = ConfigDict(from_attributes=True)

    id: int
    user_id: int
    full_name: str
    dob: Optional[date] = None
    gender: Optional[str] = None
    height_cm: Optional[float] = None
    weight_kg: Optional[float] = None
    diabetes_type: Optional[str] = Field(
        None, description="Resolved name from lk_diabetes_types"
    )
    created_at: datetime
    updated_at: datetime


# ── REQUEST ─────────────────────────────────────────────────
class PatientProfileUpdate(BaseModel):
    """Partial update for patient profile. All fields optional."""

    full_name: Optional[str] = Field(None, max_length=150)
    dob: Optional[date] = None
    gender: Optional[str] = Field(None, pattern="^(male|female|other)$")
    height_cm: Optional[float] = Field(None, gt=0, le=300)
    weight_kg: Optional[float] = Field(None, gt=0, le=500)
    diabetes_type_id: Optional[int] = None


# ── DASHBOARD ───────────────────────────────────────────────
class DashboardResponse(BaseModel):
    """Aggregated stats for the patient dashboard."""

    latest_glucose: Optional[float] = None
    latest_glucose_type: Optional[str] = None
    avg_glucose_7d: Optional[float] = None
    total_meals_7d: int = 0
    unread_alerts: int = 0
    risk_level: Optional[str] = None
