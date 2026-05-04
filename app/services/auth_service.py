"""
AuthService — handles registration, login, token refresh, and profile retrieval.

All database queries use SQLAlchemy 2.0 select() syntax.
"""

from fastapi import HTTPException, status
from sqlalchemy import select
from sqlalchemy.orm import Session

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
from app.models.health_preferences import HealthPreferences
from app.schemas.auth_schemas import (
    DoctorRegister,
    PatientRegister,
    TokenResponse,
    UserLogin,
    UserResponse,
)


# ──────────────────────────────────────────────
# Helpers
# ──────────────────────────────────────────────
def _get_user_role_info(user: User) -> tuple[str, int]:
    """Read role_name and role_id from the user_roles relation."""
    if user.roles:
        return user.roles[0].role_name, user.roles[0].id
    return "patient", 0


def _build_user_response(user: User, profile: Patient | Doctor | None) -> UserResponse:
    """
    Builds a UserResponse from a User ORM object + its profile
    (Patient or Doctor). Both have a full_name field.
    """
    role_name, role_id = _get_user_role_info(user)
    return UserResponse(
        id=user.id,
        email=user.email,
        full_name=profile.full_name if profile else "",
        role=role_name,
        role_id=role_id,
        created_at=user.created_at,
    )


# ──────────────────────────────────────────────
# Register Patient
# ──────────────────────────────────────────────
def register_patient(data: PatientRegister, db: Session) -> dict:
    """
    Creates a new User, links a Patient Role, creates Patient profile,
    and creates default HealthPreferences in one transaction.
    """
    # 1. Check duplicate email
    stmt = select(User).where(User.email == data.email)
    if db.execute(stmt).scalar_one_or_none():
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="Email already registered",
        )

    try:
        # 2. Create User
        new_user = User(
            email=data.email,
            password_hash=hash_password(data.password),
        )
        db.add(new_user)
        db.flush()

        # 3. Link role
        role_stmt = select(Role).where(Role.role_name == "patient")
        role_obj = db.execute(role_stmt).scalar_one_or_none()
        if not role_obj:
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail="Patient role not found in database",
            )
        new_user.roles.append(role_obj)

        # 4. Create profile
        profile = Patient(
            user_id=new_user.id,
            full_name=data.full_name,
            dob=data.dob,
            gender=data.gender,
            height_cm=data.height_cm,
            weight_kg=data.weight_kg,
            diabetes_type_id=data.diabetes_type_id,
        )
        db.add(profile)
        db.flush()

        # 5. Default Health Preferences
        prefs = HealthPreferences(
            patient_id=profile.id,
            min_glucose=70.0,
            max_glucose=140.0,
            carb_limit_g=60.0
        )
        db.add(prefs)

        db.commit()
        db.refresh(new_user)
        db.refresh(profile)

        return {"message": "Patient registration successful", "user": _build_user_response(new_user, profile)}
    except Exception as e:
        db.rollback()
        raise e


# ──────────────────────────────────────────────
# Register Doctor
# ──────────────────────────────────────────────
def register_doctor(data: DoctorRegister, db: Session) -> dict:
    """
    Creates a new User, links a Doctor Role, and creates Doctor profile.
    """
    stmt = select(User).where(User.email == data.email)
    if db.execute(stmt).scalar_one_or_none():
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="Email already registered",
        )

    try:
        new_user = User(
            email=data.email,
            password_hash=hash_password(data.password),
        )
        db.add(new_user)
        db.flush()

        role_stmt = select(Role).where(Role.role_name == "doctor")
        role_obj = db.execute(role_stmt).scalar_one_or_none()
        if not role_obj:
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail="Doctor role not found in database",
            )
        new_user.roles.append(role_obj)

        profile = Doctor(
            user_id=new_user.id,
            full_name=data.full_name,
            specialization_id=data.specialization_id,
        )
        db.add(profile)
        
        db.commit()
        db.refresh(new_user)
        db.refresh(profile)

        return {"message": "Doctor registration successful", "user": _build_user_response(new_user, profile)}
    except Exception as e:
        db.rollback()
        raise e


# ──────────────────────────────────────────────
# Login
# ──────────────────────────────────────────────
def login_user(data: UserLogin, db: Session) -> TokenResponse:
    """Verifies credentials, returns access + refresh JWT tokens + user profile."""
    stmt = select(User).where(User.email == data.email)
    user = db.execute(stmt).scalar_one_or_none()
    
    if not user or not verify_password(data.password, user.password_hash):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid email or password",
        )

    role_name, role_id = _get_user_role_info(user)
    
    access_token = create_access_token(user_id=user.id, role_id=role_id)
    refresh_token = create_refresh_token(user_id=user.id, role_id=role_id)

    # Get profile for response
    if role_name == "doctor":
        profile = db.execute(select(Doctor).where(Doctor.user_id == user.id)).scalar_one_or_none()
    else:
        profile = db.execute(select(Patient).where(Patient.user_id == user.id)).scalar_one_or_none()

    return TokenResponse(
        access_token=access_token,
        refresh_token=refresh_token,
        token_type="bearer",
        expires_in=access_token_expire_seconds(),
        user=_build_user_response(user, profile)
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

    # Explicitly verify Role ID from token against DB
    token_role_id = int(payload.get("role_id", 0))
    db_role_ids = [r.id for r in user.roles]
    if token_role_id not in db_role_ids:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Role privilege escalation detected in refresh token",
        )

    role_name, role_id = _get_user_role_info(user)
    new_access = create_access_token(user_id=user.id, role_id=role_id)
    new_refresh = create_refresh_token(user_id=user.id, role_id=role_id)

    if role_name == "doctor":
        profile = db.execute(select(Doctor).where(Doctor.user_id == user.id)).scalar_one_or_none()
    else:
        profile = db.execute(select(Patient).where(Patient.user_id == user.id)).scalar_one_or_none()

    return TokenResponse(
        access_token=new_access,
        refresh_token=new_refresh,
        token_type="bearer",
        expires_in=access_token_expire_seconds(),
        user=_build_user_response(user, profile)
    )


# ──────────────────────────────────────────────
# Get current user profile (moved from router)
# ──────────────────────────────────────────────
def get_current_user_profile(user: User, db: Session) -> UserResponse:
    """
    Returns the profile of the currently authenticated user.
    """
    role_name, _ = _get_user_role_info(user)

    if role_name == "doctor":
        stmt = select(Doctor).where(Doctor.user_id == user.id)
        profile = db.execute(stmt).scalar_one_or_none()
    else:
        stmt = select(Patient).where(Patient.user_id == user.id)
        profile = db.execute(stmt).scalar_one_or_none()

    return _build_user_response(user, profile)