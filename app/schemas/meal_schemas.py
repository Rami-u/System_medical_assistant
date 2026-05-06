"""Meal log schemas — request & response models."""

from datetime import datetime
from typing import Optional

from pydantic import BaseModel, ConfigDict, Field


# ── DETECTED ITEM ───────────────────────────────────────────
class MealDetectedItemCreate(BaseModel):
    """Single food item detected in a meal (from AI or manual entry)."""

    food_name: str = Field(..., max_length=150)
    confidence_pct: Optional[float] = Field(None, ge=0, le=100)
    quantity_desc: Optional[str] = Field(None, max_length=100)
    carbs_g: Optional[float] = None
    calories: Optional[float] = None
    protein_g: Optional[float] = None
    fat_g: Optional[float] = None


class MealDetectedItemResponse(BaseModel):
    """Detected food item returned to the frontend."""

    model_config = ConfigDict(from_attributes=True)

    id: int
    food_name: str
    confidence_pct: Optional[float] = None
    quantity_desc: Optional[str] = None
    carbs_g: Optional[float] = None
    calories: Optional[float] = None
    protein_g: Optional[float] = None
    fat_g: Optional[float] = None


# ── MEAL LOG ────────────────────────────────────────────────
class MealLogCreate(BaseModel):
    """Body for creating a new meal log entry."""

    meal_name: Optional[str] = Field(None, max_length=150)
    image_url: Optional[str] = Field(None, max_length=500)
    total_carbs_g: Optional[float] = None
    total_calories: Optional[float] = None
    meal_time: datetime
    detected_items: list[MealDetectedItemCreate] = Field(default_factory=list)


class MealLogResponse(BaseModel):
    """Single meal log with nested detected items."""

    model_config = ConfigDict(from_attributes=True)

    id: int
    patient_id: int
    meal_name: Optional[str] = None
    image_url: Optional[str] = None
    total_carbs_g: Optional[float] = None
    total_calories: Optional[float] = None
    meal_time: datetime
    created_at: datetime
    detected_items: list[MealDetectedItemResponse] = Field(default_factory=list)
