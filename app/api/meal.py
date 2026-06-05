"""Meals router — thin controller delegating to MealService.

Single-phase: CNN runs first, then Vision API (Gemma) provides
food names and item-level detail synchronously.
"""

import logging

from fastapi import APIRouter, Depends, Query, Request, UploadFile, File, HTTPException, status
from sqlalchemy.orm import Session
from slowapi import Limiter
from slowapi.util import get_remote_address

from app.core.dependencies import get_current_patient
from app.models.database import get_db
from app.models.user import User
from app.schemas.meal_schemas import MealLogCreate, MealLogResponse
from app.services.meal_service import create_meal_log, get_meal_log_by_id, get_meal_logs
from app.services.ai_service import analyze_meal_image

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/meal", tags=["Meals"])
limiter = Limiter(key_func=get_remote_address)

ALLOWED_TYPES = {"image/jpeg", "image/png", "image/webp"}
MAX_SIZE_BYTES = 10 * 1024 * 1024  # 10MB


@router.post("/upload", summary="Upload a meal image for AI analysis")
@limiter.limit("10/minute")
async def upload_meal_image(
    request: Request,
    file: UploadFile = File(...),
    current_user: User = Depends(get_current_patient),
):
    """
    Analyze a meal image:
      1. CNN (MobileNetV2) estimates nutrition totals (<1s)
      2. Vision API (Gemma) identifies individual food items with names
      Returns a combined result with the real meal name and per-item nutrition.
    """
    # File validation
    if file.content_type not in ALLOWED_TYPES:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Unsupported file type: {file.content_type}. Allowed: JPEG, PNG, WebP.",
        )

    image_bytes = await file.read()

    if len(image_bytes) > MAX_SIZE_BYTES:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"File too large ({len(image_bytes) / 1024 / 1024:.1f}MB). Maximum: 10MB.",
        )

    if len(image_bytes) == 0:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Empty file uploaded.",
        )

    # Run hybrid analysis: CNN + Vision API synchronously
    mime_type = file.content_type or "image/jpeg"
    result = analyze_meal_image(image_bytes, mime_type)

    # Build response with proper rounding
    items = result.get("items", [])
    response_items = []
    for item in items:
        response_items.append({
            "food_name": item.get("food_name", "Unknown food"),
            "quantity_desc": item.get("quantity_desc", "1 serving"),
            "confidence_pct": round(float(item.get("confidence_pct", 80)), 1),
            "carbs_g": round(float(item.get("carbs_g", 0)), 2),
            "calories": round(float(item.get("calories", 0)), 2),
            "protein_g": round(float(item.get("protein_g", 0)), 2),
            "fat_g": round(float(item.get("fat_g", 0)), 2),
        })

    return {
        "meal_name": result.get("meal_name", "Detected Meal"),
        "items": response_items,
        "enriched": result.get("cnn_totals") is not None,
    }


@router.post("/confirm", response_model=MealLogResponse, status_code=201, summary="Confirm and save a meal log with detected items")
def confirm_meal(data: MealLogCreate, current_user: User = Depends(get_current_patient), db: Session = Depends(get_db)) -> MealLogResponse:
    logger.info("=== CONFIRM RECEIVED ===")
    logger.info("meal_name=%s, meal_time=%s, total_carbs_g=%s, total_calories=%s",
                data.meal_name, data.meal_time, data.total_carbs_g, data.total_calories)
    logger.info("detected_items count=%d", len(data.detected_items))
    for i, item in enumerate(data.detected_items):
        logger.info("  item[%d]: food_name=%s, carbs_g=%s, calories=%s, protein_g=%s, fat_g=%s",
                     i, item.food_name, item.carbs_g, item.calories, item.protein_g, item.fat_g)
    return create_meal_log(data, current_user.id, db)


@router.get("/", response_model=list[MealLogResponse], summary="List meal logs")
def list_meals(
    skip: int = Query(0, ge=0), limit: int = Query(50, ge=1, le=100),
    current_user: User = Depends(get_current_patient), db: Session = Depends(get_db),
) -> list[MealLogResponse]:
    return get_meal_logs(current_user.id, db, skip, limit)


@router.get("/{meal_id}", response_model=MealLogResponse, summary="Get meal detail")
def detail(meal_id: int, current_user: User = Depends(get_current_patient), db: Session = Depends(get_db)) -> MealLogResponse:
    return get_meal_log_by_id(meal_id, current_user.id, db)
