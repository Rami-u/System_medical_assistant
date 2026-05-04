"""Screening router — thin controller delegating to ScreeningService."""

from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from app.core.dependencies import get_current_patient
from app.models.database import get_db
from app.models.user import User
from app.schemas.screening_schemas import ScreeningPredictRequest, ScreeningResponse
from app.services.screening_service import predict_and_save_screening

router = APIRouter(prefix="/screening", tags=["Screening"])


@router.post("/predict", response_model=ScreeningResponse, status_code=201, summary="Predict diabetes risk via AI")
def predict_risk(
    data: ScreeningPredictRequest, 
    current_user: User = Depends(get_current_patient), 
    db: Session = Depends(get_db)
) -> ScreeningResponse:
    """
    Submits screening answers to Gemini, generates a risk assessment, 
    and saves the Screening log with answers to the database.
    """
    return predict_and_save_screening(data, current_user.id, db)
