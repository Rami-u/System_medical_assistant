"""Glucose log schemas — request & response models."""

from datetime import datetime
from typing import Optional

from pydantic import BaseModel, ConfigDict, Field


# ── REQUEST ─────────────────────────────────────────────────
class GlucoseLogCreate(BaseModel):
    """Body for creating a new glucose reading."""

    glucose_value: float = Field(..., gt=0, le=900, description="mg/dL")
    reading_type: str = Field(
        ..., pattern="^(fasting|after_meal|before_sleep|random)$"
    )
    recorded_at: datetime
    notes: Optional[str] = Field(None, max_length=500)


# ── RESPONSE ────────────────────────────────────────────────
class GlucoseLogResponse(BaseModel):
    """Single glucose reading returned to the frontend."""

    model_config = ConfigDict(from_attributes=True)

    id: int
    patient_id: int
    glucose_value: float
    reading_type: str
    recorded_at: datetime
    notes: Optional[str] = None
    created_at: datetime


class GlucoseStatsResponse(BaseModel):
    """Aggregated glucose statistics for a date range."""

    average: float
    minimum: float
    maximum: float
    reading_count: int
    in_range_pct: float = Field(
        ..., description="Percentage of readings within the patient's target range"
    )
