from pydantic import BaseModel, EmailStr, ConfigDict, field_validator
from typing import Optional
from datetime import datetime


#  REQUEST SCHEMAS (what the client sends TO us)

class UserRegister(BaseModel):
    """
    Fields required to create a new account.
    Role is NOT user-controlled — it must be passed
    but is validated against allowed values only.
    Default is 'patient' for safety.
    """
    full_name: str
    email: EmailStr            # validates email format automatically
    password: str
    role: str = "patient"      # default: patient
    # Optional: patient-specific fields
    age: Optional[int] = None
    gender: Optional[str] = None
    height_cm: Optional[float] = None
    weight_kg: Optional[float] = None
    diabetes_type_id: Optional[int] = None
    # Optional: doctor-specific fields
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
        """Only 'patient' or 'doctor' are valid roles. Anything else is rejected."""
        if v not in ("patient", "doctor"):
            raise ValueError("Role must be 'patient' or 'doctor'")
        return v


class UserLogin(BaseModel):
    """Fields required to log in."""
    email: EmailStr
    password: str


#  RESPONSE SCHEMAS (what we send BACK to client)

class UserResponse(BaseModel):
    """
    Safe user representation — NEVER includes password_hash.
    from_attributes=True lets Pydantic read SQLAlchemy model objects.
    """
    model_config = ConfigDict(from_attributes=True)

    id: int
    full_name: str
    email: str
    role: str
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
    expires_in: int          # seconds until access token expires


class RefreshRequest(BaseModel):
    """Body for the refresh token endpoint."""
    refresh_token: str


class TokenData(BaseModel):
    """
    Decoded JWT payload model.
    'sub' is the standard JWT claim for the subject (our user_id).
    """
    user_id: Optional[int] = None
    role: Optional[str] = None
    token_type: Optional[str] = None