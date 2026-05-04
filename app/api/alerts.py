"""Alerts router — listing and marking alerts as read."""

from typing import Optional
from fastapi import APIRouter, Depends, Query
from sqlalchemy.orm import Session

from app.core.dependencies import get_current_patient
from app.models.database import get_db
from app.models.user import User
from app.schemas.alert_schemas import AlertMarkReadRequest, AlertResponse
from app.services.alert_service import get_patient_alerts, mark_alerts_read

router = APIRouter(prefix="/alerts", tags=["Alerts"])


@router.get("/", response_model=list[AlertResponse], summary="List alerts")
def list_alerts(
    is_read: Optional[bool] = Query(None),
    skip: int = Query(0, ge=0), limit: int = Query(50, ge=1, le=100),
    current_user: User = Depends(get_current_patient), db: Session = Depends(get_db),
) -> list[AlertResponse]:
    return get_patient_alerts(current_user.id, db, is_read, skip, limit)


@router.patch("/read", summary="Mark alerts as read")
def mark_read(data: AlertMarkReadRequest, current_user: User = Depends(get_current_patient), db: Session = Depends(get_db)) -> dict:
    return mark_alerts_read(data, current_user.id, db)
