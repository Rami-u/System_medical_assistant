"""Retinopathy router — DR screening endpoint for fundus image analysis."""

import logging

from fastapi import APIRouter, Depends, File, HTTPException, Request, UploadFile, status
from slowapi import Limiter
from slowapi.util import get_remote_address

from app.core.dependencies import get_current_patient
from app.models.user import User
from app.schemas.retinopathy_schemas import RetinopathyResponse

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/retinopathy", tags=["Retinopathy"])
limiter = Limiter(key_func=get_remote_address)

ALLOWED_TYPES = {"image/jpeg", "image/png", "image/webp"}
MAX_SIZE_BYTES = 10 * 1024 * 1024  # 10MB


@router.post(
    "/predict",
    response_model=RetinopathyResponse,
    summary="Predict diabetic retinopathy grade from a fundus image",
)
@limiter.limit("10/minute")
async def predict_retinopathy(
    request: Request,
    file: UploadFile = File(...),
    current_user: User = Depends(get_current_patient),
) -> RetinopathyResponse:
    """
    Upload a retinal fundus image for AI-powered DR screening.

    - Accepts JPEG, PNG, or WebP images up to 10MB
    - Returns severity grade (0-4), confidence, and clinical recommendation
    - Auth: Bearer token (patient role required)
    """
    # File type validation
    if file.content_type not in ALLOWED_TYPES:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Unsupported file type: {file.content_type}. Allowed: JPEG, PNG, WebP.",
        )

    # Read and validate size
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

    # Run inference
    from ml.retinopathy.dr_inference import DRInferenceService

    if not DRInferenceService.is_loaded():
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="DR model is not loaded. Please try again later.",
        )

    try:
        result = DRInferenceService.predict(image_bytes)
    except Exception as exc:
        logger.error("DR prediction failed: %s", exc, exc_info=True)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to analyze the image. The image may be corrupt or unsupported.",
        )

    logger.info(
        "DR screening for user %d: grade=%d (%s), confidence=%.1f%%",
        current_user.id, result["grade"], result["label"], result["confidence"],
    )

    return RetinopathyResponse(**result)
