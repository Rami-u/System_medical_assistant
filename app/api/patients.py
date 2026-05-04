"""Patients router — profile and dashboard endpoints."""

from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from app.core.dependencies import get_current_patient
from app.models.database import get_db
from app.models.user import User
from app.schemas.patient_schemas import DashboardResponse, PatientProfileResponse, PatientProfileUpdate
from app.services.patient_service import get_patient_dashboard, get_patient_profile, update_patient_profile

router = APIRouter(prefix="/patients", tags=["Patients"])


@router.get("/profile", response_model=PatientProfileResponse, summary="Get patient profile")
def profile(current_user: User = Depends(get_current_patient), db: Session = Depends(get_db)) -> PatientProfileResponse:
    return get_patient_profile(current_user.id, db)


@router.patch("/profile", response_model=PatientProfileResponse, summary="Update patient profile")
def update_profile(data: PatientProfileUpdate, current_user: User = Depends(get_current_patient), db: Session = Depends(get_db)) -> PatientProfileResponse:
    return update_patient_profile(current_user.id, data, db)


@router.get("/dashboard", response_model=DashboardResponse, summary="Patient dashboard data")
def dashboard(current_user: User = Depends(get_current_patient), db: Session = Depends(get_db)) -> DashboardResponse:
    return get_patient_dashboard(current_user.id, db)
