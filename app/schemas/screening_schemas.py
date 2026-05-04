"""Screening schemas — request & response models."""

from datetime import datetime
from typing import Optional

from pydantic import BaseModel, ConfigDict, Field


class ScreeningAnswerCreate(BaseModel):
    """An answer submitted for a specific question."""
    question_id: int
    answer_value: Optional[str] = None
    answer_numeric: Optional[float] = None


class ScreeningPredictRequest(BaseModel):
    """Body for submitting a screening."""
    screening_type_id: int
    answers: list[ScreeningAnswerCreate]


class ScreeningResponse(BaseModel):
    """Result of a screening prediction."""
    model_config = ConfigDict(from_attributes=True)

    id: int
    patient_id: int
    screening_type_id: int
    risk_level: str
    ai_confidence_pct: Optional[float] = None
    ai_notes: Optional[str] = None
    created_at: datetime
