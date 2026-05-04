"""Auth router — thin controller delegating to AuthService."""

from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from app.core.dependencies import get_current_user
from app.models.database import get_db
from app.models.user import User
from app.schemas.auth_schemas import (
    DoctorRegister, PatientRegister, RefreshRequest, 
    RegisterResponse, TokenResponse, UserLogin, UserResponse,
)
from app.services.auth_service import (
    get_current_user_profile, login_user, refresh_access_token, 
    register_doctor, register_patient,
)

router = APIRouter(prefix="/auth", tags=["Authentication"])


@router.post("/register/patient", response_model=RegisterResponse, status_code=201, summary="Register a new patient account")
def register_patient_endpoint(data: PatientRegister, db: Session = Depends(get_db)) -> dict:
    return register_patient(data, db)


@router.post("/register/doctor", response_model=RegisterResponse, status_code=201, summary="Register a new doctor account")
def register_doctor_endpoint(data: DoctorRegister, db: Session = Depends(get_db)) -> dict:
    return register_doctor(data, db)


@router.post("/login", response_model=TokenResponse, summary="Login and receive JWT tokens")
def login(data: UserLogin, db: Session = Depends(get_db)) -> TokenResponse:
    return login_user(data, db)


@router.post("/refresh", response_model=TokenResponse, summary="Refresh access token")
def refresh(data: RefreshRequest, db: Session = Depends(get_db)) -> TokenResponse:
    return refresh_access_token(data.refresh_token, db)


@router.get("/me", response_model=UserResponse, summary="Get current user info")
def me(current_user: User = Depends(get_current_user), db: Session = Depends(get_db)) -> UserResponse:
    return get_current_user_profile(current_user, db)