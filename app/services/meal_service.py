"""
MealService — CRUD for meal logs with nested detected items.

Uses selectinload to prevent N+1 queries when fetching meals + items.
"""

from fastapi import HTTPException, status
from sqlalchemy import select
from sqlalchemy.orm import Session, selectinload

from app.models.meal_log import MealDetectedItem, MealLog
from app.models.patient_doctor import Patient
from app.schemas.meal_schemas import (
    MealLogCreate,
    MealLogResponse,
)


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


# ──────────────────────────────────────────────
# Create
# ──────────────────────────────────────────────
def create_meal_log(
    data: MealLogCreate, user_id: int, db: Session
) -> MealLogResponse:
    """
    Creates a meal log and its detected items in a single transaction.
    """
    patient_id = _resolve_patient_id(user_id, db)

    # Auto-calculate totals from items if not provided
    total_carbs = data.total_carbs_g
    total_cals = data.total_calories
    if data.detected_items:
        if total_carbs is None:
            total_carbs = sum(i.carbs_g or 0 for i in data.detected_items)
        if total_cals is None:
            total_cals = sum(i.calories or 0 for i in data.detected_items)

    meal = MealLog(
        patient_id=patient_id,
        meal_name=data.meal_name,
        image_url=data.image_url,
        total_carbs_g=total_carbs,
        total_calories=int(total_cals) if total_cals else None,
        meal_time=data.meal_time,
    )
    db.add(meal)
    db.flush()

    for item_data in data.detected_items:
        item = MealDetectedItem(
            meal_log_id=meal.id,
            food_name=item_data.food_name,
            confidence_pct=round(item_data.confidence_pct, 1) if item_data.confidence_pct else None,
            quantity_desc=item_data.quantity_desc,
            carbs_g=round(item_data.carbs_g, 2) if item_data.carbs_g else None,
            calories=round(item_data.calories, 2) if item_data.calories else None,
            protein_g=round(item_data.protein_g, 2) if item_data.protein_g else None,
            fat_g=round(item_data.fat_g, 2) if item_data.fat_g else None,
        )
        db.add(item)

    db.commit()
    db.refresh(meal)
    return MealLogResponse.model_validate(meal)


# ──────────────────────────────────────────────
# List (paginated, with eager-loaded items)
# ──────────────────────────────────────────────
def get_meal_logs(
    user_id: int, db: Session, skip: int = 0, limit: int = 50
) -> list[MealLogResponse]:
    """
    Return paginated meal logs for the authenticated patient.
    Uses selectinload to prevent N+1 on detected_items.
    """
    patient_id = _resolve_patient_id(user_id, db)

    stmt = (
        select(MealLog)
        .options(selectinload(MealLog.detected_items))
        .where(MealLog.patient_id == patient_id)
        .order_by(MealLog.meal_time.desc())
        .offset(skip)
        .limit(limit)
    )
    rows = db.execute(stmt).scalars().all()
    return [MealLogResponse.model_validate(r) for r in rows]


# ──────────────────────────────────────────────
# Single detail
# ──────────────────────────────────────────────
def get_meal_log_by_id(
    meal_id: int, user_id: int, db: Session
) -> MealLogResponse:
    """
    Return a single meal log with its detected items.
    Raises 404 if not found or doesn't belong to the user.
    """
    patient_id = _resolve_patient_id(user_id, db)

    stmt = (
        select(MealLog)
        .options(selectinload(MealLog.detected_items))
        .where(MealLog.id == meal_id, MealLog.patient_id == patient_id)
    )
    meal = db.execute(stmt).scalar_one_or_none()
    if meal is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Meal log not found",
        )
    return MealLogResponse.model_validate(meal)
