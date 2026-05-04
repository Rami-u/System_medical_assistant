"""
AuthService — handles registration, login, token refresh, and profile retrieval.

All database queries use SQLAlchemy 2.0 select() syntax.
"""

from fastapi import HTTPException, status
from sqlalchemy import select
from sqlalchemy.orm import Session, selectinload

from app.core.security import (
    access_token_expire_seconds,
    create_access_token,
    create_refresh_token,
    decode_token,
    hash_password,
    verify_password,
)
from app.models.patient_doctor import Doctor, Patient
from app.models.user import Role, User
from app.schemas.auth_schemas import (
    TokenResponse,
    UserLogin,
    UserRegister,
    UserResponse,
)


# ──────────────────────────────────────────────
# Helpers
# ──────────────────────────────────────────────
def _get_user_role(user: User) -> str:
    """Read role from the user_roles relation (not a column on User)."""
    return user.roles[0].role_name if user.roles else "patient"


def _build_user_response(user: User, profile: Patient | Doctor | None) -> UserResponse:
    """
    Builds a UserResponse from a User ORM object + its profile
    (Patient or Doctor). Both have a full_name field.
    """
    return UserResponse(
        id=user.id,
        email=user.email,
        full_name=profile.full_name if profile else "",
        role=_get_user_role(user),
        created_at=user.created_at,
    )


# ──────────────────────────────────────────────
# Register
# ──────────────────────────────────────────────
def register_user(data: UserRegister, db: Session) -> dict:
    """
    Creates a new User, links a Role, and creates the matching
    Patient or Doctor profile — all in one transaction.
    """
    # 1. Check duplicate email
    stmt = select(User).where(User.email == data.email)
    existing = db.execute(stmt).scalar_one_or_none()
    if existing:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="Email already registered",
        )

    # 2. Create User
    new_user = User(
        email=data.email,
        password_hash=hash_password(data.password),
    )
    db.add(new_user)
    db.flush()

    # 3. Link role via user_roles table
    role_stmt = select(Role).where(Role.role_name == data.role)
    role_obj = db.execute(role_stmt).scalar_one_or_none()
    if not role_obj:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Role '{data.role}' not found in database",
        )
    new_user.roles.append(role_obj)

    # 4. Create profile
    if data.role == "patient":
        profile = Patient(
            user_id=new_user.id,
            full_name=data.full_name,
            dob=data.dob,
            gender=data.gender,
            height_cm=data.height_cm,
            weight_kg=data.weight_kg,
            diabetes_type_id=data.diabetes_type_id,
        )
    else:
        profile = Doctor(
            user_id=new_user.id,
            full_name=data.full_name,
            specialization_id=data.specialization_id,
        )

    db.add(profile)
    db.commit()
    db.refresh(new_user)
    db.refresh(profile)

    user_response = _build_user_response(new_user, profile)
    return {"message": "Registration successful", "user": user_response}


# ──────────────────────────────────────────────
# Login
# ──────────────────────────────────────────────
def login_user(data: UserLogin, db: Session) -> TokenResponse:
    """Verifies credentials, returns access + refresh JWT tokens."""
    stmt = select(User).where(User.email == data.email)
    user = db.execute(stmt).scalar_one_or_none()
    if not user:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid email or password",
        )

    if not verify_password(data.password, user.password_hash):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid email or password",
        )

    role = _get_user_role(user)
    access_token = create_access_token(user_id=user.id, role=role)
    refresh_token = create_refresh_token(user_id=user.id, role=role)

    return TokenResponse(
        access_token=access_token,
        refresh_token=refresh_token,
        token_type="bearer",
        expires_in=access_token_expire_seconds(),
    )


# ──────────────────────────────────────────────
# Refresh
# ──────────────────────────────────────────────
def refresh_access_token(refresh_token: str, db: Session) -> TokenResponse:
    """Validates a refresh token and issues a new token pair."""
    payload = decode_token(refresh_token)
    if payload is None or payload.get("type") != "refresh":
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid or expired refresh token",
        )

    user_id = int(payload.get("sub"))
    stmt = select(User).where(User.id == user_id)
    user = db.execute(stmt).scalar_one_or_none()
    if not user:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="User not found",
        )

    role = _get_user_role(user)
    new_access = create_access_token(user_id=user.id, role=role)
    new_refresh = create_refresh_token(user_id=user.id, role=role)

    return TokenResponse(
        access_token=new_access,
        refresh_token=new_refresh,
        token_type="bearer",
        expires_in=access_token_expire_seconds(),
    )


# ──────────────────────────────────────────────
# Get current user profile (moved from router)
# ──────────────────────────────────────────────
def get_current_user_profile(user: User, db: Session) -> UserResponse:
    """
    Returns the profile of the currently authenticated user.
    Business logic extracted from the /me endpoint.
    """
    role = _get_user_role(user)

    if role == "doctor":
        stmt = select(Doctor).where(Doctor.user_id == user.id)
        profile = db.execute(stmt).scalar_one_or_none()
    else:
        stmt = select(Patient).where(Patient.user_id == user.id)
        profile = db.execute(stmt).scalar_one_or_none()

    return _build_user_response(user, profile)