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

    today_avg_glucose: Optional[float] = None
    last_meal_time: Optional[datetime] = None
    active_alerts: int = 0
    risk_level: Optional[str] = None


class DailyGlucoseStat(BaseModel):
    date: str
    average: float


class WeeklyStatsResponse(BaseModel):
    """Weekly chart data for patient stats."""
    weekly_glucose: list[DailyGlucoseStat]

