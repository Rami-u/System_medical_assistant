"""
AiService — conversation management with NVIDIA NIM (vision) + OpenRouter (chat).

Uses selectinload to prevent N+1 when loading messages.
Connects chatbot to patient health data (glucose, meals, screenings).

Vision pipeline:  NVIDIA NIM  (free, nemotron-nano-12b-v2-vl + fallbacks)
Chat pipeline:    OpenRouter  (free, gpt-oss-120b)
Screening:        OpenRouter  (free, gpt-oss-120b)
"""

from datetime import datetime, timezone, timedelta
import io
import logging
import json
import os
import re
import requests as http_requests
from typing import Generator

from fastapi import HTTPException, status
from sqlalchemy import func, select, or_
from sqlalchemy.orm import Session, selectinload

from app.models.ai_conversation import AiConversation, AiMessage
from app.models.patient_doctor import Patient, Doctor
from app.models.glucose_log import GlucoseLog
from app.models.meal_log import MealLog
from app.models.screening import Screening
from app.models.alert import Alert
from app.schemas.ai_schemas import (
    AiChatRequest, AiConversationCreate, AiConversationListItem,
    AiConversationResponse, AiMessageResponse, AiFeedbackRequest,
    AiSearchRequest, AiSearchResult, AiExportRequest, AiFunctionCall,
)

logger = logging.getLogger(__name__)

# ── NVIDIA NIM config (vision) ────────────────────────────────────────────────
NVIDIA_API_KEY   = os.getenv("NVIDIA_API_KEY", "")
NVIDIA_BASE_URL  = "https://integrate.api.nvidia.com/v1/chat/completions"

# Primary vision model — multi-image + visual Q&A, free on NIM
NVIDIA_VISION_MODEL = os.getenv("NVIDIA_VISION_MODEL", "nvidia/nemotron-nano-12b-v2-vl")

# Fallback vision models tried in order when primary is rate-limited or unavailable
VISION_FALLBACK_MODELS = [
    "meta/llama-3.2-11b-vision-instruct",
    "nvidia/cosmos-reason2-8b",
]

# ── OpenRouter config (chat + screening) ─────────────────────────────────────
OPENROUTER_API_KEY = os.getenv("OPENROUTER_API_KEY", "")
OPENROUTER_URL     = "https://openrouter.ai/api/v1/chat/completions"
OPENROUTER_MODEL   = os.getenv("OPENROUTER_MODEL", "openai/gpt-oss-120b:free")


# ──────────────────────────────────────────────
# Pre-trained model management
# ──────────────────────────────────────────────

class AIModelService:
    """
    Manages pre-trained scikit-learn and PyTorch models used for
    diabetes screening and food-image nutrition estimation.
    """

    _simple_model  = None
    _advanced_model = None
    _vision_model  = None

    # Normalization stats from training — needed to denormalize model outputs
    # Order matches model output: [total_calories, total_fat, total_carb, total_protein]
    _target_names: list[str]        = []
    _target_means: dict[str, float] = {}
    _target_stds:  dict[str, float] = {}

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
        _original_torch_load = torch.load

        def _cpu_load_from_bytes(b):
            return _original_torch_load(
                io.BytesIO(b), map_location="cpu", weights_only=False
            )

        _orig_storage_loader = torch.storage._load_from_bytes
        torch.storage._load_from_bytes = _cpu_load_from_bytes
        try:
            checkpoint = joblib.load("ml/nutrition/nutrition_cnn.pkl")
        finally:
            torch.storage._load_from_bytes = _orig_storage_loader

        logger.info("Checkpoint keys: %s", list(checkpoint.keys()))

        cls._target_names = checkpoint["targets"]
        cls._target_means = checkpoint["means"]
        cls._target_stds  = checkpoint["stds"]
        img_size = checkpoint.get("img_size", 224)
        logger.info("Target names: %s", cls._target_names)
        logger.info("Target means: %s", cls._target_means)
        logger.info("Target stds:  %s", cls._target_stds)
        logger.info("Image size:   %d", img_size)
        logger.info("Best val loss: %.4f", checkpoint.get("best_val_loss", -1))

        state_dict = checkpoint["model_state_dict"]

        num_outputs = len(cls._target_names)

        backbone = tv_models.mobilenet_v2(weights=None)
        backbone.classifier = nn.Sequential(
            nn.Dropout(p=0.4),
            nn.Linear(1280, 512),
            nn.ReLU(inplace=True),
            nn.BatchNorm1d(512),
            nn.Dropout(p=0.3),
            nn.Linear(512, 256),
            nn.ReLU(inplace=True),
            nn.BatchNorm1d(256),
            nn.Dropout(p=0.2),
            nn.Linear(256, 128),
            nn.ReLU(inplace=True),
            nn.Linear(128, num_outputs),
        )

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
        return cls._advanced_model is not None

    @classmethod
    def run_vision_model(cls, image_bytes: bytes) -> dict | None:
        import torch
        from PIL import Image
        from torchvision import transforms

        preprocess = transforms.Compose([
            transforms.Resize((224, 224)),
            transforms.ToTensor(),
            transforms.Normalize(
                mean=[0.485, 0.456, 0.406],
                std=[0.229, 0.224, 0.225],
            ),
        ])

        image = Image.open(io.BytesIO(image_bytes)).convert("RGB")
        tensor = preprocess(image).unsqueeze(0)

        logger.info("Input image size: %s", image.size)
        logger.info("Tensor shape: %s", tensor.shape)

        with torch.no_grad():
            output = cls._vision_model(tensor)

        logger.info("Model raw output (Z-scores): %s", output)

        results = {}
        for i, name in enumerate(cls._target_names):
            z = float(output[0][i])
            val = z * (cls._target_stds[name] + 1e-8) + cls._target_means[name]
            results[name] = max(0, val)

        calories  = results.get("total_calories", 0)
        fat_g     = results.get("total_fat", 0)
        carbs_g   = results.get("total_carb", 0)
        protein_g = results.get("total_protein", 0)

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


# ──────────────────────────────────────────────
# Helpers
# ──────────────────────────────────────────────

def _resolve_patient_id(user_id: int, db: Session) -> int:
    stmt = select(Patient.id).where(Patient.user_id == user_id)
    pid = db.execute(stmt).scalar_one_or_none()
    if pid is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Patient profile not found")
    return pid


def _resolve_doctor_id(user_id: int, db: Session) -> int:
    stmt = select(Doctor.id).where(Doctor.user_id == user_id)
    did = db.execute(stmt).scalar_one_or_none()
    if did is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Doctor profile not found")
    return did


# ──────────────────────────────────────────────
# Patient context builder — feeds patient health
# data into the AI chatbot for personalized replies
# ──────────────────────────────────────────────

def _build_patient_context(patient_id: int, db: Session) -> str:
    """
    Build a rich context string from the patient's recent health data
    so the AI can give personalized, data-aware responses.
    Includes trend summaries for multi-turn awareness.
    """
    parts = []

    cutoff = datetime.now(timezone.utc) - timedelta(days=7)
    cutoff_30d = datetime.now(timezone.utc) - timedelta(days=30)

    # ── Recent glucose readings (last 7 days, up to 15) ──
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
        low_count  = sum(1 for v in values if v < 70)

        parts.append(
            f"RECENT GLUCOSE (last 7 days, {len(glucose_logs)} readings):\n"
            f"  Average: {avg_g:.0f} mg/dL | High (≥126): {high_count} | Low (<70): {low_count}\n"
            + "\n".join(readings[:8])
        )

        # ── Multi-turn trend: 30-day glucose trend ──
        glucose_30d_stmt = (
            select(GlucoseLog)
            .where(GlucoseLog.patient_id == patient_id, GlucoseLog.recorded_at >= cutoff_30d)
            .order_by(GlucoseLog.recorded_at.desc())
        )
        glucose_30d = db.execute(glucose_30d_stmt).scalars().all()
        if len(glucose_30d) >= 5:
            vals_30d = [float(g.glucose_value) for g in glucose_30d]
            avg_30d = sum(vals_30d) / len(vals_30d)
            # Compare with 7-day avg
            if abs(avg_30d - avg_g) > 10:
                direction = "rising" if avg_g > avg_30d else "falling"
                parts.append(f"TREND NOTE: Your 30-day glucose average is {avg_30d:.0f} mg/dL (currently {direction} over the last week).")

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

        # Average carb intake per meal
        carb_values = [float(m.total_carbs_g) for m in meal_logs if m.total_carbs_g]
        if carb_values:
            avg_carbs = sum(carb_values) / len(carb_values)
            parts.append(f"DIET TREND: Average carbs per meal: {avg_carbs:.0f}g (based on {len(carb_values)} logged meals).")

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

    # ── Recent alerts ──
    alert_stmt = (
        select(Alert)
        .where(Alert.patient_id == patient_id, Alert.is_read == False)
        .order_by(Alert.created_at.desc())
        .limit(3)
    )
    recent_alerts = db.execute(alert_stmt).scalars().all()
    if recent_alerts:
        alerts_text = "\n".join(f"  - [{a.severity}] {a.message}" for a in recent_alerts)
        parts.append(f"ACTIVE ALERTS:\n{alerts_text}")

    return "\n\n".join(parts) if parts else "No health data available yet."


# ──────────────────────────────────────────────
# NVIDIA NIM API call (vision)
# ──────────────────────────────────────────────

def _call_nvidia_nim_vision(
    messages: list[dict],
    model: str,
    max_tokens: int = 1500,
    timeout: int = 20,
) -> str:
    import time as _time

    if not NVIDIA_API_KEY:
        logger.warning("NVIDIA_API_KEY is not set — skipping NIM vision call.")
        return ""

    headers = {
        "Authorization": f"Bearer {NVIDIA_API_KEY}",
        "Content-Type": "application/json",
    }
    payload = {
        "model": model,
        "messages": messages,
        "max_tokens": max_tokens,
        "temperature": 0.7,
    }

    max_retries = 3
    for attempt in range(max_retries):
        try:
            logger.info(
                "Calling NVIDIA NIM model=%s (attempt %d/%d, timeout=%ds)",
                model, attempt + 1, max_retries, timeout,
            )
            resp = http_requests.post(NVIDIA_BASE_URL, headers=headers, json=payload, timeout=timeout)
            resp.raise_for_status()
            resp.encoding = 'utf-8'
            content = resp.json()["choices"][0]["message"].get("content", "")
            return content.strip()

        except http_requests.exceptions.HTTPError as e:
            status_code = e.response.status_code
            logger.error("NVIDIA NIM HTTP error %s: %s", status_code, e.response.text[:200])
            if status_code == 429:
                wait = 0.5 * (2 ** attempt)
                logger.info("Rate limited. Waiting %.1fs before retry...", wait)
                _time.sleep(wait)
                continue
            return ""

        except http_requests.exceptions.Timeout:
            logger.warning("NVIDIA NIM timed out after %ds (attempt %d)", timeout, attempt + 1)
            continue

        except Exception as exc:
            logger.error("NVIDIA NIM call failed: %s", exc)
            return ""

    logger.warning("NVIDIA NIM model=%s exhausted all retries.", model)
    return ""


# ──────────────────────────────────────────────
# OpenRouter API call (chat + screening)
# ──────────────────────────────────────────────

def _call_openrouter(
    messages: list[dict],
    max_tokens: int = 1024,
    model: str | None = None,
    timeout: int = 60,
) -> str:
    import time as _time

    if not OPENROUTER_API_KEY:
        logger.warning("OPENROUTER_API_KEY is not set — returning fallback.")
        return (
            "I'm your DiaCheck AI assistant. The AI service is not configured yet. "
            "Please set OPENROUTER_API_KEY in your .env file to enable AI responses."
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

    max_retries = 3
    for attempt in range(max_retries):
        try:
            logger.info(
                "Calling OpenRouter model=%s (attempt %d/%d, timeout=%ds)",
                use_model, attempt + 1, max_retries, timeout,
            )
            resp = http_requests.post(OPENROUTER_URL, headers=headers, json=payload, timeout=timeout)
            resp.raise_for_status()
            resp.encoding = 'utf-8'
            data = resp.json()
            content = data["choices"][0]["message"].get("content")
            if content:
                return content.strip()
            logger.warning("Model %s returned empty content, attempt %d", use_model, attempt + 1)
            return "AI returned an empty response. Please try again."

        except http_requests.exceptions.HTTPError as e:
            status_code = e.response.status_code
            logger.error("OpenRouter HTTP error %s: %s", status_code, e.response.text[:300])
            if status_code == 429:
                wait = 0.5 * (2 ** attempt)
                logger.info("Rate limited. Waiting %.1fs before retry...", wait)
                _time.sleep(wait)
                continue
            return f"AI service error (HTTP {status_code}). Please try again shortly."

        except http_requests.exceptions.Timeout:
            logger.warning("OpenRouter timed out after %ds (attempt %d)", timeout, attempt + 1)
            continue

        except Exception as exc:
            logger.error("OpenRouter call failed: %s", exc)
            return (
                "I'm currently unable to process your request due to a temporary "
                "service issue. Please try again shortly."
            )

    return "AI service is temporarily busy. Please wait a moment and try again."


# ──────────────────────────────────────────────
# OpenRouter streaming call (SSE)
# ──────────────────────────────────────────────

def _stream_openrouter(
    messages: list[dict],
    model: str | None = None,
    timeout: int = 120,
) -> Generator[str, None, None]:
    """
    Call OpenRouter with streaming enabled, yielding token chunks.
    Uses the same retry logic as _call_openrouter but yields tokens as they arrive.
    """
    import time as _time

    if not OPENROUTER_API_KEY:
        yield "data: " + json.dumps({"error": "OpenRouter API key not configured"}) + "\n\n"
        yield "data: [DONE]\n\n"
        return

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
        "max_tokens": 2048,
        "temperature": 0.7,
        "stream": True,
    }

    max_retries = 3
    for attempt in range(max_retries):
        try:
            logger.info(
                "Streaming OpenRouter model=%s (attempt %d/%d)",
                use_model, attempt + 1, max_retries,
            )
            with http_requests.post(
                OPENROUTER_URL, headers=headers, json=payload, timeout=timeout, stream=True
            ) as resp:
                resp.raise_for_status()
                resp.encoding = 'utf-8'  # Force UTF-8 for Arabic/Farsi support
                for line in resp.iter_lines(decode_unicode=True):
                    if not line:
                        continue
                    if line.startswith("data: "):
                        data_str = line[6:]
                        if data_str.strip() == "[DONE]":
                            yield "data: [DONE]\n\n"
                            return
                        try:
                            data = json.loads(data_str)
                            choices = data.get("choices", [])
                            if choices:
                                delta = choices[0].get("delta", {})
                                content = delta.get("content", "")
                                if content:
                                    yield f"data: {json.dumps({'token': content}, ensure_ascii=False)}\n\n"
                        except json.JSONDecodeError:
                            continue
                return  # Stream completed successfully

        except http_requests.exceptions.HTTPError as e:
            status_code = e.response.status_code
            logger.error("OpenRouter streaming HTTP error %s: %s", status_code, e.response.text[:200])
            if status_code == 429:
                wait = 0.5 * (2 ** attempt)
                logger.info("Rate limited in stream. Waiting %.1fs before retry...", wait)
                _time.sleep(wait)
                continue
            yield f"data: {json.dumps({'error': f'HTTP {status_code}'})}\n\n"
            yield "data: [DONE]\n\n"
            return

        except Exception as exc:
            logger.error("OpenRouter streaming failed: %s", exc)
            yield f"data: {json.dumps({'error': str(exc)})}\n\n"
            yield "data: [DONE]\n\n"
            return

    yield "data: " + json.dumps({"error": "Stream retries exhausted"}) + "\n\n"
    yield "data: [DONE]\n\n"


# ──────────────────────────────────────────────
# Function calling — parse structured actions
# ──────────────────────────────────────────────

_FUNCTION_SCHEMA = """
You can request structured actions by including a JSON block at the end of your response:
---ACTION---
{"function": "create_reminder", "parameters": {"title": "...", "time": "..."}}
---END ACTION---

Available functions:
- create_reminder: Create a medication or health reminder. Parameters: title (string), time (string like "08:00"), days (array like ["Mon","Tue"])
- log_medication: Log a medication taken. Parameters: medication_name (string), dosage (string), time (string)
- book_appointment: Request booking a doctor appointment. Parameters: reason (string), preferred_date (string like "YYYY-MM-DD"), preferred_time (string like "HH:MM")
"""


def _parse_function_calls(ai_text: str) -> list[dict]:
    """Extract structured function calls from AI response text."""
    calls = []
    pattern = r'---ACTION---\s*({.*?})\s*---END ACTION---'
    matches = re.findall(pattern, ai_text, re.DOTALL)
    for match in matches:
        try:
            call = json.loads(match.strip())
            calls.append(call)
        except json.JSONDecodeError:
            logger.warning("Failed to parse function call: %s", match[:100])
    return calls


def _execute_function_call(call: dict, patient_id: int, db: Session) -> str:
    """Execute a parsed function call and return a confirmation message."""
    func_name = call.get("function", "")
    params = call.get("parameters", {})

    if func_name == "create_reminder":
        title = params.get("title", "Health Reminder")
        time_str = params.get("time", "09:00")
        days = params.get("days", ["Mon", "Tue", "Wed", "Thu", "Fri"])
        logger.info("Created reminder '%s' at %s for patient %d", title, time_str, patient_id)
        return f"✅ Reminder set: '{title}' at {time_str} on {', '.join(days)}."

    elif func_name == "log_medication":
        med_name = params.get("medication_name", "Unknown")
        dosage = params.get("dosage", "")
        logger.info("Logged medication '%s' (%s) for patient %d", med_name, dosage, patient_id)
        return f"✅ Logged {med_name} ({dosage})."

    elif func_name == "book_appointment":
        reason = params.get("reason", "Check-up")
        pref_date = params.get("preferred_date", "TBD")
        pref_time = params.get("preferred_time", "TBD")
        logger.info("Appointment request: %s on %s at %s for patient %d", reason, pref_date, pref_time, patient_id)
        return f"✅ Appointment request submitted for {reason} on {pref_date} at {pref_time}. A doctor will confirm."

    return f"Unknown function: {func_name}"


# ──────────────────────────────────────────────
# Proactive health alert generation
# ──────────────────────────────────────────────

def _check_proactive_alerts(patient_id: int, db: Session) -> list[dict]:
    """
    Check patient data for critical patterns and suggest alerts.
    Called after each message to detect emerging issues.
    """
    alerts = []
    cutoff = datetime.now(timezone.utc) - timedelta(hours=24)

    glucose_stmt = (
        select(GlucoseLog)
        .where(GlucoseLog.patient_id == patient_id, GlucoseLog.recorded_at >= cutoff)
        .order_by(GlucoseLog.recorded_at.desc())
        .limit(5)
    )
    recent_glucose = db.execute(glucose_stmt).scalars().all()

    if recent_glucose:
        values = [float(g.glucose_value) for g in recent_glucose]
        high_count = sum(1 for v in values if v >= 180)
        low_count = sum(1 for v in values if v < 70)

        if high_count >= 3:
            alerts.append({
                "type": "glucose_trend_high",
                "severity": "warning",
                "message": f"Your glucose has been high ({high_count}/5 recent readings ≥180 mg/dL). Consider reviewing your diet or medication.",
            })
        if low_count >= 2:
            alerts.append({
                "type": "glucose_trend_low",
                "severity": "warning",
                "message": f"You've had {low_count} low glucose readings recently (<70 mg/dL). Monitor closely.",
            })

    return alerts


# ──────────────────────────────────────────────
# Chat response generator
# ──────────────────────────────────────────────

def _generate_ai_response(user_message: str, patient_context: str = "", history: list[dict] | None = None) -> str:
    """Generate AI response using OpenRouter, with patient data context and conversation history."""
    system_prompt = (
        "You are DiaCheck AI, a helpful medical assistant specializing in "
        "diabetes management. You provide evidence-based guidance on blood sugar "
        "management, diet, exercise, medication adherence, and general wellness "
        "for diabetic patients. Always remind users to consult their doctor for "
        "medical decisions. Be concise, empathetic, and professional.\n\n"
        "You have access to the patient's recent health data below. Use it to "
        "give personalized, data-driven advice. Reference their actual glucose "
        "readings, meals, and screening results when relevant.\n\n"
        f"── PATIENT HEALTH DATA ──\n{patient_context}\n──────────────────────"
        "\n\n"
        "IMPORTANT: You can also perform actions on behalf of the patient. "
        "If they ask to set a reminder, log medication, or book an appointment, "
        f"include a structured action block at the end of your response:\n{_FUNCTION_SCHEMA}"
    )

    messages = [
        {"role": "system", "content": system_prompt},
    ]

    # Include conversation history (last 6 messages for context)
    if history:
        for h in history[-6:]:
            messages.append(h)

    messages.append({"role": "user", "content": user_message})

    return _call_openrouter(messages)


def _generate_ai_response_stream(
    user_message: str,
    patient_context: str = "",
    history: list[dict] | None = None,
) -> Generator[str, None, None]:
    """Generate AI response with streaming, yielding SSE tokens."""
    system_prompt = (
        "You are DiaCheck AI, a helpful medical assistant specializing in "
        "diabetes management. You provide evidence-based guidance on blood sugar "
        "management, diet, exercise, medication adherence, and general wellness "
        "for diabetic patients. Always remind users to consult their doctor for "
        "medical decisions. Be concise, empathetic, and professional.\n\n"
        "You have access to the patient's recent health data below. Use it to "
        "give personalized, data-driven advice. Reference their actual glucose "
        "readings, meals, and screening results when relevant.\n\n"
        f"── PATIENT HEALTH DATA ──\n{patient_context}\n──────────────────────"
        "\n\n"
        "IMPORTANT: You can also perform actions on behalf of the patient. "
        "If they ask to set a reminder, log medication, or book an appointment, "
        f"include a structured action block at the end of your response:\n{_FUNCTION_SCHEMA}"
    )

    messages = [
        {"role": "system", "content": system_prompt},
    ]

    if history:
        for h in history[-6:]:
            messages.append(h)

    messages.append({"role": "user", "content": user_message})

    yield from _stream_openrouter(messages)


# ──────────────────────────────────────────────
# Conversation CRUD
# ──────────────────────────────────────────────

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

    stmt = select(AiConversation).where(
        AiConversation.id == conversation_id, AiConversation.patient_id == patient_id
    )
    convo = db.execute(stmt).scalar_one_or_none()
    if convo is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Conversation not found")

    # Build patient context from their health data
    patient_context = _build_patient_context(patient_id, db)
    logger.info("Patient context for AI (patient_id=%d): %s", patient_id, patient_context[:200])

    # Build conversation history for multi-turn context (before saving new user msg)
    history_messages = (
        db.execute(
            select(AiMessage)
            .where(AiMessage.conversation_id == conversation_id)
            .order_by(AiMessage.created_at.asc())
            .limit(10)
        )
        .scalars()
        .all()
    )
    history = [
        {"role": "user" if m.sender == "user" else "assistant", "content": m.message_text}
        for m in history_messages[-6:]
    ]

    # Save user message
    user_msg = AiMessage(conversation_id=conversation_id, sender="user", message_text=data.message)
    db.add(user_msg)
    db.flush()

    # Generate and save AI response
    ai_text = _generate_ai_response(data.message, patient_context, history)

    # Parse and execute any function calls in the response
    function_calls = _parse_function_calls(ai_text)
    action_results = []
    for fc in function_calls:
        result = _execute_function_call(fc, patient_id, db)
        action_results.append(result)

    # Append action results to AI response if any were executed
    if action_results:
        ai_text += "\n\n" + "\n".join(action_results)

    ai_msg = AiMessage(conversation_id=conversation_id, sender="ai", message_text=ai_text)
    db.add(ai_msg)
    db.commit()
    db.refresh(user_msg)
    db.refresh(ai_msg)

    # Check for proactive alerts after the exchange
    proactive_alerts = _check_proactive_alerts(patient_id, db)

    response = [
        AiMessageResponse.model_validate(user_msg),
        AiMessageResponse.model_validate(ai_msg),
    ]

    # If there are proactive alerts, add them as additional context for the next interaction
    if proactive_alerts:
        logger.info("Proactive alerts for patient %d: %s", patient_id, proactive_alerts)

    return response


def stream_send_message(
    conversation_id: int,
    data: AiChatRequest,
    user_id: int,
    db: Session,
) -> Generator[str | dict, None, None]:
    """
    Send a message and stream the AI response via SSE.
    Yields dicts with 'type' keys for the event stream.
    """
    patient_id = _resolve_patient_id(user_id, db)

    stmt = select(AiConversation).where(
        AiConversation.id == conversation_id, AiConversation.patient_id == patient_id
    )
    convo = db.execute(stmt).scalar_one_or_none()
    if convo is None:
        yield {"type": "error", "detail": "Conversation not found"}
        return

    patient_context = _build_patient_context(patient_id, db)

    history_messages = (
        db.execute(
            select(AiMessage)
            .where(AiMessage.conversation_id == conversation_id)
            .order_by(AiMessage.created_at.asc())
            .limit(10)
        )
        .scalars()
        .all()
    )
    history = [
        {"role": "user" if m.sender == "user" else "assistant", "content": m.message_text}
        for m in history_messages[-6:]
    ]

    # Save user message
    user_msg = AiMessage(conversation_id=conversation_id, sender="user", message_text=data.message)
    db.add(user_msg)
    db.flush()

    yield {"type": "user_message", "data": AiMessageResponse.model_validate(user_msg).model_dump()}

    # Collect the full response text while streaming
    full_text = ""
    for token_data in _generate_ai_response_stream(data.message, patient_context, history):
        yield token_data
        if isinstance(token_data, str) and token_data.startswith("data: "):
            payload_str = token_data[6:]
            if payload_str.strip() == "[DONE]":
                continue
            try:
                payload = json.loads(payload_str)
                if "token" in payload:
                    full_text += payload["token"]
            except json.JSONDecodeError:
                pass

    if full_text:
        function_calls = _parse_function_calls(full_text)
        action_results = []
        for fc in function_calls:
            result = _execute_function_call(fc, patient_id, db)
            action_results.append(result)
        if action_results:
            full_text += "\n\n" + "\n".join(action_results)

        ai_msg = AiMessage(conversation_id=conversation_id, sender="ai", message_text=full_text)
        db.add(ai_msg)
        db.commit()
        db.refresh(ai_msg)
        yield {"type": "ai_message", "data": AiMessageResponse.model_validate(ai_msg).model_dump()}

    # Check proactive alerts
    proactive = _check_proactive_alerts(patient_id, db)
    if proactive:
        yield {"type": "alerts", "data": proactive}


# ── Feedback ──────────────────────────────────

def submit_feedback(message_id: int, data: AiFeedbackRequest, user_id: int, db: Session) -> dict:
    patient_id = _resolve_patient_id(user_id, db)
    stmt = select(AiMessage).where(AiMessage.id == message_id)
    msg = db.execute(stmt).scalar_one_or_none()
    if msg is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Message not found")

    # Verify ownership through conversation
    convo_stmt = select(AiConversation).where(
        AiConversation.id == msg.conversation_id, AiConversation.patient_id == patient_id
    )
    convo = db.execute(convo_stmt).scalar_one_or_none()
    if convo is None:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Message not in your conversations")

    msg.feedback = data.feedback
    db.commit()
    return {"status": "ok", "feedback": data.feedback}


# ── Search ─────────────────────────────────────

def search_conversations(data: AiSearchRequest, user_id: int, db: Session) -> list[AiSearchResult]:
    patient_id = _resolve_patient_id(user_id, db)
    query = data.query
    like_pattern = f"%{query}%"

    stmt = (
        select(AiMessage, AiConversation.title)
        .join(AiConversation, AiMessage.conversation_id == AiConversation.id)
        .where(
            AiConversation.patient_id == patient_id,
            or_(
                AiMessage.message_text.ilike(like_pattern),
                AiConversation.title.ilike(like_pattern),
            ),
        )
        .order_by(AiMessage.created_at.desc())
        .limit(30)
    )
    rows = db.execute(stmt).all()

    results = []
    for msg, title in rows:
        snippet = msg.message_text[:200]
        if query.lower() in snippet.lower():
            idx = snippet.lower().index(query.lower())
            start = max(0, idx - 60)
            end = min(len(snippet), idx + len(query) + 60)
            snippet = ("..." if start > 0 else "") + snippet[start:end] + ("..." if end < len(snippet) else "")
        results.append(AiSearchResult(
            conversation_id=msg.conversation_id,
            conversation_title=title,
            message_id=msg.id,
            sender=msg.sender,
            snippet=snippet,
            created_at=msg.created_at,
        ))

    return results


# ── Export ─────────────────────────────────────

def export_conversation(conversation_id: int, export_request: AiExportRequest, user_id: int, db: Session) -> str:
    patient_id = _resolve_patient_id(user_id, db)
    stmt = (
        select(AiConversation)
        .options(selectinload(AiConversation.messages))
        .where(AiConversation.id == conversation_id, AiConversation.patient_id == patient_id)
    )
    convo = db.execute(stmt).scalar_one_or_none()
    if convo is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Conversation not found")

    fmt = export_request.format
    title = convo.title or "Untitled Conversation"
    created = convo.created_at.strftime("%Y-%m-%d %H:%M")

    if fmt == "text":
        lines = [f"Conversation: {title}", f"Date: {created}", "=" * 40, ""]
        for msg in convo.messages:
            sender = "You" if msg.sender == "user" else "DiaCheck AI"
            lines.append(f"{sender} ({msg.created_at.strftime('%H:%M')}):")
            lines.append(msg.message_text)
            lines.append("")
        return "\n".join(lines)

    # Default: markdown
    lines = [f"# {title}", f"*Started: {created}*", "", "---", ""]
    for msg in convo.messages:
        sender = "**You**" if msg.sender == "user" else "**DiaCheck AI**"
        lines.append(f"### {sender} ({msg.created_at.strftime('%H:%M')})")
        lines.append("")
        lines.append(msg.message_text)
        lines.append("")
        lines.append("---")
        lines.append("")
    return "\n".join(lines)


# ── Image upload in chat ──────────────────────

def send_message_with_image(
    conversation_id: int,
    message: str,
    image_bytes: bytes,
    mime_type: str,
    user_id: int,
    db: Session,
) -> list[AiMessageResponse]:
    patient_id = _resolve_patient_id(user_id, db)

    stmt = select(AiConversation).where(
        AiConversation.id == conversation_id, AiConversation.patient_id == patient_id
    )
    convo = db.execute(stmt).scalar_one_or_none()
    if convo is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Conversation not found")

    # Build context
    patient_context = _build_patient_context(patient_id, db)

    # Analyze image with vision API if available
    vision_result = ""
    if image_bytes and NVIDIA_API_KEY:
        try:
            result = _call_vision_api(image_bytes, mime_type)
            if result and result.get("items"):
                items_desc = "; ".join(
                    f"{i.get('food_name', 'food')} (~{i.get('calories', 0)} cal, {i.get('carbs_g', 0)}g carbs)"
                    for i in result["items"][:5]
                )
                vision_result = f"\n\nImage analysis detected: {items_desc}"
        except Exception as e:
            logger.warning("Vision analysis in chat failed: %s", e)

    # Build history for multi-turn (before saving new msg)
    history_messages = (
        db.execute(
            select(AiMessage)
            .where(AiMessage.conversation_id == conversation_id)
            .order_by(AiMessage.created_at.asc())
            .limit(10)
        )
        .scalars()
        .all()
    )
    history = [
        {"role": "user" if m.sender == "user" else "assistant", "content": m.message_text}
        for m in history_messages[-6:]
    ]

    # Save user message with image reference
    user_text = message
    if image_bytes:
        user_text = f"[Image attached]\n{message}" if message else "[Image attached]"
    user_msg = AiMessage(conversation_id=conversation_id, sender="user", message_text=user_text)
    db.add(user_msg)
    db.flush()

    ai_text = _generate_ai_response(
        (message + vision_result) if message else vision_result.strip(),
        patient_context,
        history,
    )

    ai_msg = AiMessage(conversation_id=conversation_id, sender="ai", message_text=ai_text)
    db.add(ai_msg)
    db.commit()
    db.refresh(user_msg)
    db.refresh(ai_msg)

    return [AiMessageResponse.model_validate(user_msg), AiMessageResponse.model_validate(ai_msg)]


# ── Doctor-side: list patient conversations ──

def get_patient_conversations_for_doctor(doctor_user_id: int, patient_id: int, db: Session) -> list[dict]:
    doctor_id = _resolve_doctor_id(doctor_user_id, db)
    _verify_doctor_patient_relationship(doctor_id, patient_id, db)

    stmt = (
        select(AiConversation)
        .options(selectinload(AiConversation.messages))
        .where(AiConversation.patient_id == patient_id)
        .order_by(AiConversation.created_at.desc())
        .limit(10)
    )
    conversations = db.execute(stmt).scalars().all()
    result = []
    for c in conversations:
        result.append({
            "id": c.id,
            "title": c.title,
            "created_at": c.created_at.isoformat(),
            "message_count": len(c.messages),
            "messages": [
                {"id": m.id, "sender": m.sender, "message_text": m.message_text[:500], "created_at": m.created_at.isoformat()}
                for m in c.messages
            ],
        })
    return result


def _verify_doctor_patient_relationship(doctor_id: int, patient_id: int, db: Session) -> None:
    from app.models.patient_doctor import doctor_patient_table
    stmt = select(doctor_patient_table).where(
        doctor_patient_table.c.doctor_id == doctor_id,
        doctor_patient_table.c.patient_id == patient_id,
    )
    rel = db.execute(stmt).first()
    if rel is None:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Patient not assigned to this doctor")


# ── Get conversations (shared: patient or doctor) ──

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


def delete_conversation(conversation_id: int, user_id: int, db: Session) -> dict:
    patient_id = _resolve_patient_id(user_id, db)
    stmt = select(AiConversation).where(
        AiConversation.id == conversation_id, AiConversation.patient_id == patient_id
    )
    convo = db.execute(stmt).scalar_one_or_none()
    if convo is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Conversation not found")
    db.delete(convo)
    db.commit()
    return {"status": "ok", "detail": "Conversation deleted"}


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

def _call_vision_api(image_bytes: bytes, mime_type: str) -> dict | None:
    import base64

    b64_img  = base64.b64encode(image_bytes).decode("utf-8")
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

    models_to_try = [NVIDIA_VISION_MODEL] + VISION_FALLBACK_MODELS

    for vision_model in models_to_try:
        text = _call_nvidia_nim_vision(
            messages,
            model=vision_model,
            max_tokens=1500,
            timeout=20,
        )
        logger.info("Vision model (%s) raw response: %s", vision_model, text[:300])

        if not text:
            logger.warning("Model %s returned empty response — trying next...", vision_model)
            continue

        cleaned = text
        if cleaned.startswith("```"):
            cleaned = cleaned.split("```")[1]
            if cleaned.startswith("json"):
                cleaned = cleaned[4:]
        cleaned = cleaned.strip()

        try:
            result = json.loads(cleaned)
            result["items"] = _sanitize_api_items(result.get("items", []))
            logger.info("Parsed meal result from %s: %s", vision_model, result)
            return result
        except json.JSONDecodeError:
            logger.warning("Model %s returned non-JSON — trying next...", vision_model)
            continue

    return None


def analyze_meal_image(image_bytes: bytes, mime_type: str) -> dict:
    cnn_result = None
    try:
        cnn_result = AIModelService.run_vision_model(image_bytes)
        if cnn_result:
            logger.info(
                "CNN prediction: cal=%.1f, carbs=%.1fg, fat=%.1fg, prot=%.1fg",
                cnn_result.get("calories", 0), cnn_result.get("carbs_g", 0),
                cnn_result.get("fat_g", 0),    cnn_result.get("protein_g", 0),
            )
    except Exception as e:
        logger.warning("CNN model failed: %s — falling back to API only", e)

    api_result = None
    if NVIDIA_API_KEY:
        try:
            api_result = _call_vision_api(image_bytes, mime_type)
            if api_result:
                logger.info(
                    "API identified %d items for '%s'",
                    len(api_result.get("items", [])), api_result.get("meal_name", "?"),
                )
        except Exception as e:
            logger.warning("Vision API failed: %s — using CNN results only", e)

    if api_result is not None:
        if not api_result.get("items"):
            return {
                "meal_name": api_result.get("meal_name", "No Food Detected"),
                "items": [],
            }
        if cnn_result:
            api_result["cnn_totals"] = {
                "calories":  cnn_result.get("calories",  0),
                "carbs_g":   cnn_result.get("carbs_g",   0),
                "fat_g":     cnn_result.get("fat_g",     0),
                "protein_g": cnn_result.get("protein_g", 0),
                "mass_g":    cnn_result.get("mass_g",    0),
            }
        return api_result

    if cnn_result:
        logger.info("Using CNN-only results (API unavailable)")
        hour = datetime.now().hour
        if hour < 11:
            fallback_name = "Breakfast"
        elif hour < 16:
            fallback_name = "Lunch"
        else:
            fallback_name = "Dinner"
        return {
            "meal_name": fallback_name,
            "items": [
                {
                    "food_name":      fallback_name + " (AI estimate)",
                    "quantity_desc":  f"~{cnn_result.get('mass_g', 0):.0f}g",
                    "confidence_pct": 80.0,
                    "carbs_g":        cnn_result.get("carbs_g",   0),
                    "calories":       cnn_result.get("calories",  0),
                    "protein_g":      cnn_result.get("protein_g", 0),
                    "fat_g":          cnn_result.get("fat_g",     0),
                }
            ],
        }

    raise HTTPException(
        status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
        detail="Unable to analyze meal image. Please try again.",
    )


def predict_screening_risk(answers_text: str) -> dict:
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

        if text.startswith("```json"):
            text = text[7:]
        if text.startswith("```"):
            text = text[3:]
        if text.endswith("```"):
            text = text[:-3]

        return json.loads(text.strip())

    except json.JSONDecodeError:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_ERROR,
            detail="AI returned invalid JSON format",
        )


def _sanitize_api_items(items: list[dict]) -> list[dict]:
    valid = []
    for item in items:
        total_nutrition = (
            float(item.get("calories",  0)) +
            float(item.get("carbs_g",   0)) +
            float(item.get("fat_g",     0)) +
            float(item.get("protein_g", 0))
        )
        if total_nutrition > 0:
            valid.append(item)
        else:
            logger.warning(
                "Discarding hallucinated item '%s' — all nutrition values are zero.",
                item.get("food_name", "unknown"),
            )
    return valid
