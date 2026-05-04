"""Glucose router — thin controller delegating to GlucoseService."""

from fastapi import APIRouter, Depends, Query, BackgroundTasks
from sqlalchemy.orm import Session

from app.core.dependencies import get_current_patient
from app.models.database import get_db
from app.models.user import User
from app.schemas.glucose_schemas import GlucoseLogCreate, GlucoseLogResponse, GlucoseStatsResponse
from app.services.glucose_service import create_glucose_log, get_glucose_logs, get_glucose_stats

router = APIRouter(prefix="/glucose", tags=["Glucose"])


@router.post("/logs", response_model=GlucoseLogResponse, status_code=201, summary="Log a glucose reading")
def create(
    data: GlucoseLogCreate, 
    background_tasks: BackgroundTasks,
    current_user: User = Depends(get_current_patient), 
    db: Session = Depends(get_db)
) -> GlucoseLogResponse:
    return create_glucose_log(data, current_user.id, db, background_tasks)


@router.get("/logs", response_model=list[GlucoseLogResponse], summary="List glucose readings")
def list_logs(
    skip: int = Query(0, ge=0), limit: int = Query(50, ge=1, le=100),
    current_user: User = Depends(get_current_patient), db: Session = Depends(get_db),
) -> list[GlucoseLogResponse]:
    return get_glucose_logs(current_user.id, db, skip, limit)


@router.get("/stats", response_model=GlucoseStatsResponse, summary="Glucose statistics")
def stats(
    days: int = Query(7, ge=1, le=90),
    current_user: User = Depends(get_current_patient), db: Session = Depends(get_db),
) -> GlucoseStatsResponse:
    return get_glucose_stats(current_user.id, db, days)
