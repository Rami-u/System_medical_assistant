"""
Diacheck auth schemas — Pydantic V2 with strict field validation.

Separate request schemas for patient vs doctor registration.
All response schemas use ConfigDict(from_attributes=True).
"""

from datetime import date, datetime
from typing import Optional

from pydantic import BaseModel, ConfigDict, EmailStr, Field, field_validator


# ──────────────────────────────────────────────
# REQUEST SCHEMAS  (client → server)
# ──────────────────────────────────────────────

class PatientRegister(BaseModel):
    """Fields required to register a new patient account."""

    full_name: str = Field(..., min_length=2, max_length=150)
    email: EmailStr
    password: str = Field(..., min_length=8, max_length=72)

    # Patient-specific
    dob: Optional[date] = None
    gender: Optional[str] = Field(None, pattern=r"^(male|female|other)$")
    height_cm: Optional[float] = Field(None, gt=0, le=300)
    weight_kg: Optional[float] = Field(None, gt=0, le=500)
    diabetes_type_id: Optional[int] = Field(None, ge=1)

    @field_validator("password")
    @classmethod
    def password_strength(cls, v: str) -> str:
        if not any(c.isupper() for c in v):
            raise ValueError("Password must contain at least one uppercase letter")
        if not any(c.isdigit() for c in v):
            raise ValueError("Password must contain at least one digit")
        return v


class DoctorRegister(BaseModel):
    """Fields required to register a new doctor account.

    Requires a valid doctor_access_key to prevent unauthorized
    doctor account creation.
    """

    full_name: str = Field(..., min_length=2, max_length=150)
    email: EmailStr
    password: str = Field(..., min_length=8, max_length=72)

    specialization_id: Optional[int] = Field(None, ge=1)

    # Security: only users with a valid access key can register as doctors
    doctor_access_key: str = Field(
        ...,
        min_length=1,
        description="Secret key required to create a doctor account",
    )

    @field_validator("password")
    @classmethod
    def password_strength(cls, v: str) -> str:
        if not any(c.isupper() for c in v):
            raise ValueError("Password must contain at least one uppercase letter")
        if not any(c.isdigit() for c in v):
            raise ValueError("Password must contain at least one digit")
        return v


class UserLogin(BaseModel):
    """Fields required to log in."""

    email: EmailStr
    password: str = Field(..., min_length=1, max_length=72)


class RefreshRequest(BaseModel):
    """Body for the /auth/refresh endpoint."""

    refresh_token: str = Field(..., min_length=1)


# ──────────────────────────────────────────────
# RESPONSE SCHEMAS  (server → client)
# ──────────────────────────────────────────────

class UserResponse(BaseModel):
    """
    Safe user representation — NEVER exposes password_hash.

    full_name and role come from Patient/Doctor profile and user_roles.
    role_id is included for the frontend to use in route guards.
    """

    model_config = ConfigDict(from_attributes=True)

    id: int
    email: str
    full_name: str
    role: str
    role_id: int
    created_at: datetime


class RegisterResponse(BaseModel):
    """Returned after successful registration."""

    message: str
    user: UserResponse


class TokenResponse(BaseModel):
    """Returned after successful login."""

    access_token: str
    refresh_token: str
    token_type: str = "bearer"
    expires_in: int = Field(..., description="Seconds until access token expires")
    user: UserResponse


class TokenData(BaseModel):
    """Decoded JWT payload model — for internal use."""

    user_id: Optional[int] = None
    role_id: Optional[int] = None
    token_type: Optional[str] = None