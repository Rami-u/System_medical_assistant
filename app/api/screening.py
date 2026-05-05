"""Screening router — thin controller delegating to ScreeningService."""

from typing import Optional

from fastapi import APIRouter, Depends, Request
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from sqlalchemy.orm import Session

from app.core.dependencies import get_current_patient
from app.core.security import decode_token
from app.models.database import get_db
from app.models.user import User
from app.schemas.screening_schemas import (
    ScreeningPredictRequest,
    ScreeningResponse,
    ScreeningTestInfoResponse,
    ScreeningHistoryItem,
)
from app.services.screening_service import (
    predict_and_save_screening,
    get_screening_questions,
    get_screening_history,
)

router = APIRouter(prefix="/screening", tags=["Screening"])

# Optional bearer — does NOT reject anonymous requests
_optional_bearer = HTTPBearer(auto_error=False)


def _get_optional_user_id(
    credentials: Optional[HTTPAuthorizationCredentials] = Depends(_optional_bearer),
) -> int | None:
    """Return the user_id from the JWT if a valid token is present,
    otherwise return None (anonymous user)."""
    if credentials is None:
        return None
    payload = decode_token(credentials.credentials)
    if payload is None or payload.get("type") != "access":
        return None
    sub = payload.get("sub")
    return int(sub) if sub is not None else None


@router.post(
    "/predict",
    response_model=ScreeningResponse,
    status_code=201,
    summary="Predict diabetes risk (public — auth optional)",
)
def predict_risk(
    data: ScreeningPredictRequest,
    user_id: int | None = Depends(_get_optional_user_id),
    db: Session = Depends(get_db),
) -> ScreeningResponse:
    """
    Public endpoint: runs the sklearn model and returns a risk assessment.
    If the caller provides a valid Bearer token the result is also
    persisted to their patient profile.
    """
    return predict_and_save_screening(data, user_id, db)


@router.get(
    "/questions/{test_type}",
    response_model=ScreeningTestInfoResponse,
    summary="Get screening questions",
)
def get_questions_api(test_type: str, db: Session = Depends(get_db)):
    return get_screening_questions(test_type, db)


@router.get(
    "/history",
    response_model=list[ScreeningHistoryItem],
    summary="Get patient screening history",
)
def get_history_api(
    current_user: User = Depends(get_current_patient), db: Session = Depends(get_db)
):
    return get_screening_history(current_user.id, db)
