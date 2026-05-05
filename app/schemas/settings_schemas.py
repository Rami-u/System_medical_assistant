"""Settings schemas — user profile, preferences, and security."""

from datetime import date
from typing import Optional

from pydantic import BaseModel, ConfigDict, Field, model_validator


# ── Profile ──────────────────────────────────────────────────

class ProfileResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    full_name: str
    email: str
    age: Optional[int] = None
    weight_kg: Optional[float] = None
    height_cm: Optional[float] = None
    gender: Optional[str] = None
    diabetes_type: Optional[str] = None
    assigned_doctor: Optional[str] = None


class ProfileUpdateRequest(BaseModel):
    full_name: str = Field(..., min_length=2, max_length=150)
    weight_kg: Optional[float] = Field(None, ge=20, le=300)
    height_cm: Optional[float] = Field(None, ge=50, le=250)
    gender: Optional[str] = Field(None, pattern="^(male|female|other)$")
    dob: Optional[date] = None
    diabetes_type_id: Optional[int] = None


# ── Preferences ──────────────────────────────────────────────

class PreferencesResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    min_glucose: float
    max_glucose: float
    carb_limit_g: float
    diet_type: Optional[str] = None


class PreferencesUpdateRequest(BaseModel):
    min_glucose: float = Field(..., ge=40, le=200)
    max_glucose: float = Field(..., ge=80, le=400)
    carb_limit_g: float = Field(..., ge=10, le=500)
    diet_type: Optional[str] = Field(None, max_length=50)

    @model_validator(mode='after')
    def check_glucose_range(self) -> 'PreferencesUpdateRequest':
        if self.min_glucose >= self.max_glucose:
            raise ValueError('min_glucose must be strictly less than max_glucose')
        return self


# ── Security ─────────────────────────────────────────────────

class PasswordUpdateRequest(BaseModel):
    current_password: str = Field(..., min_length=1)
    new_password: str = Field(..., min_length=8)
    confirm_password: str = Field(..., min_length=8)

    @model_validator(mode='after')
    def check_passwords_match(self) -> 'PasswordUpdateRequest':
        if self.new_password != self.confirm_password:
            raise ValueError('confirm_password must match new_password')
        return self
