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
    screening_type: str = Field(
        ...,
        description="Either 'simple' or 'advanced'",
        pattern="^(simple|advanced)$",
    )
    answers: list[ScreeningAnswerCreate]


class ScreeningResponse(BaseModel):
    """Result of a screening prediction."""
    model_config = ConfigDict(from_attributes=True)

    id: int
    patient_id: int
    screening_type_id: int
    risk_level: str
    risk_score: Optional[float] = None
    ai_confidence_pct: Optional[float] = None
    ai_notes: Optional[str] = None
    recommendation: Optional[str] = None
    created_at: datetime


class QuestionResponse(BaseModel):
    """A question for a screening test."""
    id: int
    question_text: str
    data_type: str
    display_order: int


class ScreeningTestInfoResponse(BaseModel):
    """Information and questions for a specific screening test type."""
    test_type: str
    title: str
    description: str
    estimated_minutes: int
    questions: list[QuestionResponse]


class ScreeningHistoryItem(BaseModel):
    """Summary of a past screening."""
    screening_id: int
    screening_type: str
    risk_level: str
    risk_score: float
    risk_label: str
    recommendation: str
    created_at: datetime
