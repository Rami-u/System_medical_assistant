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
OPENROUTER_MODEL = os.getenv("OPENROUTER_MODEL", "meta-llama/llama-3.1-8b-instruct:free")
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

    @classmethod
    def load_models(cls) -> None:
        """Load all three pre-trained models from the models/ directory."""
        import joblib
        import torch
        import torch.nn as nn
        from torchvision import models as tv_models

        logger.info("Loading pre-trained models …")
        cls._simple_model = joblib.load("models/simple_model.pkl")
        cls._advanced_model = joblib.load("models/advanced_model.pkl")

        # ── Reconstruct Nutrition5k regression CNN from state_dict ──────────
        # best_model.pth is a NUTRITION REGRESSOR trained on Nutrition5k.
        # It predicts 4 continuous values: [calories, carbs_g, fat_g, protein_g]
        state_dict = torch.load("models/best_model.pth", map_location="cpu")

        # Log all keys so we can diagnose architecture mismatches
        logger.info("State dict top-level keys: %s", list(state_dict.keys())[:15])

        # Auto-detect the final linear layer to get num_outputs
        final_key = None
        for k in state_dict.keys():
            if k.endswith(".weight") and "classifier" in k:
                final_key = k  # keep updating — we want the LAST classifier weight

        if final_key is None:
            raise RuntimeError(
                f"Cannot find classifier weight in state_dict. "
                f"All keys: {list(state_dict.keys())}"
            )

        num_outputs = state_dict[final_key].shape[0]
        logger.info(
            "Detected num_outputs=%d from key '%s' (expected 4 for Nutrition5k)",
            num_outputs, final_key,
        )

        # Build EfficientNet-B3 with regression head (same architecture as training)
        backbone = tv_models.efficientnet_b3(weights=None)
        backbone.classifier = nn.Sequential(
            nn.Dropout(p=0.3),
            nn.Linear(1536, 512),
            nn.ReLU(),
            nn.BatchNorm1d(512),
            nn.Dropout(p=0.3),
            nn.Linear(512, 256),
            nn.ReLU(),
            nn.BatchNorm1d(256),
            nn.Dropout(p=0.3),
            nn.Linear(256, 128),
            nn.ReLU(),
            nn.Linear(128, num_outputs),  # 4 regression outputs
        )

        # Strip "backbone." prefix if the state_dict was saved with a wrapper
        cleaned = {k.replace("backbone.", "", 1): v for k, v in state_dict.items()}
        backbone.load_state_dict(cleaned, strict=True)
        backbone.eval()

        cls._vision_model = backbone
        logger.info(
            "Vision model loaded as NUTRITION REGRESSOR with %d outputs.",
            num_outputs,
        )

    @classmethod
    def models_ready(cls) -> bool:
        return all([cls._simple_model, cls._advanced_model, cls._vision_model])

    @classmethod
    def screening_ready(cls) -> bool:
        """Check only if screening models are loaded — does NOT require vision model."""
        return cls._advanced_model is not None

    # ── Vision: Nutrition5k regression CNN ──────────────────────────────────
    @classmethod
    def run_vision_model(cls, image_bytes: bytes) -> dict | None:
        """
        Run the Nutrition5k regression CNN on raw image bytes.

        The model is a NUTRITION REGRESSOR — it does NOT classify food names.
        Model output shape: [1, 4] → [calories, carbs_g, fat_g, protein_g]

        Returns a nutrition dict, or None on unexpected error.
        """
        import torch
        from PIL import Image
        from torchvision import transforms

        # Task 3: Standard ImageNet preprocessing (matches Nutrition5k training)
        preprocess = transforms.Compose([
            transforms.Resize((224, 224)),
            transforms.ToTensor(),
            transforms.Normalize(
                mean=[0.485, 0.456, 0.406],
                std=[0.229, 0.224, 0.225],
            ),
        ])

        # Task 3: Convert to RGB before transform
        image = Image.open(io.BytesIO(image_bytes)).convert("RGB")
        tensor = preprocess(image).unsqueeze(0)  # shape: (1, 3, 224, 224)

        # Task 4: Log input details
        logger.info("Input image size: %s", image.size)
        logger.info("Tensor shape: %s", tensor.shape)

        with torch.no_grad():
            output = cls._vision_model(tensor)  # shape: [1, 4]

        # Task 1 + 4: Log raw model output
        logger.info("Model output shape: %s", output.shape)
        logger.info("Model raw output: %s", output)

        # Task 1: Read regression outputs directly — NO softmax, NO argmax
        calories  = float(output[0][0])
        carbs_g   = float(output[0][1])
        fat_g     = float(output[0][2])
        protein_g = float(output[0][3])

        # Task 4: Log predicted nutrition values
        logger.info(
            "Predicted: calories=%.1f, carbs=%.1fg, fat=%.1fg, protein=%.1fg",
            calories, carbs_g, fat_g, protein_g,
        )

        # Task 2: Return generic nutrition response (model cannot name food)
        return {
            "meal_name": "Detected Meal",
            "calories":  round(calories,  1),
            "carbs_g":   round(carbs_g,   1),
            "fat_g":     round(fat_g,     1),
            "protein_g": round(protein_g, 1),
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

def _call_openrouter(messages: list[dict], max_tokens: int = 1024) -> str:
    """Call OpenRouter API with the given messages. Returns the AI text."""
    if not OPENROUTER_API_KEY:
        logger.warning("OPENROUTER_API_KEY is not set — returning fallback.")
        return (
            "I'm your Diacheck AI assistant. The AI service is not configured yet. "
            "Please set the OPENROUTER_API_KEY in your .env file to enable AI responses."
        )

    headers = {
        "Authorization": f"Bearer {OPENROUTER_API_KEY}",
        "Content-Type": "application/json",
        "HTTP-Referer": "http://localhost:5173",
        "X-Title": "DiaCheck Medical Assistant",
    }
    payload = {
        "model": OPENROUTER_MODEL,
        "messages": messages,
        "max_tokens": max_tokens,
        "temperature": 0.7,
    }

    try:
        resp = http_requests.post(OPENROUTER_URL, headers=headers, json=payload, timeout=30)
        resp.raise_for_status()
        data = resp.json()
        return data["choices"][0]["message"]["content"].strip()
    except http_requests.exceptions.HTTPError as e:
        logger.error("OpenRouter HTTP error %s: %s", e.response.status_code, e.response.text[:500])
        if e.response.status_code == 429:
            return "I'm currently experiencing high demand. Please try again in a moment."
        return f"AI service error (HTTP {e.response.status_code}). Please try again shortly."
    except Exception as exc:
        logger.error("OpenRouter call failed: %s", exc)
        return (
            "Thank you for your message. I'm your Diacheck AI assistant. "
            "I'm currently unable to process your request due to a temporary "
            "service issue. Please try again shortly or consult your doctor "
            "for immediate medical advice."
        )


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
    Use OpenRouter vision model to detect food items in an image.
    Falls back to the local CNN nutrition model if OpenRouter is not available.
    Returns {meal_name, items: [{food_name, quantity_desc, confidence_pct, carbs_g, ...}]}
    """
    import base64

    if not OPENROUTER_API_KEY:
        # Fallback to local CNN model
        result = AIModelService.run_vision_model(image_bytes)
        if result:
            return {
                "meal_name": result["meal_name"],
                "items": [{
                    "food_name": "Detected Meal",
                    "quantity_desc": "1 serving",
                    "confidence_pct": 75.0,
                    "carbs_g": result["carbs_g"],
                    "calories": result["calories"],
                    "protein_g": result["protein_g"],
                    "fat_g": result["fat_g"],
                }]
            }
        raise HTTPException(status_code=500, detail="Vision model failed")

    # Encode image to base64 for OpenRouter vision models
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

    try:
        text = _call_openrouter(messages, max_tokens=1500)
        logger.info("OpenRouter meal analysis raw: %s", text[:500])

        # Strip markdown fences
        if text.startswith("```"):
            text = text.split("```")[1]
            if text.startswith("json"):
                text = text[4:]
        text = text.strip()

        result = json.loads(text)
        logger.info("Parsed meal result: %s", result)
        return result
    except json.JSONDecodeError as e:
        logger.error("Meal JSON parse error: %s — raw: %s", e, text[:500])
        # Fallback to local CNN
        cnn_result = AIModelService.run_vision_model(image_bytes)
        if cnn_result:
            return {
                "meal_name": cnn_result["meal_name"],
                "items": [{
                    "food_name": "Detected Meal",
                    "quantity_desc": "1 serving",
                    "confidence_pct": 70.0,
                    "carbs_g": cnn_result["carbs_g"],
                    "calories": cnn_result["calories"],
                    "protein_g": cnn_result["protein_g"],
                    "fat_g": cnn_result["fat_g"],
                }]
            }
        raise HTTPException(status_code=500, detail="AI returned invalid JSON format")


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