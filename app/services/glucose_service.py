"""
GlucoseService — CRUD and analytics for glucose readings.

All queries use SQLAlchemy 2.0 select() syntax.
Auto-generates alerts for critical glucose values.
"""

from datetime import datetime, timedelta, timezone

from fastapi import HTTPException, status
from sqlalchemy import func, select
from sqlalchemy.orm import Session

from app.models.alert import Alert
from app.models.glucose_log import GlucoseLog
from app.models.health_preferences import HealthPreferences
from app.models.patient_doctor import Patient
from app.schemas.glucose_schemas import (
    GlucoseLogCreate,
    GlucoseLogResponse,
    GlucoseStatsResponse,
)


# ── Thresholds for auto-alerting ────────────────────────────
_CRITICAL_LOW = 54.0    # mg/dL — severe hypoglycaemia
_CRITICAL_HIGH = 300.0  # mg/dL — severe hyperglycaemia
_DEFAULT_MIN = 70.0
_DEFAULT_MAX = 140.0


def _resolve_patient_id(user_id: int, db: Session) -> int:
    """Resolve patient.id from user.id, raise 404 if no profile."""
    stmt = select(Patient.id).where(Patient.user_id == user_id)
    patient_id = db.execute(stmt).scalar_one_or_none()
    if patient_id is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Patient profile not found",
        )
    return patient_id


def _maybe_create_alert(
    patient_id: int, glucose_value: float, reading_type: str, db: Session
) -> None:
    """Create an alert if the glucose value is critically abnormal."""
    if glucose_value <= _CRITICAL_LOW:
        alert = Alert(
            patient_id=patient_id,
            alert_type="glucose_critical_low",
            severity="critical",
            message=(
                f"Critical low glucose: {glucose_value} mg/dL "
                f"({reading_type}). Seek immediate attention."
            ),
        )
        db.add(alert)
    elif glucose_value >= _CRITICAL_HIGH:
        alert = Alert(
            patient_id=patient_id,
            alert_type="glucose_critical_high",
            severity="critical",
            message=(
                f"Critical high glucose: {glucose_value} mg/dL "
                f"({reading_type}). Contact your doctor."
            ),
        )
        db.add(alert)


# ──────────────────────────────────────────────
# Create
# ──────────────────────────────────────────────
def create_glucose_log(
    data: GlucoseLogCreate, user_id: int, db: Session
) -> GlucoseLogResponse:
    """Insert a glucose reading and auto-alert if critical."""
    patient_id = _resolve_patient_id(user_id, db)

    log = GlucoseLog(
        patient_id=patient_id,
        glucose_value=data.glucose_value,
        reading_type=data.reading_type,
        recorded_at=data.recorded_at,
        notes=data.notes,
    )
    db.add(log)

    _maybe_create_alert(patient_id, data.glucose_value, data.reading_type, db)

    db.commit()
    db.refresh(log)
    return GlucoseLogResponse.model_validate(log)


# ──────────────────────────────────────────────
# List (paginated)
# ──────────────────────────────────────────────
def get_glucose_logs(
    user_id: int, db: Session, skip: int = 0, limit: int = 50
) -> list[GlucoseLogResponse]:
    """Return paginated glucose readings for the authenticated patient."""
    patient_id = _resolve_patient_id(user_id, db)

    stmt = (
        select(GlucoseLog)
        .where(GlucoseLog.patient_id == patient_id)
        .order_by(GlucoseLog.recorded_at.desc())
        .offset(skip)
        .limit(limit)
    )
    rows = db.execute(stmt).scalars().all()
    return [GlucoseLogResponse.model_validate(r) for r in rows]


# ──────────────────────────────────────────────
# Stats
# ──────────────────────────────────────────────
def get_glucose_stats(
    user_id: int, db: Session, days: int = 7
) -> GlucoseStatsResponse:
    """
    Returns aggregated glucose stats for the last N days.
    Computes in-range percentage using the patient's health preferences
    (falls back to defaults if not set).
    """
    patient_id = _resolve_patient_id(user_id, db)
    cutoff = datetime.now(timezone.utc) - timedelta(days=days)

    # --- aggregates ---
    agg_stmt = select(
        func.avg(GlucoseLog.glucose_value).label("avg"),
        func.min(GlucoseLog.glucose_value).label("min"),
        func.max(GlucoseLog.glucose_value).label("max"),
        func.count(GlucoseLog.id).label("cnt"),
    ).where(
        GlucoseLog.patient_id == patient_id,
        GlucoseLog.recorded_at >= cutoff,
    )
    result = db.execute(agg_stmt).one()

    if result.cnt == 0:
        return GlucoseStatsResponse(
            average=0, minimum=0, maximum=0, reading_count=0, in_range_pct=0
        )

    # --- in-range percentage ---
    pref_stmt = select(HealthPreferences).where(
        HealthPreferences.patient_id == patient_id
    )
    prefs = db.execute(pref_stmt).scalar_one_or_none()
    min_gl = float(prefs.min_glucose) if prefs else _DEFAULT_MIN
    max_gl = float(prefs.max_glucose) if prefs else _DEFAULT_MAX

    in_range_stmt = select(func.count(GlucoseLog.id)).where(
        GlucoseLog.patient_id == patient_id,
        GlucoseLog.recorded_at >= cutoff,
        GlucoseLog.glucose_value >= min_gl,
        GlucoseLog.glucose_value <= max_gl,
    )
    in_range_count = db.execute(in_range_stmt).scalar() or 0
    in_range_pct = round((in_range_count / result.cnt) * 100, 1)

    return GlucoseStatsResponse(
        average=round(float(result.avg), 1),
        minimum=round(float(result.min), 1),
        maximum=round(float(result.max), 1),
        reading_count=result.cnt,
        in_range_pct=in_range_pct,
    )
