"""Doctor router — dashboard, patients, and alerts."""

from typing import Optional
from fastapi import APIRouter, Depends, Query
from sqlalchemy.orm import Session

from app.core.dependencies import get_current_doctor
from app.models.database import get_db
from app.models.user import User

import app.schemas.doctor_schemas as schemas
from app.services.doctor_service import (
    create_doctor_note,
    get_dashboard,
    get_doctor_alerts,
    get_patient_glucose,
    get_patient_profile,
    list_doctor_notes,
    list_patients,
    mark_alert_read,
)

router = APIRouter(prefix="/doctor", tags=["Doctor"])

@router.get("/patients", response_model=schemas.DoctorPatientListResponse, summary="List doctor's patients")
def list_patients_api(
    risk: Optional[str] = Query(None, pattern="^(high|moderate|low)$"),
    search: Optional[str] = Query(None),
    current_user: User = Depends(get_current_doctor),
    db: Session = Depends(get_db),
):
    return list_patients(current_user.id, risk, search, db)


@router.get("/dashboard", response_model=schemas.DoctorDashboardResponse, summary="Doctor dashboard metrics")
def get_dashboard_api(
    current_user: User = Depends(get_current_doctor), db: Session = Depends(get_db)
):
    return get_dashboard(current_user.id, db)


@router.get("/patients/{patient_id}/profile", response_model=schemas.DoctorPatientProfileResponse, summary="View patient profile")
def get_patient_profile_api(
    patient_id: int,
    current_user: User = Depends(get_current_doctor),
    db: Session = Depends(get_db),
):
    return get_patient_profile(current_user.id, patient_id, db)


@router.get("/patients/{patient_id}/glucose", summary="View patient glucose logs")
def get_patient_glucose_api(
    patient_id: int,
    days: int = Query(30, ge=1, le=365),
    current_user: User = Depends(get_current_doctor),
    db: Session = Depends(get_db),
):
    return get_patient_glucose(current_user.id, patient_id, db, days)


@router.post("/notes", response_model=schemas.DoctorNoteResponse, summary="Create clinical note")
def create_note_api(
    data: schemas.DoctorNoteCreate,
    current_user: User = Depends(get_current_doctor),
    db: Session = Depends(get_db),
):
    return create_doctor_note(current_user.id, data, db)


@router.get("/notes/{patient_id}", response_model=list[schemas.DoctorNoteResponse], summary="List clinical notes")
def list_notes_api(
    patient_id: int,
    current_user: User = Depends(get_current_doctor),
    db: Session = Depends(get_db),
):
    return list_doctor_notes(current_user.id, patient_id, db)


@router.get("/alerts", response_model=list[schemas.DoctorAlertResponse], summary="List doctor alerts")
def list_alerts_api(
    current_user: User = Depends(get_current_doctor), db: Session = Depends(get_db)
):
    return get_doctor_alerts(current_user.id, db)


@router.put("/alerts/{alert_id}/read", summary="Mark alert as read")
def mark_alert_read_api(
    alert_id: int,
    current_user: User = Depends(get_current_doctor),
    db: Session = Depends(get_db),
):
    return mark_alert_read(current_user.id, alert_id, db)
