"""
PatientService — profile management and dashboard data aggregation.
"""

from datetime import datetime, timedelta, timezone

from fastapi import HTTPException, status
from sqlalchemy import func, select
from sqlalchemy.orm import Session

from app.models.alert import Alert
from app.models.glucose_log import GlucoseLog
from app.models.lookup import LkDiabetesType
from app.models.meal_log import MealLog
from app.models.patient_doctor import Patient
from app.models.screening import Screening
from app.schemas.patient_schemas import (
    DashboardResponse,
    PatientProfileResponse,
    PatientProfileUpdate,
)


def _get_patient_or_404(user_id: int, db: Session) -> Patient:
    """Fetch Patient by user_id, raise 404 if missing."""
    stmt = select(Patient).where(Patient.user_id == user_id)
    patient = db.execute(stmt).scalar_one_or_none()
    if patient is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Patient profile not found",
        )
    return patient


# ──────────────────────────────────────────────
# Profile — Read
# ──────────────────────────────────────────────
def get_patient_profile(user_id: int, db: Session) -> PatientProfileResponse:
    """Return the full patient profile with resolved diabetes type name."""
    patient = _get_patient_or_404(user_id, db)

    # Resolve diabetes type name
    diabetes_type_name: str | None = None
    if patient.diabetes_type_id:
        dt_stmt = select(LkDiabetesType.type_name).where(
            LkDiabetesType.id == patient.diabetes_type_id
        )
        diabetes_type_name = db.execute(dt_stmt).scalar_one_or_none()

    return PatientProfileResponse(
        id=patient.id,
        user_id=patient.user_id,
        full_name=patient.full_name,
        dob=patient.dob,
        gender=patient.gender,
        height_cm=float(patient.height_cm) if patient.height_cm else None,
        weight_kg=float(patient.weight_kg) if patient.weight_kg else None,
        diabetes_type=diabetes_type_name,
        created_at=patient.created_at,
        updated_at=patient.updated_at,
    )


# ──────────────────────────────────────────────
# Profile — Update
# ──────────────────────────────────────────────
def update_patient_profile(
    user_id: int, data: PatientProfileUpdate, db: Session
) -> PatientProfileResponse:
    """Partial update of patient profile fields."""
    patient = _get_patient_or_404(user_id, db)

    update_data = data.model_dump(exclude_unset=True)
    if not update_data:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="No fields to update",
        )

    for field, value in update_data.items():
        setattr(patient, field, value)

    db.commit()
    db.refresh(patient)
    return get_patient_profile(user_id, db)


# ──────────────────────────────────────────────
# Dashboard
# ──────────────────────────────────────────────
def get_patient_dashboard(user_id: int, db: Session) -> DashboardResponse:
    """
    Aggregated stats for the patient dashboard:
    - Latest glucose reading
    - 7-day average glucose
    - 7-day meal count
    - Unread alerts count
    - Latest screening risk level
    """
    patient = _get_patient_or_404(user_id, db)
    cutoff = datetime.now(timezone.utc) - timedelta(days=7)

    # Latest glucose
    latest_gl_stmt = (
        select(GlucoseLog)
        .where(GlucoseLog.patient_id == patient.id)
        .order_by(GlucoseLog.recorded_at.desc())
        .limit(1)
    )
    latest_gl = db.execute(latest_gl_stmt).scalar_one_or_none()

    # 7-day average glucose
    avg_stmt = select(func.avg(GlucoseLog.glucose_value)).where(
        GlucoseLog.patient_id == patient.id,
        GlucoseLog.recorded_at >= cutoff,
    )
    avg_glucose = db.execute(avg_stmt).scalar()

    # 7-day meal count
    meal_count_stmt = select(func.count(MealLog.id)).where(
        MealLog.patient_id == patient.id,
        MealLog.meal_time >= cutoff,
    )
    meal_count = db.execute(meal_count_stmt).scalar() or 0

    # Unread alerts
    alert_stmt = select(func.count(Alert.id)).where(
        Alert.patient_id == patient.id,
        Alert.is_read == False,  # noqa: E712
    )
    unread_alerts = db.execute(alert_stmt).scalar() or 0

    # Latest screening risk level
    risk_stmt = (
        select(Screening.risk_level)
        .where(Screening.patient_id == patient.id)
        .order_by(Screening.created_at.desc())
        .limit(1)
    )
    risk_level = db.execute(risk_stmt).scalar_one_or_none()

    return DashboardResponse(
        latest_glucose=float(latest_gl.glucose_value) if latest_gl else None,
        latest_glucose_type=latest_gl.reading_type if latest_gl else None,
        avg_glucose_7d=round(float(avg_glucose), 1) if avg_glucose else None,
        total_meals_7d=meal_count,
        unread_alerts=unread_alerts,
        risk_level=risk_level,
    )
