from fastapi import HTTPException, status
from sqlalchemy.orm import Session
from app.core.security import (
    hash_password, verify_password,
    create_access_token, create_refresh_token, decode_token
)
from app.core.config import settings
from app.schemas.auth_schemas import UserRegister, UserLogin, RefreshRequest
from app.models.users import User
from app.models.patients import Patient
from app.models.doctors import Doctor

class AuthService:
    @staticmethod
    def register_user(data: UserRegister, db: Session) -> User:
        """
        Handles the business logic for registering a new user.
        """
        # ── STEP 1: Duplicate email check ──────────────────────────────
        existing = db.query(User).filter(User.email == data.email).first()
        if existing:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="An account with this email already exists",
            )

        # ── STEP 2: Hash password — NEVER store plain text ─────────────
        hashed = hash_password(data.password)

        # ── STEP 3: Create User row ─────────────────────────────────────
        new_user = User(
            full_name=data.full_name,
            email=data.email,
            password_hash=hashed,
            role=data.role,
        )
        db.add(new_user)
        db.flush()  # flush to get new_user.id WITHOUT committing yet

        # ── STEP 4a: If patient → create Patient profile ────────────────
        if data.role == "patient":
            patient_profile = Patient(
                user_id=new_user.id,
                age=data.age,
                gender=data.gender,
                height_cm=data.height_cm,
                weight_kg=data.weight_kg,
                diabetes_type_id=data.diabetes_type_id,
            )
            db.add(patient_profile)

        # ── STEP 4b: If doctor → create Doctor profile ──────────────────
        elif data.role == "doctor":
            doctor_profile = Doctor(
                user_id=new_user.id,
                specialization_id=data.specialization_id,
            )
            db.add(doctor_profile)

        # ── STEP 5: Commit everything atomically ────────────────────────
        db.commit()
        db.refresh(new_user)  # reload to get created_at from DB
        
        return new_user

    @staticmethod
    def login_user(data: UserLogin, db: Session) -> dict:
        """
        Handles the business logic for user login and token generation.
        """
        # Look up by email
        user = db.query(User).filter(User.email == data.email).first()

        # SECURITY: Same error for wrong email AND wrong password.
        if not user or not verify_password(data.password, user.password_hash):
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Incorrect email or password",
                headers={"WWW-Authenticate": "Bearer"},
            )

        # Issue both tokens
        access_token  = create_access_token(user_id=user.id, role=user.role)
        refresh_token = create_refresh_token(user_id=user.id, role=user.role)

        return {
            "access_token": access_token,
            "refresh_token": refresh_token,
            "token_type": "bearer",
            "expires_in": settings.ACCESS_TOKEN_EXPIRE_MINUTES * 60,
        }

    @staticmethod
    def refresh_token(data: RefreshRequest, db: Session) -> dict:
        """
        Handles the business logic for refreshing an access token.
        """
        # decode_token will raise 401 if this is not a valid refresh token
        token_data = decode_token(data.refresh_token, expected_type="refresh")

        # Verify user still exists
        user = db.query(User).filter(User.id == token_data["user_id"]).first()
        if not user:
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="User no longer exists",
            )

        # Issue a fresh access token
        new_access_token = create_access_token(user_id=user.id, role=user.role)

        return {
            "access_token": new_access_token,
            "refresh_token": data.refresh_token,  # return same refresh token
            "token_type": "bearer",
            "expires_in": settings.ACCESS_TOKEN_EXPIRE_MINUTES * 60,
        }
