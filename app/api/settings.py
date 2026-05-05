"""Settings router — profile, preferences, and password."""

from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from app.core.dependencies import get_current_patient
from app.models.database import get_db
from app.models.user import User

import app.schemas.settings_schemas as schemas
from app.services.settings_service import (
    get_preferences,
    get_profile,
    update_password,
    update_preferences,
    update_profile,
)

router = APIRouter(prefix="/settings", tags=["Settings"])


@router.get("/profile", response_model=schemas.ProfileResponse, summary="Get patient profile")
def get_profile_api(
    current_user: User = Depends(get_current_patient), db: Session = Depends(get_db)
):
    return get_profile(current_user.id, db)


@router.put("/profile", response_model=schemas.ProfileResponse, summary="Update patient profile")
def update_profile_api(
    data: schemas.ProfileUpdateRequest,
    current_user: User = Depends(get_current_patient),
    db: Session = Depends(get_db),
):
    return update_profile(current_user.id, data, db)


@router.get(
    "/preferences",
    response_model=schemas.PreferencesResponse,
    summary="Get patient health preferences",
)
def get_preferences_api(
    current_user: User = Depends(get_current_patient), db: Session = Depends(get_db)
):
    return get_preferences(current_user.id, db)


@router.put(
    "/preferences",
    response_model=schemas.PreferencesResponse,
    summary="Update patient health preferences",
)
def update_preferences_api(
    data: schemas.PreferencesUpdateRequest,
    current_user: User = Depends(get_current_patient),
    db: Session = Depends(get_db),
):
    return update_preferences(current_user.id, data, db)


@router.put("/password", summary="Update password")
def update_password_api(
    data: schemas.PasswordUpdateRequest,
    current_user: User = Depends(get_current_patient),
    db: Session = Depends(get_db),
):
    return update_password(current_user.id, data, db)
