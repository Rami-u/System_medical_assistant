"""Settings service — logic for profile, preferences, and password."""

from datetime import datetime, timezone

from fastapi import HTTPException, status
from sqlalchemy import select
from sqlalchemy.orm import Session

import app.schemas.settings_schemas as schemas
from app.core.security import hash_password, verify_password
from app.models.health_preferences import HealthPreferences
from app.models.lookup import LkDiabetesType
from app.models.patient_doctor import Doctor, Patient, doctor_patient_table
from app.models.user import User


def get_profile(user_id: int, db: Session) -> schemas.ProfileResponse:
    """Retrieve the patient profile along with user email and assigned doctor."""
    stmt = (
        select(
            Patient,
            User.email,
            LkDiabetesType.type_name.label("diabetes_type"),
            Doctor.full_name.label("assigned_doctor"),
        )
        .join(User, User.id == Patient.user_id)
        .outerjoin(LkDiabetesType, LkDiabetesType.id == Patient.diabetes_type_id)
        .outerjoin(doctor_patient_table, doctor_patient_table.c.patient_id == Patient.id)
        .outerjoin(Doctor, Doctor.id == doctor_patient_table.c.doctor_id)
        .where(Patient.user_id == user_id)
    )
    result = db.execute(stmt).first()

    if not result:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND, detail="Patient profile not found"
        )

    patient = result.Patient

    age = None
    if patient.dob:
        today = datetime.now(timezone.utc).date()
        age = today.year - patient.dob.year - (
            (today.month, today.day) < (patient.dob.month, patient.dob.day)
        )

    return schemas.ProfileResponse(
        full_name=patient.full_name,
        email=result.email,
        age=age,
        weight_kg=float(patient.weight_kg) if patient.weight_kg else None,
        height_cm=float(patient.height_cm) if patient.height_cm else None,
        gender=patient.gender,
        diabetes_type=result.diabetes_type,
        assigned_doctor=result.assigned_doctor,
    )


def update_profile(
    user_id: int, data: schemas.ProfileUpdateRequest, db: Session
) -> schemas.ProfileResponse:
    """Update patient demographic and physical data."""
    patient = db.execute(select(Patient).where(Patient.user_id == user_id)).scalar_one_or_none()
    if not patient:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND, detail="Patient profile not found"
        )

    if data.full_name is not None:
        patient.full_name = data.full_name
    if data.weight_kg is not None:
        patient.weight_kg = data.weight_kg
    if data.height_cm is not None:
        patient.height_cm = data.height_cm
    if data.gender is not None:
        patient.gender = data.gender
    if data.dob is not None:
        patient.dob = data.dob
    if data.diabetes_type_id is not None:
        patient.diabetes_type_id = data.diabetes_type_id

    db.commit()
    return get_profile(user_id, db)


def get_preferences(user_id: int, db: Session) -> schemas.PreferencesResponse:
    """Retrieve patient health preferences, defaulting if none exist."""
    patient = db.execute(select(Patient).where(Patient.user_id == user_id)).scalar_one_or_none()
    if not patient:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND, detail="Patient profile not found"
        )

    prefs = db.execute(
        select(HealthPreferences).where(HealthPreferences.patient_id == patient.id)
    ).scalar_one_or_none()

    if prefs:
        return schemas.PreferencesResponse(
            min_glucose=float(prefs.min_glucose),
            max_glucose=float(prefs.max_glucose),
            carb_limit_g=float(prefs.carb_limit_g),
            diet_type=prefs.diet_type,
        )
    else:
        # Default fallback without creating a database row
        return schemas.PreferencesResponse(
            min_glucose=70.0,
            max_glucose=140.0,
            carb_limit_g=60.0,
            diet_type=None,
        )


def update_preferences(
    user_id: int, data: schemas.PreferencesUpdateRequest, db: Session
) -> schemas.PreferencesResponse:
    """Upsert patient health preferences."""
    patient = db.execute(select(Patient).where(Patient.user_id == user_id)).scalar_one_or_none()
    if not patient:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND, detail="Patient profile not found"
        )

    prefs = db.execute(
        select(HealthPreferences).where(HealthPreferences.patient_id == patient.id)
    ).scalar_one_or_none()

    if not prefs:
        prefs = HealthPreferences(patient_id=patient.id)
        db.add(prefs)

    prefs.min_glucose = data.min_glucose
    prefs.max_glucose = data.max_glucose
    prefs.carb_limit_g = data.carb_limit_g
    prefs.diet_type = data.diet_type

    db.commit()

    return schemas.PreferencesResponse(
        min_glucose=float(prefs.min_glucose),
        max_glucose=float(prefs.max_glucose),
        carb_limit_g=float(prefs.carb_limit_g),
        diet_type=prefs.diet_type,
    )


def update_password(user_id: int, data: schemas.PasswordUpdateRequest, db: Session) -> dict:
    """Verify current password and hash/save the new password."""
    user = db.execute(select(User).where(User.id == user_id)).scalar_one_or_none()
    if not user:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="User not found")

    if not verify_password(data.current_password, user.password_hash):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST, detail="Current password is incorrect"
        )

    user.password_hash = hash_password(data.new_password)
    db.commit()

    return {"message": "Password updated successfully"}
