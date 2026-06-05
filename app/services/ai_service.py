"""
AiService — conversation management with OpenRouter AI integration.

Uses selectinload to prevent N+1 when loading messages.
Connects chatbot to patient health data (glucose, meals, screenings).
"""

from datetime import datetime, timezone, timedelta
import io
import logging

from fastapi import HTTPException, status
from sqlalchemy import func, select
from sqlalchemy.orm import Session, selectinload

import json
import os
import requests as http_requests

from app.models.ai_conversation import AiConversation, AiMessage
from app.models.patient_doctor import Patient
from app.models.glucose_log import GlucoseLog
from app.models.meal_log import MealLog
from app.models.screening import Screening
from app.schemas.ai_schemas import (
    AiChatRequest, AiConversationCreate, AiConversationListItem,
    AiConversationResponse, AiMessageResponse,
)

logger = logging.getLogger(__name__)

# ── OpenRouter config ─────────────────────────────────────────────────────────
OPENROUTER_API_KEY = os.getenv("OPENROUTER_API_KEY", "")
OPENROUTER_MODEL = os.getenv("OPENROUTER_MODEL", "openai/gpt-oss-120b:free")
# Vision model must support image input — text-only models like gpt-oss-120b CANNOT analyze images
OPENROUTER_VISION_MODEL = os.getenv("OPENROUTER_VISION_MODEL", "google/gemma-4-31b-it:free")
# Fallback vision models to try when the primary is rate-limited
VISION_FALLBACK_MODELS = [
    "google/gemma-4-26b-a4b-it:free",
    "nvidia/nemotron-nano-12b-v2-vl:free",
]
OPENROUTER_URL = "https://openrouter.ai/api/v1/chat/completions"


# ──────────────────────────────────────────────
# Pre-trained model management
# ──────────────────────────────────────────────

class AIModelService:
    """
    Manages pre-trained scikit-learn and PyTorch models used for
    diabetes screening and food-image nutrition estimation.
    """

    _simple_model = None
    _advanced_model = None
    _vision_model = None

    # Normalization stats from training — needed to denormalize model outputs
    # Order matches model output: [total_calories, total_fat, total_carb, total_protein]
    _target_names: list[str] = []
    _target_means: dict[str, float] = {}
    _target_stds: dict[str, float] = {}

    @classmethod
    def load_models(cls) -> None:
        """Load all three pre-trained models from the models/ directory."""
        import joblib
        import torch
        import torch.nn as nn
        from torchvision import models as tv_models

        logger.info("Loading pre-trained models …")
        cls._simple_model   = joblib.load("ml/screening/simple_model.pkl")
        cls._advanced_model = joblib.load("ml/screening/advanced_model.pkl")

        # ── Load Nutrition CNN (MobileNetV2 regression model) ──────────────
        # nutrition_cnn.pkl contains the full model checkpoint saved via joblib:
        #   model_state_dict, means, stds, targets, img_size, history, best_val_loss
        # The model was trained on GPU, so we must patch torch._load_from_bytes
        # to force map_location='cpu' for the nested pickle deserialization.
        _original_torch_load = torch.load

        def _cpu_load_from_bytes(b):
            return _original_torch_load(
                io.BytesIO(b), map_location="cpu", weights_only=False
            )

        # Temporarily patch so joblib can deserialize CUDA tensors on CPU
        _orig_storage_loader = torch.storage._load_from_bytes
        torch.storage._load_from_bytes = _cpu_load_from_bytes
        try:
            checkpoint = joblib.load("ml/nutrition/nutrition_cnn.pkl")
        finally:
            torch.storage._load_from_bytes = _orig_storage_loader

        logger.info("Checkpoint keys: %s", list(checkpoint.keys()))

        # Store normalization statistics for denormalizing predictions
        cls._target_names = checkpoint["targets"]   # ['total_calories', 'total_fat', 'total_carb', 'total_protein']
        cls._target_means = checkpoint["means"]
        cls._target_stds  = checkpoint["stds"]
        img_size = checkpoint.get("img_size", 224)
        logger.info("Target names: %s", cls._target_names)
        logger.info("Target means: %s", cls._target_means)
        logger.info("Target stds:  %s", cls._target_stds)
        logger.info("Image size:   %d", img_size)
        logger.info("Best val loss: %.4f", checkpoint.get("best_val_loss", -1))

        state_dict = checkpoint["model_state_dict"]

        # ── Reconstruct MobileNetV2 + custom regression head ───────────────
        # Architecture must EXACTLY match model.py NutritionCNN class:
        #   backbone = MobileNetV2  (features.0 – features.18, last conv→1280)
        #   classifier = Sequential(
        #     [0] Dropout(0.4),
        #     [1] Linear(1280, 512),  [2] ReLU(inplace),
        #     [3] BatchNorm1d(512),   [4] Dropout(0.3),
        #     [5] Linear(512, 256),   [6] ReLU(inplace),
        #     [7] BatchNorm1d(256),   [8] Dropout(0.2),
        #     [9] Linear(256, 128),  [10] ReLU(inplace),
        #    [11] Linear(128, 4)     ← 4 regression outputs
        #   )
        num_outputs = len(cls._target_names)  # 4

        backbone = tv_models.mobilenet_v2(weights=None)
        backbone.classifier = nn.Sequential(
            nn.Dropout(p=0.4),                # [0]
            nn.Linear(1280, 512),             # [1]
            nn.ReLU(inplace=True),            # [2]
            nn.BatchNorm1d(512),              # [3]
            nn.Dropout(p=0.3),                # [4]
            nn.Linear(512, 256),              # [5]
            nn.ReLU(inplace=True),            # [6]
            nn.BatchNorm1d(256),              # [7]
            nn.Dropout(p=0.2),                # [8]
            nn.Linear(256, 128),              # [9]
            nn.ReLU(inplace=True),            # [10]
            nn.Linear(128, num_outputs),      # [11] — 4 regression outputs
        )

        # Strip "backbone." prefix — the state dict was saved with a wrapper
        cleaned = {k.replace("backbone.", "", 1): v for k, v in state_dict.items()}
        backbone.load_state_dict(cleaned, strict=True)
        backbone.eval()

        cls._vision_model = backbone
        logger.info(
            "✓ Vision model loaded: MobileNetV2 nutrition regressor with %d outputs.",
            num_outputs,
        )

    @classmethod
    def models_ready(cls) -> bool:
        return all([cls._simple_model, cls._advanced_model, cls._vision_model])

    @classmethod
    def screening_ready(cls) -> bool:
        """Check only if screening models are loaded — does NOT require vision model."""
        return cls._advanced_model is not None

    # ── Vision: MobileNetV2 Nutrition Regression CNN ───────────────────────
    @classmethod
    def run_vision_model(cls, image_bytes: bytes) -> dict | None:
        """
        Run the MobileNetV2 nutrition regression CNN on raw image bytes.

        The model is a NUTRITION REGRESSOR — it does NOT classify food names.
        Model output shape: [1, 4] → normalized Z-scores for
            [total_calories, total_fat, total_carb, total_protein]

        Outputs are **denormalized** using the training-set means/stds
        that were stored in the checkpoint.

        Returns a nutrition dict, or None on unexpected error.
        """
        import torch
        from PIL import Image
        from torchvision import transforms

        # Standard ImageNet preprocessing (matches training pipeline)
        preprocess = transforms.Compose([
            transforms.Resize((224, 224)),
            transforms.ToTensor(),
            transforms.Normalize(
                mean=[0.485, 0.456, 0.406],
                std=[0.229, 0.224, 0.225],
            ),
        ])

        image = Image.open(io.BytesIO(image_bytes)).convert("RGB")
        tensor = preprocess(image).unsqueeze(0)  # shape: (1, 3, 224, 224)

        logger.info("Input image size: %s", image.size)
        logger.info("Tensor shape: %s", tensor.shape)

        with torch.no_grad():
            output = cls._vision_model(tensor)  # shape: [1, 4]

        logger.info("Model raw output (Z-scores): %s", output)

        # ── Denormalize: prediction = z_score * std + mean ─────────────────
        # Output order matches cls._target_names:
        #   [total_calories, total_fat, total_carb, total_protein]
        results = {}
        for i, name in enumerate(cls._target_names):
            z = float(output[0][i])
            # Match original inference.py: label_norm * (std + 1e-8) + mean
            val = z * (cls._target_stds[name] + 1e-8) + cls._target_means[name]
            results[name] = max(0, val)  # Clamp negatives to zero

        calories  = results.get("total_calories", 0)
        fat_g     = results.get("total_fat", 0)
        carbs_g   = results.get("total_carb", 0)
        protein_g = results.get("total_protein", 0)

        # Estimate total mass from macronutrients + water content
        # Typical food is ~60-70% water. Macros account for the rest.
        # mass ≈ (protein + carbs + fat) / 0.35  (macros are ~35% of food weight)
        macro_sum = protein_g + carbs_g + fat_g
        mass_g = max(macro_sum, macro_sum / 0.35) if macro_sum > 0 else 0

        logger.info(
            "Predicted (denormalized): calories=%.1f, carbs=%.1fg, fat=%.1fg, protein=%.1fg, mass=%.1fg",
            calories, carbs_g, fat_g, protein_g, mass_g,
        )

        return {
            "meal_name": "Detected Meal",
            "calories":  round(calories,  1),
            "carbs_g":   round(carbs_g,   1),
            "fat_g":     round(fat_g,     1),
            "protein_g": round(protein_g, 1),
            "mass_g":    round(mass_g,    1),
        }


def _resolve_patient_id(user_id: int, db: Session) -> int:
    stmt = select(Patient.id).where(Patient.user_id == user_id)
    pid = db.execute(stmt).scalar_one_or_none()
    if pid is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Patient profile not found")
    return pid


# ──────────────────────────────────────────────
# Patient context builder — feeds patient health
# data into the AI chatbot for personalized replies
# ──────────────────────────────────────────────

def _build_patient_context(patient_id: int, db: Session) -> str:
    """
    Build a rich context string from the patient's recent health data
    so the AI can give personalized, data-aware responses.
    """
    parts = []

    # ── Recent glucose readings (last 7 days, up to 15) ──
    cutoff = datetime.now(timezone.utc) - timedelta(days=7)
    glucose_stmt = (
        select(GlucoseLog)
        .where(GlucoseLog.patient_id == patient_id, GlucoseLog.recorded_at >= cutoff)
        .order_by(GlucoseLog.recorded_at.desc())
        .limit(15)
    )
    glucose_logs = db.execute(glucose_stmt).scalars().all()
    if glucose_logs:
        readings = []
        for g in glucose_logs:
            try:
                dt = g.recorded_at if isinstance(g.recorded_at, datetime) else datetime.fromisoformat(str(g.recorded_at))
                readings.append(f"  - {dt.strftime('%b %d %H:%M')}: {g.glucose_value} mg/dL ({g.reading_type or 'unknown'})")
            except Exception:
                readings.append(f"  - {g.glucose_value} mg/dL ({g.reading_type or 'unknown'})")

        values = [float(g.glucose_value) for g in glucose_logs]
        avg_g = sum(values) / len(values)
        high_count = sum(1 for v in values if v >= 126)
        low_count = sum(1 for v in values if v < 70)

        parts.append(
            f"RECENT GLUCOSE (last 7 days, {len(glucose_logs)} readings):\n"
            f"  Average: {avg_g:.0f} mg/dL | High (≥126): {high_count} | Low (<70): {low_count}\n"
            + "\n".join(readings[:8])  # Show max 8 in prompt
        )

    # ── Recent meals (last 7 days, up to 10) ──
    meal_stmt = (
        select(MealLog)
        .where(MealLog.patient_id == patient_id, MealLog.meal_time >= cutoff)
        .order_by(MealLog.meal_time.desc())
        .limit(10)
    )
    meal_logs = db.execute(meal_stmt).scalars().all()
    if meal_logs:
        meals = []
        for m in meal_logs:
            carbs = f"{m.total_carbs_g}g carbs" if m.total_carbs_g else "unknown carbs"
            meals.append(f"  - {m.meal_name or 'Meal'}: {carbs}")

        parts.append(
            f"RECENT MEALS (last 7 days, {len(meal_logs)} logged):\n"
            + "\n".join(meals[:6])
        )

    # ── Latest screening result ──
    screen_stmt = (
        select(Screening)
        .where(Screening.patient_id == patient_id)
        .order_by(Screening.created_at.desc())
        .limit(1)
    )
    screening = db.execute(screen_stmt).scalar_one_or_none()
    if screening:
        parts.append(
            f"LATEST SCREENING:\n"
            f"  Risk Level: {screening.risk_level} | Score: {screening.risk_score}/100"
        )

    # ── Patient profile ──
    patient = db.execute(select(Patient).where(Patient.id == patient_id)).scalar_one_or_none()
    if patient:
        info = []
        if patient.diabetes_type_id:
            info.append(f"Diabetes Type ID: {patient.diabetes_type_id}")
        if patient.height_cm:
            info.append(f"Height: {patient.height_cm}cm")
        if patient.weight_kg:
            info.append(f"Weight: {patient.weight_kg}kg")
        if info:
            parts.append("PATIENT PROFILE:\n  " + " | ".join(info))

    return "\n\n".join(parts) if parts else "No health data available yet."


# ──────────────────────────────────────────────
# OpenRouter API call
# ──────────────────────────────────────────────

def _call_openrouter(messages: list[dict], max_tokens: int = 1024, model: str | None = None, timeout: int = 60) -> str:
    """Call OpenRouter API with retry on rate-limit (429).

    Args:
        model: Override the default model. Use OPENROUTER_VISION_MODEL for image tasks.
        timeout: HTTP request timeout in seconds (3 for vision, 60 for chat).
    """
    import time as _time

    if not OPENROUTER_API_KEY:
        logger.warning("OPENROUTER_API_KEY is not set — returning fallback.")
        return (
            "I'm your Diacheck AI assistant. The AI service is not configured yet. "
            "Please set the OPENROUTER_API_KEY in your .env file to enable AI responses."
        )

    use_model = model or OPENROUTER_MODEL
    headers = {
        "Authorization": f"Bearer {OPENROUTER_API_KEY}",
        "Content-Type": "application/json",
        "HTTP-Referer": "http://localhost:5173",
        "X-Title": "DiaCheck Medical Assistant",
    }
    payload = {
        "model": use_model,
        "messages": messages,
        "max_tokens": max_tokens,
        "temperature": 0.7,
    }

    # Retry up to 3 times with exponential backoff on 429 rate-limit
    max_retries = 3
    for attempt in range(max_retries):
        try:
            logger.info("Calling OpenRouter model=%s (attempt %d/%d, timeout=%ds)", use_model, attempt + 1, max_retries, timeout)
            resp = http_requests.post(OPENROUTER_URL, headers=headers, json=payload, timeout=timeout)
            resp.raise_for_status()
            data = resp.json()
            content = data["choices"][0]["message"].get("content")
            if content:
                return content.strip()
            # Some models return None content with reasoning — skip
            logger.warning("Model %s returned empty content, attempt %d", use_model, attempt + 1)
            return "AI returned an empty response. Please try again."
        except http_requests.exceptions.HTTPError as e:
            status_code = e.response.status_code
            logger.error("OpenRouter HTTP error %s: %s", status_code, e.response.text[:300])
            if status_code == 429:
                wait = 0.5 * (2 ** attempt)  # 0.5s, 1s, 2s
                logger.info("Rate limited. Waiting %.1fs before retry...", wait)
                _time.sleep(wait)
                continue  # retry
            return f"AI service error (HTTP {status_code}). Please try again shortly."
        except http_requests.exceptions.Timeout:
            logger.warning("OpenRouter request timed out after %ds (attempt %d)", timeout, attempt + 1)
            continue
        except Exception as exc:
            logger.error("OpenRouter call failed: %s", exc)
            return (
                "I'm currently unable to process your request due to a temporary "
                "service issue. Please try again shortly."
            )

    # All retries exhausted
    return "AI service is temporarily busy. Please wait a moment and try again."



def _generate_ai_response(user_message: str, patient_context: str = "") -> str:
    """Generate AI response using OpenRouter, with patient data context."""
    system_prompt = (
        "You are Diacheck AI, a helpful medical assistant specializing in "
        "diabetes management. You provide evidence-based guidance on blood sugar "
        "management, diet, exercise, medication adherence, and general wellness "
        "for diabetic patients. Always remind users to consult their doctor for "
        "medical decisions. Be concise, empathetic, and professional.\n\n"
        "You have access to the patient's recent health data below. Use it to "
        "give personalized, data-driven advice. Reference their actual glucose "
        "readings, meals, and screening results when relevant.\n\n"
        f"── PATIENT HEALTH DATA ──\n{patient_context}\n──────────────────────"
    )

    messages = [
        {"role": "system", "content": system_prompt},
        {"role": "user", "content": user_message},
    ]

    return _call_openrouter(messages)


def create_conversation(data: AiConversationCreate, user_id: int, db: Session) -> AiConversationResponse:
    patient_id = _resolve_patient_id(user_id, db)
    convo = AiConversation(patient_id=patient_id, title=data.title or "New Conversation")
    db.add(convo)
    db.commit()
    db.refresh(convo)
    return AiConversationResponse(
        id=convo.id, patient_id=convo.patient_id,
        title=convo.title, created_at=convo.created_at, messages=[],
    )


def send_message(conversation_id: int, data: AiChatRequest, user_id: int, db: Session) -> list[AiMessageResponse]:
    patient_id = _resolve_patient_id(user_id, db)

    # Verify conversation ownership
    stmt = select(AiConversation).where(
        AiConversation.id == conversation_id, AiConversation.patient_id == patient_id
    )
    convo = db.execute(stmt).scalar_one_or_none()
    if convo is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Conversation not found")

    # Save user message
    user_msg = AiMessage(conversation_id=conversation_id, sender="user", message_text=data.message)
    db.add(user_msg)
    db.flush()

    # Build patient context from their health data
    patient_context = _build_patient_context(patient_id, db)
    logger.info("Patient context for AI (patient_id=%d): %s", patient_id, patient_context[:200])

    # Generate and save AI response
    ai_text = _generate_ai_response(data.message, patient_context)
    ai_msg = AiMessage(conversation_id=conversation_id, sender="ai", message_text=ai_text)
    db.add(ai_msg)
    db.commit()
    db.refresh(user_msg)
    db.refresh(ai_msg)

    return [AiMessageResponse.model_validate(user_msg), AiMessageResponse.model_validate(ai_msg)]


def get_conversations(user_id: int, db: Session, skip: int = 0, limit: int = 20) -> list[AiConversationListItem]:
    patient_id = _resolve_patient_id(user_id, db)

    stmt = (
        select(
            AiConversation.id, AiConversation.title, AiConversation.created_at,
            func.count(AiMessage.id).label("message_count"),
        )
        .outerjoin(AiMessage, AiMessage.conversation_id == AiConversation.id)
        .where(AiConversation.patient_id == patient_id)
        .group_by(AiConversation.id)
        .order_by(AiConversation.created_at.desc())
        .offset(skip).limit(limit)
    )
    rows = db.execute(stmt).all()
    return [
        AiConversationListItem(id=r.id, title=r.title, created_at=r.created_at, message_count=r.message_count)
        for r in rows
    ]


def get_conversation_detail(conversation_id: int, user_id: int, db: Session) -> AiConversationResponse:
    patient_id = _resolve_patient_id(user_id, db)
    stmt = (
        select(AiConversation)
        .options(selectinload(AiConversation.messages))
        .where(AiConversation.id == conversation_id, AiConversation.patient_id == patient_id)
    )
    convo = db.execute(stmt).scalar_one_or_none()
    if convo is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Conversation not found")
    return AiConversationResponse.model_validate(convo)


# ──────────────────────────────────────────────
# Phase 4: Meal & Screening AI Integrations
# ──────────────────────────────────────────────

def analyze_meal_image(image_bytes: bytes, mime_type: str) -> dict:
    """
    Hybrid meal analysis: CNN primary + Vision API enrichment.

    1. CNN (PRIMARY): Fast, offline nutrition estimation — always runs first.
       Returns total calories, fat, carbs, protein for the whole plate.
    2. Vision API (ENRICHMENT): Identifies individual food items with names.
       If API is available, it enriches the CNN totals with item-by-item detail.
       If API fails (rate-limited, offline), CNN results are still returned.

    Returns {meal_name, items: [{food_name, carbs_g, calories, protein_g, fat_g, ...}]}
    """
    import base64

    # ── Step 1: CNN Primary — always runs ──────────────────────────────────
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
        logger.warning("CNN model failed: %s — falling back to API only", e)

    # ── Step 2: Vision API Enrichment — try to get food item names ─────────
    api_result = None
    if OPENROUTER_API_KEY:
        try:
            api_result = _call_vision_api(image_bytes, mime_type)
            if api_result:
                logger.info(
                    "API identified %d items for '%s'",
                    len(api_result.get("items", [])), api_result.get("meal_name", "?"),
                )
        except Exception as e:
            logger.warning("Vision API failed: %s — using CNN results only", e)

    # ── Step 3: Merge results ──────────────────────────────────────────────
    if api_result and api_result.get("items"):
        # API returned item-level detail — use it (it includes names + nutrition)
        # Override API totals with CNN nutrition if CNN is available (more accurate)
        if cnn_result:
            api_result["cnn_totals"] = {
                "calories": cnn_result.get("calories", 0),
                "carbs_g": cnn_result.get("carbs_g", 0),
                "fat_g": cnn_result.get("fat_g", 0),
                "protein_g": cnn_result.get("protein_g", 0),
                "mass_g": cnn_result.get("mass_g", 0),
            }
        return api_result

    if cnn_result:
        # API unavailable — return CNN results as a single item
        logger.info("Using CNN-only results (API unavailable)")
        return {
            "meal_name": cnn_result.get("meal_name", "Detected Meal"),
            "items": [
                {
                    "food_name": "Detected Meal (CNN estimate)",
                    "quantity_desc": f"~{cnn_result.get('mass_g', 0):.0f}g",
                    "confidence_pct": 80.0,
                    "carbs_g": cnn_result.get("carbs_g", 0),
                    "calories": cnn_result.get("calories", 0),
                    "protein_g": cnn_result.get("protein_g", 0),
                    "fat_g": cnn_result.get("fat_g", 0),
                }
            ],
        }

    # Both failed
    raise HTTPException(
        status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
        detail="Unable to analyze meal image. Please try again.",
    )


def _call_vision_api(image_bytes: bytes, mime_type: str) -> dict | None:
    """
    Call OpenRouter Vision API to identify individual food items.
    Returns parsed JSON dict or None on failure.
    """
    import base64

    b64_img = base64.b64encode(image_bytes).decode("utf-8")
    data_url = f"data:{mime_type};base64,{b64_img}"

    prompt = (
        "Analyze this food image carefully. Identify EVERY distinct food item "
        "visible on the plate separately (e.g., Roasted Chicken, Mashed Potatoes, "
        "Green Peas, Rice, Bread). Do NOT group them into one generic item.\n\n"
        "For EACH individual food item, estimate its nutritional content.\n\n"
        "Return ONLY valid JSON with NO markdown formatting, NO explanation:\n"
        '{\n'
        '  "meal_name": "A descriptive name for the whole plate",\n'
        '  "items": [\n'
        '    {\n'
        '      "food_name": "Specific item name",\n'
        '      "quantity_desc": "Estimated portion",\n'
        '      "confidence_pct": 95.0,\n'
        '      "carbs_g": 0.0,\n'
        '      "calories": 250,\n'
        '      "protein_g": 25.0,\n'
        '      "fat_g": 15.0\n'
        '    }\n'
        '  ]\n'
        '}'
    )

    messages = [
        {
            "role": "user",
            "content": [
                {"type": "image_url", "image_url": {"url": data_url}},
                {"type": "text", "text": prompt},
            ],
        }
    ]

    # Try the primary vision model, then fallbacks on failure
    models_to_try = [OPENROUTER_VISION_MODEL] + VISION_FALLBACK_MODELS

    for vision_model in models_to_try:
        text = _call_openrouter(messages, max_tokens=1500, model=vision_model, timeout=3)
        logger.info("Vision model (%s) raw response: %s", vision_model, text[:300])

        # Strip markdown fences if present
        cleaned = text
        if cleaned.startswith("```"):
            cleaned = cleaned.split("```")[1]
            if cleaned.startswith("json"):
                cleaned = cleaned[4:]
        cleaned = cleaned.strip()

        try:
            result = json.loads(cleaned)
            logger.info("Parsed meal result from %s: %s", vision_model, result)
            return result
        except json.JSONDecodeError as e:
            logger.warning("Model %s returned non-JSON — trying next...", vision_model)
            continue

    return None  # All models failed


def predict_screening_risk(answers_text: str) -> dict:
    """
    Send screening answers to OpenRouter to predict diabetes risk.
    """
    messages = [
        {
            "role": "system",
            "content": "You are a medical AI. Respond ONLY with valid JSON, no markdown.",
        },
        {
            "role": "user",
            "content": (
                "Based on the following patient screening answers, assess the diabetes risk level. "
                "The answers are: " + answers_text + "\n\n"
                'Return strictly this JSON structure: '
                '{"risk_level": "Low" | "Medium" | "High", "confidence_pct": 0.0, "notes": "Brief explanation"}'
            ),
        },
    ]

    try:
        text = _call_openrouter(messages)

        # Clean up possible markdown wrappers
        if text.startswith("```json"):
            text = text[7:]
        if text.startswith("```"):
            text = text[3:]
        if text.endswith("```"):
            text = text[:-3]

        return json.loads(text.strip())
    except json.JSONDecodeError:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="AI returned invalid JSON format"
        )