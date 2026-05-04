"""
AlertService — listing and bulk-updating patient alerts.
"""

from fastapi import HTTPException, status
from sqlalchemy import select, update
from sqlalchemy.orm import Session

from app.models.alert import Alert
from app.models.patient_doctor import Patient
from app.schemas.alert_schemas import AlertMarkReadRequest, AlertResponse


def _resolve_patient_id(user_id: int, db: Session) -> int:
    stmt = select(Patient.id).where(Patient.user_id == user_id)
    patient_id = db.execute(stmt).scalar_one_or_none()
    if patient_id is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Patient profile not found")
    return patient_id


def get_patient_alerts(
    user_id: int, db: Session, is_read: bool | None = None, skip: int = 0, limit: int = 50
) -> list[AlertResponse]:
    patient_id = _resolve_patient_id(user_id, db)
    stmt = select(Alert).where(Alert.patient_id == patient_id).order_by(Alert.created_at.desc())
    if is_read is not None:
        stmt = stmt.where(Alert.is_read == is_read)
    stmt = stmt.offset(skip).limit(limit)
    rows = db.execute(stmt).scalars().all()
    return [AlertResponse.model_validate(r) for r in rows]


def mark_alerts_read(data: AlertMarkReadRequest, user_id: int, db: Session) -> dict:
    patient_id = _resolve_patient_id(user_id, db)
    stmt = update(Alert).where(Alert.patient_id == patient_id, Alert.id.in_(data.alert_ids)).values(is_read=True)
    result = db.execute(stmt)
    db.commit()
    return {"updated_count": result.rowcount}
