"""Meals router — thin controller delegating to MealService.

Implements two-phase response architecture:
  Phase 1: CNN result returns immediately (<1 second)
  Phase 2: Vision API enrichment runs in background, polled by frontend
"""

import logging
import uuid
import time
import hashlib

from fastapi import APIRouter, BackgroundTasks, Depends, Query, Request, UploadFile, File, HTTPException, status
from sqlalchemy.orm import Session
from slowapi import Limiter
from slowapi.util import get_remote_address

from app.core.dependencies import get_current_patient
from app.models.database import get_db
from app.models.user import User
from app.schemas.meal_schemas import MealLogCreate, MealLogResponse
from app.services.meal_service import create_meal_log, get_meal_log_by_id, get_meal_logs
from app.services.ai_service import AIModelService, _call_vision_api, OPENROUTER_API_KEY

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/meal", tags=["Meals"])
limiter = Limiter(key_func=get_remote_address)

# ── In-memory enrichment cache ────────────────────────────────────────────────
_enrichment_cache: dict[str, dict] = {}
_enrichment_ttl: dict[str, float] = {}
CACHE_TTL_SECONDS = 300  # 5 minutes


def _cleanup_expired_cache() -> None:
    """Remove expired entries from the enrichment cache."""
    now = time.time()
    expired = [k for k, v in _enrichment_ttl.items() if now - v > CACHE_TTL_SECONDS]
    for k in expired:
        _enrichment_cache.pop(k, None)
        _enrichment_ttl.pop(k, None)


def _enrich_meal_background(task_id: str, image_bytes: bytes, mime_type: str) -> None:
    """Background task: call Vision API and store result in cache."""
    try:
        api_result = _call_vision_api(image_bytes, mime_type)
        if api_result and api_result.get("items"):
            _enrichment_cache[task_id] = api_result
            _enrichment_ttl[task_id] = time.time()
            logger.info(
                "Enrichment complete for task %s: %d items identified",
                task_id, len(api_result.get("items", [])),
            )
        else:
            # Mark as done with no enrichment
            _enrichment_cache[task_id] = {"status": "no_enrichment"}
            _enrichment_ttl[task_id] = time.time()
            logger.info("Enrichment for task %s: no items found by Vision API", task_id)
    except Exception as exc:
        logger.warning("Vision API enrichment failed for task %s: %s", task_id, exc)
        _enrichment_cache[task_id] = {"status": "failed"}
        _enrichment_ttl[task_id] = time.time()


ALLOWED_TYPES = {"image/jpeg", "image/png", "image/webp"}
MAX_SIZE_BYTES = 10 * 1024 * 1024  # 10MB


@router.post("/upload", summary="Upload a meal image for AI analysis")
@limiter.limit("10/minute")
async def upload_meal_image(
    request: Request,
    background_tasks: BackgroundTasks,
    file: UploadFile = File(...),
    current_user: User = Depends(get_current_patient),
):
    """
    Two-phase meal analysis:
      Phase 1: CNN runs immediately, returns nutrition data + task_id
      Phase 2: Vision API enrichment runs in background (poll /meal/enrich/{task_id})
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

    # Phase 1: Run CNN immediately
    cnn_result = None
    try:
        cnn_result = AIModelService.run_vision_model(image_bytes)
        if cnn_result:
            logger.info(
                "CNN prediction: cal=%.1f, carbs=%.1fg, fat=%.1fg, prot=%.1fg",
                cnn_result.get("calories", 0), cnn_result.get("carbs_g", 0),
                cnn_result.get("fat_g", 0), cnn_result.get("protein_g", 0),
            )
    except Exception as e:
        logger.warning("CNN model failed: %s", e)

    if not cnn_result:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="Unable to analyze meal image. Please try again.",
        )

    # Build immediate response
    result = {
        "meal_name": cnn_result.get("meal_name", "Detected Meal"),
        "items": [
            {
                "food_name": "Detected Meal (CNN estimate)",
                "quantity_desc": f"~{cnn_result.get('mass_g', 0):.0f}g",
                "confidence_pct": 80.0,
                "carbs_g": round(float(cnn_result.get("carbs_g", 0)), 2),
                "calories": round(float(cnn_result.get("calories", 0)), 2),
                "protein_g": round(float(cnn_result.get("protein_g", 0)), 2),
                "fat_g": round(float(cnn_result.get("fat_g", 0)), 2),
            }
        ],
        "enriched": False,
    }

    # Phase 2: Schedule Vision API enrichment in background
    task_id = str(uuid.uuid4())
    if OPENROUTER_API_KEY:
        _cleanup_expired_cache()
        background_tasks.add_task(
            _enrich_meal_background, task_id, image_bytes, file.content_type or "image/jpeg"
        )
        result["task_id"] = task_id
        logger.info("Scheduled enrichment task %s for user %d", task_id, current_user.id)
    else:
        result["task_id"] = None

    return result


@router.get("/enrich/{task_id}", summary="Poll for Vision API enrichment result")
async def get_enrichment(task_id: str, current_user: User = Depends(get_current_patient)):
    """
    Poll for background Vision API enrichment result.
    Returns {status: "pending"} until enrichment completes, then {status: "done", data: ...}
    """
    result = _enrichment_cache.get(task_id)
    if result is None:
        return {"status": "pending"}

    if result.get("status") in ("no_enrichment", "failed"):
        return {"status": "done", "data": None}

    return {"status": "done", "data": result}


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
