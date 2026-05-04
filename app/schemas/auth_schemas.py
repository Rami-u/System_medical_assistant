from pydantic import BaseModel, EmailStr, ConfigDict, field_validator
from typing import Optional
from datetime import datetime, date


# ──────────────────────────────────────────────
# REQUEST SCHEMAS  (client → server)
# ──────────────────────────────────────────────

class UserRegister(BaseModel):
    """
    Fields required to create a new account.

    ✅ Changed: age → dob (date of birth) to match the Patient model.
    ✅ full_name is here because it lives on Patient/Doctor, not User.
    Role defaults to 'patient' for safety; validated against allowed values.
    """
    full_name: str
    email: EmailStr
    password: str
    role: str = "patient"

    # Patient-specific (optional)
    dob: Optional[date] = None               # ✅ was: age: Optional[int]
    gender: Optional[str] = None
    height_cm: Optional[float] = None
    weight_kg: Optional[float] = None
    diabetes_type_id: Optional[int] = None

    # Doctor-specific (optional)
    specialization_id: Optional[int] = None

    @field_validator("password")
    @classmethod
    def password_strength(cls, v: str) -> str:
        """Enforce minimum password security at the schema level."""
        if len(v) < 8:
            raise ValueError("Password must be at least 8 characters")
        return v

    @field_validator("role")
    @classmethod
    def role_allowed(cls, v: str) -> str:
        """Only 'patient' or 'doctor' are valid roles."""
        if v not in ("patient", "doctor"):
            raise ValueError("Role must be 'patient' or 'doctor'")
        return v


class UserLogin(BaseModel):
    """Fields required to log in."""
    email: EmailStr
    password: str


# ──────────────────────────────────────────────
# RESPONSE SCHEMAS  (server → client)
# ──────────────────────────────────────────────

class UserResponse(BaseModel):
    """
    Safe user representation — NEVER exposes password_hash.

    ✅ Fixed: full_name and role are NOT columns on User —
    they come from the Patient/Doctor profile and user_roles table.
    We return them as computed fields populated by auth_service.
    """
    model_config = ConfigDict(from_attributes=True)

    id: int
    email: str
    full_name: str            # populated from Patient.full_name or Doctor.full_name
    role: str                 # populated from user.roles[0].role_name
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
    expires_in: int           # seconds until access token expires


class RefreshRequest(BaseModel):
    """Body for the /auth/refresh endpoint."""
    refresh_token: str


class TokenData(BaseModel):
    """
    Decoded JWT payload model.
    'sub' holds user_id as string (JWT standard).
    """
    user_id: Optional[int] = None
    role: Optional[str] = None
    token_type: Optional[str] = None