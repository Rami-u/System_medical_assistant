"""Meals router — thin controller delegating to MealService."""

import logging

from fastapi import APIRouter, Depends, Query, UploadFile, File, HTTPException, status
from sqlalchemy.orm import Session

from app.core.dependencies import get_current_patient
from app.models.database import get_db
from app.models.user import User
from app.schemas.meal_schemas import MealLogCreate, MealLogResponse
from app.services.meal_service import create_meal_log, get_meal_log_by_id, get_meal_logs
from app.services.ai_service import analyze_meal_image, AIModelService

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/meal", tags=["Meals"])


@router.post("/upload", summary="Upload a meal image for AI analysis")
async def upload_meal_image(file: UploadFile = File(...), current_user: User = Depends(get_current_patient)):
    if not file.content_type.startswith("image/"):
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="File must be an image")

    image_bytes = await file.read()

    # ── 1. Try Gemini Vision FIRST for detailed food itemization ──────────
    # Gemini can identify individual foods (chicken, potatoes, peas)
    # while the CNN regressor can only estimate total nutrition for the whole plate.
    try:
        result = analyze_meal_image(image_bytes, file.content_type)
        logger.info("Gemini returned %d items for meal '%s'",
                     len(result.get("items", [])), result.get("meal_name", "?"))
        return result
    except HTTPException as exc:
        logger.warning("Gemini Vision failed (status=%s): %s", exc.status_code, exc.detail)
        # Fall through to CNN fallback
    except Exception as exc:
        logger.warning("Gemini Vision unexpected error: %s", exc)
        # Fall through to CNN fallback

    # ── 2. Fallback: local Nutrition5k CNN regression model ──────────────
    # This model can only estimate total nutrition, not identify individual foods.
    if AIModelService.models_ready():
        try:
            cnn_result = AIModelService.run_vision_model(image_bytes)
        except Exception as exc:
            logger.warning("Vision model inference failed: %s", exc)
            raise HTTPException(
                status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
                detail=f"Both AI services failed. Vision model error: {exc}",
            )

        if cnn_result is not None:
            logger.info("CNN fallback result: %s", cnn_result)
            return {
                "meal_name": "Detected Meal",
                "items": [
                    {
                        "food_name": "Detected Food (AI Estimated)",
                        "quantity_desc": "1 serving",
                        "confidence_pct": 80.0,
                        "carbs_g": round(cnn_result.get("carbs_g", 0), 1),
                        "protein_g": round(cnn_result.get("protein_g", 0), 1),
                        "fat_g": round(cnn_result.get("fat_g", 0), 1),
                        "calories": round(cnn_result.get("calories", 0)),
                    }
                ]
            }

    # ── 3. Both services unavailable ─────────────────────────────────────
    raise HTTPException(
        status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
        detail="No AI service available to analyze the image.",
    )


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
