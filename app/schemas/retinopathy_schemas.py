"""Retinopathy schemas — response model for DR prediction."""

from pydantic import BaseModel, Field


class RetinopathyResponse(BaseModel):
    """Response from the DR prediction endpoint."""

    grade: int = Field(..., ge=0, le=4, description="DR severity grade (0-4)")
    label: str = Field(..., description="Human-readable severity label")
    confidence: float = Field(..., ge=0, le=100, description="Prediction confidence percentage")
    raw_score: float = Field(..., description="Raw regression score from model")
    recommendation: str = Field(..., description="Clinical recommendation text")
